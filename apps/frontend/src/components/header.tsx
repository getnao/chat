import { useNavigate, Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { ButtonConnection } from './ui/button';
import { useSession, signOut } from '@/lib/auth-client';

export const Header = () => {
	const { data: session } = useSession();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const handleSignOut = async (e: React.FormEvent) => {
		e.preventDefault();
		queryClient.clear();
		await signOut();
		navigate({ to: '/login' });
	};

	if (!session) {
		return (
			<header className='flex items-center justify-between gap-4 px-4 py-2 border border-b'>
				<ButtonConnection>
					<Link to='/'>App</Link>
				</ButtonConnection>
				<ButtonConnection>
					<Link to='/signup'>Sign up</Link>
				</ButtonConnection>
			</header>
		);
	}
	return (
		<header className='flex items-center justify-between gap-4 px-4 py-2 border border-b'>
			<ButtonConnection>
				<Link to='/'>App</Link>
			</ButtonConnection>
			<form onSubmit={handleSignOut}>
				<ButtonConnection>
					<LogOut className='size-4' />
					<span className='font-medium text-sm'>Logout</span>
				</ButtonConnection>
			</form>
		</header>
	);
};
