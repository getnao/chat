import { describe, expect, it } from 'vitest';

import { getRenderableUserGroupFeatures } from './effective-user-group-features';

const grantedFeatures = {
	stories: true,
	automations: false,
	'compact-mode': true,
};

describe('getRenderableUserGroupFeatures', () => {
	it('returns effective grants only when they are available', () => {
		expect(getRenderableUserGroupFeatures(grantedFeatures, true)).toEqual(grantedFeatures);
	});

	it('denies every feature while loading or after an error', () => {
		expect(getRenderableUserGroupFeatures(grantedFeatures, false)).toEqual({
			stories: false,
			automations: false,
			'compact-mode': false,
		});
	});

	it('denies every feature when no project result exists', () => {
		expect(getRenderableUserGroupFeatures(undefined, true)).toEqual({
			stories: false,
			automations: false,
			'compact-mode': false,
		});
	});
});
