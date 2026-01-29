import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useSession } from '@/lib/auth-client';

export const useEnforcePasswordReset = () => {
	const navigate = useNavigate();
	const session = useSession();

	useEffect(() => {
		if (!session.isPending && session.data?.user?.requiresPasswordReset) {
			console.log('Navigating to /modifyPassword');
			navigate({ to: '/modifyPassword' });
		}
	}, [session.isPending, session.data?.user?.requiresPasswordReset, navigate]);

	return session;
};
