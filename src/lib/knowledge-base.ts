import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, max } from "drizzle-orm";

import { db } from "@/db/client";
import { seededPages, seededRevisions, seededUsers, seededWorkspaces } from "@/db/seed-data";
import {
  pageEditSessions,
  pageRevisions,
  pages,
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
};

export type KnowledgeBaseView = {
  availableUsers: User[];
  currentUser: User | null;
  selectedPageId: string | null;
  selectedPage: (Page & { canWrite: boolean }) | null;
  selectedRevision: PageRevision | null;
  selectedDraft: {
    title: string;
    contentMarkdown: string;
    editorDocJson: unknown;
  } | null;
  selectedPageRevisions: RevisionSummary[];
  visibleWorkspaces: Array<{
    workspace: Workspace;
    pages: VisiblePageNode[];
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
};

export type DeletePageInput = {
  actingUserId: string;
  pageId: string;
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

async function getSnapshot(): Promise<KnowledgeBaseSnapshot> {
  if (!db) {
    return fallbackStore;
  }

  try {
    const [userRows, workspaceRows, pageRows, revisionRows, editSessionRows] = await Promise.all([
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
    ]);

    return {
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

function toRevisionSummary(revision: PageRevision): RevisionSummary {
  return {
    id: revision.id,
    revisionNumber: revision.revisionNumber,
    titleSnapshot: revision.titleSnapshot,
    createdAt: revision.createdAt,
    createdByUserId: revision.createdByUserId,
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

  for (const page of subtree) {
    const nextParentPage = page.parentPageId
      ? updates.get(page.parentPageId) ??
        params.pageRows.find((candidate) => candidate.id === page.parentPageId) ??
        null
      : null;
    const permissions = resolvePermissions({
      workspace: params.workspace,
      parentPage: nextParentPage,
      explicitReadLevel:
        page.id === params.rootPage.id ? params.explicitReadLevel : page.explicitReadLevel,
      explicitWriteLevel:
        page.id === params.rootPage.id ? params.explicitWriteLevel : page.explicitWriteLevel,
    });

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
    .filter((page) => isDescendantPath(page.path, rootPage.path))
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
  pageRows: Page[];
  rootPage: Page;
  destinationParentPage: Page | null;
  workspace: Workspace;
  sortOrder: number;
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

  const destinationPath = buildPagePath(params.destinationParentPage, params.rootPage.slug);
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
    const permissions = resolvePermissions({
      workspace: params.workspace,
      parentPage: nextParentPage,
      explicitReadLevel: page.explicitReadLevel,
      explicitWriteLevel: page.explicitWriteLevel,
    });
    const updatedPage: Page = {
      ...page,
      parentPageId: nextParentId,
      path: nextPath,
      depth: nextDepth,
      sortOrder: page.id === params.rootPage.id ? params.sortOrder : page.sortOrder,
      explicitReadLevel: permissions.explicitReadLevel,
      explicitWriteLevel: permissions.explicitWriteLevel,
      effectiveReadLevel: permissions.effectiveReadLevel,
      effectiveWriteLevel: permissions.effectiveWriteLevel,
      updatedAt: new Date(),
    };

    if (params.workspace.type === "shared") {
      const readWeakened =
        page.effectiveReadLevel !== null &&
        updatedPage.effectiveReadLevel !== null &&
        updatedPage.effectiveReadLevel < page.effectiveReadLevel;
      const writeWeakened =
        page.effectiveWriteLevel !== null &&
        updatedPage.effectiveWriteLevel !== null &&
        updatedPage.effectiveWriteLevel < page.effectiveWriteLevel;

      if (readWeakened || writeWeakened) {
        throw new Error("Move would weaken inherited shared-page restrictions.");
      }
    }

    updates.set(page.id, updatedPage);
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
      selectedPageId: null,
      selectedPage: null,
      selectedRevision: null,
      selectedDraft: null,
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
  const selectedRevision = selectedPage
    ? getRevisionForPageFromSnapshot(snapshot, selectedPage.id, selectedPage.currentRevisionId)
    : null;
  const selectedDraft =
    selectedPage && currentUser
      ? getLatestEditSessionForPageFromSnapshot(snapshot, selectedPage.id, currentUser.id)
      : null;
  const selectedPageRevisions = selectedPage
    ? getPageRevisionsFromSnapshot(snapshot, selectedPage.id).map(toRevisionSummary)
    : [];

  return {
    availableUsers: snapshot.users,
    currentUser,
    selectedPageId: selectedPage?.id ?? null,
    selectedPage,
    selectedRevision,
    selectedDraft: selectedDraft
      ? {
          title: selectedDraft.draftTitle,
          contentMarkdown: selectedDraft.draftContentMarkdown,
          editorDocJson: selectedDraft.draftEditorDocJson,
        }
      : null,
    selectedPageRevisions,
    visibleWorkspaces,
  };
}

export async function getPageRevisions(input: { actingUserId: string; pageId: string }) {
  const snapshot = await getSnapshot();
  const { actingUser, page, workspace } = getPageContext(snapshot, input);

  if (!canReadPage(actingUser, workspace, page)) {
    throw new Error("You do not have permission to read this page.");
  }

  return getPageRevisionsFromSnapshot(snapshot, page.id).map(toRevisionSummary);
}

function updateFallbackPage(input: SavePageInput): SavePageResult {
  const snapshot = fallbackStore;
  const { actingUser, page } = assertPageWriteAccess(snapshot, input);
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

  fallbackStore = {
    ...snapshot,
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

  const permissions = resolvePermissions({
    workspace,
    parentPage,
    explicitReadLevel: input.explicitReadLevel,
    explicitWriteLevel: input.explicitWriteLevel,
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

  fallbackStore = {
    ...snapshot,
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
    const permissions = resolvePermissions({
      workspace,
      parentPage,
      explicitReadLevel: input.explicitReadLevel,
      explicitWriteLevel: input.explicitWriteLevel,
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

  if (input.destinationParentPageId && !destinationParentPage) {
    throw new Error("Destination parent page not found.");
  }

  if (destinationParentPage && destinationParentPage.workspaceId !== workspace.id) {
    throw new Error("Pages can only be moved within the same workspace.");
  }

  if (destinationParentPage && !canWritePage(actingUser, workspace, destinationParentPage)) {
    throw new Error("You do not have permission to move pages under that parent.");
  }

  if (destinationParentPage && isDescendantPath(destinationParentPage.path, page.path)) {
    throw new Error("A page cannot be moved inside its own subtree.");
  }

  const sameParent = page.parentPageId === (destinationParentPage?.id ?? null);
  const sourceSiblings = sortSiblingPages(
    getChildrenForParent(snapshot.pages, workspace.id, page.parentPageId).filter(
      (candidate) => candidate.id !== page.id,
    ),
  );
  const destinationSiblings = sortSiblingPages(
    getChildrenForParent(snapshot.pages, workspace.id, destinationParentPage?.id ?? null).filter(
      (candidate) => candidate.id !== page.id,
    ),
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
  const updates = computeSubtreeMoveUpdates({
    pageRows: snapshot.pages,
    rootPage: page,
    destinationParentPage,
    workspace,
    sortOrder: movePlan.rootSortOrder,
  });
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

    const workspacePages = await tx
      .select()
      .from(pages)
      .where(eq(pages.workspaceId, workspace.id));
    const destinationParentPage = input.destinationParentPageId
      ? workspacePages.find((candidate) => candidate.id === input.destinationParentPageId) ?? null
      : null;

    if (input.destinationParentPageId && !destinationParentPage) {
      throw new Error("Destination parent page not found.");
    }

    if (destinationParentPage && isDescendantPath(destinationParentPage.path, page.path)) {
      throw new Error("A page cannot be moved inside its own subtree.");
    }

    if (destinationParentPage && !canWritePage(actingUser, workspace, destinationParentPage)) {
      throw new Error("You do not have permission to move pages under that parent.");
    }

    const sameParent = page.parentPageId === (destinationParentPage?.id ?? null);
    const sourceSiblings = sortSiblingPages(
      getChildrenForParent(workspacePages, workspace.id, page.parentPageId).filter(
        (candidate) => candidate.id !== page.id,
      ),
    );
    const destinationSiblings = sortSiblingPages(
      getChildrenForParent(workspacePages, workspace.id, destinationParentPage?.id ?? null).filter(
        (candidate) => candidate.id !== page.id,
      ),
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
    const updates = computeSubtreeMoveUpdates({
      pageRows: workspacePages,
      rootPage: page,
      destinationParentPage,
      workspace,
      sortOrder: movePlan.rootSortOrder,
    });
    const normalizedUpdates = updates.map((candidate) =>
      candidate.id === page.id
        ? candidate
        : movePlan.siblingSortOrders.has(candidate.id)
          ? { ...candidate, sortOrder: movePlan.siblingSortOrders.get(candidate.id) ?? candidate.sortOrder }
          : candidate,
    );
    const siblingUpdates = workspacePages
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
          parentPageId: update.parentPageId,
          path: update.path,
          depth: update.depth,
          sortOrder: update.sortOrder,
          explicitReadLevel: update.explicitReadLevel,
          explicitWriteLevel: update.explicitWriteLevel,
          effectiveReadLevel: update.effectiveReadLevel,
          effectiveWriteLevel: update.effectiveWriteLevel,
          updatedAt: new Date(),
        })
        .where(eq(pages.id, update.id));
    }

    const updatedRoot = mergedUpdates.get(page.id);

    if (!updatedRoot) {
      throw new Error("Failed to move page.");
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

  if (!canWritePage(actingUser, workspace, page)) {
    throw new Error("You do not have permission to delete this page.");
  }

  const subtreeIds = new Set(
    getSubtreePages(snapshot.pages, page).map((subtreePage) => subtreePage.id),
  );
  const redirectPageId = getRedirectPageAfterDelete(snapshot, page);

  fallbackStore = {
    ...snapshot,
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

    const workspacePages = await tx
      .select()
      .from(pages)
      .where(eq(pages.workspaceId, workspace.id));
    const redirectPageId = getRedirectPageAfterDelete(
      {
        users: [],
        workspaces: [workspace],
        pages: workspacePages,
        revisions: [],
        editSessions: [],
      },
      page,
    );

    await tx.delete(pages).where(eq(pages.id, page.id));

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
