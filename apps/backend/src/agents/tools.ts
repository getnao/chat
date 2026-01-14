import { tool } from 'ai';
import z from 'zod/v3';

import { execute_sql } from './tools/execute_sql';
import { list } from './tools/list';
import { read } from './tools/read';
import { search } from './tools/search';

export const tools = {
	read_file: tool({
		description: 'Read the contents of a file at a given path.',
		inputSchema: z.object({
			file_path: z.string(),
		}),
		outputSchema: z.object({
			content: z.string(),
			numberOfTotalLines: z.number(),
		}),
		execute: async ({ file_path }) => {
			return await read(file_path);
		},
	}),
	search_files: tool({
		description: 'Search for files matching a specific pattern and return their paths.',
		inputSchema: z.object({
			file_pattern: z.string(),
		}),
		outputSchema: z.array(
			z.object({
				path: z.string(),
				dir: z.string(),
				size: z.string(),
			}),
		),
		execute: async ({ file_pattern }) => {
			return await search(file_pattern);
		},
	}),
	list: tool({
		description:
			'List assets in the project (databases, schemas, tables, files, directories, etc.). Everything is organised as a filesystem tree so it is browsable like a file explorer.',
		inputSchema: z.object({
			dir_path: z.string(),
		}),
		outputSchema: z.array(
			z.object({
				path: z.string(),
				name: z.string(),
				type: z.enum(['file', 'directory', 'symbolic_link']).optional(),
				size: z.string().optional(),
			}),
		),
		execute: async ({ dir_path }) => {
			return await list(dir_path);
		},
	}),
	execute_sql: tool({
		description:
			'Execute a SQL query against the connected database and return the results. If multiple databases are configured, specify the database_id.',
		inputSchema: z.object({
			sql_query: z.string().describe('The SQL query to execute'),
			database_id: z
				.string()
				.optional()
				.describe('The database name/id to use. Required if multiple databases are configured.'),
		}),
		outputSchema: z.object({
			columns: z.array(z.string()),
			rows: z.array(z.any()).optional(),
		}),
		execute: async ({ sql_query: query, database_id }) => {
			return await execute_sql(query, database_id);
		},
	}),
};
