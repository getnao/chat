import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	hasFeature: vi.fn(),
	resolveEffectiveUserGroupFeatures: vi.fn(),
}));

vi.mock('../src/queries/user-group.queries', () => ({
	resolveEffectiveUserGroupFeatures: mocks.resolveEffectiveUserGroupFeatures,
}));
vi.mock('../src/services/license.service', () => ({
	hasFeature: mocks.hasFeature,
	LICENSE_FEATURES: { userGroups: 'user-groups' },
}));

import {
	assertUserGroupFeature,
	getEffectiveUserGroupFeatureFlags,
	getEffectiveUserGroupFeatures,
	hasUserGroupFeature,
} from '../src/services/user-group-feature-access.service';

describe('user group feature access service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.hasFeature.mockResolvedValue(true);
		mocks.resolveEffectiveUserGroupFeatures.mockResolvedValue(['stories']);
	});

	it('fails open without querying groups when user groups are unlicensed', async () => {
		mocks.hasFeature.mockResolvedValue(false);

		await expect(getEffectiveUserGroupFeatures('project-id', 'user-id')).resolves.toEqual([
			'stories',
			'automations',
			'compact-mode',
		]);
		expect(mocks.resolveEffectiveUserGroupFeatures).not.toHaveBeenCalled();
	});

	it('returns typed flags for licensed effective grants', async () => {
		await expect(getEffectiveUserGroupFeatureFlags('project-id', 'user-id')).resolves.toEqual({
			stories: true,
			automations: false,
			'compact-mode': false,
		});
	});

	it('allows and denies licensed feature checks', async () => {
		await expect(hasUserGroupFeature('project-id', 'user-id', 'stories')).resolves.toBe(true);
		await expect(assertUserGroupFeature('project-id', 'user-id', 'automations')).rejects.toMatchObject({
			codeMessage: 'FORBIDDEN',
			message: 'Automations is not enabled for your user group.',
		});
	});
});
