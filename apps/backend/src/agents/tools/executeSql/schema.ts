import z from 'zod/v3';

export const inputSchema = z.object({
	sql_query: z.string().describe('The SQL query to execute'),
	database_id: z
		.string()
		.optional()
		.describe('The database name/id to use. Required if multiple databases are configured.'),
});

export const outputSchema = z.object({
	columns: z.array(z.string()),
	rows: z.array(z.any()).optional(),
});

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;
