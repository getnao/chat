import type { App } from '../app';
import { slackAuthMiddleware } from '../middleware/auth';
import { getSlackUser, handleSlackWorkFlow, sendSlackRequestAcknowledgement } from '../utils/slack';

export const slackRoutes = async (app: App) => {
	app.addHook('preHandler', slackAuthMiddleware);

	app.post('/app_mention', { config: { rawBody: true } }, async (request, reply) => {
		try {
			/* eslint-disable @typescript-eslint/no-explicit-any */
			const body = request.body as any;

			if (body.type === 'url_verification') {
				return reply.send({ challenge: body.challenge });
			}

			const text = (body.event?.text ?? '').replace(/<@[A-Z0-9]+>/gi, '').trim();
			const channel = body.event?.channel;
			const threadTs = body.event?.thread_ts || body.event?.ts;

			if (!text || !channel) {
				throw new Error('Invalid request: missing text or channel');
			}

			const user = await getSlackUser(body, channel, threadTs, reply);

			// Acknowledge the event within 3 seconds limit and respond with a waiting message
			await sendSlackRequestAcknowledgement(channel, threadTs, reply);

			// Handle the main workflow
			await handleSlackWorkFlow(user, text, threadTs, channel);
		} catch (error) {
			return reply.status(500).send({ error });
		}
	});
};
