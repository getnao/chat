import { TRPCError } from '@trpc/server';
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod/v4';

import * as accountQueries from '../queries/account.queries';
import * as userQueries from '../queries/user.queries';
import { emailService } from '../services/email.service';
import { regexPassword } from '../utils/utils';
import { adminProtectedProcedure, protectedProcedure } from './trpc';

export const accountRoutes = {
	resetPassword: adminProtectedProcedure
		.input(
			z.object({
				userId: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			const account = await accountQueries.getAccountById(input.userId);
			if (!account || !account.password) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'User account not found or user does not use password authentication.',
				});
			}

			const password = crypto.randomUUID().slice(0, 8);
			const hashedPassword = await hashPassword(password);

			await accountQueries.updateAccountPassword(account.id, hashedPassword, input.userId);

			const user = await userQueries.get({ id: input.userId });

			if (user) {
				await emailService.sendEmail({ user, type: 'resetPassword', temporaryPassword: password });
			}

			return { password };
		}),
	modifyPassword: protectedProcedure
		.input(
			z.object({
				userId: z.string(),
				newPassword: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			const account = await accountQueries.getAccountById(input.userId);
			if (!account || !account.password) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'User account not found or user does not use password authentication.',
				});
			}

			if (!regexPassword.test(input.newPassword)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message:
						'New password must be at least 8 characters long and include uppercase, lowercase, number, and special character.',
				});
			}

			const hashedPassword = await hashPassword(input.newPassword);

			await accountQueries.updateAccountPassword(account.id, hashedPassword, input.userId, false);
		}),
};
