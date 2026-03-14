DO $$
BEGIN
  CREATE TYPE "page_activity_event_type" AS ENUM (
    'page_created',
    'page_edited',
    'page_renamed',
    'page_moved',
    'page_deleted'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "page_activity_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "page_id" uuid,
  "actor_user_id" uuid NOT NULL,
  "event_type" "page_activity_event_type" NOT NULL,
  "page_title" text NOT NULL,
  "previous_page_title" text,
  "parent_page_id" uuid,
  "parent_page_title" text,
  "revision_number" integer,
  "effective_read_level" integer,
  "effective_write_level" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "page_activity_events"
    ADD CONSTRAINT "page_activity_events_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "page_activity_events"
    ADD CONSTRAINT "page_activity_events_page_id_pages_id_fk"
    FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "page_activity_events"
    ADD CONSTRAINT "page_activity_events_actor_user_id_users_id_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id")
    ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "page_activity_events"
    ADD CONSTRAINT "page_activity_events_parent_page_id_pages_id_fk"
    FOREIGN KEY ("parent_page_id") REFERENCES "public"."pages"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_activity_events_workspace_id_idx" ON "page_activity_events" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_activity_events_page_id_idx" ON "page_activity_events" USING btree ("page_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_activity_events_created_at_idx" ON "page_activity_events" USING btree ("created_at");
