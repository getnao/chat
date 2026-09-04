import { normalizeUserGroupFeatures, USER_GROUP_FEATURES, type UserGroupFeature } from '@nao/shared';
import { and, asc, desc, eq, isNotNull, or } from 'drizzle-orm';

import type { DBUserGroup } from '../db/abstractSchema';
import s from '../db/abstractSchema';
import { db } from '../db/db';
import {
	listUsersWithProjectAccess,
	listUsersWithProjectAccessDetails,
	type UserWithProjectAccessDetails,
} from './project.queries';

export const DEFAULT_USER_GROUP_NAME = 'All Users';

export interface UserGroupOverview {
	users: UserWithProjectAccessDetails[];
	groups: DBUserGroup[];
	memberships: Array<{ groupId: string; userId: string }>;
}

export class UserGroupQueryError extends Error {
	constructor(
		public readonly code: 'NOT_FOUND' | 'BAD_REQUEST' | 'CONFLICT',
		message: string,
	) {
		super(message);
	}
}

export const getUserGroupOverview = async (projectId: string): Promise<UserGroupOverview> => {
	await ensureDefaultUserGroup(projectId);
	const [users, groups, storedMemberships] = await Promise.all([
		listUsersWithProjectAccessDetails(projectId),
		listUserGroups(projectId),
		listUserGroupMemberships(projectId),
	]);
	const defaultGroup = groups.find((group) => group.isDefault);
	const defaultMemberships = defaultGroup ? users.map((user) => ({ groupId: defaultGroup.id, userId: user.id })) : [];
	const effectiveUserIds = new Set(users.map((user) => user.id));

	return {
		users,
		groups,
		memberships: [...defaultMemberships, ...storedMemberships.filter(({ userId }) => effectiveUserIds.has(userId))],
	};
};

export const ensureDefaultUserGroup = async (projectId: string): Promise<DBUserGroup> => {
	await db
		.insert(s.userGroup)
		.values({
			projectId,
			name: DEFAULT_USER_GROUP_NAME,
			isDefault: true,
			featureGrants: [...USER_GROUP_FEATURES],
		})
		.onConflictDoNothing()
		.execute();

	const [group] = await db
		.select()
		.from(s.userGroup)
		.where(and(eq(s.userGroup.projectId, projectId), eq(s.userGroup.isDefault, true)))
		.limit(1)
		.execute();
	if (!group) {
		throw new UserGroupQueryError('CONFLICT', 'The All Users group could not be created.');
	}
	return normalizeUserGroup(group);
};

export const resolveEffectiveUserGroupFeatures = async (
	projectId: string,
	userId: string,
): Promise<UserGroupFeature[]> => {
	await ensureDefaultUserGroup(projectId);
	const groups = await db
		.select({ featureGrants: s.userGroup.featureGrants })
		.from(s.userGroup)
		.leftJoin(
			s.userGroupMember,
			and(eq(s.userGroupMember.groupId, s.userGroup.id), eq(s.userGroupMember.userId, userId)),
		)
		.where(
			and(
				eq(s.userGroup.projectId, projectId),
				or(eq(s.userGroup.isDefault, true), isNotNull(s.userGroupMember.userId)),
			),
		)
		.orderBy(desc(s.userGroup.isDefault))
		.execute();

	return normalizeUserGroupFeatures(groups.flatMap((group) => group.featureGrants));
};

export const listUserGroups = async (projectId: string): Promise<DBUserGroup[]> =>
	db
		.select()
		.from(s.userGroup)
		.where(eq(s.userGroup.projectId, projectId))
		.orderBy(desc(s.userGroup.isDefault), asc(s.userGroup.name))
		.execute()
		.then((groups) => groups.map(normalizeUserGroup));

export const createUserGroup = async (
	projectId: string,
	name: string,
	featureGrants: UserGroupFeature[] = [],
): Promise<DBUserGroup> => {
	await ensureDefaultUserGroup(projectId);
	await assertNameAvailable(projectId, name);
	const [group] = await db
		.insert(s.userGroup)
		.values({ projectId, name, featureGrants: normalizeUserGroupFeatures(featureGrants), isDefault: false })
		.returning()
		.execute();
	return normalizeUserGroup(group);
};

