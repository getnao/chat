import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { convertToModelMessages } from 'ai';
import { tool } from 'ai';
import { UIMessage } from 'ai';
import { z } from 'zod';

import { App } from '../app';

export const chatPlugin = async (app: App) => {
	app.addHook('preHandler', async (request, reply) => {
		console.log('[preHandler]');
	});

	app.post('/chat', { schema: { body: z.object({ messages: z.array(z.custom<UIMessage>()) }) } }, async (request) => {
		const { messages } = request.body;

		const response = streamText({
			model: openai.chat('gpt-4o'),
			messages: await convertToModelMessages(messages),
			tools: {
				getWeather: tool({
					description:
						'Get the current weather for a specified city. Use this when the user asks about weather.',
					inputSchema: z.object({
						city: z.string().describe('The city to get the weather for'),
					}),
				}),
			},
		});

		return response.toUIMessageStreamResponse();
	});
};
