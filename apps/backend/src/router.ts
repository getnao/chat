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
});

export type TrpcRouter = typeof trpcRouter;