export const updateUserGroup = async (
	projectId: string,
	groupId: string,
	data: { name?: string; featureGrants: UserGroupFeature[] },
): Promise<DBUserGroup> => {
	const group = await getUserGroup(projectId, groupId);
	if (group.isDefault && data.name !== undefined && data.name !== group.name) {
		throw new UserGroupQueryError('BAD_REQUEST', 'The All Users group cannot be renamed.');
	}
	if (data.name !== undefined && data.name !== group.name) {
		await assertNameAvailable(projectId, data.name, groupId);
	}
	const [updated] = await db
		.update(s.userGroup)
		.set({
			...(data.name === undefined ? {} : { name: data.name }),
			featureGrants: normalizeUserGroupFeatures(data.featureGrants),
			updatedAt: new Date(),
		})
		.where(and(eq(s.userGroup.id, groupId), eq(s.userGroup.projectId, projectId)))
		.returning()
		.execute();
	return normalizeUserGroup(updated);
};

export const deleteUserGroup = async (projectId: string, groupId: string): Promise<void> => {
	const group = await getUserGroup(projectId, groupId);
	if (group.isDefault) {
		throw new UserGroupQueryError('BAD_REQUEST', 'The All Users group cannot be deleted.');
	}
	await db
		.delete(s.userGroup)
		.where(and(eq(s.userGroup.id, groupId), eq(s.userGroup.projectId, projectId)))
		.execute();
};

export const listUserGroupMemberships = async (
	projectId: string,
): Promise<Array<{ groupId: string; userId: string }>> =>
	db
		.select({
			groupId: s.userGroupMember.groupId,
			userId: s.userGroupMember.userId,
		})
		.from(s.userGroupMember)
		.innerJoin(s.userGroup, eq(s.userGroup.id, s.userGroupMember.groupId))
		.where(eq(s.userGroup.projectId, projectId))
		.execute();

export const setUserGroupMembership = async (
	projectId: string,
	groupId: string,
	userId: string,
	isMember: boolean,
): Promise<void> => {
	const group = await getUserGroup(projectId, groupId);
	if (group.isDefault) {
		throw new UserGroupQueryError('BAD_REQUEST', 'Membership in All Users cannot be changed.');
	}
	const effectiveUsers = await listUsersWithProjectAccess(projectId);
	if (!effectiveUsers.some((user) => user.id === userId)) {
		throw new UserGroupQueryError('BAD_REQUEST', 'This user does not have access to the project.');
	}

	if (isMember) {
		await db.insert(s.userGroupMember).values({ groupId, userId }).onConflictDoNothing().execute();
		return;
	}
	await db
		.delete(s.userGroupMember)
		.where(and(eq(s.userGroupMember.groupId, groupId), eq(s.userGroupMember.userId, userId)))
		.execute();
};

const getUserGroup = async (projectId: string, groupId: string): Promise<DBUserGroup> => {
	const [group] = await db
		.select()
		.from(s.userGroup)
		.where(and(eq(s.userGroup.id, groupId), eq(s.userGroup.projectId, projectId)))
		.limit(1)
		.execute();
	if (!group) {
		throw new UserGroupQueryError('NOT_FOUND', 'User group not found.');
	}
	return group;
};

const assertNameAvailable = async (projectId: string, name: string, excludedGroupId?: string): Promise<void> => {
	const groups = await db
		.select({ id: s.userGroup.id })
		.from(s.userGroup)
		.where(and(eq(s.userGroup.projectId, projectId), eq(s.userGroup.name, name)))
		.execute();
	if (groups.some((group) => group.id !== excludedGroupId)) {
		throw new UserGroupQueryError('CONFLICT', 'A user group with this name already exists.');
	}
};

function normalizeUserGroup(group: DBUserGroup): DBUserGroup {
	return { ...group, featureGrants: normalizeUserGroupFeatures(group.featureGrants) };
}
