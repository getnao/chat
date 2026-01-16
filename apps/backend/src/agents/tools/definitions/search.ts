import type { ToolDefinition } from '../../../types/tools';
import { execute } from '../functions/search';
import { description, inputSchema, outputSchema } from '../schema/search';

export default {
	name: 'search',
	description,
	inputSchema,
	outputSchema,
	execute,
} satisfies ToolDefinition<typeof inputSchema, typeof outputSchema>;
