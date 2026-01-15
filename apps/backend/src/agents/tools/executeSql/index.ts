import { createTool } from '../_types';
import { execute } from './execute';
import { inputSchema, outputSchema } from './schema';

export const executeSql = createTool({
	name: 'execute_sql',
	description:
		'Execute a SQL query against the connected database and return the results. If multiple databases are configured, specify the database_id.',
	inputSchema,
	outputSchema,
	execute,
});

export { inputSchema, outputSchema } from './schema';
