import "dotenv/config";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { pageRevisions, pages, users, workspaces } from "@/db/schema";

const OMAR_USER_ID = "10000000-0000-4000-8000-000000000003";
const OMAR_PRIVATE_WORKSPACE_ID = "20000000-0000-4000-8000-000000000003";
const PAGE_TITLE = "Plate Editor Technical Documentation";
const PAGE_SLUG = "plate-editor-technical-documentation";
const PAGE_PATH = `/${PAGE_SLUG}`;

async function main() {
  if (!db) {
    throw new Error("DATABASE_URL is required.");
  }

  const markdown = readFileSync(join(process.cwd(), "docs", "plate-editor.md"), "utf8");

  await db.update(users).set({ name: "Omar" }).where(eq(users.id, OMAR_USER_ID));

  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, OMAR_PRIVATE_WORKSPACE_ID))
    .limit(1)
    .then((rows) => rows[0]);

  if (!workspace) {
    throw new Error("Omar private workspace was not found.");
  }

  const existingPage = await db
    .select()
    .from(pages)
    .where(and(eq(pages.workspaceId, OMAR_PRIVATE_WORKSPACE_ID), eq(pages.slug, PAGE_SLUG)))
    .limit(1)
    .then((rows) => rows[0]);

  const revisionId = randomUUID();

  if (existingPage) {
    const latestRevision = await db
      .select()
      .from(pageRevisions)
      .where(eq(pageRevisions.pageId, existingPage.id))
      .orderBy(desc(pageRevisions.revisionNumber))
      .limit(1)
      .then((rows) => rows[0]);

    const nextRevisionNumber = (latestRevision?.revisionNumber ?? 0) + 1;

    await db.transaction(async (tx) => {
      await tx.insert(pageRevisions).values({
        id: revisionId,
        pageId: existingPage.id,
        revisionNumber: nextRevisionNumber,
        titleSnapshot: PAGE_TITLE,
        contentMarkdown: markdown,
        editorDocJson: null,
        createdByUserId: OMAR_USER_ID,
      });

      await tx
        .update(pages)
        .set({
          title: PAGE_TITLE,
          updatedByUserId: OMAR_USER_ID,
          currentRevisionId: revisionId,
          slug: PAGE_SLUG,
          path: PAGE_PATH,
        })
        .where(eq(pages.id, existingPage.id));
    });

    console.log(`Updated existing page ${existingPage.id} in Omar's workspace.`);
    return;
  }

  const maxSortOrderRow = await db
    .select({
      maxSortOrder: sql<number>`coalesce(max(${pages.sortOrder}), -1)`,
    })
    .from(pages)
    .where(and(eq(pages.workspaceId, OMAR_PRIVATE_WORKSPACE_ID), sql`${pages.parentPageId} is null`));

  const nextSortOrder = (maxSortOrderRow[0]?.maxSortOrder ?? -1) + 1;
  const pageId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(pages).values({
      id: pageId,
      workspaceId: OMAR_PRIVATE_WORKSPACE_ID,
      parentPageId: null,
      path: PAGE_PATH,
      depth: 0,
      sortOrder: nextSortOrder,
      title: PAGE_TITLE,
      slug: PAGE_SLUG,
      explicitReadLevel: null,
      explicitWriteLevel: null,
      effectiveReadLevel: null,
      effectiveWriteLevel: null,
      createdByUserId: OMAR_USER_ID,
      updatedByUserId: OMAR_USER_ID,
      currentRevisionId: null,
    });

    await tx.insert(pageRevisions).values({
      id: revisionId,
      pageId,
      revisionNumber: 1,
      titleSnapshot: PAGE_TITLE,
      contentMarkdown: markdown,
      editorDocJson: null,
      createdByUserId: OMAR_USER_ID,
    });

    await tx
      .update(pages)
      .set({ currentRevisionId: revisionId })
      .where(eq(pages.id, pageId));
  });

  console.log(`Created page ${PAGE_TITLE} (${pageId}) in Omar's personal workspace.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
