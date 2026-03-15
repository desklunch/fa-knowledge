import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userTypeEnum = pgEnum("user_type", ["human", "agent"]);
export const workspaceTypeEnum = pgEnum("workspace_type", ["private", "shared"]);
export const pageActivityEventTypeEnum = pgEnum("page_activity_event_type", [
  "page_created",
  "page_edited",
  "page_renamed",
  "page_moved",
  "page_deleted",
]);
export const agentMessageRoleEnum = pgEnum("agent_message_role", ["user", "assistant"]);
export const agentAttachmentEntityTypeEnum = pgEnum("agent_attachment_entity_type", ["page"]);
export const agentActionTypeEnum = pgEnum("agent_action_type", [
  "apply_page_patch",
  "discard_page_patch",
]);
export const agentActionStatusEnum = pgEnum("agent_action_status", [
  "pending",
  "completed",
  "dismissed",
]);
export const agentPatchProposalStatusEnum = pgEnum("agent_patch_proposal_status", [
  "pending",
  "applied",
  "discarded",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  userType: userTypeEnum("user_type").notNull().default("human"),
  permissionLevel: integer("permission_level").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: workspaceTypeEnum("type").notNull(),
  ownerUserId: uuid("owner_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.userId] })],
);

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    parentPageId: uuid("parent_page_id"),
    path: text("path").notNull(),
    depth: integer("depth").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    explicitReadLevel: integer("explicit_read_level"),
    explicitWriteLevel: integer("explicit_write_level"),
    effectiveReadLevel: integer("effective_read_level"),
    effectiveWriteLevel: integer("effective_write_level"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    currentRevisionId: uuid("current_revision_id").references(
      (): AnyPgColumn => pageRevisions.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentPageId],
      foreignColumns: [table.id],
      name: "pages_parent_page_id_fkey",
    }).onDelete("cascade"),
    index("pages_workspace_id_idx").on(table.workspaceId),
    index("pages_parent_page_id_idx").on(table.parentPageId),
    index("pages_path_idx").on(table.path),
    uniqueIndex("pages_workspace_slug_idx").on(table.workspaceId, table.slug),
    check("pages_permission_levels_valid", sql`${table.explicitWriteLevel} is null or ${table.explicitReadLevel} is null or ${table.explicitWriteLevel} >= ${table.explicitReadLevel}`),
    check("pages_effective_permission_levels_valid", sql`${table.effectiveWriteLevel} is null or ${table.effectiveReadLevel} is null or ${table.effectiveWriteLevel} >= ${table.effectiveReadLevel}`),
  ],
);

export const pageRevisions = pgTable(
  "page_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    titleSnapshot: text("title_snapshot").notNull(),
    contentMarkdown: text("content_markdown").notNull(),
    editorDocJson: jsonb("editor_doc_json"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("page_revisions_page_id_idx").on(table.pageId),
    uniqueIndex("page_revisions_page_revision_number_idx").on(
      table.pageId,
      table.revisionNumber,
    ),
  ],
);

export const pageEditSessions = pgTable(
  "page_edit_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionKey: text("session_key").notNull(),
    baseRevisionId: uuid("base_revision_id").references(() => pageRevisions.id, {
      onDelete: "set null",
    }),
    draftTitle: text("draft_title").notNull(),
    draftContentMarkdown: text("draft_content_markdown").notNull(),
    draftEditorDocJson: jsonb("draft_editor_doc_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("page_edit_sessions_page_id_idx").on(table.pageId),
    index("page_edit_sessions_user_id_idx").on(table.userId),
    uniqueIndex("page_edit_sessions_page_user_session_idx").on(
      table.pageId,
      table.userId,
      table.sessionKey,
    ),
  ],
);

