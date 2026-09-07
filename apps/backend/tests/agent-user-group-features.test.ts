import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getEffectiveUserGroupFeatureFlags: vi.fn(),
}));

vi.mock('../src/db/db', () => ({ db: {} }));
vi.mock('../src/services/user-group-feature-access.service', () => ({
	getEffectiveUserGroupFeatureFlags: mocks.getEffectiveUserGroupFeatureFlags,
}));

import {
	appendUserGroupRestrictions,
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

	it('adds Story and Automation restrictions under one heading', () => {
		const tools = { story: {}, execute_sql: {} };
		const prompt = appendUserGroupRestrictions('Custom project prompt', {
			storyCreation: isStoryCreationRestricted(tools as never, false),
			automationCreation: true,
		});

		expect(prompt).toContain('Custom project prompt');
		expect(prompt).toContain('## User group permissions');
		expect(prompt).toContain('user can still view and manage existing Stories');
		expect(prompt).toContain('Automation creation is unavailable');
		expect(prompt).toContain('user can still view and manage existing Automations');
		expect(prompt.match(/## User group permissions/g)).toHaveLength(1);
		expect(isStoryCreationRestricted({ execute_sql: {} } as never, false)).toBe(false);
	});

	it('omits restrictions that are allowed or unavailable in the candidate tools', () => {
		expect(
			appendUserGroupRestrictions('Allowed prompt', {
				storyCreation: false,
				automationCreation: false,
			}),
		).toBe('Allowed prompt');

		const automationOnly = appendUserGroupRestrictions('Prompt', {
			storyCreation: isStoryCreationRestricted({ execute_sql: {} } as never, false),
			automationCreation: true,
		});
		expect(automationOnly).not.toContain('Story creation through the agent is unavailable');
		expect(automationOnly).toContain('Automation creation is unavailable');
	});

	it('suppresses stale Story-mode mentions while restricted', () => {
		const mentions = [{ id: '__story__', label: 'Story mode', trigger: '#' }];

		expect(shouldAddStoryMode(mentions, false)).toBe(false);
		expect(shouldAddStoryMode(mentions, true)).toBe(true);
	});
});
