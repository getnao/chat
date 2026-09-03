import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	createUserGroup: vi.fn(),
	getUserGroupOverview: vi.fn(),
	hasFeature: vi.fn(),
	role: 'admin' as 'admin' | 'user',
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

		await createCaller().create({ name: ' Analysts ', featureGrants: ['stories', 'stories'] });

		expect(mocks.hasFeature).toHaveBeenCalledWith('user-groups');
		expect(mocks.createUserGroup).toHaveBeenCalledWith('project-id', 'Analysts', ['stories']);
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
