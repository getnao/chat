import type { App } from '../app';
import { slackAuthMiddleware } from '../middleware/slack.middleware';
import { SlackService } from '../services/slack.service';
import { ValidatedSlackRequest, ZSlackRequest } from '../types/slack';

export const slackRoutes = async (app: App) => {
	// Verifying requests from Slack : verify whether requests from Slack are authentic
	// https://docs.slack.dev/authentication/verifying-requests-from-slack/#signing_secrets_admin_page
	app.addHook('preHandler', slackAuthMiddleware);

	app.post(
		'/app_mention',
		{
			config: { rawBody: true },
			schema: { body: ZSlackRequest },
		},
		async (request, reply) => {
			const body = request.body;

			if (body.type === 'url_verification') {
				return reply.send({ challenge: body.challenge });
			}

			if (!process.env.SLACK_BOT_TOKEN) {
				return reply.status(400).send({ error: 'SLACK_BOT_TOKEN is not defined in environment variables' });
			}

			if (!body.event) {
				return reply.status(400).send({ error: 'Invalid request: missing event object' });
			}

			if (!body.event.text || !body.event.channel || !body.event.ts || !body.event.user) {
				return reply
					.status(400)
					.send({ error: 'Invalid request: missing text, channel, thread timestamp, or user ID' });
			}

			const slackService = new SlackService(body as ValidatedSlackRequest);
			await slackService.sendRequestAcknowledgement(reply);

			await slackService.handleWorkFlow(reply);
		},
	);
};
