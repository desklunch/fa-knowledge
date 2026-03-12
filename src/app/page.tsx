import { AppSidebar } from "@/components/app-sidebar";
import { EditablePageForm } from "@/components/editable-page-form";
import { PageMetadataForm } from "@/components/page-metadata-form";
import { UserSwitcher } from "@/components/user-switcher";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getKnowledgeBaseView } from "@/lib/knowledge-base";
import { getImpersonatedUserId } from "@/lib/impersonation";
import {
  Clock3,
  ChevronDown,
  ChevronRight,
  TreePalm,
  PanelLeftOpen,
  Shield,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ComponentType, ReactNode } from "react";

type HomeProps = {
  searchParams: Promise<{
    page?: string;
    status?: string;
    message?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const impersonatedUserId = await getImpersonatedUserId();
  const {
    availableUsers,
    currentUser,
    selectedDraft,
    selectedPage,
    selectedPageRevisions,
    selectedRevision,
    visibleWorkspaces,
  } = await getKnowledgeBaseView({
    userId: impersonatedUserId,
    pageId: params.page,
  });

  if (!currentUser) {
    throw new Error("No users are available for impersonation.");
  }

  const currentWorkspace = selectedPage
    ? visibleWorkspaces.find(({ workspace }) => workspace.id === selectedPage.workspaceId)?.workspace ??
      null
    : null;
  return (
    <main className="h-screen overflow-hidden bg-[#f3f1ea] text-stone-900">
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#f3f1ea] text-stone-600">
              <TreePalm className="h-6 w-6 stroke-[1.25px]" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-600">
                fa-knowledge-app
              </p>

            </div>
          </div>

          <div className="min-w-0">
            <UserSwitcher
              currentUserId={currentUser.id}
              selectedPageId={selectedPage?.id ?? null}
              users={availableUsers}
            />
          </div>
        </div>
      </header>

      <div className="grid h-[calc(100vh-56px)] min-h-0 grid-cols-[280px_minmax(0,1fr)_320px]">
        <AppSidebar
          currentUser={{
            id: currentUser.id,
            name: currentUser.name,
            permissionLevel: currentUser.permissionLevel,
            userType: currentUser.userType,
          }}
          selectedPageId={selectedPage?.id ?? null}
          visibleWorkspaces={visibleWorkspaces}
        />

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#fbfaf7]">
          {selectedPage && selectedRevision ? (
            <>
              {params.message ? (
                <div
                  className={`mx-5 mt-4 rounded-2xl border px-4 py-3 text-sm ${
                    params.status === "error"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800"
                  }`}
                >
                  {params.message}
                </div>
              ) : null}

              <div className="min-h-0 flex-1 ">
                {selectedPage.canWrite ? (
                  <EditablePageForm
                    key={`form-${selectedPage.id}-${selectedRevision.id}`}
                    currentRevisionId={selectedRevision.id}
                    pageId={selectedPage.id}
                    initialTitle={selectedDraft?.title ?? selectedPage.title}
                    initialEditorDocJson={
                      selectedDraft?.editorDocJson ?? selectedRevision.editorDocJson
                    }
                    initialMarkdown={
                      selectedDraft?.contentMarkdown ?? selectedRevision.contentMarkdown
                    }
                  />
                ) : (
                  <article className="flex m-4 h-full min-h-0 flex-col overflow-hidden rounded-lg max-w-4xl mx-auto border border-stone-200 bg-white shadow-sm">
                    <div className="shrink-0 border-b border-stone-200 px-6 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0">
        
                          <h2 className="truncate text-2xl font-semibold tracking-tight text-stone-950">
                            {selectedPage.title}
                          </h2>
                      
                  
                        </div>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
                      <div className="mx-auto max-w-3xl">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => (
                              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-stone-950 first:mt-0">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="mt-6 text-3xl font-semibold tracking-tight text-stone-950 first:mt-0">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-stone-950 first:mt-0">
                                {children}
                              </h3>
                            ),
                            p: ({ children }) => (
                              <p className="mt-4 text-base leading-8 text-stone-700 first:mt-0">
                                {children}
                              </p>
                            ),
                            ul: ({ children }) => (
                              <ul className="mt-4 list-disc space-y-2 pl-6 text-base leading-8 text-stone-700">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="mt-4 list-decimal space-y-2 pl-6 text-base leading-8 text-stone-700">
                                {children}
                              </ol>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="mt-4 border-l-4 border-stone-300 pl-4 italic text-stone-600">
                                {children}
                              </blockquote>
                            ),
                            code: ({ children, className }) => {
                              const isBlock = Boolean(className);

                              return isBlock ? (
                                <code className="block overflow-x-auto rounded-xl bg-stone-950 px-4 py-3 text-sm text-stone-100">
                                  {children}
                                </code>
                              ) : (
                                <code className="rounded bg-stone-100 px-1.5 py-0.5 text-sm text-stone-900">
                                  {children}
                                </code>
                              );
                            },
                            pre: ({ children }) => <div className="mt-4">{children}</div>,
                          }}
                        >
                          {selectedRevision.contentMarkdown}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </article>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <div className="max-w-md rounded-[1.75rem] border border-stone-200 bg-white p-8 text-center shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
                  No page selected
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-stone-950">
                  No visible page selected for this user.
                </h2>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  Choose a page from the left workspace rail or create a new root page
                  to start writing.
                </p>
              </div>
            </div>
          )}
        </section>

        <aside className="min-h-0 overflow-y-auto border-l border-stone-200 bg-[#f7f5ef]">
          {selectedPage && selectedRevision ? (
            <div>
              <SidebarPanel title="Page overview">
                <div className="grid gap-2 text-sm text-stone-600">
                  <InlineMetric label="Title" value={selectedDraft?.title ?? selectedPage.title} />
                  <InlineMetric label="Current revision" value={String(selectedRevision.revisionNumber)} />
                  <InlineMetric label="Visible revisions" value={String(selectedPageRevisions.length)} />
                  <InlineMetric
                    label="Reading time"
                    value={`${Math.max(1, Math.ceil(getReadingWords((selectedDraft?.contentMarkdown ?? selectedRevision.contentMarkdown)) / 220))} min`}
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
                  workspaceType={currentWorkspace?.type ?? "shared"}
                />
              </SidebarPanel>

             
              <SidebarPanel title="Recent revisions">
                <div className="">
                  {selectedPageRevisions.slice(0, 6).map((revision) => (
                    <div key={revision.id} className=" bg-stone-50  py-2 text-sm border-b border-stone-200 flex items-center justify-between last:border-none">
                      
                      <p className="text-xs font-medium text-stone-900">
                        Revision {revision.revisionNumber}
                      </p>
                      <p className="text-xs text-stone-500">
                        {revision.createdAt.toLocaleDateString()}
                      </p>
                      {/* <p className="text-stone-600">{revision.titleSnapshot}</p> */}
              
                    </div>
                  ))}
                </div>
              </SidebarPanel>
            </div>
          ) : (
            <SidebarPanel title="Workspace status">
              <div className="space-y-2 text-sm text-stone-600">
                <p>Private and shared spaces are both active in this session.</p>
                <p>Use the left rail to create new root pages and inspect visibility boundaries.</p>
              </div>
            </SidebarPanel>
          )}
        </aside>
      </div>
    </main>
  );
}

function StatusPill({
  children,
  icon: Icon,
}: {
  children: ReactNode;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
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
    <div className="flex items-center justify-between py-2 border-b border-stone-200 last:border-none">
      <span className=" text-xs text-stone-500">{label}</span>
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
