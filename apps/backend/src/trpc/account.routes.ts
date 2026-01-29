import { TRPCError } from '@trpc/server';
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod/v4';

import * as accountQueries from '../queries/account.queries';
import { regexPassword } from '../utils/utils';
import { adminProtectedProcedure } from './trpc';

export const accountRoutes = {
	modifyPassword: adminProtectedProcedure
		.input(
			z.object({
				userId: z.string(),
				newPassword: z.string().optional(),
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

			if (input.newPassword && !regexPassword.test(input.newPassword)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message:
						'New password must be at least 8 characters long and include uppercase, lowercase, number, and special character.',
				});
			}

			const password = input.newPassword || crypto.randomUUID().slice(0, 8);
			const hashedPassword = await hashPassword(password);

			await accountQueries.updateAccountPassword(account.id, hashedPassword);

			return { password };
		}),
};
