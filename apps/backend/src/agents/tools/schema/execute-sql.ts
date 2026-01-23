import z from 'zod/v3';

export const description =
	'Execute a SQL query against the connected database and return the results. If multiple databases are configured, specify the database_id.';

export const inputSchema = z.object({
	sql_query: z.string().describe('The SQL query to execute'),
	database_id: z
		.string()
		.optional()
		.describe('The database name/id to use. Required if multiple databases are configured.'),
});

export const outputSchema = z.object({
	data: z.array(z.any()),
	row_count: z.number(),
	columns: z.array(z.string()),
	/** The id of the query result. May be referenced by the `display_chart` tool call. */
	id: z.custom<`query_${string}`>(),
});

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;
