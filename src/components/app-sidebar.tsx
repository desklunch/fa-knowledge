"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDrag, useDrop } from "react-dnd";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  File,
  FilePlus2,
  FolderTree,
  History,
  MoreVertical,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";

import {
  CommandPalette,
  type CommandPalettePageItem,
} from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DialogActions, SimpleDialog } from "@/components/ui/simple-dialog";
import type { VisiblePageNode } from "@/lib/knowledge-base";
import { cn } from "@/lib/utils";

type WorkspaceTree = {
  workspace: {
    id: string;
    name: string;
    type: "private" | "shared";
    ownerUserId: string | null;
  };
  pages: VisiblePageNode[];
};

type AppSidebarProps = {
  currentUser: {
    id: string;
    name: string;
    permissionLevel: number;
    userType: string;
  };
  searchItems: CommandPalettePageItem[];
  selectedPageId: string | null;
  collapsed?: boolean;
  visibleWorkspaces: WorkspaceTree[];
};

type DragItem = {
  id: string;
  workspaceId: string;
};

type DropPosition = "before" | "after" | "inside";

type MoveTarget = {
  destinationParentPageId: string | null;
  destinationIndex: number;
  destinationWorkspaceId?: string | null;
  weakeningStrategy?: "inherit" | "preserve";
  destinationExplicitReadLevel?: number | null;
  destinationExplicitWriteLevel?: number | null;
};

const DRAG_TYPE = "sidebar-page";
const STORAGE_KEY = "fa-knowledge-sidebar-expanded";

