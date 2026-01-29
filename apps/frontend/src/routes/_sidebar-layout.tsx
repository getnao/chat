import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Sidebar } from '@/components/sidebar';
import { useEnforcePasswordReset } from '@/hooks/useEnforcePasswordReset';

export const Route = createFileRoute('/_sidebar-layout')({
	component: RouteComponent,
});

function RouteComponent() {
	const session = useEnforcePasswordReset();

	if (session.isPending) {
		return null;
	}

	return (
		<>
			<Sidebar />
			<Outlet />
		</>
	);
}
