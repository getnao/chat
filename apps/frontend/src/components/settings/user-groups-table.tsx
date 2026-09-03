import { USER_GROUP_FEATURE_DEFINITIONS } from '@nao/shared';
import { USER_ROLE_LABELS } from '@nao/shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { UpgradeToEnterprise } from '@/components/settings/upgrade-to-enterprise';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SettingsCard } from '@/components/ui/settings-card';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLicenseFeatures } from '@/hooks/use-license';
import { trpc } from '@/main';

type UserGroupFeature = (typeof USER_GROUP_FEATURE_DEFINITIONS)[number]['key'];

interface UserGroup {
	id: string;
	name: string;
	isDefault: boolean;
	featureGrants: UserGroupFeature[];
}

export function UserGroupsTable() {
	const licenseFeatures = useLicenseFeatures();

	if (licenseFeatures.isLoading) {
		return <div className='text-sm text-muted-foreground'>Loading User Groups...</div>;
	}
	if (licenseFeatures.isError) {
		return <div className='text-sm text-destructive'>Failed to load license features.</div>;
	}
	if (!licenseFeatures.data?.['user-groups']) {
		return (
			<SettingsCard
				description='Control which product features project users can access.'
				action={<UpgradeToEnterprise />}
			>
				<p className='text-sm text-muted-foreground'>User Groups is available with nao Enterprise.</p>
			</SettingsCard>
		);
	}

	return <LicensedUserGroupsTable />;
}

