import { WebClient } from '@slack/web-api';

import { User } from '../db/abstractSchema';
import * as chatQueries from '../queries/chatQueries';
import { getUser } from '../queries/userQueries';
import { UIMessage } from '../types/chat';

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const redirectUrl = 'http://localhost:3000/';

const saveOrUpdateSlackUserMessage = async (text: string, threadTs: string, user: User) => {
	const existingChat = await chatQueries.getChatBySlackThread(threadTs);

	let chatId: string;
	if (existingChat) {
		await updateSlackUserMessage(text, existingChat);
		chatId = existingChat.id;
	} else {
		const createdChat = await saveSlackUserMessage(text, user.id, threadTs);
		chatId = createdChat.id;
	}
	return chatId;
};

const updateSlackUserMessage = async (text: string, existingChat: { id: string; title: string }) => {
	const userMessage = createTextMessage(text, 'user');
	await chatQueries.upsertMessage(existingChat.id, userMessage);
};

const saveSlackUserMessage = async (text: string, userId: string, slackThreadTs?: string) => {
	const userMessage = createTextMessage(text, 'user');

	const createdChat = await chatQueries.createChat({ title: text.slice(0, 64), userId, slackThreadTs }, userMessage);
	return createdChat;
};

const createTextMessage = (text: string, role: 'system' | 'user' | 'assistant'): UIMessage => {
	const message: UIMessage = {
		id: crypto.randomUUID(),
		role,
		parts: [{ type: 'text', text }],
	};
	return message;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const getSlackUser = async (body: any, channel: string, threadTs: string, reply: any): Promise<User> => {
	reply.send({ ok: true });
	const userEmail = await getSlackUserEmail(body.event?.user);

	const user = await getUser({ email: userEmail! });
	if (!user) {
		const fullMessage = `❌ On nao-chat, create a user account with ${userEmail} to use this bot. \n\n Go to ${redirectUrl} to sign up.`;
		await slackClient.chat.postMessage({
			channel: channel,
			text: fullMessage,
			thread_ts: threadTs,
		});
		throw new Error('User not found');
	}
	return user;
};

const getSlackUserEmail = async (userId: string): Promise<string | null> => {
	const userProfile = await slackClient.users.profile.get({ user: userId });
	return userProfile.profile?.email || null;
};

const sendFirstResponseAcknowledgement = async (channel: string, threadTs: string, reply: any) => {
	reply.send({ ok: true });
	await slackClient.chat.postMessage({
		channel: channel,
		text: '🔄 Nao is analyzing your request... This may take a moment.',
		thread_ts: threadTs,
	});
};

const saveSlackAgentResponse = async (chatId: string, responseText: string) => {
	const assistantMessage = createTextMessage(responseText, 'assistant');
	await chatQueries.upsertMessage(chatId, assistantMessage);
};

export {
	createTextMessage,
	getSlackUser,
	redirectUrl,
	saveOrUpdateSlackUserMessage,
	saveSlackAgentResponse,
	sendFirstResponseAcknowledgement,
	slackClient,
};
