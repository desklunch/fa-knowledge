import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, max } from "drizzle-orm";

import { db } from "@/db/client";
import { seededPages, seededRevisions, seededUsers, seededWorkspaces } from "@/db/seed-data";
import {
  pageActivityEvents,
  pageEditSessions,
  pageRevisions,
  pages,
  type PageActivityEvent,
  type PageEditSession,
  type Page,
  type PageRevision,
  type User,
  users,
  type Workspace,
  workspaces,
} from "@/db/schema";
import { canReadPage, canReadWorkspace, canWritePage, filterVisiblePages } from "@/lib/permissions";

export type VisiblePageNode = Page & {
  children: VisiblePageNode[];
  canWrite: boolean;
  currentContentMarkdown: string | null;
};

type KnowledgeBaseSnapshot = {
  activityEvents: PageActivityEvent[];
  users: User[];
  workspaces: Workspace[];
  pages: Page[];
  revisions: PageRevision[];
  editSessions: PageEditSession[];
};

type PageContext = {
  actingUser: User;
  page: Page;
  workspace: Workspace;
};

type ResolvedPermissions = {
  explicitReadLevel: number | null;
  explicitWriteLevel: number | null;
  effectiveReadLevel: number | null;
  effectiveWriteLevel: number | null;
};

export type RevisionSummary = {
  id: string;
  revisionNumber: number;
  titleSnapshot: string;
  createdAt: Date;
  createdByUserId: string;
  createdByUserName: string;
};

export type KnowledgeBaseView = {
  availableUsers: User[];
  currentUser: User | null;
  recentActivity: Array<{
    actorName: string;
    createdAt: Date;
    eventType: "page_created" | "page_edited" | "page_renamed" | "page_moved" | "page_deleted";
    href: string | null;
    id: string;
    message: string;
    pageId: string | null;
  }>;
  selectedPageId: string | null;
  selectedPage: (Page & { canWrite: boolean; hasDescendants: boolean }) | null;
  selectedRevision: PageRevision | null;
  selectedDraft: {
    title: string;
    contentMarkdown: string;
    editorDocJson: unknown;
  } | null;
  selectedPageBacklinks: Array<{
    href: string;
    id: string;
    title: string;
    workspaceLabel: string;
  }>;
  selectedPageRevisions: RevisionSummary[];
  visibleWorkspaces: Array<{
    workspace: Workspace;
    pages: VisiblePageNode[];
  }>;
};

export type SearchKnowledgeBaseResult = {
  results: Array<{
    id: string;
    title: string;
    href: string;
    workspaceLabel: string;
    workspaceType: "private" | "shared";
    snippet: string;
  }>;
};

export type SavePageInput = {
  actingUserId: string;
  pageId: string;
  title: string;
  contentMarkdown: string;
  currentRevisionId?: string | null;
  editorSessionId?: string | null;
  saveMode?: "autosave" | "manual";
  editorDocJson?: unknown;
};

export type UpdatePageMetadataInput = {
  actingUserId: string;
  pageId: string;
  explicitReadLevel?: number | null;
  explicitWriteLevel?: number | null;
  descendantStrategy?: "cascade" | "preserve";
};

export type CreatePageInput = {
  actingUserId: string;
  workspaceId: string;
  parentPageId: string | null;
  title: string;
  slug?: string;
  contentMarkdown: string;
  explicitReadLevel?: number | null;
  explicitWriteLevel?: number | null;
};

export type MovePageInput = {
  actingUserId: string;
  pageId: string;
  destinationParentPageId: string | null;
  destinationIndex?: number | null;
  destinationWorkspaceId?: string | null;
  weakeningStrategy?: "inherit" | "preserve";
  destinationExplicitReadLevel?: number | null;
  destinationExplicitWriteLevel?: number | null;
};

export type DeletePageInput = {
  actingUserId: string;
  pageId: string;
  mode?: "delete-subtree" | "keep-descendants";
};

export type SavePageResult = {
  page: Page;
  revision: PageRevision;
};

export type CreatePageResult = {
  page: Page;
  revision: PageRevision;
};

export type MovePageResult = {
  page: Page;
};

export type DeletePageResult = {
  deletedPageId: string;
  redirectPageId: string | null;
};

export type UpdatePageMetadataResult = {
  page: Page;
};

export type RestorePageRevisionInput = {
  actingUserId: string;
  pageId: string;
  revisionId: string;
};

export type RestorePageRevisionResult = {
  page: Page;
  revision: PageRevision;
};

const MAX_PAGE_DEPTH = 5;

function buildSeedSnapshot(): KnowledgeBaseSnapshot {
  const seededPageRows = seededPages.map((page) => ({
    ...page,
    currentRevisionId:
      seededRevisions.find((revision) => revision.pageId === page.id)?.id ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })) as Page[];

  const seededRevisionRows = seededRevisions.map((revision) => ({
    ...revision,
    createdAt: new Date(),
  })) as PageRevision[];

  return {
    activityEvents: [],
    users: seededUsers as User[],
    workspaces: seededWorkspaces as Workspace[],
    pages: seededPageRows,
    revisions: seededRevisionRows,
    editSessions: [],
  };
}

let fallbackStore: KnowledgeBaseSnapshot = buildSeedSnapshot();

export function resetFallbackKnowledgeBase() {
  fallbackStore = buildSeedSnapshot();
}

export async function getKnowledgeBaseSnapshotForTests() {
  return getSnapshot();
}

export async function clearPageEditSessionsForUser(input: {
  pageId: string;
  userId: string;
}) {
  if (!db) {
    fallbackStore = {
      ...fallbackStore,
      editSessions: fallbackStore.editSessions.filter(
        (session) =>
          !(
            session.pageId === input.pageId &&
            session.userId === input.userId
          ),
      ),
    };
    return;
  }

  await db
    .delete(pageEditSessions)
    .where(
      and(
        eq(pageEditSessions.pageId, input.pageId),
        eq(pageEditSessions.userId, input.userId),
      ),
    );
}

async function getSnapshot(): Promise<KnowledgeBaseSnapshot> {
  if (!db) {
    return fallbackStore;
  }

  try {
    const [userRows, workspaceRows, pageRows, revisionRows, editSessionRows, activityEventRows] = await Promise.all([
      db.select().from(users).orderBy(desc(users.permissionLevel), asc(users.name)),
      db.select().from(workspaces).orderBy(asc(workspaces.type), asc(workspaces.name)),
      db.select().from(pages).orderBy(asc(pages.path), asc(pages.sortOrder)),
      db
        .select()
        .from(pageRevisions)
        .orderBy(desc(pageRevisions.revisionNumber), desc(pageRevisions.createdAt)),
      db
        .select()
        .from(pageEditSessions)
        .orderBy(desc(pageEditSessions.updatedAt)),
      db
        .select()
        .from(pageActivityEvents)
        .orderBy(desc(pageActivityEvents.createdAt)),
    ]);

    return {
      activityEvents: activityEventRows,
      users: userRows,
      workspaces: workspaceRows,
      pages: pageRows,
      revisions: revisionRows,
      editSessions: editSessionRows,
    };
  } catch (error) {
    console.error("Failed to load knowledge base snapshot from database.", error);

    return fallbackStore;
  }
}

function getFallbackUser(userRows: User[]) {
  return userRows[0] ?? null;
}

function getCurrentUserFromSnapshot(snapshot: KnowledgeBaseSnapshot, userId?: string | null) {
  const currentUser = snapshot.users.find((user) => user.id === userId);

  return currentUser ?? getFallbackUser(snapshot.users);
}

function getPageFromSnapshot(snapshot: KnowledgeBaseSnapshot, pageId: string) {
  return snapshot.pages.find((page) => page.id === pageId) ?? null;
}

function getWorkspaceFromSnapshot(snapshot: KnowledgeBaseSnapshot, workspaceId: string) {
  return snapshot.workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
}

function getRevisionForPageFromSnapshot(
  snapshot: KnowledgeBaseSnapshot,
  pageId: string | null,
  currentRevisionId?: string | null,
) {
  if (!pageId) {
    return null;
  }

  if (currentRevisionId) {
    const currentRevision =
      snapshot.revisions.find((revision) => revision.id === currentRevisionId) ?? null;

    if (currentRevision) {
      return currentRevision;
    }
  }

  return (
    snapshot.revisions
      .filter((revision) => revision.pageId === pageId)
      .sort((a, b) => b.revisionNumber - a.revisionNumber)[0] ?? null
  );
}

function getVisibleWorkspacesFromSnapshot(
  snapshot: KnowledgeBaseSnapshot,
  currentUser: User,
) {
  const currentRevisionByPageId = new Map<string, string>();

  for (const revision of snapshot.revisions) {
    if (!currentRevisionByPageId.has(revision.pageId)) {
      currentRevisionByPageId.set(revision.pageId, revision.contentMarkdown);
    }
  }

  return snapshot.workspaces
    .filter((workspace) => canReadWorkspace(currentUser, workspace))
    .map((workspace) => ({
      workspace,
      pages: filterVisiblePages(
        currentUser,
        workspace,
        snapshot.pages,
        currentRevisionByPageId,
      ),
    }));
}

export function flatten(nodes: VisiblePageNode[]): VisiblePageNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function selectVisiblePage(
  visibleWorkspaces: KnowledgeBaseView["visibleWorkspaces"],
  pageId: string | null,
) {
  if (!pageId) {
    return null;
  }

  return (
    visibleWorkspaces
      .flatMap(({ pages }) => flatten(pages))
      .find((page) => page.id === pageId) ?? null
  );
}

function getPageRevisionsFromSnapshot(snapshot: KnowledgeBaseSnapshot, pageId: string) {
  return snapshot.revisions
    .filter((revision) => revision.pageId === pageId)
    .sort((a, b) => b.revisionNumber - a.revisionNumber);
}

function getRecentActivityFromVisibleWorkspaces(
  snapshot: KnowledgeBaseSnapshot,
  currentUser: User,
  visibleWorkspaces: KnowledgeBaseView["visibleWorkspaces"],
) {
  const visiblePageMap = new Map(
    visibleWorkspaces.flatMap(({ workspace, pages }) =>
      flatten(pages).map((page) => [
        page.id,
        {
          title: page.title,
          workspaceLabel: workspace.type === "private" ? "Personal" : "Shared",
        },
      ]),
    ),
  );
  const sharedWorkspace = snapshot.workspaces.find((workspace) => workspace.type === "shared");

  if (!sharedWorkspace) {
    return [];
  }

  return snapshot.activityEvents
    .filter((event) => event.workspaceId === sharedWorkspace.id)
    .filter(
      (event) =>
        event.effectiveReadLevel === null ||
        currentUser.permissionLevel >= event.effectiveReadLevel,
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 50)
    .map((event) => {
      const actorName =
        snapshot.users.find((user) => user.id === event.actorUserId)?.name ?? "Unknown user";
      const href =
        event.pageId && visiblePageMap.has(event.pageId) ? `/?page=${event.pageId}` : null;

      return {
        actorName,
        createdAt: event.createdAt,
        eventType: event.eventType,
        href,
        id: event.id,
        message: formatPageActivityMessage(event, actorName),
        pageId: event.pageId,
      };
    });
}

