import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	createUserGroup: vi.fn(),
	getUserGroupOverview: vi.fn(),
	hasFeature: vi.fn(),
	resolveEffectiveUserGroupFeatures: vi.fn(),
	role: 'admin' as 'admin' | 'user' | 'viewer',
}));

vi.mock('../src/auth', () => ({ getAuth: vi.fn() }));
vi.mock('../src/queries/project.queries', () => ({
	getProjectByUserId: vi.fn(async () => ({ id: 'project-id', name: 'Project' })),
	getUserRoleInProject: vi.fn(async () => mocks.role),
}));
vi.mock('../src/queries/user-group.queries', () => ({
	UserGroupQueryError: class UserGroupQueryError extends Error {},
	createUserGroup: mocks.createUserGroup,
	deleteUserGroup: vi.fn(),
	getUserGroupOverview: mocks.getUserGroupOverview,
	resolveEffectiveUserGroupFeatures: mocks.resolveEffectiveUserGroupFeatures,
	setUserGroupMembership: vi.fn(),
	updateUserGroup: vi.fn(),
}));
vi.mock('../src/services/license.service', () => ({
	hasFeature: mocks.hasFeature,
	LICENSE_FEATURES: { userGroups: 'user-groups' },
}));
vi.mock('../src/services/sso-group-mapping.service', () => ({
	isGroupRoleMappingActive: vi.fn(async () => false),
}));

import { router } from '../src/trpc/trpc';
import { userGroupRoutes } from '../src/trpc/user-group.routes';

const testRouter = router(userGroupRoutes);

describe('user group routes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.role = 'admin';
		mocks.hasFeature.mockResolvedValue(true);
		mocks.getUserGroupOverview.mockResolvedValue({ users: [], groups: [], memberships: [] });
		mocks.resolveEffectiveUserGroupFeatures.mockResolvedValue(['story-creation']);
		mocks.createUserGroup.mockResolvedValue({ id: 'group-id', name: 'Analysts' });
	});

	it('rejects unlicensed requests without querying user groups', async () => {
		mocks.hasFeature.mockResolvedValue(false);

		await expect(createCaller().overview()).rejects.toMatchObject({
			code: 'FORBIDDEN',
			message: 'User Groups requires the Enterprise user-groups feature.',
		});
		expect(mocks.getUserGroupOverview).not.toHaveBeenCalled();
	});

	it('requires a project admin', async () => {
		mocks.role = 'user';

		await expect(createCaller().overview()).rejects.toMatchObject({ code: 'FORBIDDEN' });
		expect(mocks.hasFeature).not.toHaveBeenCalled();
	});

	it('validates feature keys and creates a licensed group', async () => {
		await expect(
			createCaller().create({ name: 'Analysts', featureGrants: ['unknown'] as never }),
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });

		await createCaller().create({
			name: ' Analysts ',
			featureGrants: ['story-creation', 'story-creation'],
		});

		expect(mocks.hasFeature).toHaveBeenCalledWith('user-groups');
		expect(mocks.createUserGroup).toHaveBeenCalledWith('project-id', 'Analysts', ['story-creation']);
	});

	it('returns effective features to viewers', async () => {
		mocks.role = 'viewer';

		await expect(createCaller().effectiveFeatures()).resolves.toEqual({
			'story-creation': true,
			automations: false,
			'compact-mode': false,
		});
		expect(mocks.resolveEffectiveUserGroupFeatures).toHaveBeenCalledWith('project-id', 'user-id');
	});

	it('returns all effective features without a user-groups license', async () => {
		mocks.role = 'viewer';
		mocks.hasFeature.mockResolvedValue(false);

		await expect(createCaller().effectiveFeatures()).resolves.toEqual({
			'story-creation': true,
			automations: true,
			'compact-mode': true,
		});
		expect(mocks.resolveEffectiveUserGroupFeatures).not.toHaveBeenCalled();
	});
});

function createCaller() {
	return testRouter.createCaller({
		session: {
			user: {
				id: 'user-id',
				name: 'Test User',
				email: 'test@example.com',
			},
		},
		selectedProjectId: 'project-id',
	} as never);
}
