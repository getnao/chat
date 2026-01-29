import { eq } from 'drizzle-orm';

import s from '../db/abstractSchema';
import { db } from '../db/db';

export const getAccountById = async (userId: string): Promise<{ id: string; password: string | null } | null> => {
	const [account] = await db
		.select({ id: s.account.id, password: s.account.password })
		.from(s.account)
		.where(eq(s.account.userId, userId))
		.execute();

	return account ?? null;
};

export const updateAccountPassword = async (accountId: string, hashedPassword: string): Promise<void> => {
	await db.update(s.account).set({ password: hashedPassword }).where(eq(s.account.id, accountId)).execute();
};
