import { TRPCError } from '@trpc/server';
import { z } from 'zod/v4';

import * as userProjectPreferenceQueries from '../queries/user-project-preference.queries';
import {
	DEFAULT_USAGE_PERIOD_SELECTION,
	MAX_SAVED_USAGE_PERIODS,
	type SavedUsagePeriod,
	savedUsagePeriodSchema,
	usagePeriodSelectionSchema,
	type UserProjectPreferences,
} from '../types/usage';

type PeriodSettings = {
	preferences: UserProjectPreferences;
	savedPeriods: SavedUsagePeriod[];
};

type PeriodSettingsTransform = (settings: PeriodSettings) => UserProjectPreferences;

const legacySavedPeriodSelectionSchema = z.object({
	mode: z.literal('saved'),
	entryId: z.string().min(1),
});

export async function getAndRepairPeriodSettings(userId: string, projectId: string): Promise<PeriodSettings> {
	const current = await userProjectPreferenceQueries.getUserProjectPreferences(userId, projectId);
	const sanitized = sanitizePeriodSettings(current);
	if (!sanitized.changed) {
		return sanitized;
	}

	const preferences = await userProjectPreferenceQueries.mutateUserProjectPreferences(
		userId,
		projectId,
		(latest) => sanitizePeriodSettings(latest).preferences,
	);
	return {
		preferences,
		savedPeriods: sanitizeSavedPeriods(preferences),
	};
}

export async function mutatePeriodSettings(
	userId: string,
	projectId: string,
	transform: PeriodSettingsTransform,
): Promise<UserProjectPreferences> {
	return userProjectPreferenceQueries.mutateUserProjectPreferences(userId, projectId, (current) => {
		const { preferences, savedPeriods } = sanitizePeriodSettings(current);
		return transform({ preferences, savedPeriods });
	});
}

export function assertSavedPeriodExists(savedPeriods: SavedUsagePeriod[], id: string): void {
	if (!savedPeriods.some((savedPeriod) => savedPeriod.id === id)) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Saved usage period not found.' });
	}
}

function sanitizePeriodSettings(preferences: UserProjectPreferences): PeriodSettings & { changed: boolean } {
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
		savedPeriods,
		changed: JSON.stringify(sanitized) !== JSON.stringify(preferences),
	};
}

function sanitizeSavedPeriods(preferences: UserProjectPreferences): SavedUsagePeriod[] {
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

function isValidPeriodSelection(
	selection: NonNullable<UserProjectPreferences['usagePeriod']>,
	savedPeriods: SavedUsagePeriod[],
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
