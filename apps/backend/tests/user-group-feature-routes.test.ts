import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	automationsEnabled: true,
	getStoryOwnerId: vi.fn(),
	getStoryProjectId: vi.fn(),
	hasLicenseFeature: vi.fn(),
	resolveEffectiveUserGroupFeatures: vi.fn(),
	role: 'user' as 'admin' | 'user' | 'viewer' | null,
}));

vi.mock('../src/env', () => ({
	env: {
		get BETA_AUTOMATIONS_ENABLED() {
			return mocks.automationsEnabled;
		},
	},
}));
vi.mock('../src/auth', () => ({ getAuth: vi.fn() }));
vi.mock('../src/db/db', () => ({ db: {} }));
vi.mock('../src/handlers/automation.handler', () => ({
	AUTOMATION_JOB_NAME: 'automation',
	startAutomationRun: vi.fn(),
}));
vi.mock('../src/handlers/story-refresh.handler', () => ({ STORY_REFRESH_JOB_NAME: 'story-refresh' }));
vi.mock('../src/queries/automation.queries', () => ({
	listAutomations: vi.fn(),
}));
vi.mock('../src/queries/project.queries', () => ({
	getProjectByUserId: vi.fn(async () => ({ id: 'project-id', name: 'Project' })),
	getUserRoleInProject: vi.fn(async () => mocks.role),
}));
vi.mock('../src/queries/user-group.queries', () => ({
	resolveEffectiveUserGroupFeatures: mocks.resolveEffectiveUserGroupFeatures,
}));
vi.mock('../src/queries/story.queries', () => ({
	getStoryOwnerId: mocks.getStoryOwnerId,
	getStoryProjectId: mocks.getStoryProjectId,
}));
vi.mock('../src/services/agent', () => ({ agentService: { get: vi.fn() } }));
vi.mock('../src/services/license.service', () => ({
	hasFeature: mocks.hasLicenseFeature,
	LICENSE_FEATURES: { userGroups: 'user-groups' },
}));
vi.mock('../src/services/sso-group-mapping.service', () => ({
	isGroupRoleMappingActive: vi.fn(async () => false),
}));

import { automationRoutes } from '../src/trpc/automation.routes';
import { storyRoutes } from '../src/trpc/story.routes';
import { router } from '../src/trpc/trpc';

const testRouter = router({
	automation: automationRoutes,
	story: storyRoutes,
});

describe('user group feature route enforcement', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.automationsEnabled = true;
		mocks.role = 'user';
		mocks.getStoryOwnerId.mockResolvedValue('user-id');
		mocks.getStoryProjectId.mockResolvedValue('project-id');
		mocks.hasLicenseFeature.mockResolvedValue(true);
		mocks.resolveEffectiveUserGroupFeatures.mockResolvedValue(['stories', 'automations', 'compact-mode']);
	});

	it('denies Automations after the beta and role checks', async () => {
		mocks.resolveEffectiveUserGroupFeatures.mockResolvedValue(['stories']);

		await expect(createCaller().automation.list()).rejects.toMatchObject({
			code: 'FORBIDDEN',
			message: 'Automations is not enabled for your user group.',
		});
		expect(mocks.resolveEffectiveUserGroupFeatures).toHaveBeenCalledWith('project-id', 'user-id');
	});

	it('preserves the Automation beta check before feature grants', async () => {
		mocks.automationsEnabled = false;

		await expect(createCaller().automation.list()).rejects.toMatchObject({
			code: 'FORBIDDEN',
			message: 'Automations are disabled on this instance.',
		});
		expect(mocks.resolveEffectiveUserGroupFeatures).not.toHaveBeenCalled();
	});

	it('preserves the Automation role check before feature grants', async () => {
		mocks.role = 'viewer';

		await expect(createCaller().automation.get({ id: 'automation-id' })).rejects.toMatchObject({
			code: 'FORBIDDEN',
			message: 'Viewers cannot perform this action',
		});
		expect(mocks.resolveEffectiveUserGroupFeatures).not.toHaveBeenCalled();
	});

	it('preserves Story ownership before feature grants', async () => {
		mocks.getStoryOwnerId.mockResolvedValue('another-user');

		await expect(createCaller().story.getStandalone({ storyId: 'story-id' })).rejects.toMatchObject({
			code: 'FORBIDDEN',
			message: 'You are not authorized to modify this story.',
		});
		expect(mocks.resolveEffectiveUserGroupFeatures).not.toHaveBeenCalled();
	});

	it('denies an owned Story without the grant', async () => {
		mocks.resolveEffectiveUserGroupFeatures.mockResolvedValue(['automations']);

		await expect(createCaller().story.getStandalone({ storyId: 'story-id' })).rejects.toMatchObject({
			code: 'FORBIDDEN',
			message: 'Stories is not enabled for your user group.',
		});
		expect(mocks.resolveEffectiveUserGroupFeatures).toHaveBeenCalledWith('project-id', 'user-id');
	});
});

function createCaller() {
	return testRouter.createCaller({
		session: { user: { id: 'user-id', name: 'Test User', email: 'test@example.com' } },
		selectedProjectId: 'project-id',
	} as never);
}
