import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { Conversation, ConversationContent } from './ui/conversation';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

interface ReasoningAccordionProps {
	text: string;
	isStreaming: boolean;
}

export const ReasoningAccordion = ({ text, isStreaming }: ReasoningAccordionProps) => {
	const [isExpanded, setIsExpanded] = useState(isStreaming);
	const wasStreamingRef = useRef(isStreaming);

	useEffect(() => {
		if (isStreaming && !wasStreamingRef.current) {
			setIsExpanded(true);
		} else if (!isStreaming && wasStreamingRef.current) {
			setIsExpanded(false);
		}
		wasStreamingRef.current = isStreaming;
	}, [isStreaming]);

	const handleValueChange = (value: string) => {
		setIsExpanded(value === 'reasoning-content');
	};

	return (
		<Accordion
			type='single'
			collapsible
			value={isExpanded ? 'reasoning-content' : ''}
			onValueChange={handleValueChange}
		>
			<AccordionItem value='reasoning-content' className='border-b-0'>
				<AccordionTrigger
					className={cn(
						'select-none flex items-center gap-2 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap transition-opacity duration-150 py-0 hover:no-underline [&>svg:last-child]:hidden',
						isExpanded ? 'opacity-100' : 'opacity-50',
						'cursor-pointer hover:opacity-75',
					)}
				>
					<div className='size-3 flex items-center justify-center shrink-0'>
						<ChevronRight
							size={12}
							className={cn('transition-transform duration-200', isExpanded && 'rotate-90')}
						/>
					</div>
					<span className={cn('text-sm', isStreaming && 'text-shimmer')}>
						{isStreaming ? 'Thinking...' : 'Thought'}
					</span>
				</AccordionTrigger>

				<AccordionContent className='pb-0 pt-1.5'>
					<div className='pl-5 bg-backgroundSecondary relative'>
						<div className='h-full border-l border-l-border absolute top-0 left-[6px]' />
						<div className='text-muted-foreground text-sm'>
							<Conversation className='p-0'>
								<ConversationContent className='p-0 max-h-[200px]'>
									<Streamdown
										isAnimating={isStreaming}
										mode={isStreaming ? 'streaming' : 'static'}
										cdnUrl={null}
									>
										{text}
									</Streamdown>
								</ConversationContent>
							</Conversation>
						</div>
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
};
