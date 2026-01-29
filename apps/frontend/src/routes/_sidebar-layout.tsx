import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Sidebar } from '@/components/sidebar';
import { CommandMenu } from '@/components/command-menu';

export const Route = createFileRoute('/_sidebar-layout')({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<>
			<Sidebar />
			<CommandMenu />
			<Outlet />
		</>
	);
}
