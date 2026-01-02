import 'dotenv/config';

import { fastifyTRPCPlugin, FastifyTRPCPluginOptions } from '@trpc/server/adapters/fastify';
import fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';

import { TrpcRouter, trpcRouter } from './router';
import { authPlugin } from './routes/auth';
import { chatPlugin } from './routes/chat';

const app = fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();
export type App = typeof app;

// Set the validator and serializer compilers for the Zod type provider
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Register tRPC plugin
app.register(fastifyTRPCPlugin, {
	prefix: '/api/trpc',
	trpcOptions: {
		router: trpcRouter,
		// createContext,
		onError({ path, error }) {
			console.error(`Error in tRPC handler on path '${path}':`, error);
		},
	} satisfies FastifyTRPCPluginOptions<TrpcRouter>['trpcOptions'],
});

app.register(chatPlugin, {
	prefix: '/api',
});

app.register(authPlugin, {
	prefix: '/api',
});

/**
 * Tests the API connection
 */
app.get('/api', async () => {
	return 'Welcome to the API!';
});

export default app;
