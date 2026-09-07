import { afterEach, describe, expect, it } from 'vitest';

import { __reloadEnvForTesting, env } from '../src/env';

describe('BETA_STORY_FILTERS_ENABLED', () => {
	const originalValue = process.env.BETA_STORY_FILTERS_ENABLED;

	afterEach(() => {
		setStoryFiltersFlag(originalValue);
	});

	it('enables story filters by default', () => {
		setStoryFiltersFlag(undefined);

		expect(env.BETA_STORY_FILTERS_ENABLED).toBe(true);
	});

	it('allows story filters to be disabled explicitly', () => {
		setStoryFiltersFlag('false');

		expect(env.BETA_STORY_FILTERS_ENABLED).toBe(false);
	});
});

function setStoryFiltersFlag(value: string | undefined) {
	if (value === undefined) {
		delete process.env.BETA_STORY_FILTERS_ENABLED;
	} else {
		process.env.BETA_STORY_FILTERS_ENABLED = value;
	}
	__reloadEnvForTesting();
}
