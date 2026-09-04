import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	hasUserGroupFeature: vi.fn(),
}));

vi.mock('../src/db/db', () => ({ db: {} }));
vi.mock('../src/services/user-group-feature-access.service', () => ({
	hasUserGroupFeature: mocks.hasUserGroupFeature,
}));

import { filterAgentToolsByUserGroupFeatures } from '../src/services/agent';

const chat = {
	id: 'chat-id',
	projectId: 'project-id',
	userId: 'user-id',
};

describe('agent user group feature tools', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('removes Story after resolving custom tools when denied', async () => {
		mocks.hasUserGroupFeature.mockResolvedValue(false);
		const tools = { story: { custom: true }, execute_sql: {}, custom: {} };

		await expect(filterAgentToolsByUserGroupFeatures(tools as never, chat)).resolves.toEqual({
			execute_sql: {},
			custom: {},
		});
	});

	it('preserves Story and all other tools when allowed or unlicensed', async () => {
		mocks.hasUserGroupFeature.mockResolvedValue(true);
		const tools = { story: {}, execute_sql: {}, custom: {} };

		await expect(filterAgentToolsByUserGroupFeatures(tools as never, chat)).resolves.toBe(tools);
	});
});