function formatPageActivityMessage(event: PageActivityEvent, actorName: string) {
  switch (event.eventType) {
    case "page_created":
      return `${actorName} created ${event.pageTitle}`;
    case "page_edited":
      return `${actorName} edited ${event.pageTitle} (${event.revisionNumber ?? "?"})`;
    case "page_renamed":
      return `${actorName} renamed "${event.previousPageTitle ?? event.pageTitle}" to "${event.pageTitle}"`;
    case "page_moved":
      return `${actorName} moved ${event.pageTitle} to ${event.parentPageTitle ?? "root"}`;
    case "page_deleted":
      return `${actorName} deleted ${event.pageTitle}`;
    default:
      return `${actorName} updated ${event.pageTitle}`;
  }
}

function extractReferencedPageIds(contentMarkdown: string | null | undefined) {
  if (!contentMarkdown) {
    return new Set<string>();
  }

  const referencedIds = new Set<string>();
  const pageUrlMatches = contentMarkdown.matchAll(/[(/?&]page=([0-9a-f-]{36})/gi);
  const mentionMatches = contentMarkdown.matchAll(/mention:(?:%2F|\/)?([0-9a-f-]{36})/gi);

  for (const match of pageUrlMatches) {
    if (match[1]) {
      referencedIds.add(match[1]);
    }
  }

  for (const match of mentionMatches) {
    if (match[1]) {
      referencedIds.add(match[1]);
    }
  }

  return referencedIds;
}

function getBacklinksFromVisibleWorkspaces(
  snapshot: KnowledgeBaseSnapshot,
  currentUser: User,
  visibleWorkspaces: KnowledgeBaseView["visibleWorkspaces"],
  selectedPageId: string | null,
) {
  if (!selectedPageId) {
    return [];
  }

  return visibleWorkspaces
    .flatMap(({ workspace, pages }) =>
      flatten(pages)
        .filter((page) => page.id !== selectedPageId)
        .filter((page) => {
          const latestDraft = getLatestEditSessionForPageFromSnapshot(
            snapshot,
            page.id,
            currentUser.id,
          );
          const contentToScan = latestDraft?.draftContentMarkdown ?? page.currentContentMarkdown;

          return extractReferencedPageIds(contentToScan).has(selectedPageId);
        })
        .map((page) => ({
          href: `/?page=${page.id}`,
          id: page.id,
          title: page.title,
          workspaceLabel: workspace.type === "private" ? "Personal" : "Shared",
        })),
    )
    .sort((a, b) => a.title.localeCompare(b.title));
}

function isStricterLevel(nextLevel: number | null, currentLevel: number | null) {
  return nextLevel !== null && (currentLevel === null || nextLevel > currentLevel);
}

function isLooserLevel(nextLevel: number | null, currentLevel: number | null) {
  return currentLevel !== null && (nextLevel === null || nextLevel < currentLevel);
}

function stripSearchText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\[\[toc\]\]/gi, "table of contents")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getSearchSnippet(body: string, query: string) {
  if (!body) {
    return "No preview";
  }

  const matchIndex = body.indexOf(query);

  if (matchIndex === -1) {
    return body.length > 120 ? `${body.slice(0, 120)}…` : body;
  }

  const start = Math.max(0, matchIndex - 36);
  const end = Math.min(body.length, matchIndex + query.length + 72);
  const snippet = body.slice(start, end).trim();

  return `${start > 0 ? "…" : ""}${snippet}${end < body.length ? "…" : ""}`;
}

