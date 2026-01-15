import z from 'zod/v3';

export const inputSchema = z.object({
	file_path: z.string(),
});

export const outputSchema = z.object({
	content: z.string(),
	numberOfTotalLines: z.number(),
});

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;
