import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuItem, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu';
import { trpc } from '@/main';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { useUserPageContext } from '@/contexts/user.provider';

interface ModifyUserInfoProps {
	isAdmin: boolean;
}

export function ModifyUserForm({ isAdmin }: ModifyUserInfoProps) {
	const { userInfo, isModifyUserFormOpen, setIsModifyUserFormOpen, setUserInfo } = useUserPageContext();
	const [error, setError] = useState('');

	const { refetch } = useSession();
	const queryClient = useQueryClient();

	const modifyUser = useMutation(
		trpc.user.modify.mutationOptions({
			onSuccess: async () => {
				await refetch();
				await queryClient.invalidateQueries({
					queryKey: trpc.project.getAllUsersWithRoles.queryKey(),
				});
				setIsModifyUserFormOpen(false);
			},
			onError: (err) => {
				setError(err.message || 'An error occurred while updating the profile.');
			},
		}),
	);

	const handleValidate = async () => {
		setError('');

		await modifyUser.mutateAsync({
			userId: userInfo.id || '',
			name: userInfo.name || '',
			newRole: userInfo.role === 'admin' ? undefined : userInfo.role,
		});
	};

	return (
		<Dialog open={isModifyUserFormOpen} onOpenChange={setIsModifyUserFormOpen}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit Profile</DialogTitle>
				</DialogHeader>
				<div className='flex flex-col gap-4'>
					<div className='flex flex-col gap-2'>
						<label htmlFor='name' className='text-sm font-medium text-slate-700'>
							Name
						</label>
						<Input
							id='name'
							type='text'
							placeholder='Your name'
							value={userInfo.name || ''}
							onChange={(e) => setUserInfo({ ...userInfo, name: e.target.value })}
						/>
					</div>

					{isAdmin && userInfo.role !== 'admin' && (
						<div className='flex flex-col gap-2'>
							<label htmlFor='role' className='text-sm font-medium text-slate-700'>
								Role
							</label>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant='outline' className='w-full justify-between'>
										<span className='capitalize'>{userInfo.role}</span>
										<ChevronDown className='h-4 w-4 opacity-50' />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='start' className='w-full'>
									<DropdownMenuItem
										onClick={() => setUserInfo({ ...userInfo, role: 'user' })}
										className={userInfo.role === 'user' ? 'bg-accent' : ''}
									>
										User
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => setUserInfo({ ...userInfo, role: 'viewer' })}
										className={userInfo.role === 'viewer' ? 'bg-accent' : ''}
									>
										Viewer
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					)}
				</div>

				{error && <p className='text-red-500 text-center text-base'>{error}</p>}
				<div className='flex justify-end'>
					<Button onClick={handleValidate}>Validate changes</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
