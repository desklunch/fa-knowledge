CREATE TABLE "page_edit_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"session_key" text NOT NULL,
	"base_revision_id" uuid,
	"draft_title" text NOT NULL,
	"draft_content_markdown" text NOT NULL,
	"draft_editor_doc_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "page_edit_sessions" ADD CONSTRAINT "page_edit_sessions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_edit_sessions" ADD CONSTRAINT "page_edit_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_edit_sessions" ADD CONSTRAINT "page_edit_sessions_base_revision_id_page_revisions_id_fk" FOREIGN KEY ("base_revision_id") REFERENCES "public"."page_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_edit_sessions_page_id_idx" ON "page_edit_sessions" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "page_edit_sessions_user_id_idx" ON "page_edit_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "page_edit_sessions_page_user_session_idx" ON "page_edit_sessions" USING btree ("page_id","user_id","session_key");