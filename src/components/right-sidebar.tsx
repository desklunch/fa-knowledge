import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PageMetadataForm } from "@/components/page-metadata-form";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type DraftSnapshot = {
  contentMarkdown: string;
  title: string;
} | null;

type RevisionSummary = {
  createdAt: Date;
  id: string;
  revisionNumber: number;
};

type SelectedRevision = {
  contentMarkdown: string;
  revisionNumber: number;
};

type SelectedPage = {
  canWrite: boolean;
  explicitReadLevel: number | null;
  explicitWriteLevel: number | null;
  id: string;
  parentPageId: string | null;
  title: string;
};

type RightSidebarProps = {
  availableUsers: Array<{ name: string }>;
  currentWorkspaceType: "private" | "shared";
  selectedDraft: DraftSnapshot;
  selectedPage: SelectedPage | null;
  selectedPageRevisions: RevisionSummary[];
  selectedRevision: SelectedRevision | null;
};

export function RightSidebar({
  availableUsers,
  currentWorkspaceType,
  selectedDraft,
  selectedPage,
  selectedPageRevisions,
  selectedRevision,
}: RightSidebarProps) {
  return (
    <aside className="min-h-0 overflow-y-auto border-l border-stone-200 bg-[#f7f5ef]">
      {selectedPage && selectedRevision ? (
        <div>
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
            </div>
          </SidebarPanel>

          <SidebarPanel title="Permissions">
            <PageMetadataForm
              canWrite={selectedPage.canWrite}
              explicitReadLevel={selectedPage.explicitReadLevel}
              explicitWriteLevel={selectedPage.explicitWriteLevel}
              hasParent={selectedPage.parentPageId !== null}
              pageId={selectedPage.id}
              workspaceType={currentWorkspaceType}
            />
          </SidebarPanel>

          <SidebarPanel title="Recent revisions">
            <div>
              {selectedPageRevisions.slice(0, 6).map((revision) => (
                <div
                  className="flex items-center justify-between border-b border-stone-200 py-2 text-sm last:border-none"
                  key={revision.id}
                >
                  <p className="text-xs font-medium text-stone-900">
                    Revision {revision.revisionNumber}
                  </p>
                  <p className="text-xs text-stone-500">
                    {revision.createdAt.toLocaleDateString()}
                  </p>
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
