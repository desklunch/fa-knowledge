import { AppDndProvider } from "@/components/app-dnd-provider";
import { AgentRail } from "@/components/agent-rail";
import { AppShell } from "@/components/app-shell";
import { EditablePageForm } from "@/components/editable-page-form";
import { RightSidebar } from "@/components/right-sidebar";
import {
  RightSidebarLayout,
  RightSidebarToggleButton,
} from "@/components/right-sidebar-layout";
import { UserSwitcher } from "@/components/user-switcher";
import { getAgentThread } from "@/lib/agent";
import { flatten, getKnowledgeBaseView } from "@/lib/knowledge-base";
import { getImpersonatedUserId } from "@/lib/impersonation";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
    selectedPageBacklinks,
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
    ? (visibleWorkspaces.find(
        ({ workspace }) => workspace.id === selectedPage.workspaceId,
      )?.workspace ?? null)
    : null;
  const currentWorkspacePages = selectedPage
    ? (visibleWorkspaces.find(
        ({ workspace }) => workspace.id === selectedPage.workspaceId,
      )?.pages ?? [])
    : [];

  const internalLinkTargets = flatten(currentWorkspacePages)
    .filter((page) => page.id !== selectedPage?.id)
    .map((page) => ({
      depth: page.depth,
      href: `/?page=${page.id}`,
      pageId: page.id,
      title: page.title,
    }));

  const mentionUsers = availableUsers.map((user) => ({
    id: user.id,
    name: user.name,
  }));

  const searchItems = visibleWorkspaces.flatMap(({ workspace, pages }) =>
    flatten(pages).map((page) => ({
      href: `/?page=${page.id}`,
      id: page.id,
      title: page.title,
      workspaceLabel: workspace.type === "private" ? "Personal" : "Shared",
      workspaceType: workspace.type,
    })),
  );

  const rightSidebar = (
    <RightSidebar
      availableUsers={availableUsers.map((user) => ({
        id: user.id,
        name: user.name,
      }))}
      currentWorkspaceType={currentWorkspace?.type ?? "shared"}
      selectedDraft={
        selectedDraft
          ? {
              contentMarkdown: selectedDraft.contentMarkdown,
              title: selectedDraft.title,
            }
          : null
      }
      selectedPage={selectedPage}
      selectedPageBacklinks={selectedPageBacklinks}
      selectedPageRevisions={selectedPageRevisions}
      selectedRevision={selectedRevision}
    />
  );

  const agentThread = await getAgentThread({ actingUserId: currentUser.id });
  const selectedPageAttachment = selectedPage
    ? {
        entityId: selectedPage.id,
        entityType: "page" as const,
        href: `/?page=${selectedPage.id}`,
        label: selectedPage.title,
      }
    : null;

  return (
    <AppDndProvider>
      <AppShell
        currentUser={{
          id: currentUser.id,
          name: currentUser.name,
          permissionLevel: currentUser.permissionLevel,
          userType: currentUser.userType,
        }}
        searchItems={searchItems}
        selectedPageId={selectedPage?.id ?? null}
        userSwitcher={
          <UserSwitcher
            currentUserId={currentUser.id}
            selectedPageId={selectedPage?.id ?? null}
            users={availableUsers}
          />
        }
        visibleWorkspaces={visibleWorkspaces}
      >
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_400px] overflow-hidden">
          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#fbfaf7]">
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

                <div className="min-h-0 flex-1">
                  {selectedPage.canWrite ? (
                    <EditablePageForm
                      key={`form-${selectedPage.id}-${selectedRevision.id}`}
                      currentRevisionId={selectedRevision.id}
                      initialEditorDocJson={
                        selectedDraft?.editorDocJson ?? selectedRevision.editorDocJson
                      }
                      initialMarkdown={
                        selectedDraft?.contentMarkdown ?? selectedRevision.contentMarkdown
                      }
                      initialTitle={selectedDraft?.title ?? selectedPage.title}
                      internalLinkTargets={internalLinkTargets}
                      mentionUsers={mentionUsers}
                      pageId={selectedPage.id}
                      rightSidebar={rightSidebar}
                    />
                  ) : (
                    <RightSidebarLayout
                      header={
                        <div className="border-b border-stone-200 bg-white px-6 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <h2 className="truncate text-2xl font-semibold tracking-tight text-stone-950">
                                {selectedPage.title}
                              </h2>
                            </div>
                            <RightSidebarToggleButton />
                          </div>
                        </div>
                      }
                      rightSidebar={rightSidebar}
                    >
                      <article className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
                        <div className="mx-auto max-w-3xl">
                          <ReactMarkdown
                            components={{
                              a: ({ children, href }) => {
                                if (href?.startsWith("mention:")) {
                                  const mentionId = decodeURIComponent(
                                    href.slice("mention:".length),
                                  );
                                  const isPageMention = mentionId.startsWith("/");

                                  if (isPageMention) {
                                    return (
                                      <a
                                        className="inline-flex items-center rounded-md bg-stone-100 px-1.5 py-0.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-200"
                                        href={`/?page=${mentionId.slice(1)}`}
                                      >
                                        {children}
                                      </a>
                                    );
                                  }

                                  return (
                                    <span className="inline-flex items-center rounded-md bg-stone-100 px-1.5 py-0.5 text-sm font-medium text-stone-700">
                                      {children}
                                    </span>
                                  );
                                }

                                return (
                                  <a
                                    className="font-medium text-sky-700 underline decoration-sky-700/35 underline-offset-4 transition-colors hover:text-sky-800"
                                    href={href}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    {children}
                                  </a>
                                );
                              },
                              blockquote: ({ children }) => (
                                <blockquote className="my-3 border-l-4 border-amber-300 bg-amber-50/70 px-5 py-3 italic text-stone-700">
                                  {children}
                                </blockquote>
                              ),
                              code: ({ children, className }) => {
                                const isBlock = Boolean(className);

                                return isBlock ? (
                                  <code className="block overflow-x-auto rounded-2xl bg-stone-950 px-4 py-3 font-mono text-sm leading-[1.65] text-stone-100">
                                    {children}
                                  </code>
                                ) : (
                                  <code className="whitespace-pre-wrap rounded-md bg-stone-100 px-[0.3em] py-[0.2em] font-mono text-sm text-stone-900">
                                    {children}
                                  </code>
                                );
                              },
                              h1: ({ children }) => (
                                <h1 className="relative mb-1 mt-[1.6em] pb-1 text-5xl font-semibold tracking-tight text-stone-950 first:mt-0">
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="relative mb-1 mt-[1.35em] pb-px text-3xl font-semibold tracking-tight text-stone-950 first:mt-0">
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="relative mb-1 mt-[1em] pb-px text-2xl font-semibold tracking-tight text-stone-950 first:mt-0">
                                  {children}
                                </h3>
                              ),
                              hr: () => (
                                <div className="py-6">
                                  <hr className="h-0.5 rounded-sm border-none bg-stone-200 bg-clip-content" />
                                </div>
                              ),
                              input: ({ checked, type }) => {
                                if (type !== "checkbox") {
                                  return null;
                                }

                                return (
                                  <input
                                    checked={checked}
                                    className="-ml-7 mr-3 inline-block size-4 rounded border border-stone-300 bg-white align-middle accent-stone-900 shadow-sm"
                                    disabled
                                    readOnly
                                    type="checkbox"
                                  />
                                );
                              },
                              li: ({ children }) => {
                                const isTask =
                                  Array.isArray(children) &&
                                  children.some(
                                    (child) =>
                                      React.isValidElement(child) &&
                                      child.type === "input",
                                  );

                                return (
                                  <li
                                    className={
                                      isTask
                                        ? "relative min-h-8 list-none py-1 pl-0"
                                        : undefined
                                    }
                                  >
                                    {children}
                                  </li>
                                );
                              },
                              ol: ({ children }) => (
                                <ol className="m-0 list-decimal pl-6 text-base leading-8 text-stone-700 [&>li]:py-1 [&>li]:pl-1">
                                  {children}
                                </ol>
                              ),
                              p: ({ children }) => (
                                <p className="m-0 px-0 py-1 text-base leading-8 text-stone-700">
                                  {children}
                                </p>
                              ),
                              pre: ({ children }) => <div className="mt-4">{children}</div>,
                              ul: ({ children }) => (
                                <ul className="m-0 list-disc pl-6 text-base leading-8 text-stone-700 [&>li]:py-1 [&>li]:pl-1">
                                  {children}
                                </ul>
                              ),
                            }}
                            remarkPlugins={[remarkGfm]}
                          >
                            {selectedRevision.contentMarkdown}
                          </ReactMarkdown>
                        </div>
                      </article>
                    </RightSidebarLayout>
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
                    Choose a page from the left workspace rail or create a new root page to start
                    writing.
                  </p>
                </div>
              </div>
            )}
          </section>

          <AgentRail
            initialThread={agentThread}
            selectedPageAttachment={selectedPageAttachment}
          />
        </div>
      </AppShell>
    </AppDndProvider>
  );
}
