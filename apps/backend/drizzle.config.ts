import { defineConfig } from 'drizzle-kit';

import dbConfig from './src/db/dbConfig';

export default defineConfig({
	out: dbConfig.migrationsFolder,
	schema: dbConfig.schemaPath,
	dialect: dbConfig.dialect === 'pg' ? 'postgresql' : 'sqlite',
	dbCredentials: {
		url: dbConfig.dbUrl,
	},
});
