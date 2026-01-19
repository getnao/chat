import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Sidebar } from '@/components/sidebar';
import { AgentProvider } from '@/contexts/agent.provider';
import { ChatInput } from '@/components/chat-input';

export const Route = createFileRoute('/_chat-layout')({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<>
			<Sidebar />

			<AgentProvider>
				<div className='flex flex-col h-full flex-1 bg-secondary min-w-0 overflow-hidden justify-center'>
					<Outlet />

					<ChatInput />
				</div>
			</AgentProvider>
		</>
	);
}
