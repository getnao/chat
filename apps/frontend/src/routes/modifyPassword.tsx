import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { trpc } from '@/main';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/modifyPassword')({
	component: ModifyPassword,
});

function ModifyPassword() {
	const navigate = useNavigate();
	const { data: sessionData, refetch } = useSession();
	const [formData, setFormData] = useState({
		newPassword: '',
		confirmPassword: '',
	});
	const [error, setError] = useState('');

	const modifyUserPassword = useMutation(
		trpc.account.modifyPassword.mutationOptions({
			onSuccess: async () => {
				await refetch();
				navigate({ to: '/' });
			},
			onError: (err) => {
				setError(err.message);
			},
		}),
	);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

		if (formData.newPassword !== formData.confirmPassword) {
			setError('Passwords do not match');
			e.stopPropagation();
			return;
		}

		if (!sessionData?.user?.id) {
			setError('User not found');
			e.stopPropagation();
			return;
		}

		await modifyUserPassword.mutateAsync({
			userId: sessionData.user.id,
			newPassword: formData.newPassword,
		});
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value,
		});
	};

	return (
		<div className='container mx-auto w-full max-w-2xl p-12 my-auto'>
			<div className='text-3xl font-bold mb-8 text-center'>Reset Your Password</div>

			<form onSubmit={handleSubmit} className='space-y-6'>
				<Input
					name='newPassword'
					type='password'
					placeholder='New Password'
					value={formData.newPassword}
					onChange={handleChange}
					required
					className='h-12 text-base'
				/>

				<Input
					name='confirmPassword'
					type='password'
					placeholder='Confirm New Password'
					value={formData.confirmPassword}
					onChange={handleChange}
					required
					className='h-12 text-base'
				/>

				{error && <p className='text-red-500 text-center text-base'>{error}</p>}

				<Button
					type='submit'
					className='w-full h-12 text-base'
					disabled={!formData.newPassword || !formData.confirmPassword || modifyUserPassword.isPending}
				>
					{modifyUserPassword.isPending ? 'Updating...' : 'Reset Password'}
				</Button>
			</form>
		</div>
	);
}
