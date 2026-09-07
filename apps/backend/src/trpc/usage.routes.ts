import { TRPCError } from '@trpc/server';
import { z } from 'zod/v4';

import * as usageQueries from '../queries/usage.queries';
import * as userProjectPreferenceQueries from '../queries/user-project-preference.queries';
import type { UserProjectPreferences } from '../types/usage';
import {
	DEFAULT_USAGE_PERIOD_SELECTION,
	MAX_SAVED_USAGE_PERIODS,
	SAVED_USAGE_PERIOD_LIMIT_MESSAGE,
	savedUsagePeriodInputSchema,
	savedUsagePeriodSchema,
	usageChartFilterSchema,
	usageFilterSchema,
	usagePeriodSelectionSchema,
} from '../types/usage';
import { adminProtectedProcedure } from './trpc';

const projectPreferenceInputSchema = z.object({ projectId: z.string().min(1) });
const updatePeriodSelectionInputSchema = projectPreferenceInputSchema.extend({
	selection: usagePeriodSelectionSchema,
});
const createSavedPeriodInputSchema = projectPreferenceInputSchema.extend({
	savedPeriod: savedUsagePeriodInputSchema,
});
const updateSavedPeriodInputSchema = projectPreferenceInputSchema.extend({
	savedPeriod: savedUsagePeriodSchema,
});
const deleteSavedPeriodInputSchema = projectPreferenceInputSchema.extend({
	id: savedUsagePeriodSchema.shape.id,
});
const legacySavedPeriodSelectionSchema = z.object({
	mode: z.literal('saved'),
	entryId: z.string().min(1),
});

export const usageRoutes = {
	getMessagesUsage: adminProtectedProcedure.input(usageChartFilterSchema).query(async ({ ctx, input }) => {
		return usageQueries.getMessagesUsage(ctx.project.id, input);
	}),

	getTotalUsage: adminProtectedProcedure.input(usageFilterSchema).query(async ({ ctx, input }) => {
		return usageQueries.getTotalUsage(ctx.project.id, input);
	}),

	getUsedProviders: adminProtectedProcedure.query(async ({ ctx }) => {
		return usageQueries.getUsedProviders(ctx.project.id);
	}),

	getPeriodSettings: adminProtectedProcedure.input(projectPreferenceInputSchema).query(async ({ ctx, input }) => {
		assertPreferenceProject(input.projectId, ctx.project.id);
		const preferences = await getSanitizedPeriodPreferences(ctx.user.id, ctx.project.id);
		return {
			selection: preferences.usagePeriod ?? null,
			savedPeriods: sanitizeSavedPeriods(preferences),
		};
	}),

	updatePeriodSelection: adminProtectedProcedure
		.input(updatePeriodSelectionInputSchema)
		.mutation(async ({ ctx, input }) => {
			assertPreferenceProject(input.projectId, ctx.project.id);
			const nextSelection = input.selection;
			const preferences = await userProjectPreferenceQueries.mutateUserProjectPreferences(
				ctx.user.id,
				ctx.project.id,
				(current) => {
					const sanitizedCurrent = sanitizePeriodSettings(current).preferences;
					if (nextSelection.mode !== 'saved') {
						return { ...sanitizedCurrent, usagePeriod: nextSelection };
					}
					const savedPeriods = sanitizeSavedPeriods(sanitizedCurrent);
					if (!savedPeriods.some(({ id }) => id === nextSelection.savedPeriodId)) {
						throw new TRPCError({ code: 'NOT_FOUND', message: 'Saved usage period not found.' });
					}
					return { ...sanitizedCurrent, usagePeriod: nextSelection };
				},
			);
			return preferences.usagePeriod;
		}),

	createSavedPeriod: adminProtectedProcedure.input(createSavedPeriodInputSchema).mutation(async ({ ctx, input }) => {
		assertPreferenceProject(input.projectId, ctx.project.id);
		const savedPeriod = { id: crypto.randomUUID(), ...input.savedPeriod };
		await userProjectPreferenceQueries.mutateUserProjectPreferences(ctx.user.id, ctx.project.id, (current) => {
			const sanitizedCurrent = sanitizePeriodSettings(current).preferences;
			const savedPeriods = sanitizeSavedPeriods(sanitizedCurrent);
			if (savedPeriods.length >= MAX_SAVED_USAGE_PERIODS) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: SAVED_USAGE_PERIOD_LIMIT_MESSAGE });
			}
			return {
				...sanitizedCurrent,
				usagePeriod: { mode: 'saved', savedPeriodId: savedPeriod.id },
				savedUsagePeriods: [...savedPeriods, savedPeriod],
			};
		});
		return savedPeriod;
	}),

	updateSavedPeriod: adminProtectedProcedure.input(updateSavedPeriodInputSchema).mutation(async ({ ctx, input }) => {
		assertPreferenceProject(input.projectId, ctx.project.id);
		const nextSavedPeriod = input.savedPeriod;
		await userProjectPreferenceQueries.mutateUserProjectPreferences(ctx.user.id, ctx.project.id, (current) => {
			const sanitizedCurrent = sanitizePeriodSettings(current).preferences;
			const savedPeriods = sanitizeSavedPeriods(sanitizedCurrent);
			if (!savedPeriods.some(({ id }) => id === nextSavedPeriod.id)) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Saved usage period not found.' });
			}
			return {
				...sanitizedCurrent,
				savedUsagePeriods: savedPeriods.map((savedPeriod) =>
					savedPeriod.id === nextSavedPeriod.id ? nextSavedPeriod : savedPeriod,
				),
			};
		});
		return nextSavedPeriod;
	}),

	deleteSavedPeriod: adminProtectedProcedure.input(deleteSavedPeriodInputSchema).mutation(async ({ ctx, input }) => {
		assertPreferenceProject(input.projectId, ctx.project.id);
		const preferences = await userProjectPreferenceQueries.mutateUserProjectPreferences(
			ctx.user.id,
			ctx.project.id,
			(current) => {
				const sanitizedCurrent = sanitizePeriodSettings(current).preferences;
				const savedPeriods = sanitizeSavedPeriods(sanitizedCurrent);
				if (!savedPeriods.some(({ id }) => id === input.id)) {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Saved usage period not found.' });
				}
				const usagePeriod =
					sanitizedCurrent.usagePeriod?.mode === 'saved' &&
					sanitizedCurrent.usagePeriod.savedPeriodId === input.id
						? DEFAULT_USAGE_PERIOD_SELECTION
						: sanitizedCurrent.usagePeriod;
				return {
					...sanitizedCurrent,
					usagePeriod,
					savedUsagePeriods: savedPeriods.filter(({ id }) => id !== input.id),
				};
			},
		);
		return { id: input.id, selection: preferences.usagePeriod };
	}),
};

