import type { UIMessage } from 'backend/chat';

export interface MessageGroup {
	user: UIMessage;
	response: UIMessage[];
}
