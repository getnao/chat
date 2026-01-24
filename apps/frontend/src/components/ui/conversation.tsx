import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
import type { ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
	<StickToBottom
		className={cn('relative flex-1 overflow-y-hidden', className)}
		initial='instant'
		resize='instant'
		{...props}
	/>
);

export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

export const ConversationContent = ({ className, ...props }: ConversationContentProps) => (
	<StickToBottom.Content className={cn('flex flex-col gap-8 p-4 pb-8 overflow-x-hidden', className)} {...props} />
);

export type ConversationEmptyStateProps = ComponentProps<'div'> & {
	title?: string;
	description?: string;
	icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
	className,
	title = 'No messages yet',
	description = 'Start a conversation to see messages here',
	icon,
	children,
	...props
}: ConversationEmptyStateProps) => (
	<div
		className={cn('flex size-full flex-col items-center justify-center gap-3 p-8 text-center', className)}
		{...props}
	>
		{children ?? (
			<>
				{icon && <div className='text-muted-foreground'>{icon}</div>}
				<div className='space-y-1'>
					<h3 className='font-medium text-sm'>{title}</h3>
					{description && <p className='text-muted-foreground text-sm'>{description}</p>}
				</div>
			</>
		)}
	</div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({ className, ...props }: ConversationScrollButtonProps) => {
	const { isAtBottom, scrollToBottom } = useStickToBottomContext();

	return (
		!isAtBottom && (
			<Button
				className={cn(
					'absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full animate-fade-in-up px-3 gap-2',
					className,
				)}
				onClick={() => scrollToBottom()}
				size='sm'
				type='button'
				variant='outline'
				{...props}
			>
				<ArrowDownIcon className='size-4' />
			</Button>
		)
	);
};

export type ConversationHistoryIndicatorProps = ComponentProps<'div'> & {
	hasHistory?: boolean;
};

export const ConversationHistoryIndicator = ({ className, hasHistory = false }: ConversationHistoryIndicatorProps) => {
	const { isAtBottom } = useStickToBottomContext();

	return (
		// hasHistory is true when there are more than 2 messages in the chat -> history to scroll up to
		isAtBottom &&
		hasHistory && (
			<div
				className={cn(
					'absolute top-4 left-[50%] translate-x-[-50%] animate-fade-in-down pointer-events-none',
					className,
				)}
			>
				<div className='flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/95 backdrop-blur-sm border shadow-sm text-xs text-muted-foreground'>
					<ArrowUpIcon className='size-3' />
					<span>Scroll up for chat history</span>
				</div>
			</div>
		)
	);
};
