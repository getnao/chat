import { useQuery } from '@tanstack/react-query';
import { Plus, EllipsisVertical } from 'lucide-react';
import { NewlyCreatedUserDialog } from './settings-display-newUser';
import { ResetPasswordDialog } from './settings-reset-user-password';
import {
	DropdownMenu,
	DropdownMenuItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
	DropdownMenuGroup,
} from './ui/dropdown-menu';
import { trpc } from '@/main';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreateUserForm } from '@/components/settings-create-user-form';
import { Badge } from '@/components/ui/badge';
import { useUserPageContext } from '@/contexts/user.provider';

interface UsersListProps {
	isAdmin: boolean;
}

export function UsersList({ isAdmin }: UsersListProps) {
	const { setUserInfo, setIsModifyUserFormOpen, setIsCreateUserFormOpen, setIsResetUserPasswordOpen } =
		useUserPageContext();

	const usersWithRoles = useQuery(trpc.project.getAllUsersWithRoles.queryOptions());

	return (
		<div className='grid gap-4'>
			<div className='flex items-center justify-between'>
				<span className='text-sm font-medium text-foreground'>Users</span>
				{isAdmin && (
					<Button variant='secondary' size='icon-sm' onClick={() => setIsCreateUserFormOpen(true)}>
						<Plus className='size-4' />
					</Button>
				)}
			</div>

			{usersWithRoles.isLoading ? (
				<div className='text-sm text-muted-foreground'>Loading users...</div>
			) : usersWithRoles.data?.length === 0 ? (
				<div className='text-sm text-muted-foreground'>No users found.</div>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Email</TableHead>
							<TableHead>Role</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{usersWithRoles.data?.map((user) => (
							<TableRow key={user.id}>
								<TableCell className='font-medium'>{user.name}</TableCell>
								<TableCell className='font-mono text-muted-foreground'>{user.email}</TableCell>
								<TableCell>{user.role && <Badge variant={user.role}>{user.role}</Badge>}</TableCell>
								{isAdmin && (
									<TableCell className='w-0'>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant='ghost' size='icon-sm'>
													<EllipsisVertical className='size-4' />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent onClick={(e) => e.stopPropagation()}>
												<DropdownMenuGroup>
													<DropdownMenuItem
														onSelect={() => {
															setUserInfo({
																id: user.id,
																role: user.role,
																name: user.name,
																email: user.email,
															});
															setIsModifyUserFormOpen(true);
														}}
													>
														Edit user
													</DropdownMenuItem>
													<DropdownMenuItem
														onSelect={() => {
															setUserInfo({
																id: user.id,
																role: user.role,
																name: user.name,
																email: user.email,
															});
															setIsResetUserPasswordOpen(true);
														}}
													>
														Reset password
													</DropdownMenuItem>
												</DropdownMenuGroup>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								)}
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}

			<CreateUserForm />
			<NewlyCreatedUserDialog />
			<ResetPasswordDialog />
		</div>
	);
}
