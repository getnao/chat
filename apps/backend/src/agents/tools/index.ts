import { type AnyToolDefinition, createTool } from './_types';
import executeSql from './definitions/execute-sql';
import list from './definitions/list';
import read from './definitions/read';
import search from './definitions/search';

const allTools: AnyToolDefinition[] = [executeSql, list, read, search];

export const tools = Object.fromEntries(allTools.map((def) => [def.name, createTool(def).tool]));

// Schema re-exports for external use
export * as executeSqlSchemas from './schema/execute-sql';
export * as listSchemas from './schema/list';
export * as readFileSchemas from './schema/read';
export * as searchFilesSchemas from './schema/search';