function getLatestEditSessionForPageFromSnapshot(
  snapshot: KnowledgeBaseSnapshot,
  pageId: string,
  userId: string,
) {
  return (
    snapshot.editSessions
      .filter((session) => session.pageId === pageId && session.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null
  );
}

function getEditSessionFromSnapshot(
  snapshot: KnowledgeBaseSnapshot,
  pageId: string,
  userId: string,
  sessionKey: string,
) {
  return (
    snapshot.editSessions.find(
      (session) =>
        session.pageId === pageId &&
        session.userId === userId &&
        session.sessionKey === sessionKey,
    ) ?? null
  );
}

function toRevisionSummary(
  revision: PageRevision,
  userRows: User[],
): RevisionSummary {
  const user = userRows.find((candidate) => candidate.id === revision.createdByUserId);
  return {
    id: revision.id,
    revisionNumber: revision.revisionNumber,
    titleSnapshot: revision.titleSnapshot,
    createdAt: revision.createdAt,
    createdByUserId: revision.createdByUserId,
    createdByUserName: user?.name ?? "Unknown user",
  };
}

function createActivityEvent(params: {
  actorUserId: string;
  createdAt?: Date;
  effectiveReadLevel: number | null;
  effectiveWriteLevel: number | null;
  eventType: PageActivityEvent["eventType"];
  pageId: string | null;
  pageTitle: string;
  parentPageId?: string | null;
  parentPageTitle?: string | null;
  previousPageTitle?: string | null;
  revisionNumber?: number | null;
  workspaceId: string;
}): PageActivityEvent {
  return {
    id: randomUUID(),
    workspaceId: params.workspaceId,
    pageId: params.pageId,
    actorUserId: params.actorUserId,
    eventType: params.eventType,
    pageTitle: params.pageTitle,
    previousPageTitle: params.previousPageTitle ?? null,
    parentPageId: params.parentPageId ?? null,
    parentPageTitle: params.parentPageTitle ?? null,
    revisionNumber: params.revisionNumber ?? null,
    effectiveReadLevel: params.effectiveReadLevel,
    effectiveWriteLevel: params.effectiveWriteLevel,
    createdAt: params.createdAt ?? new Date(),
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function ensureWorkspaceSlug(
  pageRows: Page[],
  workspaceId: string,
  baseSlug: string,
  excludePageId?: string,
) {
  const normalizedBaseSlug = baseSlug || "page";
  const existingSlugs = new Set(
    pageRows
      .filter((page) => page.workspaceId === workspaceId && page.id !== excludePageId)
      .map((page) => page.slug),
  );

  if (!existingSlugs.has(normalizedBaseSlug)) {
    return normalizedBaseSlug;
  }

  let suffix = 2;

  while (existingSlugs.has(`${normalizedBaseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${normalizedBaseSlug}-${suffix}`;
}

function getChildrenForParent(pageRows: Page[], workspaceId: string, parentPageId: string | null) {
  return pageRows.filter(
    (page) => page.workspaceId === workspaceId && page.parentPageId === parentPageId,
  );
}

function getNextSortOrder(pageRows: Page[], workspaceId: string, parentPageId: string | null) {
  const siblings = getChildrenForParent(pageRows, workspaceId, parentPageId);
  const maxSortOrder = siblings.reduce(
    (currentMax, sibling) => Math.max(currentMax, sibling.sortOrder),
    -1,
  );

  return maxSortOrder + 1;
}

function buildPagePath(parentPage: Page | null, slug: string) {
  return parentPage ? `${parentPage.path}/${slug}` : `/${slug}`;
}

function normalizePermissionLevel(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  return value;
}

function resolvePermissions(params: {
  workspace: Workspace;
  parentPage: Page | null;
  explicitReadLevel?: number | null;
  explicitWriteLevel?: number | null;
}) {
  if (params.workspace.type === "private") {
    return {
      explicitReadLevel: null,
      explicitWriteLevel: null,
      effectiveReadLevel: null,
      effectiveWriteLevel: null,
    } satisfies ResolvedPermissions;
  }

  const explicitReadLevel = normalizePermissionLevel(params.explicitReadLevel);
  const explicitWriteLevel = normalizePermissionLevel(params.explicitWriteLevel);

  if (
    explicitReadLevel !== null &&
    explicitWriteLevel !== null &&
    explicitWriteLevel < explicitReadLevel
  ) {
    throw new Error("Write level cannot be less permissive than read level.");
  }

  const inheritedReadLevel = params.parentPage?.effectiveReadLevel ?? null;
  const inheritedWriteLevel = params.parentPage?.effectiveWriteLevel ?? null;
  const effectiveReadLevel =
    inheritedReadLevel === null
      ? explicitReadLevel
      : explicitReadLevel === null
        ? inheritedReadLevel
        : Math.max(inheritedReadLevel, explicitReadLevel);
  const effectiveWriteLevel =
    inheritedWriteLevel === null
      ? explicitWriteLevel
      : explicitWriteLevel === null
        ? inheritedWriteLevel
        : Math.max(inheritedWriteLevel, explicitWriteLevel);

  if (effectiveReadLevel === null || effectiveWriteLevel === null) {
    throw new Error("Shared pages require effective read and write levels.");
  }

  if (effectiveWriteLevel < effectiveReadLevel) {
    throw new Error("Effective write level cannot be less permissive than read level.");
  }

  return {
    explicitReadLevel,
    explicitWriteLevel,
    effectiveReadLevel,
    effectiveWriteLevel,
  } satisfies ResolvedPermissions;
}

function assertUserCanCreatePage(params: {
  actingUser: User;
  workspace: Workspace;
  parentPage: Page | null;
  permissions: ResolvedPermissions;
}) {
  const { actingUser, workspace, parentPage, permissions } = params;

  if (!canReadWorkspace(actingUser, workspace)) {
    throw new Error("You do not have permission to access this workspace.");
  }

  if (workspace.type === "private") {
    if (workspace.ownerUserId !== actingUser.id) {
      throw new Error("You do not have permission to create pages in this workspace.");
    }

    return;
  }

  if (parentPage && !canWritePage(actingUser, workspace, parentPage)) {
    throw new Error("You do not have permission to create pages under this parent.");
  }

  if (
    permissions.effectiveWriteLevel !== null &&
    actingUser.permissionLevel < permissions.effectiveWriteLevel
  ) {
    throw new Error("You cannot create a page above your write permission level.");
  }
}

function getPageContext(snapshot: KnowledgeBaseSnapshot, input: {
  actingUserId: string;
  pageId: string;
}): PageContext {
  const actingUser = snapshot.users.find((user) => user.id === input.actingUserId);

  if (!actingUser) {
    throw new Error("Acting user not found.");
  }

  const page = getPageFromSnapshot(snapshot, input.pageId);

  if (!page) {
    throw new Error("Page not found.");
  }

  const workspace = getWorkspaceFromSnapshot(snapshot, page.workspaceId);

  if (!workspace) {
    throw new Error("Workspace not found.");
  }

  return {
    actingUser,
    page,
    workspace,
  };
}

function assertPageWriteAccess(snapshot: KnowledgeBaseSnapshot, input: SavePageInput) {
  const context = getPageContext(snapshot, input);

  if (!canWritePage(context.actingUser, context.workspace, context.page)) {
    throw new Error("You do not have permission to edit this page.");
  }

  return context;
}

function assertCurrentRevisionMatches(page: Page, currentRevisionId?: string | null) {
  if (!currentRevisionId) {
    return;
  }

  if (page.currentRevisionId !== currentRevisionId) {
    throw new Error("A newer revision exists. Reload this page before saving again.");
  }
}

function upsertFallbackEditSession(
  currentSessions: PageEditSession[],
  input: {
    pageId: string;
    userId: string;
    sessionKey: string;
    baseRevisionId: string | null;
    draftTitle: string;
    draftContentMarkdown: string;
    draftEditorDocJson: unknown;
  },
) {
  const existingSession = currentSessions.find(
    (session) =>
      session.pageId === input.pageId &&
      session.userId === input.userId &&
      session.sessionKey === input.sessionKey,
  );

  if (!existingSession) {
    return [
      {
        id: randomUUID(),
        pageId: input.pageId,
        userId: input.userId,
        sessionKey: input.sessionKey,
        baseRevisionId: input.baseRevisionId,
        draftTitle: input.draftTitle,
        draftContentMarkdown: input.draftContentMarkdown,
        draftEditorDocJson: input.draftEditorDocJson ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies PageEditSession,
      ...currentSessions,
    ];
  }

  return currentSessions.map((session) =>
    session.id === existingSession.id
      ? {
          ...session,
          baseRevisionId: input.baseRevisionId,
          draftTitle: input.draftTitle,
          draftContentMarkdown: input.draftContentMarkdown,
          draftEditorDocJson: input.draftEditorDocJson ?? null,
          updatedAt: new Date(),
        }
      : session,
  );
}

function computeSubtreePermissionUpdates(params: {
  pageRows: Page[];
  rootPage: Page;
  workspace: Workspace;
  explicitReadLevel?: number | null;
  explicitWriteLevel?: number | null;
  actingUser: User;
  descendantStrategy?: "cascade" | "preserve";
}) {
  if (params.workspace.type === "private") {
    return [
      {
        ...params.rootPage,
        explicitReadLevel: null,
        explicitWriteLevel: null,
        effectiveReadLevel: null,
        effectiveWriteLevel: null,
        updatedAt: new Date(),
      },
    ];
  }

  const subtree = getSubtreePages(params.pageRows, params.rootPage);
  const updates = new Map<string, Page>();
  const rootPermissions = resolvePermissions({
    workspace: params.workspace,
    parentPage:
      params.rootPage.parentPageId === null
        ? null
        : params.pageRows.find((candidate) => candidate.id === params.rootPage.parentPageId) ??
          null,
    explicitReadLevel: params.explicitReadLevel,
    explicitWriteLevel: params.explicitWriteLevel,
  });
  const rootBecameStricter =
    isStricterLevel(rootPermissions.effectiveReadLevel, params.rootPage.effectiveReadLevel) ||
    isStricterLevel(rootPermissions.effectiveWriteLevel, params.rootPage.effectiveWriteLevel);
  const rootBecameLooser =
    isLooserLevel(rootPermissions.effectiveReadLevel, params.rootPage.effectiveReadLevel) ||
    isLooserLevel(rootPermissions.effectiveWriteLevel, params.rootPage.effectiveWriteLevel);

  for (const page of subtree) {
    const nextParentPage = page.parentPageId
      ? updates.get(page.parentPageId) ??
        params.pageRows.find((candidate) => candidate.id === page.parentPageId) ??
        null
      : null;
    let explicitReadLevel =
      page.id === params.rootPage.id
        ? (params.explicitReadLevel ?? null)
        : (page.explicitReadLevel ?? null);
    let explicitWriteLevel =
      page.id === params.rootPage.id
        ? (params.explicitWriteLevel ?? null)
        : (page.explicitWriteLevel ?? null);
    let permissions = resolvePermissions({
      workspace: params.workspace,
      parentPage: nextParentPage,
      explicitReadLevel,
      explicitWriteLevel,
    });

    if (page.id !== params.rootPage.id && rootBecameStricter) {
      if (
        rootPermissions.effectiveReadLevel !== null &&
        (explicitReadLevel === null || explicitReadLevel < rootPermissions.effectiveReadLevel)
      ) {
        explicitReadLevel = rootPermissions.effectiveReadLevel;
      }

      if (
        rootPermissions.effectiveWriteLevel !== null &&
        (explicitWriteLevel === null || explicitWriteLevel < rootPermissions.effectiveWriteLevel)
      ) {
        explicitWriteLevel = rootPermissions.effectiveWriteLevel;
      }

      permissions = resolvePermissions({
        workspace: params.workspace,
        parentPage: nextParentPage,
        explicitReadLevel,
        explicitWriteLevel,
      });
    }

    if (
      page.id !== params.rootPage.id &&
      rootBecameLooser &&
      params.descendantStrategy === "preserve"
    ) {
      if (
        isLooserLevel(permissions.effectiveReadLevel, page.effectiveReadLevel) &&
        page.effectiveReadLevel !== null
      ) {
        explicitReadLevel = Math.max(explicitReadLevel ?? page.effectiveReadLevel, page.effectiveReadLevel);
      }

      if (
        isLooserLevel(permissions.effectiveWriteLevel, page.effectiveWriteLevel) &&
        page.effectiveWriteLevel !== null
      ) {
        explicitWriteLevel = Math.max(
          explicitWriteLevel ?? page.effectiveWriteLevel,
          page.effectiveWriteLevel,
        );
      }

      permissions = resolvePermissions({
        workspace: params.workspace,
        parentPage: nextParentPage,
        explicitReadLevel,
        explicitWriteLevel,
      });
    }

    if (
      page.id !== params.rootPage.id &&
      rootBecameLooser &&
      params.descendantStrategy === "cascade"
    ) {
      explicitReadLevel = rootPermissions.effectiveReadLevel;
      explicitWriteLevel = rootPermissions.effectiveWriteLevel;

      permissions = resolvePermissions({
        workspace: params.workspace,
        parentPage: nextParentPage,
        explicitReadLevel,
        explicitWriteLevel,
      });
    }

    if (
      permissions.effectiveWriteLevel !== null &&
      params.actingUser.permissionLevel < permissions.effectiveWriteLevel
    ) {
      throw new Error("You cannot set page permissions level.");
    }

    updates.set(page.id, {
      ...page,
      explicitReadLevel: permissions.explicitReadLevel,
      explicitWriteLevel: permissions.explicitWriteLevel,
      effectiveReadLevel: permissions.effectiveReadLevel,
      effectiveWriteLevel: permissions.effectiveWriteLevel,
      updatedAt: new Date(),
    });
  }

  return Array.from(updates.values());
}

function isDescendantPath(descendantPath: string, ancestorPath: string) {
  return descendantPath === ancestorPath || descendantPath.startsWith(`${ancestorPath}/`);
}

function getSubtreePages(pageRows: Page[], rootPage: Page) {
  return pageRows
    .filter(
      (page) =>
        page.workspaceId === rootPage.workspaceId &&
        isDescendantPath(page.path, rootPage.path),
    )
    .sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));
}

function clamp(value: number, minValue: number, maxValue: number) {
  return Math.min(Math.max(value, minValue), maxValue);
}

function sortSiblingPages(pageRows: Page[]) {
  return [...pageRows].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());
}

function getNormalizedDestinationIndex(
  destinationSiblings: Page[],
  requestedIndex?: number | null,
) {
  if (requestedIndex === null || requestedIndex === undefined || Number.isNaN(requestedIndex)) {
    return destinationSiblings.length;
  }

  return clamp(requestedIndex, 0, destinationSiblings.length);
}

function getReindexedSiblingUpdates(params: {
  rootPage: Page;
  destinationParentPage: Page | null;
  destinationSiblings: Page[];
  destinationIndex: number;
  sourceSiblings: Page[];
  sameParent: boolean;
}) {
  const updates = new Map<string, number>();

  const destinationPages = [...params.destinationSiblings];
  destinationPages.splice(params.destinationIndex, 0, params.rootPage);

  for (const [index, sibling] of destinationPages.entries()) {
    updates.set(sibling.id, index);
  }

  if (!params.sameParent) {
    for (const [index, sibling] of params.sourceSiblings.entries()) {
      updates.set(sibling.id, index);
    }
  }

  return {
    siblingSortOrders: updates,
    rootSortOrder: updates.get(params.rootPage.id) ?? params.destinationIndex,
    destinationParentId: params.destinationParentPage?.id ?? null,
  };
}

function computeSubtreeMoveUpdates(params: {
  actingUser: User;
  pageRows: Page[];
  rootPage: Page;
  destinationParentPage: Page | null;
  destinationWorkspace: Workspace;
  sortOrder: number;
  nextRootSlug: string;
  weakeningStrategy?: "inherit" | "preserve";
  destinationExplicitReadLevel?: number | null;
  destinationExplicitWriteLevel?: number | null;
}) {
  const subtree = getSubtreePages(params.pageRows, params.rootPage);
  const destinationDepth = params.destinationParentPage ? params.destinationParentPage.depth + 1 : 0;
  const maxRelativeDepth = subtree.reduce(
    (currentMax, page) => Math.max(currentMax, page.depth - params.rootPage.depth),
    0,
  );

  if (destinationDepth + maxRelativeDepth > MAX_PAGE_DEPTH) {
    throw new Error(`Pages cannot be nested deeper than ${MAX_PAGE_DEPTH} levels.`);
  }

  const destinationPath = buildPagePath(params.destinationParentPage, params.nextRootSlug);
  const updates = new Map<string, Page>();

  for (const page of subtree) {
    const nextParentId =
      page.id === params.rootPage.id
        ? params.destinationParentPage?.id ?? null
        : page.parentPageId;
    const nextParentPage =
      page.id === params.rootPage.id
        ? params.destinationParentPage
        : nextParentId
          ? updates.get(nextParentId) ?? params.pageRows.find((row) => row.id === nextParentId) ?? null
          : null;
    const nextPath =
      page.id === params.rootPage.id
        ? destinationPath
        : page.path.replace(params.rootPage.path, destinationPath);
    const nextDepth =
      page.id === params.rootPage.id
        ? destinationDepth
        : page.depth - params.rootPage.depth + destinationDepth;
    let explicitReadLevel =
      page.id === params.rootPage.id
        ? params.destinationExplicitReadLevel ?? page.explicitReadLevel
        : page.explicitReadLevel ?? null;
    let explicitWriteLevel =
      page.id === params.rootPage.id
        ? params.destinationExplicitWriteLevel ?? page.explicitWriteLevel
        : page.explicitWriteLevel ?? null;

    if (
      page.id === params.rootPage.id &&
      params.destinationWorkspace.type === "shared" &&
      params.destinationParentPage === null
    ) {
      explicitReadLevel ??= params.actingUser.permissionLevel;
      explicitWriteLevel ??= params.actingUser.permissionLevel;
    }

    let permissions = resolvePermissions({
      workspace: params.destinationWorkspace,
      parentPage: nextParentPage,
      explicitReadLevel,
      explicitWriteLevel,
    });

    const readWeakened = isLooserLevel(permissions.effectiveReadLevel, page.effectiveReadLevel);
    const writeWeakened = isLooserLevel(
      permissions.effectiveWriteLevel,
      page.effectiveWriteLevel,
    );

    if (params.destinationWorkspace.type === "shared" && (readWeakened || writeWeakened)) {
      if (!params.weakeningStrategy) {
        throw new Error("Move requires permission resolution.");
      }

      if (params.weakeningStrategy === "preserve") {
        if (readWeakened && page.effectiveReadLevel !== null) {
          explicitReadLevel = Math.max(
            explicitReadLevel ?? page.effectiveReadLevel,
            page.effectiveReadLevel,
          );
        }

        if (writeWeakened && page.effectiveWriteLevel !== null) {
          explicitWriteLevel = Math.max(
            explicitWriteLevel ?? page.effectiveWriteLevel,
            page.effectiveWriteLevel,
          );
        }

        permissions = resolvePermissions({
          workspace: params.destinationWorkspace,
          parentPage: nextParentPage,
          explicitReadLevel,
          explicitWriteLevel,
        });
      }
    }

    updates.set(page.id, {
      ...page,
      workspaceId: params.destinationWorkspace.id,
      parentPageId: nextParentId,
      path: nextPath,
      depth: nextDepth,
      slug: page.id === params.rootPage.id ? params.nextRootSlug : page.slug,
      sortOrder: page.id === params.rootPage.id ? params.sortOrder : page.sortOrder,
      explicitReadLevel: permissions.explicitReadLevel,
      explicitWriteLevel: permissions.explicitWriteLevel,
      effectiveReadLevel: permissions.effectiveReadLevel,
      effectiveWriteLevel: permissions.effectiveWriteLevel,
      updatedAt: new Date(),
    });
  }

  return Array.from(updates.values());
}

function getRedirectPageAfterDelete(snapshot: KnowledgeBaseSnapshot, deletedPage: Page) {
  if (deletedPage.parentPageId) {
    return deletedPage.parentPageId;
  }

  const siblings = snapshot.pages
    .filter(
      (page) =>
        page.workspaceId === deletedPage.workspaceId &&
        page.parentPageId === null &&
        page.id !== deletedPage.id,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return siblings[0]?.id ?? null;
}

function requireNonEmpty(value: string, fieldName: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

export async function getAvailableUsers() {
  const snapshot = await getSnapshot();

  return snapshot.users;
}

export async function getCurrentUser(userId?: string | null) {
  const snapshot = await getSnapshot();

  return getCurrentUserFromSnapshot(snapshot, userId);
}

export async function getKnowledgeBaseView(input: {
  userId?: string | null;
  pageId?: string | null;
}): Promise<KnowledgeBaseView> {
  const snapshot = await getSnapshot();
  const currentUser = getCurrentUserFromSnapshot(snapshot, input.userId);

  if (!currentUser) {
    return {
      availableUsers: snapshot.users,
      currentUser: null,
      recentActivity: [],
      selectedPageId: null,
      selectedPage: null,
      selectedRevision: null,
      selectedDraft: null,
      selectedPageBacklinks: [],
      selectedPageRevisions: [],
      visibleWorkspaces: [],
    };
  }

  const visibleWorkspaces = getVisibleWorkspacesFromSnapshot(snapshot, currentUser);
  const requestedPage = selectVisiblePage(visibleWorkspaces, input.pageId ?? null);
  const selectedPage =
    requestedPage ??
    visibleWorkspaces.flatMap(({ pages }) => flatten(pages))[0] ??
    null;
  const selectedPageWithDescendants = selectedPage
    ? {
        ...selectedPage,
        hasDescendants: snapshot.pages.some(
          (page) =>
            page.workspaceId === selectedPage.workspaceId &&
            page.parentPageId === selectedPage.id,
        ),
      }
    : null;
  const selectedRevision = selectedPage
    ? getRevisionForPageFromSnapshot(snapshot, selectedPage.id, selectedPage.currentRevisionId)
    : null;
  const selectedDraft =
    selectedPage && currentUser
      ? getLatestEditSessionForPageFromSnapshot(snapshot, selectedPage.id, currentUser.id)
      : null;
  const selectedPageRevisions = selectedPage
    ? getPageRevisionsFromSnapshot(snapshot, selectedPage.id).map((revision) =>
        toRevisionSummary(revision, snapshot.users),
      )
    : [];
  const selectedPageBacklinks = getBacklinksFromVisibleWorkspaces(
    snapshot,
    currentUser,
    visibleWorkspaces,
    selectedPage?.id ?? null,
  );
  const recentActivity = getRecentActivityFromVisibleWorkspaces(
    snapshot,
    currentUser,
    visibleWorkspaces,
  );

  return {
    availableUsers: snapshot.users,
    currentUser,
    recentActivity,
    selectedPageId: selectedPageWithDescendants?.id ?? null,
    selectedPage: selectedPageWithDescendants,
    selectedRevision,
    selectedDraft: selectedDraft
      ? {
          title: selectedDraft.draftTitle,
          contentMarkdown: selectedDraft.draftContentMarkdown,
          editorDocJson: selectedDraft.draftEditorDocJson,
        }
      : null,
    selectedPageBacklinks,
    selectedPageRevisions,
    visibleWorkspaces,
  };
}

export async function searchKnowledgeBase(input: {
  userId?: string | null;
  query: string;
}): Promise<SearchKnowledgeBaseResult> {
  const snapshot = await getSnapshot();
  const currentUser = getCurrentUserFromSnapshot(snapshot, input.userId);
  const normalizedQuery = input.query.trim().toLowerCase();

  if (!currentUser || normalizedQuery.length < 3) {
    return { results: [] };
  }

  const visibleWorkspaces = getVisibleWorkspacesFromSnapshot(snapshot, currentUser);
  const results = visibleWorkspaces
    .flatMap(({ workspace, pages }) =>
      flatten(pages).map((page) => {
        const title = page.title.toLowerCase();
        const body = stripSearchText(page.currentContentMarkdown ?? "");
        let score = 0;

        if (title === normalizedQuery) score += 300;
        if (title.startsWith(normalizedQuery)) score += 180;
        if (title.includes(normalizedQuery)) score += 100;
        if (body.includes(normalizedQuery)) score += 40;

        return {
          id: page.id,
          title: page.title,
          href: `/?page=${page.id}`,
          workspaceLabel: workspace.type === "private" ? "Personal" : "Shared",
          workspaceType: workspace.type,
          snippet: getSearchSnippet(body, normalizedQuery),
          score,
        };
      }),
    )
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 20)
    .map((result) => ({
      id: result.id,
      title: result.title,
      href: result.href,
      workspaceLabel: result.workspaceLabel,
      workspaceType: result.workspaceType,
      snippet: result.snippet,
    }));

  return { results };
}

export async function getPageRevisions(input: { actingUserId: string; pageId: string }) {
  const snapshot = await getSnapshot();
  const { actingUser, page, workspace } = getPageContext(snapshot, input);

  if (!canReadPage(actingUser, workspace, page)) {
    throw new Error("You do not have permission to read this page.");
  }

  return getPageRevisionsFromSnapshot(snapshot, page.id).map((revision) =>
    toRevisionSummary(revision, snapshot.users),
  );
}

function restoreFallbackPageRevision(
  input: RestorePageRevisionInput,
): RestorePageRevisionResult {
  const snapshot = fallbackStore;
  const { actingUser, page, workspace } = getPageContext(snapshot, input);

  if (!canWritePage(actingUser, workspace, page)) {
    throw new Error("You do not have permission to restore this page.");
  }

  const targetRevision = snapshot.revisions.find(
    (revision) => revision.id === input.revisionId && revision.pageId === page.id,
  );

  if (!targetRevision) {
    throw new Error("Revision not found.");
  }

  const currentRevisionNumber =
    getPageRevisionsFromSnapshot(snapshot, page.id)[0]?.revisionNumber ?? 0;
  const restoredRevision: PageRevision = {
    id: randomUUID(),
    pageId: page.id,
    revisionNumber: currentRevisionNumber + 1,
    titleSnapshot: targetRevision.titleSnapshot,
    contentMarkdown: targetRevision.contentMarkdown,
    editorDocJson: targetRevision.editorDocJson ?? null,
    createdByUserId: actingUser.id,
    createdAt: new Date(),
  };
  const updatedPage: Page = {
    ...page,
    title: targetRevision.titleSnapshot,
    currentRevisionId: restoredRevision.id,
    updatedByUserId: actingUser.id,
    updatedAt: restoredRevision.createdAt,
  };

  fallbackStore = {
    ...snapshot,
    pages: snapshot.pages.map((candidate) =>
      candidate.id === page.id ? updatedPage : candidate,
    ),
    revisions: [restoredRevision, ...snapshot.revisions],
    editSessions: snapshot.editSessions.filter((session) => session.pageId !== page.id),
  };

  return {
    page: updatedPage,
    revision: restoredRevision,
  };
}

async function restoreDatabasePageRevision(
  input: RestorePageRevisionInput,
): Promise<RestorePageRevisionResult> {
  if (!db) {
    throw new Error("DATABASE_URL is required for database writes.");
  }

  return db.transaction(async (tx) => {
    const [actingUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.actingUserId))
      .limit(1);

    if (!actingUser) {
      throw new Error("Acting user not found.");
    }

    const [page] = await tx.select().from(pages).where(eq(pages.id, input.pageId)).limit(1);

    if (!page) {
      throw new Error("Page not found.");
    }

    const [workspace] = await tx
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, page.workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error("Workspace not found.");
    }

    if (!canWritePage(actingUser, workspace, page)) {
      throw new Error("You do not have permission to restore this page.");
    }

    const [targetRevision] = await tx
      .select()
      .from(pageRevisions)
      .where(and(eq(pageRevisions.id, input.revisionId), eq(pageRevisions.pageId, page.id)))
      .limit(1);

    if (!targetRevision) {
      throw new Error("Revision not found.");
    }

    const currentRevisionNumber = (
      await tx
        .select({ value: max(pageRevisions.revisionNumber) })
        .from(pageRevisions)
        .where(eq(pageRevisions.pageId, page.id))
    )[0]?.value ?? 0;

    const [restoredRevision] = await tx
      .insert(pageRevisions)
      .values({
        pageId: page.id,
        revisionNumber: currentRevisionNumber + 1,
        titleSnapshot: targetRevision.titleSnapshot,
        contentMarkdown: targetRevision.contentMarkdown,
        editorDocJson: targetRevision.editorDocJson ?? null,
        createdByUserId: actingUser.id,
      })
      .returning();

    const [updatedPage] = await tx
      .update(pages)
      .set({
        title: targetRevision.titleSnapshot,
        currentRevisionId: restoredRevision.id,
        updatedByUserId: actingUser.id,
        updatedAt: restoredRevision.createdAt,
      })
      .where(eq(pages.id, page.id))
      .returning();

    await tx.delete(pageEditSessions).where(eq(pageEditSessions.pageId, page.id));

    return {
      page: updatedPage,
      revision: restoredRevision,
    };
  });
}

export async function restorePageRevision(
  input: RestorePageRevisionInput,
): Promise<RestorePageRevisionResult> {
  if (!db) {
    return restoreFallbackPageRevision(input);
  }

  return restoreDatabasePageRevision(input);
}

function updateFallbackPage(input: SavePageInput): SavePageResult {
  const snapshot = fallbackStore;
  const { actingUser, page, workspace } = assertPageWriteAccess(snapshot, input);
  assertCurrentRevisionMatches(page, input.currentRevisionId);
  const previousRevision = getPageRevisionsFromSnapshot(snapshot, page.id)[0] ?? null;
  const saveMode = input.saveMode ?? "manual";

  if (saveMode === "autosave") {
    if (!input.editorSessionId) {
      throw new Error("Autosave requires an editor session.");
    }

    const existingSession = getEditSessionFromSnapshot(
      snapshot,
      page.id,
      actingUser.id,
      input.editorSessionId,
    );

    if (existingSession) {
      const baseRevision =
        snapshot.revisions.find((revision) => revision.id === existingSession.baseRevisionId) ??
        previousRevision;

      if (!baseRevision) {
        throw new Error("Session revision not found.");
      }

      const updatedSession: PageEditSession = {
        ...existingSession,
        draftTitle: input.title,
        draftContentMarkdown: input.contentMarkdown,
        draftEditorDocJson: input.editorDocJson ?? null,
        updatedAt: new Date(),
      };

      fallbackStore = {
        ...snapshot,
        editSessions: snapshot.editSessions.map((session) =>
          session.id === updatedSession.id ? updatedSession : session,
        ),
      };

      return {
        page,
        revision: baseRevision,
      };
    }
  }

  const revision: PageRevision = {
    id: randomUUID(),
    pageId: page.id,
    revisionNumber: (previousRevision?.revisionNumber ?? 0) + 1,
    titleSnapshot: input.title,
    contentMarkdown: input.contentMarkdown,
    editorDocJson: input.editorDocJson ?? null,
    createdByUserId: actingUser.id,
    createdAt: new Date(),
  };
  const updatedPage: Page = {
    ...page,
    title: input.title,
    currentRevisionId: revision.id,
    updatedByUserId: actingUser.id,
    updatedAt: new Date(),
  };
  const titleChanged = page.title !== input.title;
  const contentChanged =
    previousRevision?.contentMarkdown !== input.contentMarkdown ||
    JSON.stringify(previousRevision?.editorDocJson ?? null) !==
      JSON.stringify(input.editorDocJson ?? null);
  const nextEditSessions = input.editorSessionId
    ? upsertFallbackEditSession(snapshot.editSessions, {
        pageId: page.id,
        userId: actingUser.id,
        sessionKey: input.editorSessionId,
        baseRevisionId: revision.id,
        draftTitle: input.title,
        draftContentMarkdown: input.contentMarkdown,
        draftEditorDocJson: input.editorDocJson ?? null,
      })
    : snapshot.editSessions;
  const activityEvents = [...snapshot.activityEvents];

  if (workspace.type === "shared") {
    if (titleChanged) {
      activityEvents.unshift(
        createActivityEvent({
          actorUserId: actingUser.id,
          createdAt: updatedPage.updatedAt,
          effectiveReadLevel: updatedPage.effectiveReadLevel,
          effectiveWriteLevel: updatedPage.effectiveWriteLevel,
          eventType: "page_renamed",
          pageId: updatedPage.id,
          pageTitle: updatedPage.title,
          previousPageTitle: page.title,
          workspaceId: workspace.id,
        }),
      );
    }

    if (contentChanged) {
      activityEvents.unshift(
        createActivityEvent({
          actorUserId: actingUser.id,
          createdAt: revision.createdAt,
          effectiveReadLevel: updatedPage.effectiveReadLevel,
          effectiveWriteLevel: updatedPage.effectiveWriteLevel,
          eventType: "page_edited",
          pageId: updatedPage.id,
          pageTitle: updatedPage.title,
          revisionNumber: revision.revisionNumber,
          workspaceId: workspace.id,
        }),
      );
    }
  }

  fallbackStore = {
    ...snapshot,
    activityEvents,
    pages: snapshot.pages.map((pageRow) =>
      pageRow.id === updatedPage.id ? updatedPage : pageRow,
    ),
    revisions: [revision, ...snapshot.revisions],
    editSessions: nextEditSessions,
  };

  return {
    page: updatedPage,
    revision,
  };
}

async function updateDatabasePage(input: SavePageInput): Promise<SavePageResult> {
  if (!db) {
    throw new Error("DATABASE_URL is required for database writes.");
  }

  return db.transaction(async (tx) => {
    const [actingUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.actingUserId))
      .limit(1);

    if (!actingUser) {
      throw new Error("Acting user not found.");
    }

    const [page] = await tx.select().from(pages).where(eq(pages.id, input.pageId)).limit(1);

    if (!page) {
      throw new Error("Page not found.");
    }
    assertCurrentRevisionMatches(page, input.currentRevisionId);

    const [workspace] = await tx
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, page.workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error("Workspace not found.");
    }

    if (!canWritePage(actingUser, workspace, page)) {
      throw new Error("You do not have permission to edit this page.");
    }

    const saveMode = input.saveMode ?? "manual";

    if (saveMode === "autosave") {
      if (!input.editorSessionId) {
        throw new Error("Autosave requires an editor session.");
      }

      const existingSession =
        (
          await tx
            .select()
            .from(pageEditSessions)
            .where(
              and(
                eq(pageEditSessions.pageId, page.id),
                eq(pageEditSessions.userId, actingUser.id),
                eq(pageEditSessions.sessionKey, input.editorSessionId),
              ),
            )
            .limit(1)
        )[0] ?? null;

      if (existingSession) {
        await tx
          .update(pageEditSessions)
          .set({
            draftTitle: input.title,
            draftContentMarkdown: input.contentMarkdown,
            draftEditorDocJson: input.editorDocJson ?? null,
            updatedAt: new Date(),
          })
          .where(eq(pageEditSessions.id, existingSession.id));

        const baseRevision =
          existingSession.baseRevisionId
            ? (
                await tx
                  .select()
                  .from(pageRevisions)
                  .where(eq(pageRevisions.id, existingSession.baseRevisionId))
                  .limit(1)
              )[0] ?? null
            : null;

        if (!baseRevision) {
          throw new Error("Session revision not found.");
        }

        return {
          page,
          revision: baseRevision,
        };
      }
    }

    const [{ value: currentRevisionNumber }] = await tx
      .select({
        value: max(pageRevisions.revisionNumber),
      })
      .from(pageRevisions)
      .where(eq(pageRevisions.pageId, page.id));

    const [revision] = await tx
      .insert(pageRevisions)
      .values({
        pageId: page.id,
        revisionNumber: (currentRevisionNumber ?? 0) + 1,
        titleSnapshot: input.title,
        contentMarkdown: input.contentMarkdown,
        editorDocJson: input.editorDocJson ?? null,
        createdByUserId: actingUser.id,
      })
      .returning();
    const titleChanged = page.title !== input.title;
    const previousRevision =
      page.currentRevisionId
        ? (
            await tx
              .select()
              .from(pageRevisions)
              .where(eq(pageRevisions.id, page.currentRevisionId))
              .limit(1)
          )[0] ?? null
        : null;
    const contentChanged =
      previousRevision?.contentMarkdown !== input.contentMarkdown ||
      JSON.stringify(previousRevision?.editorDocJson ?? null) !==
        JSON.stringify(input.editorDocJson ?? null);

    const [updatedPage] = await tx
      .update(pages)
      .set({
        title: input.title,
        currentRevisionId: revision.id,
        updatedByUserId: actingUser.id,
        updatedAt: new Date(),
      })
      .where(and(eq(pages.id, page.id), eq(pages.workspaceId, workspace.id)))
      .returning();

    if (workspace.type === "shared") {
      if (titleChanged) {
        await tx.insert(pageActivityEvents).values({
          workspaceId: workspace.id,
          pageId: updatedPage.id,
          actorUserId: actingUser.id,
          eventType: "page_renamed",
          pageTitle: updatedPage.title,
          previousPageTitle: page.title,
          effectiveReadLevel: updatedPage.effectiveReadLevel,
          effectiveWriteLevel: updatedPage.effectiveWriteLevel,
          createdAt: updatedPage.updatedAt,
        });
      }

      if (contentChanged) {
        await tx.insert(pageActivityEvents).values({
          workspaceId: workspace.id,
          pageId: updatedPage.id,
          actorUserId: actingUser.id,
          eventType: "page_edited",
          pageTitle: updatedPage.title,
          revisionNumber: revision.revisionNumber,
          effectiveReadLevel: updatedPage.effectiveReadLevel,
          effectiveWriteLevel: updatedPage.effectiveWriteLevel,
          createdAt: revision.createdAt,
        });
      }
    }

    if (input.editorSessionId) {
      const existingSession =
        (
          await tx
            .select()
            .from(pageEditSessions)
            .where(
              and(
                eq(pageEditSessions.pageId, page.id),
                eq(pageEditSessions.userId, actingUser.id),
                eq(pageEditSessions.sessionKey, input.editorSessionId),
              ),
            )
            .limit(1)
        )[0] ?? null;

      if (existingSession) {
        await tx
          .update(pageEditSessions)
          .set({
            baseRevisionId: revision.id,
            draftTitle: input.title,
            draftContentMarkdown: input.contentMarkdown,
            draftEditorDocJson: input.editorDocJson ?? null,
            updatedAt: new Date(),
          })
          .where(eq(pageEditSessions.id, existingSession.id));
      } else {
        await tx.insert(pageEditSessions).values({
          pageId: page.id,
          userId: actingUser.id,
          sessionKey: input.editorSessionId,
          baseRevisionId: revision.id,
          draftTitle: input.title,
          draftContentMarkdown: input.contentMarkdown,
          draftEditorDocJson: input.editorDocJson ?? null,
        });
      }
    }

    return {
      page: updatedPage,
      revision,
    };
  });
}

