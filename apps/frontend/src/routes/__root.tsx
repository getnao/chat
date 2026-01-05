import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Header } from '../components/header';

export const Route = createRootRoute({
	component: () => (
		<>
			<Header />
			<Outlet />
			{/* <TanStackDevtools
				config={{
					position: 'bottom-right',
				}}
				plugins={[
					{
						name: 'Tanstack Router',
						render: <TanStackRouterDevtoolsPanel />,
					},
				]}
			/> */}
		</>
	),
});
