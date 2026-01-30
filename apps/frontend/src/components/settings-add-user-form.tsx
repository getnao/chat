import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { trpc } from '@/main';
import { useUserPageContext } from '@/contexts/user.provider';

export function AddUserDialog() {
	const { isAddUserFormOpen, setIsAddUserFormOpen, setNewUser, setIsNewUserDialogOpen, error, setError } =
		useUserPageContext();
	const [needToCreateUser, setNeedToCreateUser] = useState(false);
	const [email, setEmail] = useState('');
	const [name, setName] = useState('');

	const queryClient = useQueryClient();

	const handleClose = () => {
		setIsAddUserFormOpen(false);
		setNeedToCreateUser(false);
		setEmail('');
		setName('');
	};

	const searchUserAndAddToProject = useMutation(
		trpc.user.searchUserAndAddToProject.mutationOptions({
			onSuccess: async (ctx) => {
				if (ctx.success) {
					await queryClient.invalidateQueries({
						queryKey: trpc.project.getAllUsersWithRoles.queryKey(),
					});
					handleClose();
				} else {
					setNeedToCreateUser(true);
				}
			},
			onError: (err) => {
				setError(err.message);
			},
		}),
	);

	const createUserAndAddToProject = useMutation(
		trpc.user.createUserAndAddToProject.mutationOptions({
			onSuccess: async (ctx) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.project.getAllUsersWithRoles.queryKey(),
				});
				handleClose();
				setNewUser({ email, password: ctx.password });
				setIsNewUserDialogOpen(true);
			},
			onError: (err) => {
				setError(err.message);
			},
		}),
	);

	const handleSubmit = async () => {
		setError('');

		if (needToCreateUser === false) {
			await searchUserAndAddToProject.mutateAsync({ email });
		} else {
			await createUserAndAddToProject.mutateAsync({ email, name });
		}
	};

	return (
		<Dialog open={isAddUserFormOpen} onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add User</DialogTitle>
				</DialogHeader>
				<div className='flex flex-col gap-4'>
					<div className='flex flex-col gap-2'>
						<label htmlFor='email' className='text-sm font-medium text-slate-700'>
							Email
						</label>
						<Input
							id='email'
							name='email'
							type='text'
							placeholder="Enter the user's email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</div>
				</div>
				{needToCreateUser && (
					<>
						<div className='flex flex-col gap-4'>
							<div className='flex flex-col gap-2'>
								<label htmlFor='name' className='text-sm font-medium text-slate-700'>
									Name
								</label>
								<Input
									id='name'
									name='name'
									type='text'
									placeholder="Enter the user's name"
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</div>
						</div>
						<div className='text-sm font-medium text-slate-700'>
							Add a name in order to create a new user, no one was found with the provided email.
						</div>
					</>
				)}
				{error && <p className='text-red-500 text-center text-base'>{error}</p>}
				<div className='flex justify-end'>
					<Button onClick={handleSubmit}>Add user</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