function LicensedUserGroupsTable() {
	const queryClient = useQueryClient();
	const overview = useQuery(trpc.userGroup.overview.queryOptions());
	const setMembership = useMutation(
		trpc.userGroup.setMembership.mutationOptions({
			onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.userGroup.overview.queryKey() }),
		}),
	);
	const [editingGroup, setEditingGroup] = useState<UserGroup | 'new' | null>(null);
	const membershipKeys = useMemo(
		() => new Set(overview.data?.memberships.map(({ groupId, userId }) => `${groupId}:${userId}`)),
		[overview.data?.memberships],
	);

	if (overview.isLoading) {
		return <div className='text-sm text-muted-foreground'>Loading groups...</div>;
	}
	if (overview.isError) {
		return <div className='text-sm text-destructive'>Failed to load User Groups.</div>;
	}
	if (!overview.data) {
		return null;
	}

	return (
		<>
			<SettingsCard
				description='Assign project users to groups and configure the features each group allows.'
				action={
					<Button size='sm' variant='secondary' onClick={() => setEditingGroup('new')}>
						<Plus />
						Create group
					</Button>
				}
				flush
			>
				<div className='overflow-x-auto'>
					<Table className='min-w-max'>
						<TableHeader>
							<TableRow>
								<TableHead className='sticky left-0 z-10 min-w-64 bg-background'>User</TableHead>
								<TableHead className='min-w-28'>Role</TableHead>
								{overview.data.groups.map((group) => (
									<TableHead key={group.id} className='min-w-36 text-center'>
										<button
											type='button'
											className='inline-flex items-center gap-1 font-medium hover:text-foreground'
											onClick={() => setEditingGroup(group)}
										>
											{group.name}
											<Pencil className='size-3' />
										</button>
									</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{overview.data.users.length === 0 ? (
								<TableRow>
									<TableCell colSpan={2 + overview.data.groups.length} className='h-24 text-center'>
										No users have access to this project.
									</TableCell>
								</TableRow>
							) : (
								overview.data.users.map((user) => (
									<TableRow key={user.id}>
										<TableCell className='sticky left-0 z-10 bg-background'>
											<div className='flex flex-col'>
												<span className='font-medium'>{user.name}</span>
												<span className='text-xs text-muted-foreground'>
													{user.email}
													{user.status ? ` · ${user.status}` : ''}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<Badge variant={user.role}>{USER_ROLE_LABELS[user.role]}</Badge>
										</TableCell>
										{overview.data.groups.map((group) => (
											<TableCell key={group.id} className='text-center'>
												<Switch
													aria-label={`${user.name} in ${group.name}`}
													checked={
														group.isDefault || membershipKeys.has(`${group.id}:${user.id}`)
													}
													disabled={group.isDefault || setMembership.isPending}
													onCheckedChange={(isMember) =>
														setMembership.mutate({
															groupId: group.id,
															userId: user.id,
															isMember,
														})
													}
												/>
											</TableCell>
										))}
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</SettingsCard>

			<UserGroupDialog
				group={editingGroup}
				onOpenChange={(open) => {
					if (!open) {
						setEditingGroup(null);
					}
				}}
			/>
		</>
	);
}

function UserGroupDialog({
	group,
	onOpenChange,
}: {
	group: UserGroup | 'new' | null;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const existingGroup = group === 'new' ? null : group;
	const [name, setName] = useState('');
	const [featureGrants, setFeatureGrants] = useState<UserGroupFeature[]>([]);
	const [formError, setFormError] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const invalidateOverview = () => queryClient.invalidateQueries({ queryKey: trpc.userGroup.overview.queryKey() });
	const createGroup = useMutation(trpc.userGroup.create.mutationOptions());
	const updateGroup = useMutation(trpc.userGroup.update.mutationOptions());
	const deleteGroup = useMutation(trpc.userGroup.delete.mutationOptions());

	useEffect(() => {
		setName(existingGroup?.name ?? '');
		setFeatureGrants(existingGroup?.featureGrants ?? []);
		setFormError(null);
		setConfirmDelete(false);
	}, [existingGroup]);

	const handleSave = async () => {
		setFormError(null);
		try {
			if (existingGroup) {
				await updateGroup.mutateAsync({
					groupId: existingGroup.id,
					...(existingGroup.isDefault ? {} : { name }),
					featureGrants,
				});
			} else {
				await createGroup.mutateAsync({ name, featureGrants });
			}
			await invalidateOverview();
			onOpenChange(false);
		} catch (error) {
			setFormError(error instanceof Error ? error.message : 'Failed to save the group.');
		}
	};

	const handleDelete = async () => {
		if (!existingGroup || existingGroup.isDefault) {
			return;
		}
		try {
			await deleteGroup.mutateAsync({ groupId: existingGroup.id });
			await invalidateOverview();
			setConfirmDelete(false);
			onOpenChange(false);
		} catch (error) {
			setConfirmDelete(false);
			setFormError(error instanceof Error ? error.message : 'Failed to delete the group.');
		}
	};

	return (
		<>
			<Dialog open={group !== null} onOpenChange={onOpenChange}>
				<DialogContent className='sm:max-w-xl'>
					<DialogHeader>
						<DialogTitle>{existingGroup ? `Edit ${existingGroup.name}` : 'Create group'}</DialogTitle>
					</DialogHeader>
					<div className='flex flex-col gap-6'>
						<div className='flex flex-col gap-2'>
							<label htmlFor='user-group-name' className='text-sm font-medium'>
								Group name
							</label>
							<Input
								id='user-group-name'
								value={name}
								onChange={(event) => setName(event.target.value)}
								disabled={existingGroup?.isDefault}
								required
								maxLength={80}
							/>
						</div>
						<div className='flex flex-col gap-3'>
							<div>
								<h3 className='text-sm font-medium'>Allowed features</h3>
								<p className='text-xs text-muted-foreground'>
									Choose which product features this group can use.
								</p>
							</div>
							{USER_GROUP_FEATURE_DEFINITIONS.map((feature) => (
								<div
									key={feature.key}
									className='flex items-start justify-between gap-4 rounded-lg border p-3'
								>
									<div>
										<label
											htmlFor={`user-group-feature-${feature.key}`}
											className='text-sm font-medium'
										>
											{feature.label}
										</label>
										<p className='text-xs text-muted-foreground'>{feature.description}</p>
									</div>
									<Switch
										id={`user-group-feature-${feature.key}`}
										checked={featureGrants.includes(feature.key)}
										onCheckedChange={(checked) =>
											setFeatureGrants((current) =>
												checked
													? [...current, feature.key]
													: current.filter((key) => key !== feature.key),
											)
										}
									/>
								</div>
							))}
						</div>
						{formError && <p className='text-sm text-destructive'>{formError}</p>}
						<div className='flex justify-between gap-2'>
							{existingGroup && !existingGroup.isDefault ? (
								<Button variant='destructive' onClick={() => setConfirmDelete(true)}>
									Delete group
								</Button>
							) : (
								<span />
							)}
							<div className='flex gap-2'>
								<Button variant='outline' onClick={() => onOpenChange(false)}>
									Cancel
								</Button>
								<Button
									onClick={handleSave}
									disabled={!existingGroup?.isDefault && name.trim().length === 0}
									isLoading={createGroup.isPending || updateGroup.isPending}
								>
									Save
								</Button>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {existingGroup?.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							This removes the group and all of its user memberships.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant='destructive'
							onClick={handleDelete}
							isLoading={deleteGroup.isPending}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
