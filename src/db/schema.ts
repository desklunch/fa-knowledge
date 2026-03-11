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

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type PageRevision = typeof pageRevisions.$inferSelect;
