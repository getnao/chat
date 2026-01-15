import { createTool } from '../_types';
import { execute } from './execute';
import { inputSchema, outputSchema } from './schema';

export const list = createTool({
	name: 'list',
	description:
		'List assets in the project (databases, schemas, tables, files, directories, etc.). Everything is organised as a filesystem tree so it is browsable like a file explorer.',
	inputSchema,
	outputSchema,
	execute,
});

export { inputSchema, outputSchema } from './schema';