export async function savePage(input: SavePageInput): Promise<SavePageResult> {
  const title = requireNonEmpty(input.title, "Title");
  const contentMarkdown = requireNonEmpty(input.contentMarkdown, "Markdown content");

  if (!db) {
    return updateFallbackPage({
      ...input,
      title,
      contentMarkdown,
    });
  }

  return updateDatabasePage({
    ...input,
    title,
    contentMarkdown,
  });
}

function updateFallbackPageMetadata(
  input: UpdatePageMetadataInput,
): UpdatePageMetadataResult {
  const snapshot = fallbackStore;
  const { actingUser, page, workspace } = getPageContext(snapshot, input);

  if (!canWritePage(actingUser, workspace, page)) {
    throw new Error("You do not have permission to edit this page.");
  }

  const updates = computeSubtreePermissionUpdates({
    pageRows: snapshot.pages,
    rootPage: page,
    workspace,
    explicitReadLevel: input.explicitReadLevel,
    explicitWriteLevel: input.explicitWriteLevel,
    actingUser,
    descendantStrategy: input.descendantStrategy,
  }).map((updatedPage) => ({
    ...updatedPage,
    updatedByUserId: actingUser.id,
  }));
  const updatesById = new Map(updates.map((updatedPage) => [updatedPage.id, updatedPage]));
  const updatedRootPage = updatesById.get(page.id);

  if (!updatedRootPage) {
    throw new Error("Failed to update page permissions.");
  }

  fallbackStore = {
    ...snapshot,
    pages: snapshot.pages.map((pageRow) => updatesById.get(pageRow.id) ?? pageRow),
  };

  return {
    page: updatedRootPage,
  };
}

