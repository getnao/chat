import { z } from 'zod/v4';

export const ZSlackEvent = z.object({
	type: z.string(),
	user: z.string(),
	ts: z.string(),
	thread_ts: z.string().optional(),
	text: z.string(),
	channel: z.string(),
	event_ts: z.string(),
});

export const ZSlackRequest = z.object({
	type: z.string().optional(),
	challenge: z.string().optional(),
	token: z.string().optional(),
	event: ZSlackEvent.optional(),
});

export type SlackRequest = z.infer<typeof ZSlackRequest>;
export type SlackEvent = z.infer<typeof ZSlackEvent>;

export interface ValidatedSlackRequest {
	type?: string;
	challenge?: string;
	token?: string;
	event: SlackEvent;
}
