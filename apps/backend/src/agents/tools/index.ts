import { executeSql } from './executeSql';
import { list } from './list';
import { readFile } from './readFile';
import { searchFiles } from './searchFiles';

export const tools = {
	read: readFile.tool,
	list: list.tool,
	search: searchFiles.tool,
	execute_sql: executeSql.tool,
} as const;

export * as executeSqlSchemas from './executeSql/schema';
export * as listSchemas from './list/schema';
export * as readFileSchemas from './readFile/schema';
export * as searchFilesSchemas from './searchFiles/schema';
