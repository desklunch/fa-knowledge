import Link from "next/link";
import { FilePlus2, FolderTree, Lock, Share2 } from "lucide-react";

import { createPageAction } from "@/app/actions";
import type { VisiblePageNode } from "@/lib/knowledge-base";

type SidebarTreeProps = {
  currentUserPermissionLevel: number;
  workspaceName: string;
  workspaceId: string;
  workspaceType: "private" | "shared";
  nodes: VisiblePageNode[];
  selectedPageId: string | null;
};

export function SidebarTree({
  currentUserPermissionLevel,
  workspaceName,
  workspaceId,
  workspaceType,
  nodes,
  selectedPageId,
}: SidebarTreeProps) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white/90 p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-700">
            {workspaceType === "private" ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
          </span>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              {workspaceName}
            </h2>
            <p className="text-xs text-stone-400">{nodes.length} root pages</p>
          </div>
        </div>
        <span className="rounded-md bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-500">
          {workspaceType}
        </span>
      </div>
      <form action={createPageAction} className="mb-3">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="parentPageId" value="" />
        <input
          type="hidden"
          name="title"
          value={
            workspaceType === "private"
              ? "New private note"
              : `New shared note L${currentUserPermissionLevel}`
          }
        />
        <input
          type="hidden"
          name="contentMarkdown"
          value={
            workspaceType === "private"
              ? "# New private note\n\nScratch space for this workspace."
              : "# New shared note\n\nSeeded at the shared workspace root for testing."
          }
        />
        {workspaceType === "shared" ? (
          <>
            <input
              type="hidden"
              name="explicitReadLevel"
              value={String(currentUserPermissionLevel)}
            />
            <input
              type="hidden"
              name="explicitWriteLevel"
              value={String(currentUserPermissionLevel)}
            />
          </>
        ) : null}
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
        >
          <FilePlus2 className="h-4 w-4" />
          {workspaceType === "private" ? "New private page" : "New shared page"}
        </button>
      </form>
      <nav className="space-y-1.5">
        {nodes.length === 0 ? (
          <p className="text-sm text-stone-500">No visible pages for this user.</p>
        ) : (
          nodes.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              selectedPageId={selectedPageId}
            />
          ))
        )}
      </nav>
    </section>
  );
}

function TreeNode({
  node,
  selectedPageId,
}: {
  node: VisiblePageNode;
  selectedPageId: string | null;
}) {
  const isActive = selectedPageId === node.id;
  const params = new URLSearchParams({
    page: node.id,
  });

  return (
    <div className="space-y-1">
      <Link
        href={`/?${params.toString()}`}
        className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
          isActive
            ? "bg-stone-900 text-white"
            : "bg-stone-50 text-stone-700 hover:bg-stone-100"
        }`}
      >
        <span className="flex items-center gap-2">
          <FolderTree className={`h-3.5 w-3.5 ${isActive ? "text-stone-200" : "text-stone-400"}`} />
          <span>{node.title}</span>
        </span>
        <span className={`text-xs ${isActive ? "text-stone-200" : "opacity-70"}`}>
          {node.canWrite ? "edit" : "read"}
        </span>
      </Link>
      {node.children.length > 0 ? (
        <div className="ml-4 space-y-1.5 border-l border-stone-200 pl-3">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedPageId={selectedPageId}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
