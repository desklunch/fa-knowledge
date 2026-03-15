"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PageMetadataForm } from "@/components/page-metadata-form";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

type DraftSnapshot = {
  contentMarkdown: string;
  title: string;
} | null;

type RevisionSummary = {
  createdAt: Date;
  createdByUserName: string;
  id: string;
  revisionNumber: number;
  titleSnapshot: string;
};

type SelectedRevision = {
  contentMarkdown: string;
  revisionNumber: number;
};

type SelectedPage = {
  canWrite: boolean;
  createdAt: Date;
  createdByUserId: string;
  explicitReadLevel: number | null;
  explicitWriteLevel: number | null;
  effectiveReadLevel: number | null;
  effectiveWriteLevel: number | null;
  hasDescendants: boolean;
  id: string;
  parentPageId: string | null;
  title: string;
  updatedAt: Date;
  updatedByUserId: string;
};

type RightSidebarProps = {
  availableUsers: Array<{ id: string; name: string }>;
  currentWorkspaceType: "private" | "shared";
  selectedPageBacklinks: Array<{
    href: string;
    id: string;
    title: string;
    workspaceLabel: string;
  }>;
  selectedDraft: DraftSnapshot;
  selectedPage: SelectedPage | null;
  selectedPageRevisions: RevisionSummary[];
  selectedRevision: SelectedRevision | null;
};

export function RightSidebar({
  availableUsers,
  currentWorkspaceType,
  selectedPageBacklinks,
  selectedDraft,
  selectedPage,
  selectedPageRevisions,
  selectedRevision,
}: RightSidebarProps) {
  const router = useRouter();
  const userNameById = new Map(availableUsers.map((user) => [user.id, user.name]));
  const restoreRevision = async (revisionId: string) => {
    if (!selectedPage?.canWrite || !selectedPage) {
      return;
    }

    const response = await fetch(
      `/api/pages/${selectedPage.id}/revisions/${revisionId}/restore`,
      { method: "POST" },
    );
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to restore revision.");
    }

    router.refresh();
  };

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#f7f5ef]">
      {selectedPage && selectedRevision ? (
        <div className="min-h-0">
          <SidebarPanel title="Page overview">
            <div className="grid gap-2 text-sm text-stone-600">
              <InlineMetric label="Title" value={selectedDraft?.title ?? selectedPage.title} />
              <InlineMetric
                label="Current revision"
                value={String(selectedRevision.revisionNumber)}
              />
              <InlineMetric
                label="Visible revisions"
                value={String(selectedPageRevisions.length)}
              />
              <InlineMetric
                label="Reading time"
                value={`${Math.max(
                  1,
                  Math.ceil(
                    getReadingWords(
                      selectedDraft?.contentMarkdown ?? selectedRevision.contentMarkdown,
                    ) / 220,
                  ),
                )} min`}
              />
              <InlineMetric
                label="Save behavior"
                value={selectedPage.canWrite ? "Autosave + manual save" : "Read only"}
              />
              <InlineMetric
                label="Created by"
                value={userNameById.get(selectedPage.createdByUserId) ?? "Unknown user"}
              />
              <InlineMetric
                label="Created on"
                value={formatCalendarDay(selectedPage.createdAt)}
              />
              <InlineMetric
                label="Last edited by"
                value={userNameById.get(selectedPage.updatedByUserId) ?? "Unknown user"}
              />
              <InlineMetric
                label="Last edited"
                value={formatCalendarDay(selectedPage.updatedAt)}
              />
            </div>
          </SidebarPanel>

          <SidebarPanel title="Permissions">
            <PageMetadataForm
              canWrite={selectedPage.canWrite}
              currentEffectiveReadLevel={selectedPage.effectiveReadLevel}
              currentEffectiveWriteLevel={selectedPage.effectiveWriteLevel}
              explicitReadLevel={selectedPage.explicitReadLevel}
              explicitWriteLevel={selectedPage.explicitWriteLevel}
              hasDescendants={selectedPage.hasDescendants}
              hasParent={selectedPage.parentPageId !== null}
              pageId={selectedPage.id}
              workspaceType={currentWorkspaceType}
            />
          </SidebarPanel>

          <SidebarPanel title="Referenced by">
            {selectedPageBacklinks.length > 0 ? (
              <div className="space-y-2">
                {selectedPageBacklinks.map((backlink) => (
                  <Link
                    className="block rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm transition hover:border-stone-300 hover:bg-stone-50"
                    href={backlink.href}
                    key={backlink.id}
                  >
                    <p className="font-medium text-stone-900">{backlink.title}</p>
                    <p className="text-xs text-stone-500">{backlink.workspaceLabel}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-500">No visible pages reference this page yet.</p>
            )}
          </SidebarPanel>

          <SidebarPanel title="Recent revisions">
            <div>
              {selectedPageRevisions.slice(0, 6).map((revision) => (
                <div
                  className="flex items-center justify-between border-b border-stone-200 py-2 text-sm last:border-none"
                  key={revision.id}
                >
                  <div>
                    <p className="text-xs font-medium text-stone-900">
                      Revision {revision.revisionNumber}
                    </p>
                    <p className="text-[11px] text-stone-500">{revision.createdByUserName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-stone-500">
                      {formatUtcTimestamp(revision.createdAt)}
                    </p>
                    {selectedPage.canWrite && revision.revisionNumber !== selectedRevision.revisionNumber ? (
                      <Button
                        onClick={() => void restoreRevision(revision.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Restore
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </SidebarPanel>
        </div>
      ) : (
        <SidebarPanel title="Workspace status">
          <div className="space-y-2 text-sm text-stone-600">
            <p>Private and shared spaces are both active in this session.</p>
            <p>Available identities: {availableUsers.map((user) => user.name).join(" · ")}</p>
            <p>Use the left rail to create new root pages and inspect visibility boundaries.</p>
          </div>
        </SidebarPanel>
      )}
    </aside>
  );
}

function SidebarPanel({
  children,
  title,
  defaultOpen = true,
}: {
  children: ReactNode;
  title: string;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <section className="w-full border-b border-stone-200 bg-stone-50">
        <CollapsibleTrigger asChild>
          <button
            className="group flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition hover:bg-stone-100"
            type="button"
          >
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
            </div>
            <span className="mt-0.5 shrink-0 text-stone-400">
              <ChevronDown className="h-4 w-4 group-data-[state=closed]:hidden" />
              <ChevronRight className="hidden h-4 w-4 group-data-[state=closed]:block" />
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          {children}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function InlineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-stone-200 py-2 last:border-none">
      <span className="text-xs text-stone-500">{label}</span>
      <span className="text-xs font-medium text-stone-900">{value}</span>
    </div>
  );
}

function getReadingWords(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/).length;
}

function formatCalendarDay(value: Date) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatUtcTimestamp(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })
    .format(new Date(value))
    .replace(",", " at");
}
