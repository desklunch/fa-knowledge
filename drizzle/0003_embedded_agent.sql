DO $$
BEGIN
  CREATE TYPE "agent_message_role" AS ENUM ('user', 'assistant');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "agent_attachment_entity_type" AS ENUM ('page');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "agent_action_type" AS ENUM ('apply_page_patch', 'discard_page_patch');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "agent_action_status" AS ENUM ('pending', 'completed', 'dismissed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "agent_patch_proposal_status" AS ENUM ('pending', 'applied', 'discarded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "agent_key" text NOT NULL,
  "title" text NOT NULL,
  "is_default" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL,
  "role" "agent_message_role" NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_message_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL,
  "entity_type" "agent_attachment_entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "label" text NOT NULL,
  "href" text,
  "sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_message_citations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL,
  "page_id" uuid NOT NULL,
  "page_title" text NOT NULL,
  "href" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_patch_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "assistant_message_id" uuid NOT NULL,
  "target_page_id" uuid NOT NULL,
  "base_revision_id" uuid NOT NULL,
  "proposed_title" text NOT NULL,
  "proposed_content_markdown" text NOT NULL,
  "rationale" text NOT NULL,
  "status" "agent_patch_proposal_status" DEFAULT 'pending' NOT NULL,
  "applied_revision_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL,
  "action_type" "agent_action_type" NOT NULL,
  "label" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" "agent_action_status" DEFAULT 'pending' NOT NULL,
  "target_entity_type" "agent_attachment_entity_type",
  "target_entity_id" uuid,
  "acted_by_user_id" uuid,
  "outcome_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "agent_threads"
    ADD CONSTRAINT "agent_threads_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "agent_messages"
    ADD CONSTRAINT "agent_messages_thread_id_agent_threads_id_fk"
    FOREIGN KEY ("thread_id") REFERENCES "public"."agent_threads"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "agent_message_attachments"
    ADD CONSTRAINT "agent_message_attachments_message_id_agent_messages_id_fk"
    FOREIGN KEY ("message_id") REFERENCES "public"."agent_messages"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "agent_message_citations"
    ADD CONSTRAINT "agent_message_citations_message_id_agent_messages_id_fk"
    FOREIGN KEY ("message_id") REFERENCES "public"."agent_messages"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "agent_message_citations"
    ADD CONSTRAINT "agent_message_citations_page_id_pages_id_fk"
    FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "agent_patch_proposals"
    ADD CONSTRAINT "agent_patch_proposals_assistant_message_id_agent_messages_id_fk"
    FOREIGN KEY ("assistant_message_id") REFERENCES "public"."agent_messages"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "agent_patch_proposals"
    ADD CONSTRAINT "agent_patch_proposals_target_page_id_pages_id_fk"
    FOREIGN KEY ("target_page_id") REFERENCES "public"."pages"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "agent_patch_proposals"
    ADD CONSTRAINT "agent_patch_proposals_base_revision_id_page_revisions_id_fk"
    FOREIGN KEY ("base_revision_id") REFERENCES "public"."page_revisions"("id")
    ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "agent_patch_proposals"
    ADD CONSTRAINT "agent_patch_proposals_applied_revision_id_page_revisions_id_fk"
    FOREIGN KEY ("applied_revision_id") REFERENCES "public"."page_revisions"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "agent_actions"
    ADD CONSTRAINT "agent_actions_message_id_agent_messages_id_fk"
    FOREIGN KEY ("message_id") REFERENCES "public"."agent_messages"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "agent_actions"
    ADD CONSTRAINT "agent_actions_acted_by_user_id_users_id_fk"
    FOREIGN KEY ("acted_by_user_id") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_threads_user_id_idx" ON "agent_threads" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_threads_user_agent_default_idx" ON "agent_threads" USING btree ("user_id","agent_key","is_default");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_messages_thread_id_idx" ON "agent_messages" USING btree ("thread_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_messages_created_at_idx" ON "agent_messages" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_message_attachments_message_id_idx" ON "agent_message_attachments" USING btree ("message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_message_citations_message_id_idx" ON "agent_message_citations" USING btree ("message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_message_citations_page_id_idx" ON "agent_message_citations" USING btree ("page_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_patch_proposals_assistant_message_id_idx" ON "agent_patch_proposals" USING btree ("assistant_message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_patch_proposals_target_page_id_idx" ON "agent_patch_proposals" USING btree ("target_page_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_actions_message_id_idx" ON "agent_actions" USING btree ("message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_actions_status_idx" ON "agent_actions" USING btree ("status");
