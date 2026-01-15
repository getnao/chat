import { DefaultToolCall } from './ui/default';

import { ExecuteSqlToolCall } from './ui/execute-sql';
import { ListToolCall } from './ui/list';
import { ReadToolCall } from './ui/read';
import { SearchToolCall } from './ui/search';
import type { UIToolPart } from 'backend/chat';
import type { ToolCallProps } from './context';
import { getToolName } from '@/lib/ai';

const toolComponents: Record<string, React.ComponentType<ToolCallProps>> = {
	execute_sql: ExecuteSqlToolCall,
	list: ListToolCall,
	read: ReadToolCall,
	search: SearchToolCall,
};

export const ToolCall = ({ toolPart }: { toolPart: UIToolPart }) => {
	const toolName = getToolName(toolPart);
	const Component = toolComponents[toolName] ?? DefaultToolCall;
	return <Component toolPart={toolPart} />;
};

export { DefaultToolCall } from './ui/default';
export { ExecuteSqlToolCall } from './ui/execute-sql';
export { ListToolCall } from './ui/list';
export { ReadToolCall } from './ui/read';
export { SearchToolCall } from './ui/search';
export { useToolCallContext, ToolCallProvider, type ToolCallProps } from './context';
