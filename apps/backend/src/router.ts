import { z } from 'zod';

import { db } from './db/db';
import { publicProcedure, router } from './trpc';

export const trpcRouter = router({
	test: publicProcedure.query(() => {
		return { hello: 'world' };
	}),

	dbTest: publicProcedure
		.input(
			z.object({
				query: z.string(),
			}),
		)
		.query(({ input }) => {
			return db.run(input.query);
		}),

	hasGoogleSetup: publicProcedure.query(() => {
		return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
	}),
});

export type TrpcRouter = typeof trpcRouter;
