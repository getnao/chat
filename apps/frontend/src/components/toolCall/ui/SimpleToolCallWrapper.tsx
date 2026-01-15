import { ChevronRight } from 'lucide-react';
import { useToolCallContext } from '../context';
import type { ReactNode } from 'react';
import { isToolSettled } from '@/lib/ai';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

interface SimpleToolCallWrapperProps {
	title: ReactNode;
	badge?: ReactNode;
	children: ReactNode;
}

export const SimpleToolCallWrapper = ({ title, badge, children }: SimpleToolCallWrapperProps) => {
	const { toolPart, isExpanded, setIsExpanded } = useToolCallContext();
	const canExpand = !!toolPart.errorText || !!toolPart.output;
	const isSettled = isToolSettled(toolPart);

	const handleValueChange = (value: string) => {
		setIsExpanded(value === 'tool-content');
	};

	return (
		<Accordion type='single' collapsible onValueChange={handleValueChange} disabled={!canExpand}>
			<AccordionItem value='tool-content' className='border-b-0'>
				<AccordionTrigger
					className={cn(
						'select-none flex items-center gap-2 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap [&_*]:overflow-hidden [&_*]:text-ellipsis [&_*]:whitespace-nowrap transition-opacity duration-150 py-0 hover:no-underline [&>svg:last-child]:hidden',
						isExpanded ? 'opacity-100' : 'opacity-50',
						canExpand && !isExpanded
							? 'cursor-pointer hover:opacity-75'
							: canExpand
								? 'cursor-pointer'
								: '',
					)}
				>
					{isSettled ? (
						<ChevronRight
							size={12}
							className={cn('transition-transform duration-200', isExpanded ? 'rotate-90' : '')}
						/>
					) : (
						<Spinner className='size-4 opacity-50' />
					)}
					<span className={cn(!isSettled ? 'text-shimmer' : '')}>{title}</span>
					{badge && <span className='text-xs opacity-50'>{badge}</span>}
				</AccordionTrigger>

				<AccordionContent className='pb-0 pt-1.5'>
					<div className='pl-5 bg-backgroundSecondary relative'>
						<div className='h-full border-l border-l-border absolute top-0 left-[6px]' />
						<div>
							{toolPart.errorText ? (
								<pre className='p-2 overflow-auto max-h-80 m-0 bg-red-950'>{toolPart.errorText}</pre>
							) : (
								children
							)}
						</div>
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
};
