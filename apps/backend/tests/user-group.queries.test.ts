import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	process.env.MODE = 'test';
	process.env.NAO_MODE = 'self-hosted';
});

vi.mock('../src/db/db', async () => {
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const schema = await import('../src/db/sqlite-schema');
	return { db: drizzle('./db.sqlite', { schema }) };
});

import { db as appDb } from '../src/db/db';
import * as sqliteSchema from '../src/db/sqlite-schema';
import {
	organization,
	orgMember,
	project,
	projectMember,
	user,
	userGroup,
	userGroupMember,
} from '../src/db/sqlite-schema';
import {
	createUserGroup,
	deleteUserGroup,
	getUserGroupOverview,
	resolveEffectiveUserGroupFeatures,
	setUserGroupMembership,
	updateUserGroup,
	UserGroupQueryError,
} from '../src/queries/user-group.queries';

const db = drizzle('./db.sqlite', { schema: sqliteSchema });
const PROJECT_ID = 'user-group-project';
const ORG_ID = 'user-group-org';
const DIRECT_USER_ID = 'user-group-direct';
const INHERITED_USER_ID = 'user-group-inherited';
const BOTH_USER_ID = 'user-group-both';
const OUTSIDER_USER_ID = 'user-group-outsider';

describe('user group queries', () => {
	beforeEach(async () => {
		await cleanup();
		await db.insert(organization).values({ id: ORG_ID, name: 'User Group Org', slug: ORG_ID });
		await db.insert(project).values({
			id: PROJECT_ID,
			orgId: ORG_ID,
			name: 'User Group Project',
			type: 'local',
			path: '/tmp/user-group-project',
		});
		await db.insert(user).values([
			{ id: DIRECT_USER_ID, name: 'Direct User', email: 'user-group-direct@example.com' },
			{ id: INHERITED_USER_ID, name: 'Inherited User', email: 'user-group-inherited@example.com' },
			{ id: BOTH_USER_ID, name: 'Both User', email: 'user-group-both@example.com' },
			{ id: OUTSIDER_USER_ID, name: 'Outsider User', email: 'user-group-outsider@example.com' },
		]);
		await db.insert(projectMember).values([
			{ projectId: PROJECT_ID, userId: DIRECT_USER_ID, role: 'admin' },
			{ projectId: PROJECT_ID, userId: BOTH_USER_ID, role: 'viewer' },
		]);
		await db.insert(orgMember).values([
			{ orgId: ORG_ID, userId: INHERITED_USER_ID, role: 'user' },
			{ orgId: ORG_ID, userId: BOTH_USER_ID, role: 'admin' },
		]);
	});

	afterEach(cleanup);

	afterAll(() => {
		appDb.$client.close();
		db.$client.close();
	});

	it('lazily creates All Users with every effective project user and feature', async () => {
		const overview = await getUserGroupOverview(PROJECT_ID);
		const defaultGroup = overview.groups.find((group) => group.isDefault);

		expect(defaultGroup).toMatchObject({
			name: 'All Users',
			featureGrants: ['story-creation', 'automations', 'compact-mode'],
		});
		expect(overview.users.map(({ id }) => id).sort()).toEqual(
			[BOTH_USER_ID, DIRECT_USER_ID, INHERITED_USER_ID].sort(),
		);
		expect(overview.users.find(({ id }) => id === DIRECT_USER_ID)).toMatchObject({
			role: 'admin',
			source: 'project',
		});
		expect(overview.users.find(({ id }) => id === INHERITED_USER_ID)).toMatchObject({
			role: 'user',
			source: 'organization',
		});
		expect(overview.users.find(({ id }) => id === BOTH_USER_ID)).toMatchObject({
			role: 'viewer',
			source: 'both',
		});
		expect(overview.memberships.filter(({ groupId }) => groupId === defaultGroup?.id)).toHaveLength(3);
		expect(await getUserGroupOverview(PROJECT_ID)).toMatchObject({
			groups: [expect.objectContaining({ isDefault: true })],
		});
	});

	it('supports group CRUD and validates membership and default-group rules', async () => {
		const overview = await getUserGroupOverview(PROJECT_ID);
		const defaultGroup = overview.groups[0];
		const group = await createUserGroup(PROJECT_ID, 'Analysts');

		expect(group.featureGrants).toEqual([]);
		await setUserGroupMembership(PROJECT_ID, group.id, INHERITED_USER_ID, true);
		expect((await getUserGroupOverview(PROJECT_ID)).memberships).toContainEqual({
			groupId: group.id,
			userId: INHERITED_USER_ID,
		});

		const updated = await updateUserGroup(PROJECT_ID, group.id, {
			name: 'Data Analysts',
			featureGrants: ['story-creation'],
		});
		expect(updated).toMatchObject({ name: 'Data Analysts', featureGrants: ['story-creation'] });

		await expect(
			setUserGroupMembership(PROJECT_ID, group.id, OUTSIDER_USER_ID, true),
		).rejects.toMatchObject<UserGroupQueryError>({ code: 'BAD_REQUEST' });
		await expect(
			setUserGroupMembership(PROJECT_ID, defaultGroup.id, DIRECT_USER_ID, false),
		).rejects.toMatchObject<UserGroupQueryError>({ code: 'BAD_REQUEST' });
		await expect(
			updateUserGroup(PROJECT_ID, defaultGroup.id, { name: 'Everyone', featureGrants: [] }),
		).rejects.toMatchObject<UserGroupQueryError>({ code: 'BAD_REQUEST' });
		await expect(deleteUserGroup(PROJECT_ID, defaultGroup.id)).rejects.toMatchObject<UserGroupQueryError>({
			code: 'BAD_REQUEST',
		});

		await updateUserGroup(PROJECT_ID, defaultGroup.id, { featureGrants: ['automations'] });
		await deleteUserGroup(PROJECT_ID, group.id);
		expect((await getUserGroupOverview(PROJECT_ID)).groups).toHaveLength(1);
	});

	it('resolves every feature for an untouched project', async () => {
		await expect(resolveEffectiveUserGroupFeatures(PROJECT_ID, DIRECT_USER_ID)).resolves.toEqual([
			'story-creation',
			'automations',
			'compact-mode',
		]);
	});

	it('unions grants from the default and explicit groups', async () => {
		const overview = await getUserGroupOverview(PROJECT_ID);
		await updateUserGroup(PROJECT_ID, overview.groups[0].id, { featureGrants: ['story-creation'] });
		const analysts = await createUserGroup(PROJECT_ID, 'Analysts', ['automations']);
		await setUserGroupMembership(PROJECT_ID, analysts.id, DIRECT_USER_ID, true);

		await expect(resolveEffectiveUserGroupFeatures(PROJECT_ID, DIRECT_USER_ID)).resolves.toEqual([
			'story-creation',
			'automations',
		]);
	});

	it('uses a custom group when the default has no grants', async () => {
		const overview = await getUserGroupOverview(PROJECT_ID);
		await updateUserGroup(PROJECT_ID, overview.groups[0].id, { featureGrants: [] });
		const analysts = await createUserGroup(PROJECT_ID, 'Analysts', ['compact-mode']);
		await setUserGroupMembership(PROJECT_ID, analysts.id, DIRECT_USER_ID, true);

		await expect(resolveEffectiveUserGroupFeatures(PROJECT_ID, DIRECT_USER_ID)).resolves.toEqual(['compact-mode']);
	});

	it('deduplicates grants shared by multiple groups', async () => {
		const overview = await getUserGroupOverview(PROJECT_ID);
		await updateUserGroup(PROJECT_ID, overview.groups[0].id, { featureGrants: ['story-creation'] });
		const analysts = await createUserGroup(PROJECT_ID, 'Analysts', ['story-creation', 'automations']);
		await setUserGroupMembership(PROJECT_ID, analysts.id, DIRECT_USER_ID, true);

		await expect(resolveEffectiveUserGroupFeatures(PROJECT_ID, DIRECT_USER_ID)).resolves.toEqual([
			'story-creation',
			'automations',
		]);
	});

	it('normalizes legacy Story grants in effective features and overview output', async () => {
		const overview = await getUserGroupOverview(PROJECT_ID);
		const defaultGroup = overview.groups[0];
		await db
			.update(userGroup)
			.set({ featureGrants: ['stories', 'story-creation', 'stories'] as never })
			.where(eq(userGroup.id, defaultGroup.id));

		await expect(resolveEffectiveUserGroupFeatures(PROJECT_ID, DIRECT_USER_ID)).resolves.toEqual([
			'story-creation',
		]);
		await expect(getUserGroupOverview(PROJECT_ID)).resolves.toMatchObject({
			groups: [expect.objectContaining({ featureGrants: ['story-creation'] })],
		});
	});

	it('only uses the default group without explicit memberships', async () => {
		const overview = await getUserGroupOverview(PROJECT_ID);
		await updateUserGroup(PROJECT_ID, overview.groups[0].id, { featureGrants: ['automations'] });
		await createUserGroup(PROJECT_ID, 'Analysts', ['story-creation']);

		await expect(resolveEffectiveUserGroupFeatures(PROJECT_ID, DIRECT_USER_ID)).resolves.toEqual(['automations']);
	});
});

async function cleanup() {
	await db.delete(userGroupMember).where(eq(userGroupMember.userId, INHERITED_USER_ID));
	await db.delete(userGroup).where(eq(userGroup.projectId, PROJECT_ID));
	await db.delete(projectMember).where(eq(projectMember.projectId, PROJECT_ID));
	await db.delete(orgMember).where(eq(orgMember.orgId, ORG_ID));
	await db.delete(project).where(eq(project.id, PROJECT_ID));
	await db.delete(organization).where(eq(organization.id, ORG_ID));
	for (const userId of [DIRECT_USER_ID, INHERITED_USER_ID, BOTH_USER_ID, OUTSIDER_USER_ID]) {
		await db.delete(user).where(eq(user.id, userId));
	}
}
