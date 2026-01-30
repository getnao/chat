import { TRPCError } from '@trpc/server';
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod/v4';

import * as projectQueries from '../queries/project.queries';
import * as userQueries from '../queries/user.queries';
import { emailService } from '../services/email.service';
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
				newRole: z.enum(['user', 'viewer', 'admin']).optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const previousRole = await projectQueries.getUserRoleInProject(ctx.project!.id, input.userId);
			const previousName = (await userQueries.get({ id: input.userId }))?.name;

			if (previousRole === 'admin' && input.newRole && input.newRole !== 'admin') {
				const moreThanOneAdmin = await projectQueries.checkProjectHasMoreThanOneAdmin(ctx.project!.id);
				if (!moreThanOneAdmin) {
					throw new TRPCError({
						code: 'BAD_REQUEST',
						message: 'The project must have at least one admin user.',
					});
				}
			}

			if (ctx.project && input.newRole && input.newRole !== previousRole) {
				await projectQueries.updateProjectMemberRole(ctx.project.id, input.userId, input.newRole);
			}
			if (ctx.project && input.name && input.name !== previousName) {
				await userQueries.modify({
					id: input.userId,
					name: input.name,
				});
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
					requiresPasswordReset: true,
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

			await emailService.sendEmail({
				user: newUser,
				type: 'createUser',
				projectName: ctx.project?.name,
				temporaryPassword: password,
			});

			return { newUser, password };
		}),
	searchUserAndAddToProject: adminProtectedProcedure
		.input(
			z.object({
				email: z.string().min(1),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const user = await userQueries.get({ email: input.email });
			if (!user) {
				return {
					success: false,
					message: 'Add a name in order to create a new user, no one was found with the provided email.',
				};
			}

			const existingMember = await projectQueries.getProjectMember(ctx.project!.id, user.id);
			if (existingMember) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: 'User is already a member of the project' });
			}

			await projectQueries.addProjectMember({
				userId: user.id,
				projectId: ctx.project!.id,
				role: 'user',
			});

			await emailService.sendEmail({
				user,
				type: 'createUser',
				projectName: ctx.project?.name,
			});

			return { success: true, message: 'User added to project successfully.' };
		}),
};
