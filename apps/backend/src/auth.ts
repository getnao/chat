import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { isPostgres } from '../drizzle.config';
import { db } from './db/db';
import * as postgresSchema from './db/postgres-schema';
import * as sqliteSchema from './db/sqlite-schema';

const provider = isPostgres ? 'pg' : 'sqlite';
const schema = isPostgres ? postgresSchema : sqliteSchema;

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: provider,
		schema,
	}),
	emailAndPassword: {
		enabled: true,
	},
	socialProviders: {
		google: {
			prompt: 'select_account',
			clientId: process.env.GOOGLE_CLIENT_ID as string,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
		},
	},
});
