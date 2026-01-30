import { z } from 'zod';

const envSchema = z.object({
	// Required
	DB_URI: z.string().default('sqlite:./db.sqlite'),
	REDIRECT_URL: z.url({ message: 'REDIRECT_URL must be a valid URL' }).default('http://localhost:3000/'),
	BETTER_AUTH_URL: z.url({ message: 'BETTER_AUTH_URL must be a valid URL' }),

	// Optional
	DB_SSL: z
		.enum(['true', 'false'])
		.optional()
		.transform((val) => val === 'true'),
	BETTER_AUTH_SECRET: z.string().min(20).or(z.literal('').optional()), // try to make min 1 if set and optional otherwise
	TRUSTED_ORIGINS: z
		.string()
		.optional()
		.transform((val) => (val ? val.split(',').map((s) => s.trim()) : undefined)),
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),
	GOOGLE_AUTH_DOMAINS: z.string().optional(),
	SLACK_BOT_TOKEN: z.string().optional(),
	SLACK_SIGNING_SECRET: z.string().optional(),
	FASTAPI_URL: z.url({ message: 'FASTAPI_URL must be a valid URL' }).optional(),
	NAO_DEFAULT_PROJECT_PATH: z.string().optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
	for (const issue of result.error.issues) {
		const path = issue.path.join('.');
		console.log(`${path}: ${issue.message}`);
	}
	process.exit(1);
}

export const env = result.data;