async function updateDatabasePageMetadata(
  input: UpdatePageMetadataInput,
): Promise<UpdatePageMetadataResult> {
  if (!db) {
    throw new Error("DATABASE_URL is required for database writes.");
  }

  return db.transaction(async (tx) => {
    const [actingUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.actingUserId))
      .limit(1);

    if (!actingUser) {
      throw new Error("Acting user not found.");
    }

    const [page] = await tx.select().from(pages).where(eq(pages.id, input.pageId)).limit(1);

    if (!page) {
      throw new Error("Page not found.");
    }

    const [workspace] = await tx
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, page.workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error("Workspace not found.");
    }

    if (!canWritePage(actingUser, workspace, page)) {
      throw new Error("You do not have permission to edit this page.");
    }

    const pageRows = await tx
      .select()
      .from(pages)
      .where(eq(pages.workspaceId, workspace.id))
      .orderBy(asc(pages.path), asc(pages.sortOrder));
    const updates = computeSubtreePermissionUpdates({
      pageRows,
      rootPage: page,
      workspace,
      explicitReadLevel: input.explicitReadLevel,
      explicitWriteLevel: input.explicitWriteLevel,
      actingUser,
      descendantStrategy: input.descendantStrategy,
    });
    const updatesById = new Map(updates.map((updatedPage) => [updatedPage.id, updatedPage]));

    for (const updatedPage of updates) {
      await tx
        .update(pages)
        .set({
          explicitReadLevel: updatedPage.explicitReadLevel,
          explicitWriteLevel: updatedPage.explicitWriteLevel,
          effectiveReadLevel: updatedPage.effectiveReadLevel,
          effectiveWriteLevel: updatedPage.effectiveWriteLevel,
          updatedByUserId: actingUser.id,
          updatedAt: updatedPage.updatedAt,
        })
        .where(eq(pages.id, updatedPage.id));
    }

    const [updatedRootPage] = await tx
      .select()
      .from(pages)
      .where(eq(pages.id, page.id))
      .limit(1);

    if (!updatedRootPage || !updatesById.has(page.id)) {
      throw new Error("Failed to update page permissions.");
    }

    return {
      page: updatedRootPage,
    };
  });
}

