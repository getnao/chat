import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, ToolLoopAgent } from 'ai';
import { z } from 'zod/v4';

import { tools } from '../agents/tools';
import type { App } from '../app';
import { authMiddleware } from '../middleware/auth';
import * as chatQueries from '../queries/chatQueries';
import { UIMessage } from '../types/chat';

const DEBUG_CHUNKS = false;

export const chatRoutes = async (app: App) => {
	app.addHook('preHandler', authMiddleware);

	app.post(
		'/agent',
		{ schema: { body: z.object({ message: z.custom<UIMessage>(), chatId: z.string().optional() }) } },
		async (request) => {
			const userId = request.user.id;
			const message = request.body.message;
			let chatId = request.body.chatId;
			const isNewChat = !chatId;

			if (!chatId) {
				// If no id, we create a new chat and insert the first message
				const title = message.parts.find((part) => part.type === 'text')?.text.slice(0, 64);
				const createdChat = await chatQueries.createChat({ title, userId }, message);
				chatId = createdChat.id;
			} else {
				// update the existing chat with the new message
				await chatQueries.upsertMessage(chatId, message);
			}

			const chat = await chatQueries.loadChat(chatId);
			const instructions = `
You are nao, an expert AI data analyst tailored for people doing analytics, you are integrated into an agentic workflow by nao Labs. 
You have access to user context defined as files and directories in the project folder. Databases content is defined as files in the project folder so you can eaily search for information about the database instead of querying the database directly (it's faster and avoid leaking sensitive information).

## Persona
- **Efficient & Proactive**: Value the user's time. Be concise. Anticipate needs and act without unnecessary hesitation.
- **Professional Tone**: Be professional and concise. Only use emojis when specifically asked to.
- **Direct Communication**: Avoid stating obvious facts, unnecessary explanations, or conversation fillers. Jump straight to providing value.

## Tool Usage Rules
- ONLY use tools specifically defined in your official tool list. NEVER use unavailable tools, even if they were used in previous messages.
- Describe tool actions in natural language (e.g., "I'm searching for X") rather than function names.
- Be efficient with tool calls and prefer calling multiple tools in parallel, especially when researching.
- If you can execute a SQL query, use the execute_sql tool for it.
			`;

			const agent = new ToolLoopAgent({
				model: openai.chat('gpt-5.1'),
				instructions,
				tools,
			});

			let stream = createUIMessageStream<UIMessage>({
				execute: async ({ writer }) => {
					if (isNewChat) {
						writer.write({
							type: 'data-newChat',
							data: {
								id: chatId,
								title: chat.title,
								createdAt: chat.createdAt,
								updatedAt: chat.updatedAt,
							},
						});
					}

					writer.write({
						type: 'start',
						messageId: crypto.randomUUID(),
					});
					writer.write({
						type: 'start-step',
					});

					const result = await agent.stream({
						messages: await convertToModelMessages(chat.messages as UIMessage[]),
					});

					writer.merge(result.toUIMessageStream({ sendStart: false }));
				},
				originalMessages: chat.messages as UIMessage[],
				onFinish: async (e) => {
					console.log('onFinish');
					await chatQueries.upsertMessage(chatId, e.responseMessage);
				},
			});

			if (DEBUG_CHUNKS) {
				stream = stream.pipeThrough(
					new TransformStream({
						transform: async (chunk, controller) => {
							console.log(chunk);
							controller.enqueue(chunk);
							await new Promise((resolve) => setTimeout(resolve, 250));
						},
					}),
				);
			}

			return createUIMessageStreamResponse({ stream });
		},
	);
};
