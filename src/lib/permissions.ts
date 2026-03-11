import type { Page, User, Workspace } from "@/db/schema";
import type { VisiblePageNode } from "@/lib/knowledge-base";

export function canReadWorkspace(user: User, workspace: Workspace) {
  if (workspace.type === "private") {
    return workspace.ownerUserId === user.id;
  }

  // Memberships are intentionally not enforced for shared workspaces in the MVP.
  return true;
}

export function canReadPage(user: User, workspace: Workspace, page: Page) {
  if (!canReadWorkspace(user, workspace)) {
    return false;
  }

  if (workspace.type === "private") {
    return workspace.ownerUserId === user.id;
  }

  return page.effectiveReadLevel !== null && user.permissionLevel >= page.effectiveReadLevel;
}

export function canWritePage(user: User, workspace: Workspace, page: Page) {
  if (!canReadPage(user, workspace, page)) {
    return false;
  }

  if (workspace.type === "private") {
    return workspace.ownerUserId === user.id;
  }

  return page.effectiveWriteLevel !== null && user.permissionLevel >= page.effectiveWriteLevel;
}

export function filterVisiblePages(
  user: User,
  workspace: Workspace,
  pageRows: Page[],
  currentRevisionByPageId: Map<string, string>,
): VisiblePageNode[] {
  const workspacePages = pageRows
    .filter((page) => page.workspaceId === workspace.id)
    .sort((a, b) => a.depth - b.depth || a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());

  const visibleIds = new Set<string>();

  for (const page of workspacePages) {
    if (page.parentPageId && !visibleIds.has(page.parentPageId)) {
      continue;
    }

    if (!canReadPage(user, workspace, page)) {
      continue;
    }

    visibleIds.add(page.id);
  }

  const nodeMap = new Map<string, VisiblePageNode>();

  for (const page of workspacePages) {
    if (!visibleIds.has(page.id)) {
      continue;
    }

    nodeMap.set(page.id, {
      ...page,
      children: [],
      canWrite: canWritePage(user, workspace, page),
      currentContentMarkdown: currentRevisionByPageId.get(page.id) ?? null,
    });
  }

  const roots: VisiblePageNode[] = [];

  for (const page of workspacePages) {
    const node = nodeMap.get(page.id);

    if (!node) {
      continue;
    }

    if (!page.parentPageId) {
      roots.push(node);
      continue;
    }

    const parent = nodeMap.get(page.parentPageId);

    if (parent) {
      parent.children.push(node);
    }
  }

  for (const node of nodeMap.values()) {
    node.children.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  return roots.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime(),
  );
}
