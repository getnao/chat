import { createTool } from '../_types';
import { execute } from './execute';
import { inputSchema, outputSchema } from './schema';

export const searchFiles = createTool({
	name: 'search_files',
	description: 'Search for files matching a specific pattern and return their paths.',
	inputSchema,
	outputSchema,
	execute,
});

export { inputSchema, outputSchema } from './schema';
