import "dotenv/config";

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  pageRevisions,
  pages,
  users,
  workspaceMemberships,
  workspaces,
} from "@/db/schema";
import {
  seededMemberships,
  seededPages,
  seededRevisions,
  seededUsers,
  seededWorkspaces,
} from "@/db/seed-data";

async function main() {
  if (!db) {
    throw new Error("DATABASE_URL is required before seeding.");
  }

  await db.insert(users).values(seededUsers).onConflictDoNothing();
  await db.insert(workspaces).values(seededWorkspaces).onConflictDoNothing();
  await db
    .insert(workspaceMemberships)
    .values(seededMemberships)
    .onConflictDoNothing();
  await db
    .insert(pages)
    .values(seededPages.map((page) => ({ ...page, currentRevisionId: undefined })))
    .onConflictDoNothing();
  await db.insert(pageRevisions).values(seededRevisions).onConflictDoNothing();
  for (const page of seededPages) {
    if (!page.currentRevisionId) {
      continue;
    }

    await db
      .update(pages)
      .set({ currentRevisionId: page.currentRevisionId })
      .where(eq(pages.id, page.id));
  }

  console.log("Seeded users, workspaces, pages, and revisions.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
