import '../utils/loadEnv';

import * as postgresSchema from './pgSchema';
import * as sqliteSchema from './sqliteSchema';

export type Dialect = 'sqlite' | 'pg';

interface DbConfig {
	dialect: Dialect;
	schema: typeof postgresSchema | typeof sqliteSchema;
	migrationsFolder: string;
	schemaPath: string;
	dbUrl: string;
}

const DEFAULT_DB_URI = 'sqlite:./db.sqlite';

/**
 * Parse DB_URI environment variable to extract database type and connection string.
 * Supported formats:
 *   - sqlite:./path/to/db.sqlite
 *   - sqlite:path/to/db.sqlite
 *   - postgres://user:pass@host:port/database
 */
function parseDbUri(): { dialect: Dialect; connectionString: string } {
	const dbUri = process.env.DB_URI || DEFAULT_DB_URI;

	if (dbUri.startsWith('postgres://') || dbUri.startsWith('postgresql://')) {
		return { dialect: 'pg', connectionString: dbUri };
	}

	if (dbUri.startsWith('sqlite:')) {
		// Remove 'sqlite:' prefix to get the file path
		const filePath = dbUri.slice('sqlite:'.length);
		return { dialect: 'sqlite', connectionString: filePath };
	}

	// Default: treat as SQLite file path for backwards compatibility
	return { dialect: 'sqlite', connectionString: dbUri };
}

const { dialect, connectionString } = parseDbUri();

const dbConfig: DbConfig =
	dialect === 'pg'
		? {
				dialect: 'pg',
				schema: postgresSchema,
				migrationsFolder: './migrations-postgres',
				schemaPath: './src/db/pgSchema.ts',
				dbUrl: connectionString,
			}
		: {
				dialect: 'sqlite',
				schema: sqliteSchema,
				migrationsFolder: './migrations-sqlite',
				schemaPath: './src/db/sqliteSchema.ts',
				dbUrl: connectionString,
			};

export default dbConfig;