export async function updatePageMetadata(
  input: UpdatePageMetadataInput,
): Promise<UpdatePageMetadataResult> {
  if (!db) {
    return updateFallbackPageMetadata(input);
  }

  return updateDatabasePageMetadata(input);
}

function createFallbackPage(input: CreatePageInput): CreatePageResult {
  const snapshot = fallbackStore;
  const actingUser = snapshot.users.find((user) => user.id === input.actingUserId);

  if (!actingUser) {
    throw new Error("Acting user not found.");
  }

  const workspace = getWorkspaceFromSnapshot(snapshot, input.workspaceId);

  if (!workspace) {
    throw new Error("Workspace not found.");
  }

  const parentPage = input.parentPageId
    ? getPageFromSnapshot(snapshot, input.parentPageId)
    : null;

  if (input.parentPageId && !parentPage) {
    throw new Error("Destination parent page not found.");
  }

  if (parentPage && parentPage.workspaceId !== workspace.id) {
    throw new Error("Parent page must belong to the selected workspace.");
  }

  const defaultExplicitReadLevel =
    workspace.type === "shared"
      ? input.explicitReadLevel ?? actingUser.permissionLevel
      : null;
  const defaultExplicitWriteLevel =
    workspace.type === "shared"
      ? input.explicitWriteLevel ?? actingUser.permissionLevel
      : null;
  const permissions = resolvePermissions({
    workspace,
    parentPage,
    explicitReadLevel: defaultExplicitReadLevel,
    explicitWriteLevel: defaultExplicitWriteLevel,
  });

  assertUserCanCreatePage({
    actingUser,
    workspace,
    parentPage,
    permissions,
  });

  const slug = ensureWorkspaceSlug(
    snapshot.pages,
    workspace.id,
    slugify(input.slug ?? input.title) || "page",
  );
  const pageId = randomUUID();
  const page: Page = {
    id: pageId,
    workspaceId: workspace.id,
    parentPageId: parentPage?.id ?? null,
    path: buildPagePath(parentPage, slug),
    depth: parentPage ? parentPage.depth + 1 : 0,
    sortOrder: getNextSortOrder(snapshot.pages, workspace.id, parentPage?.id ?? null),
    title: input.title,
    slug,
    explicitReadLevel: permissions.explicitReadLevel,
    explicitWriteLevel: permissions.explicitWriteLevel,
    effectiveReadLevel: permissions.effectiveReadLevel,
    effectiveWriteLevel: permissions.effectiveWriteLevel,
    createdByUserId: actingUser.id,
    updatedByUserId: actingUser.id,
    currentRevisionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const revision: PageRevision = {
    id: randomUUID(),
    pageId,
    revisionNumber: 1,
    titleSnapshot: input.title,
    contentMarkdown: input.contentMarkdown,
    editorDocJson: null,
    createdByUserId: actingUser.id,
    createdAt: new Date(),
  };
  const pageWithRevision = {
    ...page,
    currentRevisionId: revision.id,
  };
  const activityEvent = createActivityEvent({
    actorUserId: actingUser.id,
    createdAt: revision.createdAt,
    effectiveReadLevel: pageWithRevision.effectiveReadLevel,
    effectiveWriteLevel: pageWithRevision.effectiveWriteLevel,
    eventType: "page_created",
    pageId: pageWithRevision.id,
    pageTitle: pageWithRevision.title,
    parentPageId: parentPage?.id ?? null,
    parentPageTitle: parentPage?.title ?? null,
    revisionNumber: revision.revisionNumber,
    workspaceId: workspace.id,
  });

  fallbackStore = {
    ...snapshot,
    activityEvents: [activityEvent, ...snapshot.activityEvents],
    pages: [...snapshot.pages, pageWithRevision],
    revisions: [revision, ...snapshot.revisions],
  };

  return {
    page: pageWithRevision,
    revision,
  };
}

async function createDatabasePage(input: CreatePageInput): Promise<CreatePageResult> {
  if (!db) {
    throw new Error("DATABASE_URL is required for database writes.");
  }

  return db.transaction(async (tx) => {
    const [actingUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.actingUserId))
      .limit(1);

    if (!actingUser) {
      throw new Error("Acting user not found.");
    }

    const [workspace] = await tx
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, input.workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error("Workspace not found.");
    }

    const parentPage = input.parentPageId
      ? (
          await tx
            .select()
            .from(pages)
            .where(eq(pages.id, input.parentPageId))
            .limit(1)
        )[0] ?? null
      : null;

    if (input.parentPageId && !parentPage) {
      throw new Error("Destination parent page not found.");
    }

    if (parentPage && parentPage.workspaceId !== workspace.id) {
      throw new Error("Parent page must belong to the selected workspace.");
    }

    const siblingRows = await tx
      .select()
      .from(pages)
      .where(eq(pages.workspaceId, workspace.id));
    const defaultExplicitReadLevel =
      workspace.type === "shared"
        ? input.explicitReadLevel ?? actingUser.permissionLevel
        : null;
    const defaultExplicitWriteLevel =
      workspace.type === "shared"
        ? input.explicitWriteLevel ?? actingUser.permissionLevel
        : null;
    const permissions = resolvePermissions({
      workspace,
      parentPage,
      explicitReadLevel: defaultExplicitReadLevel,
      explicitWriteLevel: defaultExplicitWriteLevel,
    });

    assertUserCanCreatePage({
      actingUser,
      workspace,
      parentPage,
      permissions,
    });

    const slug = ensureWorkspaceSlug(
      siblingRows,
      workspace.id,
      slugify(input.slug ?? input.title) || "page",
    );
    const [page] = await tx
      .insert(pages)
      .values({
        workspaceId: workspace.id,
        parentPageId: parentPage?.id ?? null,
        path: buildPagePath(parentPage, slug),
        depth: parentPage ? parentPage.depth + 1 : 0,
        sortOrder: getNextSortOrder(siblingRows, workspace.id, parentPage?.id ?? null),
        title: input.title,
        slug,
        explicitReadLevel: permissions.explicitReadLevel,
        explicitWriteLevel: permissions.explicitWriteLevel,
        effectiveReadLevel: permissions.effectiveReadLevel,
        effectiveWriteLevel: permissions.effectiveWriteLevel,
        createdByUserId: actingUser.id,
        updatedByUserId: actingUser.id,
      })
      .returning();
    const [revision] = await tx
      .insert(pageRevisions)
      .values({
        pageId: page.id,
        revisionNumber: 1,
        titleSnapshot: input.title,
        contentMarkdown: input.contentMarkdown,
        editorDocJson: null,
        createdByUserId: actingUser.id,
      })
      .returning();
    const [updatedPage] = await tx
      .update(pages)
      .set({
        currentRevisionId: revision.id,
      })
      .where(eq(pages.id, page.id))
      .returning();

    await tx.insert(pageActivityEvents).values({
      workspaceId: workspace.id,
      pageId: updatedPage.id,
      actorUserId: actingUser.id,
      eventType: "page_created",
      pageTitle: updatedPage.title,
      parentPageId: parentPage?.id ?? null,
      parentPageTitle: parentPage?.title ?? null,
      revisionNumber: revision.revisionNumber,
      effectiveReadLevel: updatedPage.effectiveReadLevel,
      effectiveWriteLevel: updatedPage.effectiveWriteLevel,
      createdAt: revision.createdAt,
    });

    return {
      page: updatedPage,
      revision,
    };
  });
}

