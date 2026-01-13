CREATE TABLE "chat" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'New Conversation' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_part" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"text" text,
	"reasoning_text" text,
	"tool_call_id" text,
	"tool_name" text,
	"tool_state" text,
	"tool_error_text" text,
	"tool_input" jsonb,
	"tool_output" jsonb,
	"tool_approval_id" text,
	"tool_approval_approved" boolean,
	"tool_approval_reason" text,
	CONSTRAINT "text_required_if_type_is_text" CHECK (CASE WHEN "message_part"."type" = 'text' THEN "message_part"."text" IS NOT NULL ELSE TRUE END),
	CONSTRAINT "reasoning_text_required_if_type_is_reasoning" CHECK (CASE WHEN "message_part"."type" = 'reasoning' THEN "message_part"."reasoning_text" IS NOT NULL ELSE TRUE END),
	CONSTRAINT "tool_call_fields_required" CHECK (CASE WHEN "message_part"."type" LIKE 'tool-%' THEN "message_part"."tool_call_id" IS NOT NULL AND "message_part"."tool_state" IS NOT NULL ELSE TRUE END)
);
--> statement-breakpoint
ALTER TABLE "conversation" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tool_call" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "conversation" CASCADE;--> statement-breakpoint
DROP TABLE "tool_call" CASCADE;--> statement-breakpoint
ALTER TABLE "chat_message" RENAME COLUMN "conversation_id" TO "chat_id";--> statement-breakpoint
DROP INDEX "chat_message_conversationId_idx";--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_part" ADD CONSTRAINT "message_part_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_userId_idx" ON "chat" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "parts_message_id_idx" ON "message_part" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "parts_message_id_order_idx" ON "message_part" USING btree ("message_id","order");--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_message_chatId_idx" ON "chat_message" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "chat_message_createdAt_idx" ON "chat_message" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "chat_message" DROP COLUMN "content";