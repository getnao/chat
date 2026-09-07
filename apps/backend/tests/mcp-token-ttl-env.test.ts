import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// MCP_ACCESS_TOKEN_TTL / MCP_REFRESH_TOKEN_TTL are parsed from env at module load,
// so each case resets the module registry and re-imports env against process.env.
describe('MCP token TTL env', () => {
	let originalEnv: typeof process.env;

	beforeEach(() => {
		originalEnv = { ...process.env };
		process.env.BETTER_AUTH_URL = 'https://nao.internal.example';
		delete process.env.MCP_ACCESS_TOKEN_TTL;
		delete process.env.MCP_REFRESH_TOKEN_TTL;
		vi.resetModules();
	});

	afterEach(() => {
		process.env = originalEnv;
		vi.resetModules();
		vi.restoreAllMocks();
	});

	it('defaults to 24h access / 7d refresh when unset', async () => {
		const { env } = await import('../src/env');
		expect(env.MCP_ACCESS_TOKEN_TTL).toBe(86400);
		expect(env.MCP_REFRESH_TOKEN_TTL).toBe(604800);
	});

	it('honors overrides', async () => {
		process.env.MCP_ACCESS_TOKEN_TTL = '3600';
		process.env.MCP_REFRESH_TOKEN_TTL = '86400';
		const { env } = await import('../src/env');
		expect(env.MCP_ACCESS_TOKEN_TTL).toBe(3600);
		expect(env.MCP_REFRESH_TOKEN_TTL).toBe(86400);
	});

	it('rejects a non-positive TTL at parse time', async () => {
		process.env.MCP_ACCESS_TOKEN_TTL = '0';
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
			throw new Error(`process.exit(${code})`);
		}) as never);
		await expect(import('../src/env')).rejects.toThrow();
		exitSpy.mockRestore();
	});
});
