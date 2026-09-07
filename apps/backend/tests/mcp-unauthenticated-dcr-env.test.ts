import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ALLOW_UNAUTHENTICATED_DCR is parsed from env at module load, so each case resets
// the module registry and re-imports env against process.env.
describe('ALLOW_UNAUTHENTICATED_DCR env', () => {
	let originalEnv: typeof process.env;

	beforeEach(() => {
		originalEnv = { ...process.env };
		process.env.BETTER_AUTH_URL = 'https://nao.internal.example';
		delete process.env.ALLOW_UNAUTHENTICATED_DCR;
		vi.resetModules();
	});

	afterEach(() => {
		process.env = originalEnv;
		vi.resetModules();
		vi.restoreAllMocks();
	});

	it('defaults to true (preserves prior behavior)', async () => {
		const { env } = await import('../src/env');
		expect(env.ALLOW_UNAUTHENTICATED_DCR).toBe(true);
	});

	it('can be disabled with "false"', async () => {
		process.env.ALLOW_UNAUTHENTICATED_DCR = 'false';
		const { env } = await import('../src/env');
		expect(env.ALLOW_UNAUTHENTICATED_DCR).toBe(false);
	});

	it('accepts "true"', async () => {
		process.env.ALLOW_UNAUTHENTICATED_DCR = 'true';
		const { env } = await import('../src/env');
		expect(env.ALLOW_UNAUTHENTICATED_DCR).toBe(true);
	});
});
