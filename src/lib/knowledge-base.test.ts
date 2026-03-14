import test from "node:test";
import assert from "node:assert/strict";

import { seededUsers } from "@/db/seed-data";
import {
  createPage,
  deletePage,
  getKnowledgeBaseView,
  getPageRevisions,
  movePage,
  resetFallbackKnowledgeBase,
  restorePageRevision,
  savePage,
  updatePageMetadata,
} from "@/lib/knowledge-base";

function flattenVisibleIds(pages: Awaited<ReturnType<typeof getKnowledgeBaseView>>["visibleWorkspaces"][number]["pages"]) {
  return pages.flatMap((page) => [page.id, ...flattenVisibleIds(page.children)]);
}

test("shared workspace is visible to all users in the MVP", async () => {
  resetFallbackKnowledgeBase();

  const view = await getKnowledgeBaseView({
    userId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000010",
  });

  assert.equal(view.currentUser?.id, seededUsers[0].id);
  assert.ok(
    view.visibleWorkspaces.some(
      ({ workspace }) => workspace.id === "20000000-0000-4000-8000-000000000010",
    ),
  );
});

test("restricted parent hides its subtree from lower-permission users", async () => {
  resetFallbackKnowledgeBase();

  const view = await getKnowledgeBaseView({
    userId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000013",
  });

  const visiblePageIds = view.visibleWorkspaces.flatMap(({ pages }) =>
    flattenVisibleIds(pages),
  );

  assert.equal(view.selectedPageId, "30000000-0000-4000-8000-000000000001");
  assert.ok(!visiblePageIds.includes("30000000-0000-4000-8000-000000000012"));
  assert.ok(!visiblePageIds.includes("30000000-0000-4000-8000-000000000013"));
});

test("authorized saves create a new revision and advance currentRevisionId", async () => {
  resetFallbackKnowledgeBase();

  const result = await savePage({
    actingUserId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000001",
    title: "Daily briefing updated",
    contentMarkdown: "# Daily briefing updated\n\nFresh notes.",
  });

  assert.equal(result.page.title, "Daily briefing updated");
  assert.equal(result.page.currentRevisionId, result.revision.id);
  assert.equal(result.revision.revisionNumber, 2);

  const revisions = await getPageRevisions({
    actingUserId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000001",
  });

  assert.equal(revisions[0]?.revisionNumber, 2);
});

test("autosave creates one revision per editor session and reopens latest draft", async () => {
  resetFallbackKnowledgeBase();

  const firstAutosave = await savePage({
    actingUserId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000001",
    title: "Daily briefing autosave",
    contentMarkdown: "# Daily briefing autosave\n\nFirst autosave.",
    currentRevisionId: "40000000-0000-4000-8000-000000000001",
    editorSessionId: "session-a",
    saveMode: "autosave",
  });

  const secondAutosave = await savePage({
    actingUserId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000001",
    title: "Daily briefing autosave draft",
    contentMarkdown: "# Daily briefing autosave draft\n\nSecond autosave.",
    currentRevisionId: firstAutosave.page.currentRevisionId,
    editorSessionId: "session-a",
    saveMode: "autosave",
  });

  const revisions = await getPageRevisions({
    actingUserId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000001",
  });
  const view = await getKnowledgeBaseView({
    userId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000001",
  });

  assert.equal(firstAutosave.revision.revisionNumber, 2);
  assert.equal(secondAutosave.revision.revisionNumber, 2);
  assert.equal(revisions[0]?.revisionNumber, 2);
  assert.equal(view.selectedDraft?.title, "Daily briefing autosave draft");
  assert.equal(
    view.selectedDraft?.contentMarkdown,
    "# Daily briefing autosave draft\n\nSecond autosave.",
  );
});

