import { ToolCallProvider, useToolCallContext } from '../context';
import { SimpleToolCallWrapper } from './SimpleToolCallWrapper';
import type { ToolCallProps } from '../context';
import type { readFileSchemas } from 'backend/tools';
import { isToolSettled } from '@/lib/ai';

const ReadContent = () => {
	const { toolPart } = useToolCallContext();
	const output = toolPart.output as readFileSchemas.Output | undefined;
	const input = toolPart.input as readFileSchemas.Input | undefined;
	const isSettled = isToolSettled(toolPart);

	const fileName = input?.file_path?.split('/').pop() ?? input?.file_path;

	if (!isSettled) {
		return (
			<SimpleToolCallWrapper
				title={
					<>
						Reading... <code className='text-xs bg-background/50 px-1 py-0.5 rounded'>{fileName}</code>
					</>
				}
				children={<div className='p-4 text-center text-foreground/50 text-sm'>Reading file...</div>}
			/>
		);
	}

	return (
		<SimpleToolCallWrapper
			title={
				<>
					Read <code className='text-xs bg-background/50 px-1 py-0.5 rounded'>{fileName}</code>
				</>
			}
			badge={output && `(${output.numberOfTotalLines} lines)`}
		>
			{output && (
				<div className='overflow-auto max-h-80'>
					<pre className='m-0 p-2 text-xs font-mono leading-relaxed'>{output.content}</pre>
				</div>
			)}
		</SimpleToolCallWrapper>
	);
};

export const ReadToolCall = ({ toolPart }: ToolCallProps) => {
	return (
		<ToolCallProvider toolPart={toolPart}>
			<ReadContent />
		</ToolCallProvider>
	);
};
