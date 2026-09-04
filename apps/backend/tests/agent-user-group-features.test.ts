import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	hasUserGroupFeature: vi.fn(),
}));

vi.mock('../src/db/db', () => ({ db: {} }));
vi.mock('../src/services/user-group-feature-access.service', () => ({
	hasUserGroupFeature: mocks.hasUserGroupFeature,
}));

import {
	appendStoryCreationRestriction,
	filterAgentToolsByUserGroupFeatures,
	isStoryCreationRestricted,
	shouldAddStoryMode,
} from '../src/services/agent';

describe('agent user group feature tools', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('removes Story after resolving custom tools when denied', async () => {
		const tools = { story: { custom: true }, execute_sql: {}, custom: {} };

		expect(filterAgentToolsByUserGroupFeatures(tools as never, false)).toEqual({
			execute_sql: {},
			custom: {},
		});
	});

	it('preserves Story and all other tools when allowed or unlicensed', async () => {
		const tools = { story: {}, execute_sql: {}, custom: {} };

		expect(filterAgentToolsByUserGroupFeatures(tools as never, true)).toBe(tools);
	});

	it('adds the restriction to the final custom prompt only when Story was offered and denied', () => {
		const tools = { story: {}, execute_sql: {} };
		const restricted = isStoryCreationRestricted(tools as never, false);
		const prompt = appendStoryCreationRestriction('Custom project prompt', restricted);

		expect(prompt).toContain('Custom project prompt');
		expect(prompt).toContain('## User group permissions');
		expect(prompt).toContain('user can still view and manage existing Stories');
		expect(appendStoryCreationRestriction('Allowed prompt', false)).toBe('Allowed prompt');
		expect(isStoryCreationRestricted({ execute_sql: {} } as never, false)).toBe(false);
	});

	it('suppresses stale Story-mode mentions while restricted', () => {
		const mentions = [{ id: '__story__', label: 'Story mode', trigger: '#' }];

		expect(shouldAddStoryMode(mentions, false)).toBe(false);
		expect(shouldAddStoryMode(mentions, true)).toBe(true);
	});
});