test("stale revision saves are rejected", async () => {
  resetFallbackKnowledgeBase();

  const initialView = await getKnowledgeBaseView({
    userId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000001",
  });

  await savePage({
    actingUserId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000001",
    title: "Daily briefing v2",
    contentMarkdown: "# Daily briefing v2\n\nFresh notes.",
    currentRevisionId: initialView.selectedRevision?.id ?? null,
  });

  await assert.rejects(
    savePage({
      actingUserId: seededUsers[0].id,
      pageId: "30000000-0000-4000-8000-000000000001",
      title: "Daily briefing stale",
      contentMarkdown: "# Daily briefing stale\n\nOld draft.",
      currentRevisionId: initialView.selectedRevision?.id ?? null,
    }),
    /newer revision/i,
  );
});

test("creating a shared page defaults explicit permissions to the creator level", async () => {
  resetFallbackKnowledgeBase();

  const result = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000010",
    parentPageId: "30000000-0000-4000-8000-000000000012",
    title: "Board notes",
    contentMarkdown: "# Board notes\n\nInherited restrictions.",
  });

  assert.equal(result.page.explicitReadLevel, 3);
  assert.equal(result.page.explicitWriteLevel, 3);
  assert.equal(result.page.effectiveReadLevel, 3);
  assert.equal(result.page.effectiveWriteLevel, 3);
  assert.equal(result.revision.revisionNumber, 1);
});

test("moving a page under a more restrictive parent recomputes subtree permissions", async () => {
  resetFallbackKnowledgeBase();

  const result = await movePage({
    actingUserId: seededUsers[2].id,
    pageId: "30000000-0000-4000-8000-000000000011",
    destinationParentPageId: "30000000-0000-4000-8000-000000000014",
  });

  assert.equal(result.page.parentPageId, "30000000-0000-4000-8000-000000000014");
  assert.equal(result.page.effectiveReadLevel, 3);
  assert.equal(result.page.effectiveWriteLevel, 3);
});

test("updating shared page metadata recomputes subtree permissions", async () => {
  resetFallbackKnowledgeBase();

  const result = await updatePageMetadata({
    actingUserId: seededUsers[2].id,
    pageId: "30000000-0000-4000-8000-000000000010",
    explicitReadLevel: 2,
    explicitWriteLevel: 3,
  });

  assert.equal(result.page.explicitReadLevel, 2);
  assert.equal(result.page.explicitWriteLevel, 3);

  const view = await getKnowledgeBaseView({
    userId: seededUsers[2].id,
    pageId: "30000000-0000-4000-8000-000000000011",
  });
  const operations = view.visibleWorkspaces
    .find(({ workspace }) => workspace.id === "20000000-0000-4000-8000-000000000010")
    ?.pages.find((page) => page.id === "30000000-0000-4000-8000-000000000010");
  const runbooks = operations?.children.find(
    (page) => page.id === "30000000-0000-4000-8000-000000000011",
  );

  assert.equal(runbooks?.effectiveReadLevel, 2);
  assert.equal(runbooks?.effectiveWriteLevel, 3);
});

test("moving a page to a less restrictive parent is rejected when it weakens inherited restrictions", async () => {
  resetFallbackKnowledgeBase();

  const createdPage = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000010",
    parentPageId: "30000000-0000-4000-8000-000000000014",
    title: "Quarterly audit",
    contentMarkdown: "# Quarterly audit\n\nHighly restricted.",
  });

  await updatePageMetadata({
    actingUserId: seededUsers[2].id,
    pageId: createdPage.page.id,
    explicitReadLevel: null,
    explicitWriteLevel: null,
  });

  await assert.rejects(
    movePage({
      actingUserId: seededUsers[2].id,
      pageId: createdPage.page.id,
      destinationParentPageId: "30000000-0000-4000-8000-000000000010",
    }),
    /permission resolution/i,
  );
});

test("moving a shared page to a less restrictive parent can preserve stricter restrictions", async () => {
  resetFallbackKnowledgeBase();

  const createdPage = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000010",
    parentPageId: "30000000-0000-4000-8000-000000000014",
    title: "Quarterly audit",
    contentMarkdown: "# Quarterly audit\n\nHighly restricted.",
  });

  const result = await movePage({
    actingUserId: seededUsers[2].id,
    pageId: createdPage.page.id,
    destinationParentPageId: "30000000-0000-4000-8000-000000000010",
    weakeningStrategy: "preserve",
  });

  assert.equal(result.page.effectiveReadLevel, 3);
  assert.equal(result.page.effectiveWriteLevel, 3);
});