export const pageActivityEvents = pgTable(
  "page_activity_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    eventType: pageActivityEventTypeEnum("event_type").notNull(),
    pageTitle: text("page_title").notNull(),
    previousPageTitle: text("previous_page_title"),
    parentPageId: uuid("parent_page_id").references((): AnyPgColumn => pages.id, {
      onDelete: "set null",
    }),
    parentPageTitle: text("parent_page_title"),
    revisionNumber: integer("revision_number"),
    effectiveReadLevel: integer("effective_read_level"),
    effectiveWriteLevel: integer("effective_write_level"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("page_activity_events_workspace_id_idx").on(table.workspaceId),
    index("page_activity_events_page_id_idx").on(table.pageId),
    index("page_activity_events_created_at_idx").on(table.createdAt),
  ],
);

export const agentThreads = pgTable(
  "agent_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentKey: text("agent_key").notNull(),
    title: text("title").notNull(),
    isDefault: integer("is_default").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("agent_threads_user_id_idx").on(table.userId),
    uniqueIndex("agent_threads_user_agent_default_idx").on(
      table.userId,
      table.agentKey,
      table.isDefault,
    ),
  ],
);

export const agentMessages = pgTable(
  "agent_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => agentThreads.id, { onDelete: "cascade" }),
    role: agentMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("agent_messages_thread_id_idx").on(table.threadId),
    index("agent_messages_created_at_idx").on(table.createdAt),
  ],
);

export const agentMessageAttachments = pgTable(
  "agent_message_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => agentMessages.id, { onDelete: "cascade" }),
    entityType: agentAttachmentEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    label: text("label").notNull(),
    href: text("href"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("agent_message_attachments_message_id_idx").on(table.messageId),
  ],
);

export const agentMessageCitations = pgTable(
  "agent_message_citations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => agentMessages.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    pageTitle: text("page_title").notNull(),
    href: text("href").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("agent_message_citations_message_id_idx").on(table.messageId),
    index("agent_message_citations_page_id_idx").on(table.pageId),
  ],
);

export const agentPatchProposals = pgTable(
  "agent_patch_proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assistantMessageId: uuid("assistant_message_id")
      .notNull()
      .references(() => agentMessages.id, { onDelete: "cascade" }),
    targetPageId: uuid("target_page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    baseRevisionId: uuid("base_revision_id")
      .notNull()
      .references(() => pageRevisions.id, { onDelete: "restrict" }),
    proposedTitle: text("proposed_title").notNull(),
    proposedContentMarkdown: text("proposed_content_markdown").notNull(),
    rationale: text("rationale").notNull(),
    status: agentPatchProposalStatusEnum("status").notNull().default("pending"),
    appliedRevisionId: uuid("applied_revision_id").references(() => pageRevisions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("agent_patch_proposals_assistant_message_id_idx").on(table.assistantMessageId),
    index("agent_patch_proposals_target_page_id_idx").on(table.targetPageId),
  ],
);

export const agentActions = pgTable(
  "agent_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => agentMessages.id, { onDelete: "cascade" }),
    actionType: agentActionTypeEnum("action_type").notNull(),
    label: text("label").notNull(),
    payload: jsonb("payload").notNull(),
    status: agentActionStatusEnum("status").notNull().default("pending"),
    targetEntityType: agentAttachmentEntityTypeEnum("target_entity_type"),
    targetEntityId: uuid("target_entity_id"),
    actedByUserId: uuid("acted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    outcomeMessage: text("outcome_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("agent_actions_message_id_idx").on(table.messageId),
    index("agent_actions_status_idx").on(table.status),
  ],
);

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type PageRevision = typeof pageRevisions.$inferSelect;
export type PageEditSession = typeof pageEditSessions.$inferSelect;
export type PageActivityEvent = typeof pageActivityEvents.$inferSelect;
export type AgentThread = typeof agentThreads.$inferSelect;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type AgentMessageAttachment = typeof agentMessageAttachments.$inferSelect;
export type AgentMessageCitation = typeof agentMessageCitations.$inferSelect;
export type AgentPatchProposal = typeof agentPatchProposals.$inferSelect;
export type AgentAction = typeof agentActions.$inferSelect;
