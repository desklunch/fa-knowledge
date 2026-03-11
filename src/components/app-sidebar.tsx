"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FilePlus2,
  FolderTree,
  GripVertical,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Share2,
  Trash2,
} from "lucide-react";

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
  selectedPageId: string | null;
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
};

const DRAG_TYPE = "sidebar-page";
const STORAGE_KEY = "fa-knowledge-sidebar-expanded";

export function AppSidebar({
  currentUser,
  selectedPageId,
  visibleWorkspaces,
}: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [workspaceTrees, setWorkspaceTrees] = useState(visibleWorkspaces);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<{ kind: "error" | "success"; message: string } | null>(
    null,
  );

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

    return `${pathname}?${nextParams.toString()}`;
  };

  const refreshData = () => {
    startTransition(() => {
      router.refresh();
    });
  };

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

  const mutateWorkspaceTrees = async (
    updater: (current: WorkspaceTree[]) => WorkspaceTree[],
    action: () => Promise<void>,
  ) => {
    const previousTrees = workspaceTrees;
    const nextTrees = updater(previousTrees);
    setWorkspaceTrees(nextTrees);

    try {
      await action();
      refreshData();
    } catch (error) {
      setWorkspaceTrees(previousTrees);
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Sidebar action failed.",
      });
    }
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

  const handleRenamePage = async (node: VisiblePageNode) => {
    const nextTitle = window.prompt("Rename page", node.title)?.trim();

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
    if (!window.confirm(`Delete "${node.title}" and its subtree?`)) {
      return;
    }

    const response = await fetch(`/api/pages/${node.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Failed to delete page.");
    }

    const payload = (await response.json()) as { redirectPageId: string | null };

    if (selectedPageId === node.id) {
      router.push(payload.redirectPageId ? pageHref(payload.redirectPageId) : pathname);
    }

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
    await mutateWorkspaceTrees(
      (current) =>
        current.map((workspace) =>
          workspace.workspace.id === workspaceId
            ? {
                ...workspace,
                pages: moveNodeInTree(
                  workspace.pages,
                  pageId,
                  target.destinationParentPageId,
                  target.destinationIndex,
                ),
              }
            : workspace,
        ),
      async () => {
        const response = await fetch(`/api/pages/${pageId}/move`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(target),
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to move page.");
        }

        if (target.destinationParentPageId) {
          setExpanded(getPageExpansionKey(target.destinationParentPageId), true);
          setExpandedForAncestors(workspaceId, target.destinationParentPageId);
        }

        setStatus({
          kind: "success",
          message: "Page moved.",
        });
      },
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <aside className="flex h-full min-h-0 flex-col border-r border-stone-200 bg-[#f7f5ef]">
        <div className="border-b border-stone-200 px-3 py-3">
          <div className="rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              Active identity
            </p>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-stone-950">{currentUser.name}</h2>
                <p className="mt-1 text-sm text-stone-600">
                  Level {currentUser.permissionLevel} · {currentUser.userType}
                </p>
              </div>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">
                rail
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-stone-500">
              Notion-style workspace trees with inline actions and drag/drop hierarchy controls.
            </p>
            {status ? (
              <div
                className={cn(
                  "mt-3 rounded-xl border px-3 py-2 text-xs",
                  status.kind === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700",
                )}
              >
                {status.message}
              </div>
            ) : null}
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 px-3 py-3">
            {workspaceTrees.map(({ workspace, pages }) => {
              const workspaceKey = getWorkspaceExpansionKey(workspace.id);
              const isExpanded = expandedKeys[workspaceKey] ?? true;

              return (
                <Collapsible
                  key={workspace.id}
                  onOpenChange={(open) => setExpanded(workspaceKey, open)}
                  open={isExpanded}
                >
                  <section className="rounded-2xl border border-stone-200 bg-white/90 p-2 shadow-sm">
                    <div className="flex items-center gap-2 px-1 py-1">
                      <CollapsibleTrigger asChild>
                        <button
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                          type="button"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </CollapsibleTrigger>
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
                        {workspace.type === "private" ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <Share2 className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                          {workspace.name}
                        </p>
                        <p className="text-xs text-stone-400">
                          {pages.length} root {pages.length === 1 ? "page" : "pages"}
                        </p>
                      </div>
                      <Button
                        className="h-8 w-8 rounded-lg"
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

                    <CollapsibleContent className="pt-1">
                      <WorkspaceDropZone
                        onDrop={(item) =>
                          void handleMovePage(workspace.id, item.id, {
                            destinationParentPageId: null,
                            destinationIndex: pages.filter((candidate) => candidate.id !== item.id).length,
                          })
                        }
                        workspaceId={workspace.id}
                      />
                      <div className="space-y-0.5">
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
                              onRename={handleRenamePage}
                              pageHref={pageHref}
                              selectedPageId={selectedPageId}
                              setExpanded={setExpanded}
                              siblingNodes={pages}
                              workspaceId={workspace.id}
                            />
                          ))
                        )}
                      </div>
                    </CollapsibleContent>
                  </section>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </aside>
    </DndProvider>
  );
}

function SidebarPageNode({
  depth,
  expandedKeys,
  node,
  onCopyLink,
  onCreateChild,
  onDelete,
  onDuplicate,
  onMove,
  onMoveToRoot,
  onRename,
  pageHref,
  selectedPageId,
  setExpanded,
  siblingNodes,
  workspaceId,
}: {
  depth: number;
  expandedKeys: Record<string, boolean>;
  node: VisiblePageNode;
  onCopyLink: (pageId: string) => Promise<void>;
  onCreateChild: (title: string) => Promise<void>;
  onDelete: (node: VisiblePageNode) => Promise<void>;
  onDuplicate: (node: VisiblePageNode) => Promise<void>;
  onMove: (workspaceId: string, pageId: string, target: MoveTarget) => Promise<void>;
  onMoveToRoot: (node: VisiblePageNode) => Promise<void>;
  onRename: (node: VisiblePageNode) => Promise<void>;
  pageHref: (pageId: string) => string;
  selectedPageId: string | null;
  setExpanded: (key: string, value: boolean) => void;
  siblingNodes: VisiblePageNode[];
  workspaceId: string;
}) {
  const isExpanded = expandedKeys[getPageExpansionKey(node.id)] ?? true;
  const hasChildren = node.children.length > 0;
  const isSelected = selectedPageId === node.id;
  const rowRef = useRef<HTMLDivElement | null>(null);
  const expandTimeoutRef = useRef<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<DropPosition | null>(null);
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
    },
    [dropRef],
  );
  const setDragHandleNode = useCallback(
    (element: HTMLSpanElement | null) => {
      if (node.canWrite) {
        dragRef(element);
      }
    },
    [dragRef, node.canWrite],
  );

  const activeDropPosition = isOver && canDrop ? hoverPosition : null;

  return (
    <Collapsible
      onOpenChange={(open) => setExpanded(getPageExpansionKey(node.id), open)}
      open={hasChildren ? isExpanded : true}
    >
      <div className="space-y-0.5">
        <div
          className={cn(
            "relative rounded-xl",
            activeDropPosition === "before" && "before:absolute before:inset-x-2 before:top-0 before:h-0.5 before:rounded-full before:bg-stone-900",
            activeDropPosition === "after" && "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-stone-900",
            activeDropPosition === "inside" && "bg-stone-100/80",
          )}
          ref={setRowNode}
        >
          <div
            className={cn(
              "group flex items-center gap-1 rounded-xl pr-1 transition",
              isSelected ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100",
              isDragging && "opacity-50",
            )}
            style={{ paddingLeft: `${8 + depth * 14}px` }}
          >
            <div className="flex items-center gap-0.5">
              {hasChildren ? (
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-md transition",
                      isSelected
                        ? "text-stone-200 hover:bg-white/10 hover:text-white"
                        : "text-stone-400 hover:bg-stone-200/70 hover:text-stone-900",
                    )}
                    type="button"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
              ) : (
                <span className="inline-flex h-7 w-7 items-center justify-center">
                  <FolderTree
                    className={cn(
                      "h-3.5 w-3.5",
                      isSelected ? "text-stone-200" : "text-stone-300",
                    )}
                  />
                </span>
              )}

              <span
                className={cn(
                  "inline-flex h-7 w-5 items-center justify-center",
                  node.canWrite ? "cursor-grab" : "cursor-default",
                  isSelected ? "text-stone-200" : "text-stone-300 group-hover:text-stone-500",
                )}
                ref={setDragHandleNode}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </span>
            </div>

            <Link
              className="min-w-0 flex-1 py-2 text-sm"
              href={pageHref(node.id)}
              prefetch
            >
              <span className="truncate block">{node.title}</span>
            </Link>

            <span
              className={cn(
                "hidden rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] sm:inline-flex",
                isSelected ? "bg-white/10 text-stone-200" : "bg-stone-100 text-stone-500",
              )}
            >
              {node.canWrite ? "edit" : "read"}
            </span>

            <PageActionMenu
              node={node}
              onCopyLink={onCopyLink}
              onCreateChild={onCreateChild}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onMoveToRoot={onMoveToRoot}
              onRename={onRename}
              selected={isSelected}
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
              onRename={onRename}
              pageHref={pageHref}
              selectedPageId={selectedPageId}
              setExpanded={setExpanded}
              siblingNodes={node.children}
              workspaceId={workspaceId}
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
  onRename,
  selected,
}: {
  node: VisiblePageNode;
  onCopyLink: (pageId: string) => Promise<void>;
  onCreateChild: (title: string) => Promise<void>;
  onDelete: (node: VisiblePageNode) => Promise<void>;
  onDuplicate: (node: VisiblePageNode) => Promise<void>;
  onMoveToRoot: (node: VisiblePageNode) => Promise<void>;
  onRename: (node: VisiblePageNode) => Promise<void>;
  selected: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg transition",
            selected
              ? "text-stone-200 hover:bg-white/10 hover:text-white"
              : "text-stone-400 hover:bg-stone-200/70 hover:text-stone-900",
          )}
          type="button"
        >
          <MoreHorizontal className="h-4 w-4" />
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
        <DropdownMenuItem disabled={!node.canWrite} onSelect={() => void onRename(node)}>
          <Pencil className="h-4 w-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!node.canWrite} onSelect={() => void onMoveToRoot(node)}>
          <GripVertical className="h-4 w-4" />
          Move to workspace root
        </DropdownMenuItem>
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
  const [{ isOver, canDrop }, dropRef] = useDrop(
    () => ({
      accept: DRAG_TYPE,
      canDrop: (item: DragItem) => item.workspaceId === workspaceId,
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

function moveNodeInTree(
  pages: VisiblePageNode[],
  pageId: string,
  destinationParentPageId: string | null,
  destinationIndex: number,
) {
  const [node, prunedPages] = removeNode(pages, pageId);

  if (!node) {
    return pages;
  }

  const destinationParent = destinationParentPageId
    ? findNode(prunedPages, destinationParentPageId)
    : null;
  const nextDepth = destinationParent ? destinationParent.depth + 1 : 0;
  const normalizedNode = updateSubtreeDepth({
    node: {
      ...node,
      parentPageId: destinationParentPageId,
    },
    nextDepth,
  });

  return reindexTree(insertNode(prunedPages, normalizedNode, destinationParentPageId, destinationIndex));
}

function removeNode(
  pages: VisiblePageNode[],
  pageId: string,
): [VisiblePageNode | null, VisiblePageNode[]] {
  let removedNode: VisiblePageNode | null = null;

  const nextPages = pages
    .filter((node) => {
      if (node.id === pageId) {
        removedNode = node;
        return false;
      }

      return true;
    })
    .map((node) => {
      const [removedChild, nextChildren] = removeNode(node.children, pageId);

      if (removedChild) {
        removedNode = removedChild;
        return {
          ...node,
          children: nextChildren,
        };
      }

      return node;
    });

  return [removedNode, nextPages];
}

function insertNode(
  pages: VisiblePageNode[],
  node: VisiblePageNode,
  destinationParentPageId: string | null,
  destinationIndex: number,
): VisiblePageNode[] {
  if (destinationParentPageId === null) {
    const nextPages = [...pages];
    nextPages.splice(Math.min(destinationIndex, nextPages.length), 0, node);
    return nextPages;
  }

  return pages.map((page) => {
    if (page.id === destinationParentPageId) {
      const nextChildren = [...page.children];
      nextChildren.splice(Math.min(destinationIndex, nextChildren.length), 0, node);

      return {
        ...page,
        children: nextChildren,
      };
    }

    return {
      ...page,
      children: insertNode(page.children, node, destinationParentPageId, destinationIndex),
    };
  });
}

function reindexTree(nodes: VisiblePageNode[]): VisiblePageNode[] {
  return nodes.map((node, index) => ({
    ...node,
    sortOrder: index,
    children: reindexTree(node.children),
  }));
}

function updateSubtreeDepth({
  node,
  nextDepth,
}: {
  node: VisiblePageNode;
  nextDepth: number;
}): VisiblePageNode {
  return {
    ...node,
    depth: nextDepth,
    children: node.children.map((child) =>
      updateSubtreeDepth({
        node: {
          ...child,
          parentPageId: node.id,
        },
        nextDepth: nextDepth + 1,
      }),
    ),
  };
}

function findNode(nodes: VisiblePageNode[], pageId: string): VisiblePageNode | null {
  for (const node of nodes) {
    if (node.id === pageId) {
      return node;
    }

    const childNode = findNode(node.children, pageId);

    if (childNode) {
      return childNode;
    }
  }

  return null;
}