test("lowering shared page permissions can preserve descendant restrictions", async () => {
  resetFallbackKnowledgeBase();

  const result = await updatePageMetadata({
    actingUserId: seededUsers[2].id,
    pageId: "30000000-0000-4000-8000-000000000012",
    explicitReadLevel: 1,
    explicitWriteLevel: 2,
    descendantStrategy: "preserve",
  });

  assert.equal(result.page.effectiveReadLevel, 1);
  assert.equal(result.page.effectiveWriteLevel, 2);

  const view = await getKnowledgeBaseView({
    userId: seededUsers[2].id,
    pageId: "30000000-0000-4000-8000-000000000013",
  });
  const strategy = view.visibleWorkspaces
    .find(({ workspace }) => workspace.id === "20000000-0000-4000-8000-000000000010")
    ?.pages.find((page) => page.id === "30000000-0000-4000-8000-000000000012")
    ?.children.find((page) => page.id === "30000000-0000-4000-8000-000000000013");

  assert.equal(strategy?.effectiveReadLevel, 2);
  assert.equal(strategy?.effectiveWriteLevel, 3);
});

test("lowering shared page permissions can also cascade to descendants", async () => {
  resetFallbackKnowledgeBase();

  const result = await updatePageMetadata({
    actingUserId: seededUsers[2].id,
    pageId: "30000000-0000-4000-8000-000000000012",
    explicitReadLevel: 1,
    explicitWriteLevel: 2,
    descendantStrategy: "cascade",
  });

  assert.equal(result.page.effectiveReadLevel, 1);
  assert.equal(result.page.effectiveWriteLevel, 2);

  const view = await getKnowledgeBaseView({
    userId: seededUsers[2].id,
    pageId: "30000000-0000-4000-8000-000000000013",
  });
  const strategy = view.visibleWorkspaces
    .find(({ workspace }) => workspace.id === "20000000-0000-4000-8000-000000000010")
    ?.pages.find((page) => page.id === "30000000-0000-4000-8000-000000000012")
    ?.children.find((page) => page.id === "30000000-0000-4000-8000-000000000013");

  assert.equal(strategy?.effectiveReadLevel, 1);
  assert.equal(strategy?.effectiveWriteLevel, 2);
});

test("private workspace create keeps permission columns null", async () => {
  resetFallbackKnowledgeBase();

  const result = await createPage({
    actingUserId: seededUsers[0].id,
    workspaceId: "20000000-0000-4000-8000-000000000001",
    parentPageId: null,
    title: "Scratchpad",
    contentMarkdown: "# Scratchpad\n\nPrivate page.",
    explicitReadLevel: 3,
    explicitWriteLevel: 3,
  });

  assert.equal(result.page.explicitReadLevel, null);
  assert.equal(result.page.explicitWriteLevel, null);
  assert.equal(result.page.effectiveReadLevel, null);
  assert.equal(result.page.effectiveWriteLevel, null);
});

test("unauthorized create and delete requests are rejected", async () => {
  resetFallbackKnowledgeBase();

  await assert.rejects(
    createPage({
      actingUserId: seededUsers[0].id,
      workspaceId: "20000000-0000-4000-8000-000000000010",
      parentPageId: "30000000-0000-4000-8000-000000000014",
      title: "Not allowed",
      contentMarkdown: "# Not allowed\n\nShould fail.",
    }),
    /permission/i,
  );

  await assert.rejects(
    deletePage({
      actingUserId: seededUsers[0].id,
      pageId: "30000000-0000-4000-8000-000000000010",
    }),
    /permission/i,
  );
});

