import { TRPCError } from '@trpc/server';
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod/v4';

import * as projectQueries from '../queries/project.queries';
import * as userQueries from '../queries/user.queries';
import { adminProtectedProcedure, projectProtectedProcedure, publicProcedure } from './trpc';

export const userRoutes = {
	countAll: publicProcedure.query(() => {
		return userQueries.countAll();
	}),
	get: projectProtectedProcedure.input(z.object({ userId: z.string() })).query(async ({ input, ctx }) => {
		if (ctx.userRole !== 'admin' && input.userId !== ctx.user.id) {
			throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can access other users information' });
		}

		const user = await userQueries.get({ id: input.userId });
		if (!user) {
			return null;
		}
		return user;
	}),
	modify: projectProtectedProcedure
		.input(
			z.object({
				userId: z.string(),
				name: z.string().optional(),
				newRole: z.enum(['user', 'viewer']).optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (ctx.project && input.newRole && input.newRole !== ctx.userRole) {
				await projectQueries.updateProjectMemberRole(ctx.project.id, input.userId, input.newRole);
			}
			if (input.name && input.name !== ctx.user.name) {
				await userQueries.modify(input.userId, { name: input.name });
			}
		}),
	createUserAndAddToProject: adminProtectedProcedure
		.input(
			z.object({
				name: z.string().min(1),
				email: z.string().min(1),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const userId = crypto.randomUUID();
			const accountId = crypto.randomUUID();

			const password = crypto.randomUUID().slice(0, 8);
			const hashedPassword = await hashPassword(password);

			const newUser = await userQueries.create(
				{
					id: userId,
					name: input.name,
					email: input.email,
				},
				{
					id: accountId,
					userId: userId,
					accountId: userId,
					providerId: 'credential',
					password: hashedPassword,
				},
				{
					userId: '',
					projectId: ctx.project?.id || '',
					role: 'user',
				},
			);

			return { newUser, password };
		}),
};