export async function createPage(input: CreatePageInput): Promise<CreatePageResult> {
  const title = requireNonEmpty(input.title, "Title");
  const contentMarkdown = requireNonEmpty(input.contentMarkdown, "Markdown content");

  if (!db) {
    return createFallbackPage({
      ...input,
      title,
      contentMarkdown,
    });
  }

  return createDatabasePage({
    ...input,
    title,
    contentMarkdown,
  });
}

function moveFallbackPage(input: MovePageInput): MovePageResult {
  const snapshot = fallbackStore;
  const { actingUser, page, workspace } = getPageContext(snapshot, input);

  if (!canWritePage(actingUser, workspace, page)) {
    throw new Error("You do not have permission to move this page.");
  }

  const destinationParentPage = input.destinationParentPageId
    ? getPageFromSnapshot(snapshot, input.destinationParentPageId)
    : null;
  const destinationWorkspace =
    destinationParentPage
      ? getWorkspaceFromSnapshot(snapshot, destinationParentPage.workspaceId)
      : getWorkspaceFromSnapshot(
          snapshot,
          input.destinationWorkspaceId ?? page.workspaceId,
        );

  if (input.destinationParentPageId && !destinationParentPage) {
    throw new Error("Destination parent page not found.");
  }

  if (!destinationWorkspace) {
    throw new Error("Destination workspace not found.");
  }

  if (
    destinationWorkspace.type === "private" &&
    destinationWorkspace.ownerUserId !== actingUser.id
  ) {
    throw new Error("You do not have permission to move pages into that workspace.");
  }

  if (
    destinationParentPage &&
    !canWritePage(actingUser, destinationWorkspace, destinationParentPage)
  ) {
    throw new Error("You do not have permission to move pages under that parent.");
  }

  if (destinationParentPage && isDescendantPath(destinationParentPage.path, page.path)) {
    throw new Error("A page cannot be moved inside its own subtree.");
  }

  const allPages = snapshot.pages.filter(
    (candidate) =>
      candidate.workspaceId === page.workspaceId ||
      candidate.workspaceId === destinationWorkspace.id,
  );
  const sameParent =
    page.workspaceId === destinationWorkspace.id &&
    page.parentPageId === (destinationParentPage?.id ?? null);
  const sourceSiblings = sortSiblingPages(
    getChildrenForParent(allPages, page.workspaceId, page.parentPageId).filter(
      (candidate) => candidate.id !== page.id,
    ),
  );
  const destinationSiblings = sortSiblingPages(
    getChildrenForParent(
      allPages,
      destinationWorkspace.id,
      destinationParentPage?.id ?? null,
    ).filter((candidate) => candidate.id !== page.id),
  );
  const destinationIndex = getNormalizedDestinationIndex(
    destinationSiblings,
    input.destinationIndex,
  );
  const movePlan = getReindexedSiblingUpdates({
    rootPage: page,
    destinationParentPage,
    destinationSiblings,
    destinationIndex,
    sourceSiblings,
    sameParent,
  });
  const nextRootSlug = ensureWorkspaceSlug(
    snapshot.pages,
    destinationWorkspace.id,
    page.slug,
    page.id,
  );
  const destinationExplicitReadLevel =
    destinationWorkspace.type === "private"
      ? null
      : destinationParentPage
        ? undefined
        : input.destinationExplicitReadLevel ?? page.explicitReadLevel ?? actingUser.permissionLevel;
  const destinationExplicitWriteLevel =
    destinationWorkspace.type === "private"
      ? null
      : destinationParentPage
        ? undefined
        : input.destinationExplicitWriteLevel ?? page.explicitWriteLevel ?? actingUser.permissionLevel;
  const updates = computeSubtreeMoveUpdates({
    actingUser,
    pageRows: allPages,
    rootPage: page,
    destinationParentPage,
    destinationWorkspace,
    sortOrder: movePlan.rootSortOrder,
    nextRootSlug,
    weakeningStrategy: input.weakeningStrategy,
    destinationExplicitReadLevel,
    destinationExplicitWriteLevel,
  });

  if (
    updates.some(
      (candidate) =>
        candidate.effectiveWriteLevel !== null &&
        actingUser.permissionLevel < candidate.effectiveWriteLevel,
    )
  ) {
    throw new Error("You cannot move a page above your write permission level.");
  }
  const normalizedUpdates = updates.map((candidate) =>
    candidate.id === page.id
      ? candidate
      : movePlan.siblingSortOrders.has(candidate.id)
        ? { ...candidate, sortOrder: movePlan.siblingSortOrders.get(candidate.id) ?? candidate.sortOrder }
        : candidate,
  );
  const siblingUpdates = snapshot.pages
    .filter((candidate) => candidate.id !== page.id && movePlan.siblingSortOrders.has(candidate.id))
    .map((candidate) => ({
      ...candidate,
      sortOrder: movePlan.siblingSortOrders.get(candidate.id) ?? candidate.sortOrder,
      updatedAt: new Date(),
    }));
  const mergedUpdates = new Map(
    [...normalizedUpdates, ...siblingUpdates].map((candidate) => [candidate.id, candidate]),
  );
  const updatedPage = mergedUpdates.get(page.id);

  fallbackStore = {
    ...snapshot,
    activityEvents:
      updatedPage &&
      destinationWorkspace.type === "shared" &&
      (page.workspaceId !== destinationWorkspace.id ||
        page.parentPageId !== (destinationParentPage?.id ?? null))
        ? [
            createActivityEvent({
              actorUserId: actingUser.id,
              effectiveReadLevel: updatedPage.effectiveReadLevel,
              effectiveWriteLevel: updatedPage.effectiveWriteLevel,
              eventType: "page_moved",
              pageId: updatedPage.id,
              pageTitle: updatedPage.title,
              parentPageId: destinationParentPage?.id ?? null,
              parentPageTitle: destinationParentPage?.title ?? null,
              workspaceId: destinationWorkspace.id,
            }),
            ...snapshot.activityEvents,
          ]
        : snapshot.activityEvents,
    pages: snapshot.pages.map(
      (pageRow) => mergedUpdates.get(pageRow.id) ?? pageRow,
    ),
  };

  if (!updatedPage) {
    throw new Error("Failed to move page.");
  }

  return {
    page: updatedPage,
  };
}

async function moveDatabasePage(input: MovePageInput): Promise<MovePageResult> {
  if (!db) {
    throw new Error("DATABASE_URL is required for database writes.");
  }

  return db.transaction(async (tx) => {
    const [actingUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.actingUserId))
      .limit(1);

    if (!actingUser) {
      throw new Error("Acting user not found.");
    }

    const [page] = await tx.select().from(pages).where(eq(pages.id, input.pageId)).limit(1);

    if (!page) {
      throw new Error("Page not found.");
    }

    const [workspace] = await tx
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, page.workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error("Workspace not found.");
    }

    if (!canWritePage(actingUser, workspace, page)) {
      throw new Error("You do not have permission to move this page.");
    }

    const destinationWorkspace = input.destinationParentPageId
      ? null
      : (
          await tx
            .select()
            .from(workspaces)
            .where(eq(workspaces.id, input.destinationWorkspaceId ?? page.workspaceId))
            .limit(1)
        )[0] ?? null;
    const pageRows = await tx.select().from(pages);
    const destinationParentPage = input.destinationParentPageId
      ? pageRows.find((candidate) => candidate.id === input.destinationParentPageId) ?? null
      : null;
    const resolvedDestinationWorkspace =
      destinationParentPage
        ? (
            await tx
              .select()
              .from(workspaces)
              .where(eq(workspaces.id, destinationParentPage.workspaceId))
              .limit(1)
          )[0] ?? null
        : destinationWorkspace;

    if (input.destinationParentPageId && !destinationParentPage) {
      throw new Error("Destination parent page not found.");
    }

    if (!resolvedDestinationWorkspace) {
      throw new Error("Destination workspace not found.");
    }

    if (destinationParentPage && isDescendantPath(destinationParentPage.path, page.path)) {
      throw new Error("A page cannot be moved inside its own subtree.");
    }

    if (
      resolvedDestinationWorkspace.type === "private" &&
      resolvedDestinationWorkspace.ownerUserId !== actingUser.id
    ) {
      throw new Error("You do not have permission to move pages into that workspace.");
    }

    if (
      destinationParentPage &&
      !canWritePage(actingUser, resolvedDestinationWorkspace, destinationParentPage)
    ) {
      throw new Error("You do not have permission to move pages under that parent.");
    }

    const sameParent =
      page.workspaceId === resolvedDestinationWorkspace.id &&
      page.parentPageId === (destinationParentPage?.id ?? null);
    const sourceSiblings = sortSiblingPages(
      getChildrenForParent(pageRows, page.workspaceId, page.parentPageId).filter(
        (candidate) => candidate.id !== page.id,
      ),
    );
    const destinationSiblings = sortSiblingPages(
      getChildrenForParent(
        pageRows,
        resolvedDestinationWorkspace.id,
        destinationParentPage?.id ?? null,
      ).filter((candidate) => candidate.id !== page.id),
    );
    const destinationIndex = getNormalizedDestinationIndex(
      destinationSiblings,
      input.destinationIndex,
    );
    const movePlan = getReindexedSiblingUpdates({
      rootPage: page,
      destinationParentPage,
      destinationSiblings,
      destinationIndex,
      sourceSiblings,
      sameParent,
    });
    const nextRootSlug = ensureWorkspaceSlug(
      pageRows,
      resolvedDestinationWorkspace.id,
      page.slug,
      page.id,
    );
    const destinationExplicitReadLevel =
      resolvedDestinationWorkspace.type === "private"
        ? null
        : destinationParentPage
          ? undefined
          : input.destinationExplicitReadLevel ?? page.explicitReadLevel ?? actingUser.permissionLevel;
    const destinationExplicitWriteLevel =
      resolvedDestinationWorkspace.type === "private"
        ? null
        : destinationParentPage
          ? undefined
          : input.destinationExplicitWriteLevel ?? page.explicitWriteLevel ?? actingUser.permissionLevel;
    const updates = computeSubtreeMoveUpdates({
      actingUser,
      pageRows,
      rootPage: page,
      destinationParentPage,
      destinationWorkspace: resolvedDestinationWorkspace,
      sortOrder: movePlan.rootSortOrder,
      nextRootSlug,
      weakeningStrategy: input.weakeningStrategy,
      destinationExplicitReadLevel,
      destinationExplicitWriteLevel,
    });

    if (
      updates.some(
        (candidate) =>
          candidate.effectiveWriteLevel !== null &&
          actingUser.permissionLevel < candidate.effectiveWriteLevel,
      )
    ) {
      throw new Error("You cannot move a page above your write permission level.");
    }
    const normalizedUpdates = updates.map((candidate) =>
      candidate.id === page.id
        ? candidate
        : movePlan.siblingSortOrders.has(candidate.id)
          ? { ...candidate, sortOrder: movePlan.siblingSortOrders.get(candidate.id) ?? candidate.sortOrder }
          : candidate,
    );
    const siblingUpdates = pageRows
      .filter((candidate) => candidate.id !== page.id && movePlan.siblingSortOrders.has(candidate.id))
      .map((candidate) => ({
        ...candidate,
        sortOrder: movePlan.siblingSortOrders.get(candidate.id) ?? candidate.sortOrder,
        updatedAt: new Date(),
      }));
    const mergedUpdates = new Map(
      [...normalizedUpdates, ...siblingUpdates].map((candidate) => [candidate.id, candidate]),
    );

    for (const update of mergedUpdates.values()) {
      await tx
        .update(pages)
        .set({
          workspaceId: update.workspaceId,
          parentPageId: update.parentPageId,
          path: update.path,
          depth: update.depth,
          slug: update.slug,
          sortOrder: update.sortOrder,
          explicitReadLevel: update.explicitReadLevel,
          explicitWriteLevel: update.explicitWriteLevel,
          effectiveReadLevel: update.effectiveReadLevel,
          effectiveWriteLevel: update.effectiveWriteLevel,
          updatedByUserId: actingUser.id,
          updatedAt: new Date(),
        })
        .where(eq(pages.id, update.id));
    }

    const updatedRoot = mergedUpdates.get(page.id);

    if (!updatedRoot) {
      throw new Error("Failed to move page.");
    }

    if (
      resolvedDestinationWorkspace.type === "shared" &&
      (page.workspaceId !== resolvedDestinationWorkspace.id ||
        page.parentPageId !== (destinationParentPage?.id ?? null))
    ) {
      await tx.insert(pageActivityEvents).values({
        workspaceId: resolvedDestinationWorkspace.id,
        pageId: updatedRoot.id,
        actorUserId: actingUser.id,
        eventType: "page_moved",
        pageTitle: updatedRoot.title,
        parentPageId: destinationParentPage?.id ?? null,
        parentPageTitle: destinationParentPage?.title ?? null,
        effectiveReadLevel: updatedRoot.effectiveReadLevel,
        effectiveWriteLevel: updatedRoot.effectiveWriteLevel,
      });
    }

    return {
      page: updatedRoot,
    };
  });
}

