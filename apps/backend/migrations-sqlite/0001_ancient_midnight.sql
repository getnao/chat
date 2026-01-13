CREATE TABLE `chat` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text DEFAULT 'New Conversation' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_userId_idx` ON `chat` (`user_id`);--> statement-breakpoint
CREATE TABLE `message_part` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`order` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`type` text NOT NULL,
	`text` text,
	`reasoning_text` text,
	`tool_call_id` text,
	`tool_name` text,
	`tool_state` text,
	`tool_error_text` text,
	`tool_input` text,
	`tool_output` text,
	`tool_approval_id` text,
	`tool_approval_approved` integer,
	`tool_approval_reason` text,
	FOREIGN KEY (`message_id`) REFERENCES `chat_message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `parts_message_id_idx` ON `message_part` (`message_id`);--> statement-breakpoint
CREATE INDEX `parts_message_id_order_idx` ON `message_part` (`message_id`,`order`);--> statement-breakpoint
DROP TABLE `conversation`;--> statement-breakpoint
DROP TABLE `tool_call`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_chat_message` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chat`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_chat_message`("id", "chat_id", "role", "created_at") SELECT "id", "conversation_id", "role", "created_at" FROM `chat_message`;--> statement-breakpoint
DROP TABLE `chat_message`;--> statement-breakpoint
ALTER TABLE `__new_chat_message` RENAME TO `chat_message`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `chat_message_chatId_idx` ON `chat_message` (`chat_id`);--> statement-breakpoint
CREATE INDEX `chat_message_createdAt_idx` ON `chat_message` (`created_at`);