import { createRootRoute } from '@tanstack/react-router';
import { Sidebar } from '@/components/sidebar';
import { ChatView } from '@/components/chat-view';
import { useDisposeInactiveAgents } from '@/hooks/useAgent';

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	useDisposeInactiveAgents();

	return (
		<div className='flex h-screen'>
			<Sidebar />
			<ChatView />
		</div>
	);
}