function sanitizeSavedPeriods(preferences: UserProjectPreferences) {
	if (!Array.isArray(preferences.savedUsagePeriods)) {
		return [];
	}
	return preferences.savedUsagePeriods
		.flatMap((savedPeriod) => {
			const parsed = savedUsagePeriodSchema.safeParse(savedPeriod);
			return parsed.success ? [parsed.data] : [];
		})
		.slice(0, MAX_SAVED_USAGE_PERIODS);
}

async function getSanitizedPeriodPreferences(userId: string, projectId: string): Promise<UserProjectPreferences> {
	const current = await userProjectPreferenceQueries.getUserProjectPreferences(userId, projectId);
	const sanitized = sanitizePeriodSettings(current);
	if (!sanitized.changed) {
		return sanitized.preferences;
	}
	return userProjectPreferenceQueries.mutateUserProjectPreferences(
		userId,
		projectId,
		(latest) => sanitizePeriodSettings(latest).preferences,
	);
}

function sanitizePeriodSettings(preferences: UserProjectPreferences): {
	preferences: UserProjectPreferences;
	changed: boolean;
} {
	const savedPeriods = sanitizeSavedPeriods(preferences);
	const parsedSelection = parsePeriodSelection(preferences.usagePeriod);
	const usagePeriod =
		preferences.usagePeriod === undefined
			? undefined
			: parsedSelection.success && isValidPeriodSelection(parsedSelection.data, savedPeriods)
				? parsedSelection.data
				: DEFAULT_USAGE_PERIOD_SELECTION;
	const sanitized = {
		...preferences,
		usagePeriod,
		savedUsagePeriods: preferences.savedUsagePeriods === undefined ? undefined : savedPeriods,
	};
	return {
		preferences: sanitized,
		changed: JSON.stringify(sanitized) !== JSON.stringify(preferences),
	};
}

function isValidPeriodSelection(
	selection: NonNullable<UserProjectPreferences['usagePeriod']>,
	savedPeriods: ReturnType<typeof sanitizeSavedPeriods>,
): boolean {
	return selection.mode !== 'saved' || savedPeriods.some(({ id }) => id === selection.savedPeriodId);
}

function parsePeriodSelection(value: unknown) {
	const parsed = usagePeriodSelectionSchema.safeParse(value);
	if (parsed.success) {
		return parsed;
	}
	const legacy = legacySavedPeriodSelectionSchema.safeParse(value);
	return legacy.success
		? usagePeriodSelectionSchema.safeParse({
				mode: 'saved',
				savedPeriodId: legacy.data.entryId,
			})
		: parsed;
}

function assertPreferenceProject(inputProjectId: string, contextProjectId: string): void {
	if (inputProjectId !== contextProjectId) {
		throw new TRPCError({ code: 'BAD_REQUEST', message: 'Active project changed. Retry the request.' });
	}
}
