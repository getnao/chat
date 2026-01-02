import { useChat } from '@ai-sdk/react';
import { createFileRoute } from '@tanstack/react-router';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { ArrowUpIcon, BotIcon, Loader2Icon, UserIcon } from 'lucide-react';
import { useState } from 'react';
import {
	Conversation,
	ConversationContent,
	ConversationEmptyState,
	ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group';
import { useSession } from '@/lib/auth-client';

export const Route = createFileRoute('/')({
	component: App,
});

// Weather tool input type
interface WeatherInput {
	city: string;
}

// Fake weather data generator
interface WeatherData {
	city: string;
	condition: string;
	temperature: string;
	humidity: string;
	wind: string;
}

function getFakeWeather(city: string): WeatherData {
	const conditions = ['☀️ Sunny', '🌤️ Partly Cloudy', '☁️ Cloudy', '🌧️ Rainy', '⛈️ Stormy', '❄️ Snowy', '🌫️ Foggy'];
	const condition = conditions[Math.floor(Math.random() * conditions.length)];
	const temp = Math.floor(Math.random() * 35) + 5;
	const humidity = Math.floor(Math.random() * 60) + 30;
	const wind = Math.floor(Math.random() * 30) + 5;

	return {
		city,
		condition,
		temperature: `${temp}°C`,
		humidity: `${humidity}%`,
		wind: `${wind} km/h`,
	};
}

function App() {
	const [input, setInput] = useState('');
	const { data: session } = useSession();

	const { messages, sendMessage, status, addToolOutput } = useChat({
		transport: new DefaultChatTransport({ api: '/api/chat' }),
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		onToolCall: ({ toolCall }) => {
			if (toolCall.toolName === 'getWeather') {
				const toolInput = toolCall.input as WeatherInput;
				const weather = getFakeWeather(toolInput.city);
				addToolOutput({
					tool: 'getWeather',
					toolCallId: toolCall.toolCallId,
					output: weather,
				});
			}
		},
	});

	const isLoading = status === 'streaming' || status === 'submitted';

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isLoading) return;

		sendMessage({ text: input });
		setInput('');
	};

	return (
		<div className='flex h-screen flex-col bg-linear-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 gap-2'>
			<Conversation>
				<ConversationContent>
					{messages.length === 0 ? (
						<ConversationEmptyState
							icon={<BotIcon className='size-8' />}
							title={`Welcome${session?.user ? `, ${session.user.name}` : ''} !`}
							description='Ask me about the weather in any city'
						/>
					) : (
						messages.map((message) => (
							<div
								className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
								key={message.id}
							>
								{message.role === 'assistant' && (
									<div className='flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10'>
										<BotIcon className='size-4' />
									</div>
								)}

								<div
									className={`max-w-[80%] rounded-2xl px-4 py-2 ${
										message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
									}`}
								>
									<pre className='whitespace-pre-wrap text-sm'>
										{JSON.stringify(message, null, 2)}
									</pre>
								</div>

								{message.role === 'user' && (
									<div className='flex size-8 shrink-0 items-center justify-center rounded-full bg-primary'>
										<UserIcon className='size-4 text-primary-foreground' />
									</div>
								)}
							</div>
						))
					)}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>

			<div className='border-t bg-white/50 p-4 backdrop-blur-sm dark:bg-slate-900/50 mt-auto'>
				<form onSubmit={handleSubmit} className='mx-auto max-w-3xl'>
					<InputGroup>
						<InputGroupTextarea
							placeholder='Ask about the weather...'
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									handleSubmit(e);
								}
							}}
						/>
						<InputGroupAddon align='block-end'>
							<InputGroupButton
								type='submit'
								variant='default'
								className='rounded-full ml-auto'
								size='icon-xs'
								disabled={!input || isLoading}
							>
								{isLoading ? <Loader2Icon className='animate-spin' /> : <ArrowUpIcon />}
								<span className='sr-only'>Send</span>
							</InputGroupButton>
						</InputGroupAddon>
					</InputGroup>
				</form>
			</div>
		</div>
	);
}
