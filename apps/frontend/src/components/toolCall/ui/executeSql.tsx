import { ChevronRight } from 'lucide-react';
import { ToolCallProvider, useToolCallContext } from '../context';
import type { ToolCallProps } from '../context';
import { getToolName, isToolSettled } from '@/lib/ai';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

interface ExecuteSqlOutput {
	columns: string[];
	rows?: unknown[][];
}

const ExecuteSqlContent = () => {
	const { toolPart, isExpanded, setIsExpanded } = useToolCallContext();
	const output = toolPart.output as ExecuteSqlOutput | undefined;
	const canExpand = !!toolPart.errorText || !!output;
	const isClickable = canExpand;
	const isSettled = isToolSettled(toolPart);
	const toolName = getToolName(toolPart);

	const handleClick = () => {
		if (canExpand) {
			setIsExpanded(!isExpanded);
		}
	};

	return (
		<>
			<span
				className={cn(
					'select-none flex items-center gap-2 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap [&_*]:overflow-hidden [&_*]:text-ellipsis [&_*]:whitespace-nowrap transition-opacity duration-150',
					isExpanded ? 'opacity-100' : 'opacity-50',
					isClickable && !isExpanded
						? 'cursor-pointer hover:opacity-75'
						: isClickable
							? 'cursor-pointer'
							: '',
				)}
				onClick={handleClick}
			>
				{isSettled ? (
					<ChevronRight size={12} className={cn(isExpanded ? 'rotate-90' : '')} />
				) : (
					<Spinner className='size-4 opacity-50' />
				)}
				<span className={cn(!isSettled ? 'text-shimmer' : '')}>{toolName}</span>
				{output?.rows && <span className='text-xs opacity-50'>({output.rows.length} rows)</span>}
			</span>

			{isExpanded && canExpand && (
				<div className='pl-5 mt-1.5 bg-backgroundSecondary relative'>
					<div className='h-full border-l border-l-border absolute top-0 left-[6px]' />
					<div>
						{toolPart.errorText ? (
							<pre className='p-2 overflow-auto max-h-80 m-0 bg-red-950'>{toolPart.errorText}</pre>
						) : output ? (
							<div className='overflow-auto max-h-80'>
								<table className='text-sm border-collapse w-full'>
									<thead>
										<tr className='border-b border-border'>
											{output.columns.map((col, i) => (
												<th
													key={i}
													className='text-left p-2 font-medium text-foreground/70 bg-backgroundSecondary sticky top-0'
												>
													{col}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{output.rows?.map((row, rowIndex) => (
											<tr
												key={rowIndex}
												className='border-b border-border/50 hover:bg-background/50'
											>
												{row.map((cell, cellIndex) => (
													<td key={cellIndex} className='p-2 font-mono text-xs'>
														{cell === null ? (
															<span className='text-foreground/30 italic'>NULL</span>
														) : (
															String(cell)
														)}
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
								{(!output.rows || output.rows.length === 0) && (
									<div className='p-4 text-center text-foreground/50 text-sm'>No rows returned</div>
								)}
							</div>
						) : null}
					</div>
				</div>
			)}
		</>
	);
};

export const ExecuteSqlToolCall = ({ toolPart }: ToolCallProps) => {
	return (
		<ToolCallProvider toolPart={toolPart}>
			<ExecuteSqlContent />
		</ToolCallProvider>
	);
};
