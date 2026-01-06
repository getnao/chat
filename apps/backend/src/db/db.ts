import 'dotenv/config';

import { createClient } from '@libsql/client';
import { drizzle as drizzleSqlite } from 'drizzle-orm/libsql';
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { isPostgres } from '../../drizzle.config';
import * as postgresSchema from './postgres-schema';
import * as sqliteSchema from './sqlite-schema';

export const db = isPostgres
	? drizzlePostgres(new Pool({ connectionString: process.env.DATABASE_URL! }), { schema: postgresSchema })
	: drizzleSqlite(process.env.DB_FILE_NAME!, { schema: sqliteSchema });