test("deleting a page removes its subtree", async () => {
  resetFallbackKnowledgeBase();

  const createdParent = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000010",
    parentPageId: "30000000-0000-4000-8000-000000000010",
    title: "Nested root",
    contentMarkdown: "# Nested root\n\nParent.",
  });
  const createdChild = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000010",
    parentPageId: createdParent.page.id,
    title: "Nested child",
    contentMarkdown: "# Nested child\n\nChild.",
  });

  await deletePage({
    actingUserId: seededUsers[2].id,
    pageId: createdParent.page.id,
  });

  const view = await getKnowledgeBaseView({
    userId: seededUsers[2].id,
    pageId: createdChild.page.id,
  });

  const visibleIds = view.visibleWorkspaces.flatMap(({ pages }) =>
    flattenVisibleIds(pages),
  );

  assert.ok(!visibleIds.includes(createdParent.page.id));
  assert.ok(!visibleIds.includes(createdChild.page.id));
});

test("deleting a page can keep descendants by reparenting them upward", async () => {
  resetFallbackKnowledgeBase();

  const createdParent = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000010",
    parentPageId: "30000000-0000-4000-8000-000000000010",
    title: "Delete target",
    contentMarkdown: "# Delete target\n\nParent.",
  });
  const createdChild = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000010",
    parentPageId: createdParent.page.id,
    title: "Child survives",
    contentMarkdown: "# Child survives\n\nChild.",
  });

  await deletePage({
    actingUserId: seededUsers[2].id,
    pageId: createdParent.page.id,
    mode: "keep-descendants",
  });

  const view = await getKnowledgeBaseView({
    userId: seededUsers[2].id,
    pageId: createdChild.page.id,
  });
  const operations = view.visibleWorkspaces
    .find(({ workspace }) => workspace.id === "20000000-0000-4000-8000-000000000010")
    ?.pages.find((page) => page.id === "30000000-0000-4000-8000-000000000010");

  assert.ok(operations?.children.some((child) => child.id === createdChild.page.id));
});

test("moving a page with destinationIndex reorders siblings deterministically", async () => {
  resetFallbackKnowledgeBase();

  await movePage({
    actingUserId: seededUsers[2].id,
    pageId: "30000000-0000-4000-8000-000000000014",
    destinationParentPageId: null,
    destinationIndex: 0,
  });

  const view = await getKnowledgeBaseView({
    userId: seededUsers[2].id,
    pageId: "30000000-0000-4000-8000-000000000014",
  });
  const sharedWorkspace = view.visibleWorkspaces.find(
    ({ workspace }) => workspace.id === "20000000-0000-4000-8000-000000000010",
  );

  assert.deepEqual(
    sharedWorkspace?.pages.map((page) => page.id),
    [
      "30000000-0000-4000-8000-000000000014",
      "30000000-0000-4000-8000-000000000010",
      "30000000-0000-4000-8000-000000000012",
    ],
  );
});

test("moving a page between parents reindexes source and destination sibling order", async () => {
  resetFallbackKnowledgeBase();

  const newParent = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000010",
    parentPageId: "30000000-0000-4000-8000-000000000010",
    title: "Escalations",
    contentMarkdown: "# Escalations\n\nDestination sibling.",
  });

  await movePage({
    actingUserId: seededUsers[2].id,
    pageId: "30000000-0000-4000-8000-000000000013",
    destinationParentPageId: "30000000-0000-4000-8000-000000000010",
    destinationIndex: 0,
  });

  const view = await getKnowledgeBaseView({
    userId: seededUsers[2].id,
    pageId: "30000000-0000-4000-8000-000000000013",
  });
  const operations = view.visibleWorkspaces
    .find(({ workspace }) => workspace.id === "20000000-0000-4000-8000-000000000010")
    ?.pages.find((page) => page.id === "30000000-0000-4000-8000-000000000010");

  assert.deepEqual(
    operations?.children.map((child) => child.id),
    [
      "30000000-0000-4000-8000-000000000013",
      "30000000-0000-4000-8000-000000000011",
      newParent.page.id,
    ],
  );
});