export function AppSidebar({
  collapsed = false,
  currentUser,
  searchItems,
  selectedPageId,
  visibleWorkspaces,
}: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [workspaceTrees, setWorkspaceTrees] = useState(visibleWorkspaces);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [pendingDeleteNode, setPendingDeleteNode] = useState<VisiblePageNode | null>(null);
  const [pendingDeleteMode, setPendingDeleteMode] = useState<
    "delete-subtree" | "keep-descendants"
  >("delete-subtree");
  const [pendingMoveResolution, setPendingMoveResolution] = useState<{
    pageId: string;
    pageTitle: string;
    target: MoveTarget;
    workspaceId: string;
  } | null>(null);
  const [pendingCrossWorkspaceMove, setPendingCrossWorkspaceMove] = useState<{
    destinationWorkspaceId: string;
    destinationWorkspaceType: "private" | "shared";
    node: VisiblePageNode;
  } | null>(null);
  const [, setStatus] = useState<{ kind: "error" | "success"; message: string } | null>(
    null,
  );
  const [isFloatingOpen, setIsFloatingOpen] = useState(false);

  useEffect(() => {
    setWorkspaceTrees(visibleWorkspaces);
  }, [visibleWorkspaces]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      setExpandedKeys(getDefaultExpandedKeys(visibleWorkspaces, selectedPageId));
      return;
    }

    try {
      const parsedValue = JSON.parse(rawValue) as Record<string, boolean>;
      setExpandedKeys({
        ...getDefaultExpandedKeys(visibleWorkspaces, selectedPageId),
        ...parsedValue,
      });
    } catch {
      setExpandedKeys(getDefaultExpandedKeys(visibleWorkspaces, selectedPageId));
    }
  }, [selectedPageId, visibleWorkspaces]);

  useEffect(() => {
    if (typeof window === "undefined" || Object.keys(expandedKeys).length === 0) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedKeys));
  }, [expandedKeys]);

  const pageHref = (pageId: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("page", pageId);
    nextParams.delete("status");
    nextParams.delete("message");

    return `/?${nextParams.toString()}`;
  };

  const refreshData = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const navigateToHref = (href: string) => {
    router.push(href);
    if (collapsed) {
      setIsFloatingOpen(false);
    }
  };

  const personalWorkspace = visibleWorkspaces.find(
    ({ workspace }) =>
      workspace.type === "private" && workspace.ownerUserId === currentUser.id,
  )?.workspace;
  const sharedWorkspace = visibleWorkspaces.find(
    ({ workspace }) => workspace.type === "shared",
  )?.workspace;

  const setExpanded = (key: string, value: boolean) => {
    setExpandedKeys((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const setExpandedForAncestors = (workspaceId: string, pageId: string) => {
    const workspace = workspaceTrees.find((candidate) => candidate.workspace.id === workspaceId);

    if (!workspace) {
      return;
    }

    const ancestorIds = getAncestorIds(workspace.pages, pageId) ?? [];

    if (ancestorIds.length === 0) {
      return;
    }

    setExpandedKeys((current) => {
      const nextState = { ...current };

      for (const ancestorId of ancestorIds) {
        nextState[getPageExpansionKey(ancestorId)] = true;
      }

      nextState[getWorkspaceExpansionKey(workspaceId)] = true;

      return nextState;
    });
  };

  const handleCreatePage = async ({
    parentPageId,
    title,
    workspaceId,
    workspaceType,
  }: {
    parentPageId: string | null;
    title: string;
    workspaceId: string;
    workspaceType: "private" | "shared";
  }) => {
    const response = await fetch("/api/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceId,
        parentPageId,
        title,
        contentMarkdown: `# ${title}\n\nNew page.`,
        explicitReadLevel: workspaceType === "shared" && parentPageId === null ? currentUser.permissionLevel : null,
        explicitWriteLevel: workspaceType === "shared" && parentPageId === null ? currentUser.permissionLevel : null,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Failed to create page.");
    }

    const payload = (await response.json()) as { page: VisiblePageNode };
    setStatus({
      kind: "success",
      message: "Page created.",
    });
    router.push(pageHref(payload.page.id));
    refreshData();
  };

  const handleRenamePage = async (node: VisiblePageNode, nextTitle: string) => {
    if (!nextTitle || nextTitle === node.title) {
      return;
    }

    const response = await fetch(`/api/pages/${node.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: nextTitle,
        contentMarkdown: node.currentContentMarkdown ?? `# ${nextTitle}\n\n`,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Failed to rename page.");
    }

    setStatus({
      kind: "success",
      message: "Page renamed.",
    });
    refreshData();
  };

  const handleDeletePage = async (node: VisiblePageNode) => {
    setPendingDeleteNode(node);
    setPendingDeleteMode("delete-subtree");
  };

  const confirmDeletePage = async () => {
    if (!pendingDeleteNode) {
      return;
    }

    const response = await fetch(`/api/pages/${pendingDeleteNode.id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: pendingDeleteMode,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Failed to delete page.");
    }

    const payload = (await response.json()) as { redirectPageId: string | null };

    if (selectedPageId === pendingDeleteNode.id) {
      router.push(payload.redirectPageId ? pageHref(payload.redirectPageId) : pathname);
    }

    setPendingDeleteNode(null);
    setStatus({
      kind: "success",
      message: "Page deleted.",
    });
    refreshData();
  };

  const handleDuplicatePage = async (node: VisiblePageNode) => {
    const response = await fetch("/api/pages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceId: node.workspaceId,
        parentPageId: node.parentPageId,
        title: `${node.title} Copy`,
        contentMarkdown: node.currentContentMarkdown ?? `# ${node.title} Copy\n\n`,
        explicitReadLevel: node.explicitReadLevel,
        explicitWriteLevel: node.explicitWriteLevel,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Failed to duplicate page.");
    }

    const payload = (await response.json()) as { page: VisiblePageNode };
    router.push(pageHref(payload.page.id));
    setStatus({
      kind: "success",
      message: "Page duplicated.",
    });
    refreshData();
  };

  const handleCopyLink = async (pageId: string) => {
    const url = new URL(pageHref(pageId), window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setStatus({
      kind: "success",
      message: "Page link copied.",
    });
  };

  const handleMoveToRoot = async (node: VisiblePageNode) => {
    const workspace = workspaceTrees.find(
      (candidate) => candidate.workspace.id === node.workspaceId,
    );

    if (!workspace) {
      return;
    }

    const destinationIndex = workspace.pages.filter((candidate) => candidate.id !== node.id).length;
    await handleMovePage(node.workspaceId, node.id, {
      destinationParentPageId: null,
      destinationIndex,
    });
  };

  const handleMovePage = async (
    workspaceId: string,
    pageId: string,
    target: MoveTarget,
  ) => {
    console.debug("[sidebar] movePage request", {
      pageId,
      sourceWorkspaceId: workspaceId,
      target,
    });
    const response = await fetch(`/api/pages/${pageId}/move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(target),
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      if (payload.error?.includes("permission resolution")) {
        const pageTitle =
          workspaceTrees
            .flatMap((workspace) => flattenVisibleNodes(workspace.pages))
            .find((page) => page.id === pageId)?.title ?? "Page";

        setPendingMoveResolution({
          pageId,
          pageTitle,
          target,
          workspaceId,
        });
        return;
      }

      throw new Error(payload.error ?? "Failed to move page.");
    }

    setPendingMoveResolution(null);

    if (target.destinationParentPageId) {
      setExpanded(getPageExpansionKey(target.destinationParentPageId), true);
      setExpandedForAncestors(
        target.destinationWorkspaceId ?? workspaceId,
        target.destinationParentPageId,
      );
    }

    setStatus({
      kind: "success",
      message: "Page moved.",
    });
    refreshData();
  };

  const confirmCrossWorkspaceMove = async () => {
    if (!pendingCrossWorkspaceMove) {
      return;
    }

    await handleMovePage(pendingCrossWorkspaceMove.node.workspaceId, pendingCrossWorkspaceMove.node.id, {
      destinationParentPageId: null,
      destinationIndex: 0,
      destinationWorkspaceId: pendingCrossWorkspaceMove.destinationWorkspaceId,
      destinationExplicitReadLevel:
        pendingCrossWorkspaceMove.destinationWorkspaceType === "shared"
          ? currentUser.permissionLevel
          : null,
      destinationExplicitWriteLevel:
        pendingCrossWorkspaceMove.destinationWorkspaceType === "shared"
          ? currentUser.permissionLevel
          : null,
    });
    setPendingCrossWorkspaceMove(null);
  };

  return (
    <div
      className="relative h-full"
      onMouseEnter={() => {
        if (collapsed) {
          setIsFloatingOpen(true);
        }
      }}
      onMouseLeave={() => {
        if (collapsed) {
          setIsFloatingOpen(false);
        }
      }}
    >
      <aside
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-col border-r border-stone-200 bg-white/90",
          collapsed ? "w-[48px]" : "w-full",
          collapsed && isFloatingOpen && "absolute left-0 top-0 z-30 w-[280px] shadow-xl",
        )}
      >
        {collapsed && !isFloatingOpen ? (
          <div className="flex h-full flex-col items-center">
            <div className="px-3 py-1">
              <CommandPalette
                compact
                currentWorkspaceOptions={{
                  personal: personalWorkspace
                    ? {
                        id: personalWorkspace.id,
                        label: "Personal",
                        workspaceType: "private",
                      }
                    : null,
                  shared: sharedWorkspace
                    ? {
                        id: sharedWorkspace.id,
                        label: "Shared",
                        workspaceType: "shared",
                      }
                    : null,
                }}
                items={searchItems}
                onCreatePage={async ({ title, workspaceId, workspaceType }) => {
                  await handleCreatePage({
                    workspaceId,
                    parentPageId: null,
                    title,
                    workspaceType,
                  });
                }}
                onNavigate={navigateToHref}
                selectedPageId={selectedPageId}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-stone-200 px-3 py-3">
          <CommandPalette
            currentWorkspaceOptions={{
              personal: personalWorkspace
                ? {
                    id: personalWorkspace.id,
                    label: "Personal",
                    workspaceType: "private",
                  }
                : null,
              shared: sharedWorkspace
                ? {
                    id: sharedWorkspace.id,
                    label: "Shared",
                    workspaceType: "shared",
                  }
                : null,
            }}
            items={searchItems}
            onCreatePage={async ({ title, workspaceId, workspaceType }) => {
              await handleCreatePage({
                workspaceId,
                parentPageId: null,
                title,
                workspaceType,
              });
            }}
            onNavigate={navigateToHref}
            selectedPageId={selectedPageId}
          />
        </div>
        <ScrollArea className="min-h-0 min-w-0 flex flex-col flex-1 overflow-hidden ">
          <div className="min-w-0 flex flex-col w-full overflow-hidden ">
            {workspaceTrees.map(({ workspace, pages }) => {
              const workspaceKey = getWorkspaceExpansionKey(workspace.id);
              const isExpanded = expandedKeys[workspaceKey] ?? true;

              return (
                <Collapsible
                  key={workspace.id}
                  onOpenChange={(open) => setExpanded(workspaceKey, open)}
                  open={isExpanded}
                >
                  <section className="w-full h-full min-w-0 flex-1 bg-white/90  border-b-1 border-stone-200">
                    <div className="flex min-w-0 items-center  px-3 py-1 overflow-hiddenx">

                      {/* <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
                        {workspace.type === "private" ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <Share2 className="h-4 w-4" />
                        )}
                      </span> */}
                      <div className="min-w-0 flex-1 flex items-center gap-1 overflow-hidden">
                        
                        <p className="truncate text-[11px] font-semibold uppercase text-stone-500">
                          {getWorkspaceLabel(workspace)}
                        </p>
                        {/* <p className="text-xs text-stone-400">
                          {pages.length} root {pages.length === 1 ? "page" : "pages"}
                        </p> */}
                                              <CollapsibleTrigger asChild>
                        <button
                          className="inline-flex h-5 w-5 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                          type="button"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </CollapsibleTrigger>
                      </div>
                      <Button
                        className="h-8 w-8 shrink-0 rounded-lg"
                        onClick={() =>
                          void handleCreatePage({
                            workspaceId: workspace.id,
                            parentPageId: null,
                            title:
                              workspace.type === "private"
                                ? "New private page"
                                : `New shared page L${currentUser.permissionLevel}`,
                            workspaceType: workspace.type,
                          }).catch((error) =>
                            setStatus({
                              kind: "error",
                              message:
                                error instanceof Error
                                  ? error.message
                                  : "Failed to create page.",
                            }),
                          )
                        }
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <CollapsibleContent className="">
                      <div className="min-w-0 space-y-0.5 p-2 pt-0">
                        {pages.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-stone-500">
                            No visible pages for this user.
                          </p>
                        ) : (
                          pages.map((node) => (
                            <SidebarPageNode
                              depth={0}
                              expandedKeys={expandedKeys}
                              key={node.id}
                              node={node}
                              onCopyLink={handleCopyLink}
                              onCreateChild={(title) =>
                                handleCreatePage({
                                  workspaceId: workspace.id,
                                  parentPageId: node.id,
                                  title,
                                  workspaceType: workspace.type,
                                })
                              }
                              onDelete={handleDeletePage}
                              onDuplicate={handleDuplicatePage}
                              onMove={handleMovePage}
                              onMoveToRoot={handleMoveToRoot}
                              onMoveToWorkspace={(targetWorkspaceId, targetWorkspaceType) =>
                                setPendingCrossWorkspaceMove({
                                  destinationWorkspaceId: targetWorkspaceId,
                                  destinationWorkspaceType: targetWorkspaceType,
                                  node,
                                })
                              }
                              onRename={handleRenamePage}
                              onStartRename={(pageId) => setEditingPageId(pageId)}
                              onStopRename={() => setEditingPageId(null)}
                              onNavigate={() => {
                                if (collapsed) {
                                  setIsFloatingOpen(false);
                                }
                              }}
                              pageHref={pageHref}
                              editingPageId={editingPageId}
                              personalWorkspaceId={personalWorkspace?.id ?? null}
                              selectedPageId={selectedPageId}
                              setExpanded={setExpanded}
                              sharedWorkspaceId={sharedWorkspace?.id ?? null}
                              siblingNodes={pages}
                              workspaceId={workspace.id}
                              workspaceType={workspace.type}
                            />
                          ))
                        )}
                      </div>
                      <WorkspaceDropZone
                        onDrop={(item) =>
                          void handleMovePage(workspace.id, item.id, {
                            destinationParentPageId: null,
                            destinationIndex: pages.filter((candidate) => candidate.id !== item.id).length,
                            destinationWorkspaceId:
                              item.workspaceId === workspace.id ? null : workspace.id,
                            destinationExplicitReadLevel:
                              item.workspaceId === workspace.id
                                ? undefined
                                : workspace.type === "shared"
                                  ? currentUser.permissionLevel
                                  : null,
                            destinationExplicitWriteLevel:
                              item.workspaceId === workspace.id
                                ? undefined
                                : workspace.type === "shared"
                                  ? currentUser.permissionLevel
                                  : null,
                          })
                        }
                        workspaceId={workspace.id}
                      />
                    </CollapsibleContent>
                  </section>
                </Collapsible>
              );
            })}

            <div className="border-b border-stone-200 bg-white/90 p-2">
              <Link
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                  pathname === "/recent"
                    ? "bg-stone-900 "
                    : " hover:bg-stone-100",
                )}
                href="/recent"
                onClick={() => {
                  if (collapsed) {
                    setIsFloatingOpen(false);
                  }
                }}
              >
                <History
                  className={cn(
                    "h-4 w-4",
                    pathname === "/recent" ? "text-stone-200" : "text-stone-500",
                  )}
                />
                <span className={cn(
                    "font-medium",
                    pathname === "/recent" ? "text-stone-200" : "text-stone-500",
                  )}>Recent</span>
              </Link>
            </div>
          </div>
        </ScrollArea>
        <SimpleDialog
          description={
            pendingDeleteNode
              ? `Choose whether deleting "${pendingDeleteNode.title}" should also delete its descendant pages or keep them by moving them up one level.`
              : undefined
          }
          open={pendingDeleteNode !== null}
          title="Delete page"
        >
          <div className="space-y-3">
            <button
              className={cn(
                "w-full rounded-xl border px-4 py-3 text-left text-sm transition",
                pendingDeleteMode === "delete-subtree"
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-300",
              )}
              onClick={() => setPendingDeleteMode("delete-subtree")}
              type="button"
            >
              Delete this page and all descendants
            </button>
            <button
              className={cn(
                "w-full rounded-xl border px-4 py-3 text-left text-sm transition",
                pendingDeleteMode === "keep-descendants"
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-300",
              )}
              onClick={() => setPendingDeleteMode("keep-descendants")}
              type="button"
            >
              Delete only this page and keep descendants
            </button>
          </div>
          <DialogActions>
            <Button
              onClick={() => setPendingDeleteNode(null)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="bg-red-700 text-white hover:bg-red-800"
              onClick={() => void confirmDeletePage()}
              type="button"
            >
              Delete page
            </Button>
          </DialogActions>
        </SimpleDialog>
        <SimpleDialog
          description={
            pendingMoveResolution
              ? `Moving "${pendingMoveResolution.pageTitle}" would make it less restrictive than it is now. Choose whether it should inherit the new parent permissions or keep its current stricter restriction level.`
              : undefined
          }
          open={pendingMoveResolution !== null}
          title="Resolve shared-page permissions"
        >
          <DialogActions className="justify-between">
            <Button
              onClick={() => setPendingMoveResolution(null)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (!pendingMoveResolution) return;
                  void handleMovePage(
                    pendingMoveResolution.workspaceId,
                    pendingMoveResolution.pageId,
                    {
                      ...pendingMoveResolution.target,
                      weakeningStrategy: "preserve",
                    },
                  );
                }}
                type="button"
                variant="outline"
              >
                Keep stricter permissions
              </Button>
              <Button
                onClick={() => {
                  if (!pendingMoveResolution) return;
                  void handleMovePage(
                    pendingMoveResolution.workspaceId,
                    pendingMoveResolution.pageId,
                    {
                      ...pendingMoveResolution.target,
                      weakeningStrategy: "inherit",
                    },
                  );
                }}
                type="button"
              >
                Inherit new parent permissions
              </Button>
            </div>
          </DialogActions>
        </SimpleDialog>
        <SimpleDialog
          description={
            pendingCrossWorkspaceMove
              ? pendingCrossWorkspaceMove.destinationWorkspaceType === "shared"
                ? `Move "${pendingCrossWorkspaceMove.node.title}" into the shared workspace root using your Level ${currentUser.permissionLevel} permissions as the default shared-page setting?`
                : `Move "${pendingCrossWorkspaceMove.node.title}" into your personal workspace root?`
              : undefined
          }
          open={pendingCrossWorkspaceMove !== null}
          title="Move page to another workspace"
        >
          <DialogActions>
            <Button
              onClick={() => setPendingCrossWorkspaceMove(null)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button onClick={() => void confirmCrossWorkspaceMove()} type="button">
              Move page
            </Button>
          </DialogActions>
        </SimpleDialog>
          </>
        )}
      </aside>
    </div>
  );
}

function SidebarPageNode({
  depth,
  editingPageId,
  expandedKeys,
  node,
  onCopyLink,
  onCreateChild,
  onDelete,
  onDuplicate,
  onMove,
  onMoveToRoot,
  onMoveToWorkspace,
  onRename,
  onStartRename,
  onStopRename,
  onNavigate,
  pageHref,
  personalWorkspaceId,
  selectedPageId,
  setExpanded,
  sharedWorkspaceId,
  siblingNodes,
  workspaceId,
  workspaceType,
}: {
  depth: number;
  editingPageId: string | null;
  expandedKeys: Record<string, boolean>;
  node: VisiblePageNode;
  onCopyLink: (pageId: string) => Promise<void>;
  onCreateChild: (title: string) => Promise<void>;
  onDelete: (node: VisiblePageNode) => Promise<void>;
  onDuplicate: (node: VisiblePageNode) => Promise<void>;
  onMove: (workspaceId: string, pageId: string, target: MoveTarget) => Promise<void>;
  onMoveToRoot: (node: VisiblePageNode) => Promise<void>;
  onMoveToWorkspace: (
    workspaceId: string,
    workspaceType: "private" | "shared",
  ) => void;
  onRename: (node: VisiblePageNode, nextTitle: string) => Promise<void>;
  onStartRename: (pageId: string) => void;
  onStopRename: () => void;
  onNavigate: () => void;
  pageHref: (pageId: string) => string;
  personalWorkspaceId: string | null;
  selectedPageId: string | null;
  setExpanded: (key: string, value: boolean) => void;
  sharedWorkspaceId: string | null;
  siblingNodes: VisiblePageNode[];
  workspaceId: string;
  workspaceType: "private" | "shared";
}) {
  const isExpanded = expandedKeys[getPageExpansionKey(node.id)] ?? true;
  const hasChildren = node.children.length > 0;
  const isSelected = selectedPageId === node.id;
  const isEditing = editingPageId === node.id;
  const rowRef = useRef<HTMLDivElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const renameHasFocusedRef = useRef(false);
  const renameSubmissionRef = useRef(false);
  const expandTimeoutRef = useRef<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<DropPosition | null>(null);
  const [draftTitle, setDraftTitle] = useState(node.title);

  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(node.title);
      renameSubmissionRef.current = false;
      renameHasFocusedRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isEditing, node.title]);
  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      canDrag: node.canWrite,
      item: {
        id: node.id,
        workspaceId,
      } satisfies DragItem,
      type: DRAG_TYPE,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [node.canWrite, node.id, workspaceId],
  );
  const [{ isOver, canDrop }, dropRef] = useDrop(
    () => ({
      accept: DRAG_TYPE,
      canDrop: (item: DragItem) =>
        item.id !== node.id && item.workspaceId === workspaceId && node.canWrite,
      collect: (monitor) => ({
        canDrop: monitor.canDrop(),
        isOver: monitor.isOver({ shallow: true }),
      }),
      drop: async (item: DragItem, monitor) => {
        if (!rowRef.current || monitor.didDrop()) {
          return;
        }

        const position = getDropPosition(
          rowRef.current,
          monitor.getClientOffset(),
          depth,
          node.canWrite,
        );
        const target = getTargetForDrop(item.id, node, siblingNodes, position);

        await onMove(workspaceId, item.id, target);
      },
      hover: (_item: DragItem, monitor) => {
        if (!rowRef.current || !monitor.canDrop()) {
          return;
        }

        const position = getDropPosition(
          rowRef.current,
          monitor.getClientOffset(),
          depth,
          node.canWrite,
        );
        setHoverPosition(position);

        if (position === "inside" && hasChildren && !isExpanded) {
          if (expandTimeoutRef.current !== null) {
            window.clearTimeout(expandTimeoutRef.current);
          }

          expandTimeoutRef.current = window.setTimeout(() => {
            setExpanded(getPageExpansionKey(node.id), true);
          }, 450);
        }
      },
    }),
    [depth, hasChildren, isExpanded, node, onMove, setExpanded, siblingNodes, workspaceId],
  );

  useEffect(
    () => () => {
      if (expandTimeoutRef.current !== null) {
        window.clearTimeout(expandTimeoutRef.current);
      }
    },
    [],
  );

  const setRowNode = useCallback(
    (element: HTMLDivElement | null) => {
      rowRef.current = element;
      dropRef(element);
      if (node.canWrite) {
        dragRef(element);
      }
    },
    [dragRef, dropRef, node.canWrite],
  );

  const activeDropPosition = isOver && canDrop ? hoverPosition : null;

  const commitRename = async () => {
    if (renameSubmissionRef.current) {
      return;
    }

    renameSubmissionRef.current = true;
    const nextTitle = draftTitle.trim();

    if (!nextTitle || nextTitle === node.title) {
      onStopRename();
      renameSubmissionRef.current = false;
      return;
    }

    try {
      await onRename(node, nextTitle);
      onStopRename();
    } finally {
      renameSubmissionRef.current = false;
    }
  };

  return (
    <Collapsible
      onOpenChange={(open) => setExpanded(getPageExpansionKey(node.id), open)}
      open={hasChildren ? isExpanded : true}
    >
      <div className="min-w-0 ">
        <div
          className={cn(
            "relative w-full min-w-0 rounded-xl",
            activeDropPosition === "before" && "before:absolute before:inset-x-2 before:top-0 before:h-0.5 before:rounded-full before:bg-stone-900",
            activeDropPosition === "after" && "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-stone-900",
            activeDropPosition === "inside" && "bg-stone-100/80",
          )}
          ref={setRowNode}
        >
          <div
            className={cn(
              "group flex w-full min-w-0 items-center gap-1 rounded-md  transition ",
              node.canWrite ? "cursor-grab active:cursor-grabbing" : "cursor-default",
              isSelected ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100",
              isDragging && "opacity-50",
            )}
            style={{ paddingLeft: `${4 + depth * 14}px` }}
          >
            <div className="flex shrink-0 items-center gap-0.5">
              {hasChildren ? (
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "inline-flex h-7 w-6 items-center justify-center rounded-md transition",
                      isSelected
                        ? "text-stone-200 "
                        : "text-stone-400 ",
                    )}
                    type="button"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 " />
                    ) : (
                      <ChevronRight className="h-4 " />
                    )}
                  </button>
                </CollapsibleTrigger>
              ) : (
                <>
                  <span className="inline-flex h-7 w-7 items-center justify-center">
                  <File
                    className={cn(
                      "h-3.5 w-3.5",
                      isSelected ? "text-stone-200" : "text-stone-300",
                    )}
                  />
                </span>
                </>

              )}

            </div>

            {isEditing ? (
              <input
                className={cn(
                  "min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 py-1 text-sm outline-none ring-0",
                  isSelected && "border-white/30 bg-white text-stone-950",
                )}
                onBlur={() => {
                  if (!renameHasFocusedRef.current) {
                    return;
                  }

                  void commitRename();
                }}
                onChange={(event) => setDraftTitle(event.target.value)}
                onFocus={() => {
                  renameHasFocusedRef.current = true;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void commitRename();
                    return;
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    setDraftTitle(node.title);
                    onStopRename();
                  }
                }}
                ref={renameInputRef}
                value={draftTitle}
              />
            ) : (
              <Link
                className="min-w-0 flex-1 overflow-hidden py-2 text-sm"
                href={pageHref(node.id)}
                onClick={onNavigate}
                prefetch
              >
                <span className="block max-w-36 truncate whitespace-nowrap">
                  {node.title}
                </span>
              </Link>
            )}

            {/* <span
              className={cn(
                "hidden shrink-0 rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] xl:inline-flex",
                isSelected ? "bg-white/10 text-stone-200" : "bg-stone-100 text-stone-500",
              )}
            >
              {node.canWrite ? "edit" : "read"}
            </span> */}

            <PageActionMenu
              node={node}
              onCopyLink={onCopyLink}
              onCreateChild={onCreateChild}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onMoveToRoot={onMoveToRoot}
              onMoveToWorkspace={onMoveToWorkspace}
              onRename={() => onStartRename(node.id)}
              personalWorkspaceId={personalWorkspaceId}
              selected={isSelected}
              sharedWorkspaceId={sharedWorkspaceId}
              workspaceType={workspaceType}
            />
          </div>
        </div>

        {hasChildren ? (
          <CollapsibleContent className="space-y-0.5">
            {isExpanded
              ? node.children.map((child) => (
                  <SidebarPageNode
                    depth={depth + 1}
                    expandedKeys={expandedKeys}
                    key={child.id}
                    node={child}
                    onCopyLink={onCopyLink}
                    onCreateChild={onCreateChild}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
              onMove={onMove}
              onMoveToRoot={onMoveToRoot}
              onMoveToWorkspace={onMoveToWorkspace}
              onRename={onRename}
              onStartRename={onStartRename}
              onStopRename={onStopRename}
              onNavigate={onNavigate}
              pageHref={pageHref}
              editingPageId={editingPageId}
              personalWorkspaceId={personalWorkspaceId}
              selectedPageId={selectedPageId}
              setExpanded={setExpanded}
              sharedWorkspaceId={sharedWorkspaceId}
              siblingNodes={node.children}
              workspaceId={workspaceId}
              workspaceType={workspaceType}
            />
          ))
              : null}
          </CollapsibleContent>
        ) : null}
      </div>
    </Collapsible>
  );
}

function PageActionMenu({
  node,
  onCopyLink,
  onCreateChild,
  onDelete,
  onDuplicate,
  onMoveToRoot,
  onMoveToWorkspace,
  onRename,
  personalWorkspaceId,
  selected,
  sharedWorkspaceId,
  workspaceType,
}: {
  node: VisiblePageNode;
  onCopyLink: (pageId: string) => Promise<void>;
  onCreateChild: (title: string) => Promise<void>;
  onDelete: (node: VisiblePageNode) => Promise<void>;
  onDuplicate: (node: VisiblePageNode) => Promise<void>;
  onMoveToRoot: (node: VisiblePageNode) => Promise<void>;
  onMoveToWorkspace: (
    workspaceId: string,
    workspaceType: "private" | "shared",
  ) => void;
  onRename: () => void;
  personalWorkspaceId: string | null;
  selected: boolean;
  sharedWorkspaceId: string | null;
  workspaceType: "private" | "shared";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100",
            selected
              ? "text-stone-200 hover:bg-white/10 hover:text-white"
              : "text-stone-400 hover:bg-stone-200/70 hover:text-stone-900",
            selected && "opacity-100",
          )}
          type="button"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{node.title}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/?page=${node.id}`}>
            <FolderTree className="h-4 w-4" />
            Open
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!node.canWrite}
          onSelect={() => {
            const title = window.prompt("New child page title", `New child under ${node.title}`)?.trim();

            if (title) {
              void onCreateChild(title);
            }
          }}
        >
          <FilePlus2 className="h-4 w-4" />
          New child
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!node.canWrite}
          onSelect={() => {
            window.setTimeout(() => {
              onRename();
            }, 0);
          }}
        >
          <Pencil className="h-4 w-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!node.canWrite} onSelect={() => void onMoveToRoot(node)}>
          <FolderTree className="h-4 w-4" />
          Move to workspace root
        </DropdownMenuItem>
        {workspaceType !== "private" && personalWorkspaceId ? (
          <DropdownMenuItem
            disabled={!node.canWrite}
            onSelect={() => onMoveToWorkspace(personalWorkspaceId, "private")}
          >
            <FolderTree className="h-4 w-4" />
            Move to Personal workspace
          </DropdownMenuItem>
        ) : null}
        {workspaceType !== "shared" && sharedWorkspaceId ? (
          <DropdownMenuItem
            disabled={!node.canWrite}
            onSelect={() => onMoveToWorkspace(sharedWorkspaceId, "shared")}
          >
            <FolderTree className="h-4 w-4" />
            Move to Shared workspace
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!node.canWrite} onSelect={() => void onDuplicate(node)}>
          <Copy className="h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onCopyLink(node.id)}>
          <Copy className="h-4 w-4" />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Settings2 className="h-4 w-4" />
          Permission controls
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-700 focus:bg-red-50 focus:text-red-700"
          disabled={!node.canWrite}
          onSelect={() => void onDelete(node)}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceDropZone({
  onDrop,
  workspaceId,
}: {
  onDrop: (item: DragItem) => void;
  workspaceId: string;
}) {
  const [{ isOver, canDrop }, dropRef] = useDrop<
    DragItem,
    void,
    { canDrop: boolean; isOver: boolean }
  >(
    () => ({
      accept: DRAG_TYPE,
      canDrop: () => true,
      collect: (monitor) => ({
        canDrop: monitor.canDrop(),
        isOver: monitor.isOver({ shallow: true }),
      }),
      drop: (item: DragItem, monitor) => {
        if (monitor.didDrop()) {
          return;
        }

        onDrop(item);
      },
    }),
    [onDrop, workspaceId],
  );
  const setDropZoneNode = useCallback(
    (element: HTMLDivElement | null) => {
      dropRef(element);
    },
    [dropRef],
  );

  return (
    <div
      className={cn(
        "mx-2 mb-2 h-4 rounded-full border border-dashed transition",
        isOver && canDrop ? "border-stone-900 bg-stone-100" : "border-transparent",
      )}
      ref={setDropZoneNode}
    />
  );
}

function getWorkspaceExpansionKey(workspaceId: string) {
  return `workspace:${workspaceId}`;
}

function getWorkspaceLabel(workspace: WorkspaceTree["workspace"]) {
  return workspace.type === "private" ? "Personal" : "Shared";
}

function getPageExpansionKey(pageId: string) {
  return `page:${pageId}`;
}

function getDefaultExpandedKeys(
  workspaces: WorkspaceTree[],
  selectedPageId: string | null,
) {
  const expanded: Record<string, boolean> = {};

  for (const { workspace, pages } of workspaces) {
    expanded[getWorkspaceExpansionKey(workspace.id)] = true;

    if (!selectedPageId) {
      continue;
    }

    const ancestorIds = getAncestorIds(pages, selectedPageId) ?? [];

    for (const ancestorId of ancestorIds) {
      expanded[getPageExpansionKey(ancestorId)] = true;
    }
  }

  return expanded;
}

function getAncestorIds(nodes: VisiblePageNode[], pageId: string): string[] | null {
  for (const node of nodes) {
    if (node.id === pageId) {
      return [];
    }

    const descendantAncestors = getAncestorIds(node.children, pageId);

    if (descendantAncestors !== null) {
      return [node.id, ...descendantAncestors];
    }
  }

  return null;
}

function flattenVisibleNodes(nodes: VisiblePageNode[]): VisiblePageNode[] {
  return nodes.flatMap((node) => [node, ...flattenVisibleNodes(node.children)]);
}

function getDropPosition(
  element: HTMLElement,
  clientOffset: { x: number; y: number } | null,
  depth: number,
  canNest: boolean,
): DropPosition {
  const rect = element.getBoundingClientRect();
  const fallbackY = rect.top + rect.height / 2;
  const fallbackX = rect.left + 24;
  const pointerY = clientOffset?.y ?? fallbackY;
  const pointerX = clientOffset?.x ?? fallbackX;
  const offsetY = pointerY - rect.top;
  const relativeX = pointerX - rect.left;
  const insideThreshold = 28 + depth * 8;

  if (canNest && relativeX > insideThreshold && offsetY >= rect.height * 0.25) {
    return "inside";
  }

  if (offsetY < rect.height * 0.35) {
    return "before";
  }

  if (offsetY > rect.height * 0.65) {
    return "after";
  }

  return canNest ? "inside" : "after";
}

function getTargetForDrop(
  draggedId: string,
  node: VisiblePageNode,
  siblingNodes: VisiblePageNode[],
  position: DropPosition,
): MoveTarget {
  if (position === "inside") {
    const destinationChildren = node.children.filter((child) => child.id !== draggedId);

    return {
      destinationParentPageId: node.id,
      destinationIndex: destinationChildren.length,
    };
  }

  const siblings = siblingNodes.filter((candidate) => candidate.id !== draggedId);
  const nodeIndex = siblings.findIndex((candidate) => candidate.id === node.id);
  const destinationIndex = position === "before" ? nodeIndex : nodeIndex + 1;

  return {
    destinationParentPageId: node.parentPageId,
    destinationIndex,
  };
}
