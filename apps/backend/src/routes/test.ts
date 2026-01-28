/**
 * Test routes for nao test command.
 * These routes are unauthenticated and meant for local testing only.
 */
import { AnthropicProviderOptions, createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI, OpenAIResponsesProviderOptions } from '@ai-sdk/openai';
import { convertToModelMessages, StreamTextResult, ToolLoopAgent, ToolLoopAgentSettings } from 'ai';
import { z } from 'zod/v4';

import { getInstructions } from '../agents/prompt';
import { tools } from '../agents/tools';
import type { App } from '../app';
import { UIMessage } from '../types/chat';

// Only enable test routes in development/test mode
const TEST_MODE_ENABLED = process.env.NAO_TEST_MODE === 'true' || process.env.NODE_ENV !== 'production';

interface TestAgentResponse {
	messages: UIMessage[];
	finalText: string;
	totalTokens: {
		input: number;
		output: number;
		total: number;
	};
	stopReason: string;
}

async function getModelConfig(): Promise<Pick<ToolLoopAgentSettings, 'model' | 'providerOptions'>> {
	// Use environment variables for model config in test mode
	if (process.env.ANTHROPIC_API_KEY) {
		const provider = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
		return {
			model: provider.chat('claude-sonnet-4-20250514'),
			providerOptions: {
				anthropic: {
					disableParallelToolUse: false,
				} satisfies AnthropicProviderOptions,
			},
		};
	}

	if (process.env.OPENAI_API_KEY) {
		const provider = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
		return {
			model: provider.chat('gpt-4o'),
			providerOptions: {
				openai: {} satisfies OpenAIResponsesProviderOptions,
			},
		};
	}

	throw new Error('No LLM API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable.');
}

export const testRoutes = async (app: App) => {
	if (!TEST_MODE_ENABLED) {
		console.log('Test routes disabled (production mode)');
		return;
	}

	console.log('Test routes enabled');

	/**
	 * Run a single agent turn with messages and return the response.
	 * This endpoint is synchronous and waits for the agent to complete.
	 */
	app.post(
		'/run',
		{
			schema: {
				body: z.object({
					messages: z.array(z.custom<UIMessage>()),
				}),
			},
		},
		async (request, reply) => {
			try {
				const { messages } = request.body;
				const modelConfig = await getModelConfig();

				const agent = new ToolLoopAgent({
					...modelConfig,
					tools,
					instructions: getInstructions(),
				});

				// Use stream() and consume the full stream to get the final result
				const result: StreamTextResult<typeof tools, never> = await agent.stream({
					messages: await convertToModelMessages(messages),
				});

				// Consume the stream and get the final text
				// We need to read the text property which returns a promise that resolves
				// when the stream is complete
				const finalText = await result.text;

				// Get token usage
				const usage = await result.totalUsage;
				const totalTokens = {
					input: usage.inputTokens || 0,
					output: usage.outputTokens || 0,
					total: (usage.inputTokens || 0) + (usage.outputTokens || 0),
				};

				// Get response metadata and finish reason (both are promises in streaming)
				const responseMetadata = await result.response;
				const finishReason = await result.finishReason;

				const response: TestAgentResponse = {
					messages: responseMetadata.messages as unknown as UIMessage[],
					finalText,
					totalTokens,
					stopReason: finishReason || 'stop',
				};

				return reply.send(response);
			} catch (error) {
				console.error('Test agent error:', error);
				return reply.status(500).send({
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		},
	);

	/**
	 * Health check for test routes
	 */
	app.get('/health', async () => {
		return { status: 'ok', testMode: true };
	});
};