test("moving a subtree deeper than five levels is rejected", async () => {
  resetFallbackKnowledgeBase();

  const movablePage = await createPage({
    actingUserId: seededUsers[0].id,
    workspaceId: "20000000-0000-4000-8000-000000000001",
    parentPageId: null,
    title: "Movable page",
    contentMarkdown: "# Movable page\n\nSource page.",
  });

  let parentPageId: string | null = null;

  for (let level = 0; level < 6; level += 1) {
    const createdPage = await createPage({
      actingUserId: seededUsers[0].id,
      workspaceId: "20000000-0000-4000-8000-000000000001",
      parentPageId,
      title: `Level ${level + 2}`,
      contentMarkdown: `# Level ${level + 2}\n\nNested page.`,
    });

    parentPageId = createdPage.page.id;
  }

  await assert.rejects(
    movePage({
      actingUserId: seededUsers[0].id,
      pageId: movablePage.page.id,
      destinationParentPageId: parentPageId,
      destinationIndex: 0,
    }),
    /deeper than 5 levels/i,
  );
});

test("moving a personal page into shared workspace root assigns shared permissions", async () => {
  resetFallbackKnowledgeBase();

  const createdPage = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000003",
    parentPageId: null,
    title: "Private draft",
    contentMarkdown: "# Private draft\n\nPrivate.",
  });

  const result = await movePage({
    actingUserId: seededUsers[2].id,
    pageId: createdPage.page.id,
    destinationWorkspaceId: "20000000-0000-4000-8000-000000000010",
    destinationParentPageId: null,
    destinationExplicitReadLevel: 3,
    destinationExplicitWriteLevel: 3,
  });

  assert.equal(result.page.workspaceId, "20000000-0000-4000-8000-000000000010");
  assert.equal(result.page.effectiveReadLevel, 3);
  assert.equal(result.page.effectiveWriteLevel, 3);
});

test("moving a personal page into shared workspace root defaults permissions to the acting user level when omitted", async () => {
  resetFallbackKnowledgeBase();

  const createdPage = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000003",
    parentPageId: null,
    title: "Private draft",
    contentMarkdown: "# Private draft\n\nPersonal notes.",
  });

  const result = await movePage({
    actingUserId: seededUsers[2].id,
    pageId: createdPage.page.id,
    destinationParentPageId: null,
    destinationWorkspaceId: "20000000-0000-4000-8000-000000000010",
  });

  assert.equal(result.page.workspaceId, "20000000-0000-4000-8000-000000000010");
  assert.equal(result.page.explicitReadLevel, 3);
  assert.equal(result.page.explicitWriteLevel, 3);
  assert.equal(result.page.effectiveReadLevel, 3);
  assert.equal(result.page.effectiveWriteLevel, 3);
});

test("moving a page only updates descendants from the same workspace", async () => {
  resetFallbackKnowledgeBase();

  const sharedRoot = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000010",
    parentPageId: null,
    title: "Collision",
    contentMarkdown: "# Collision\n\nShared root.",
    explicitReadLevel: 3,
    explicitWriteLevel: 3,
  });

  const sharedChild = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000010",
    parentPageId: sharedRoot.page.id,
    title: "Shared child",
    contentMarkdown: "# Shared child\n\nNested under shared collision.",
  });

  const personalRoot = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000003",
    parentPageId: null,
    title: "Collision",
    contentMarkdown: "# Collision\n\nPersonal root.",
  });

  const personalParent = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000003",
    parentPageId: null,
    title: "Personal parent",
    contentMarkdown: "# Personal parent\n\nRoot.",
  });

  const moved = await movePage({
    actingUserId: seededUsers[2].id,
    pageId: personalRoot.page.id,
    destinationParentPageId: personalParent.page.id,
    destinationIndex: 0,
  });

  const view = await getKnowledgeBaseView({
    userId: seededUsers[2].id,
    pageId: sharedChild.page.id,
  });

  assert.equal(moved.page.parentPageId, personalParent.page.id);
  assert.equal(
    view.visibleWorkspaces
      .find(({ workspace }) => workspace.id === "20000000-0000-4000-8000-000000000010")
      ?.pages.find((page) => page.id === sharedRoot.page.id)
      ?.children.some((page) => page.id === sharedChild.page.id),
    true,
  );
});

