import { createTool } from '../_types';
import { execute } from './execute';
import { inputSchema, outputSchema } from './schema';

export const readFile = createTool({
	name: 'read_file',
	description: 'Read the contents of a file at a given path.',
	inputSchema,
	outputSchema,
	execute,
});

export { inputSchema, outputSchema } from './schema';