export async function movePage(input: MovePageInput): Promise<MovePageResult> {
  if (!db) {
    return moveFallbackPage(input);
  }

  return moveDatabasePage(input);
}

function deleteFallbackPage(input: DeletePageInput): DeletePageResult {
  const snapshot = fallbackStore;
  const { actingUser, page, workspace } = getPageContext(snapshot, input);
  const deleteMode = input.mode ?? "delete-subtree";

  if (!canWritePage(actingUser, workspace, page)) {
    throw new Error("You do not have permission to delete this page.");
  }

  if (deleteMode === "keep-descendants") {
    const directChildren = sortSiblingPages(
      getChildrenForParent(snapshot.pages, workspace.id, page.id),
    );
    let nextPages = [...snapshot.pages];
    let destinationIndex = page.sortOrder;

    for (const child of directChildren) {
      const updates = computeSubtreeMoveUpdates({
        actingUser,
        pageRows: nextPages,
        rootPage: child,
        destinationParentPage: page.parentPageId
          ? nextPages.find((candidate) => candidate.id === page.parentPageId) ?? null
          : null,
        destinationWorkspace: workspace,
        sortOrder: destinationIndex,
        nextRootSlug: child.slug,
        weakeningStrategy: "preserve",
      });
      const updatesById = new Map(updates.map((updatedPage) => [updatedPage.id, updatedPage]));
      nextPages = nextPages.map((pageRow) => updatesById.get(pageRow.id) ?? pageRow);
      destinationIndex += 1;
    }

    const redirectPageId =
      directChildren[0]?.id ?? getRedirectPageAfterDelete({ ...snapshot, pages: nextPages }, page);

    fallbackStore = {
      ...snapshot,
      activityEvents:
        workspace.type === "shared"
          ? [
              createActivityEvent({
                actorUserId: actingUser.id,
                effectiveReadLevel: page.effectiveReadLevel,
                effectiveWriteLevel: page.effectiveWriteLevel,
                eventType: "page_deleted",
                pageId: null,
                pageTitle: page.title,
                workspaceId: workspace.id,
              }),
              ...snapshot.activityEvents,
            ]
          : snapshot.activityEvents,
      pages: nextPages.filter((pageRow) => pageRow.id !== page.id),
      revisions: snapshot.revisions.filter((revision) => revision.pageId !== page.id),
      editSessions: snapshot.editSessions.filter((session) => session.pageId !== page.id),
    };

    return {
      deletedPageId: page.id,
      redirectPageId,
    };
  }

  const subtreeIds = new Set(
    getSubtreePages(snapshot.pages, page).map((subtreePage) => subtreePage.id),
  );
  const redirectPageId = getRedirectPageAfterDelete(snapshot, page);

  fallbackStore = {
    ...snapshot,
    activityEvents:
      workspace.type === "shared"
        ? [
            createActivityEvent({
              actorUserId: actingUser.id,
              effectiveReadLevel: page.effectiveReadLevel,
              effectiveWriteLevel: page.effectiveWriteLevel,
              eventType: "page_deleted",
              pageId: null,
              pageTitle: page.title,
              workspaceId: workspace.id,
            }),
            ...snapshot.activityEvents,
          ]
        : snapshot.activityEvents,
    pages: snapshot.pages.filter((pageRow) => !subtreeIds.has(pageRow.id)),
    revisions: snapshot.revisions.filter((revision) => !subtreeIds.has(revision.pageId)),
  };

  return {
    deletedPageId: page.id,
    redirectPageId,
  };
}

async function deleteDatabasePage(input: DeletePageInput): Promise<DeletePageResult> {
  if (!db) {
    throw new Error("DATABASE_URL is required for database writes.");
  }

  return db.transaction(async (tx) => {
    const [actingUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.actingUserId))
      .limit(1);

    if (!actingUser) {
      throw new Error("Acting user not found.");
    }

    const [page] = await tx.select().from(pages).where(eq(pages.id, input.pageId)).limit(1);

    if (!page) {
      throw new Error("Page not found.");
    }

    const [workspace] = await tx
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, page.workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error("Workspace not found.");
    }

    if (!canWritePage(actingUser, workspace, page)) {
      throw new Error("You do not have permission to delete this page.");
    }

    const deleteMode = input.mode ?? "delete-subtree";
    const workspacePages = await tx
      .select()
      .from(pages)
      .where(eq(pages.workspaceId, workspace.id));

    if (deleteMode === "keep-descendants") {
      const directChildren = sortSiblingPages(
        getChildrenForParent(workspacePages, workspace.id, page.id),
      );
      let nextPages = [...workspacePages];
      let destinationIndex = page.sortOrder;

      for (const child of directChildren) {
        const updates = computeSubtreeMoveUpdates({
          actingUser,
          pageRows: nextPages,
          rootPage: child,
          destinationParentPage: page.parentPageId
            ? nextPages.find((candidate) => candidate.id === page.parentPageId) ?? null
            : null,
          destinationWorkspace: workspace,
          sortOrder: destinationIndex,
          nextRootSlug: child.slug,
          weakeningStrategy: "preserve",
        });
        const updatesById = new Map(updates.map((updatedPage) => [updatedPage.id, updatedPage]));
        nextPages = nextPages.map((pageRow) => updatesById.get(pageRow.id) ?? pageRow);

        for (const update of updates) {
          await tx
            .update(pages)
            .set({
              parentPageId: update.parentPageId,
              path: update.path,
              depth: update.depth,
              sortOrder: update.sortOrder,
              explicitReadLevel: update.explicitReadLevel,
              explicitWriteLevel: update.explicitWriteLevel,
              effectiveReadLevel: update.effectiveReadLevel,
              effectiveWriteLevel: update.effectiveWriteLevel,
              updatedByUserId: actingUser.id,
              updatedAt: update.updatedAt,
            })
            .where(eq(pages.id, update.id));
        }

        destinationIndex += 1;
      }

      const redirectPageId =
        directChildren[0]?.id ?? getRedirectPageAfterDelete(
          {
            activityEvents: [],
            users: [],
            workspaces: [workspace],
            pages: nextPages,
            revisions: [],
            editSessions: [],
          },
          page,
        );

      await tx.delete(pages).where(eq(pages.id, page.id));

      if (workspace.type === "shared") {
        await tx.insert(pageActivityEvents).values({
          workspaceId: workspace.id,
          pageId: null,
          actorUserId: actingUser.id,
          eventType: "page_deleted",
          pageTitle: page.title,
          effectiveReadLevel: page.effectiveReadLevel,
          effectiveWriteLevel: page.effectiveWriteLevel,
        });
      }

      return {
        deletedPageId: page.id,
        redirectPageId,
      };
    }

    const redirectPageId = getRedirectPageAfterDelete(
      {
        activityEvents: [],
        users: [],
        workspaces: [workspace],
        pages: workspacePages,
        revisions: [],
        editSessions: [],
      },
      page,
    );

    await tx.delete(pages).where(eq(pages.id, page.id));

    if (workspace.type === "shared") {
      await tx.insert(pageActivityEvents).values({
        workspaceId: workspace.id,
        pageId: null,
        actorUserId: actingUser.id,
        eventType: "page_deleted",
        pageTitle: page.title,
        effectiveReadLevel: page.effectiveReadLevel,
        effectiveWriteLevel: page.effectiveWriteLevel,
      });
    }

    return {
      deletedPageId: page.id,
      redirectPageId,
    };
  });
}

export async function deletePage(input: DeletePageInput): Promise<DeletePageResult> {
  if (!db) {
    return deleteFallbackPage(input);
  }

  return deleteDatabasePage(input);
}