test("restoring a revision appends a new revision and updates current content", async () => {
  resetFallbackKnowledgeBase();

  const saveResult = await savePage({
    actingUserId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000001",
    title: "Daily briefing updated",
    contentMarkdown: "# Daily briefing updated\n\nFresh notes.",
  });

  const restoreResult = await restorePageRevision({
    actingUserId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000001",
    revisionId: "40000000-0000-4000-8000-000000000001",
  });

  const revisions = await getPageRevisions({
    actingUserId: seededUsers[0].id,
    pageId: "30000000-0000-4000-8000-000000000001",
  });

  assert.equal(saveResult.revision.revisionNumber, 2);
  assert.equal(restoreResult.revision.revisionNumber, 3);
  assert.equal(restoreResult.page.title, "Daily briefing");
  assert.equal(revisions[0]?.revisionNumber, 3);
});

test("knowledge base view includes backlinks for the selected page", async () => {
  resetFallbackKnowledgeBase();

  const sourcePage = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000010",
    parentPageId: null,
    title: "Backlink source",
    contentMarkdown:
      "# Backlink source\n\nLinks to [Runbooks](/?page=30000000-0000-4000-8000-000000000011).",
    explicitReadLevel: 3,
    explicitWriteLevel: 3,
  });

  const view = await getKnowledgeBaseView({
    userId: seededUsers[2].id,
    pageId: "30000000-0000-4000-8000-000000000011",
  });

  assert.ok(view.selectedPageBacklinks.some((page) => page.id === sourcePage.page.id));
});

test("knowledge base view includes backlinks from the current user's latest draft", async () => {
  resetFallbackKnowledgeBase();

  const sourcePage = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000010",
    parentPageId: null,
    title: "Draft backlink source",
    contentMarkdown: "# Draft backlink source\n\nNo links yet.",
    explicitReadLevel: 3,
    explicitWriteLevel: 3,
  });

  await savePage({
    actingUserId: seededUsers[2].id,
    pageId: sourcePage.page.id,
    title: "Draft backlink source",
    contentMarkdown:
      "# Draft backlink source\n\n[Runbooks](mention:%2F30000000-0000-4000-8000-000000000011)",
    currentRevisionId: sourcePage.page.currentRevisionId,
    editorSessionId: "draft-backlink-session",
    saveMode: "autosave",
  });

  const view = await getKnowledgeBaseView({
    userId: seededUsers[2].id,
    pageId: "30000000-0000-4000-8000-000000000011",
  });

  assert.ok(view.selectedPageBacklinks.some((page) => page.id === sourcePage.page.id));
});

test("recent activity returns a single reverse-chronological shared workspace feed", async () => {
  resetFallbackKnowledgeBase();

  const createdPage = await createPage({
    actingUserId: seededUsers[2].id,
    workspaceId: "20000000-0000-4000-8000-000000000010",
    parentPageId: null,
    title: "Activity Test",
    contentMarkdown: "# Activity Test\n\nInitial content.",
  });

  await savePage({
    actingUserId: seededUsers[2].id,
    pageId: createdPage.page.id,
    title: "Activity Test Renamed",
    contentMarkdown: "# Activity Test Renamed\n\nUpdated content.",
    currentRevisionId: createdPage.page.currentRevisionId,
  });

  const view = await getKnowledgeBaseView({
    userId: seededUsers[2].id,
    pageId: createdPage.page.id,
  });

  assert.ok(view.recentActivity.length >= 3);
  assert.match(view.recentActivity[0]?.message ?? "", /edited Activity Test Renamed \(2\)/);
  assert.match(
    view.recentActivity[1]?.message ?? "",
    /renamed "Activity Test" to "Activity Test Renamed"/,
  );
  assert.match(view.recentActivity[2]?.message ?? "", /created Activity Test/);
});
