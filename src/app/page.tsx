import { AppSidebar } from "@/components/app-sidebar";
import { EditablePageForm } from "@/components/editable-page-form";
import { RightSidebar } from "@/components/right-sidebar";
import { UserSwitcher } from "@/components/user-switcher";
import { flatten, getKnowledgeBaseView } from "@/lib/knowledge-base";
import { getImpersonatedUserId } from "@/lib/impersonation";
import { TreePalm } from "lucide-react";
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
  const currentWorkspacePages = selectedPage
    ? visibleWorkspaces.find(({ workspace }) => workspace.id === selectedPage.workspaceId)?.pages ?? []
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

  return (
    <main className="h-screen overflow-hidden bg-[#f3f1ea] text-stone-900">
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#f3f1ea] text-stone-900">
              <TreePalm className="h-6 w-6 stroke-[1.25px]" />
            </span>
            <div>
              <h1 className="text-xl font-semibold uppercase ">
                SHVR AI
              </h1>

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
          searchItems={searchItems}
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
                    internalLinkTargets={internalLinkTargets}
                    mentionUsers={mentionUsers}
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
                            p: ({ children }) => (
                              <p className="m-0 px-0 py-1 text-base leading-8 text-stone-700">
                                {children}
                              </p>
                            ),
                            ul: ({ children }) => (
                              <ul className="m-0 list-disc pl-6 text-base leading-8 text-stone-700 [&>li]:py-1 [&>li]:pl-1">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="m-0 list-decimal pl-6 text-base leading-8 text-stone-700 [&>li]:py-1 [&>li]:pl-1">
                                {children}
                              </ol>
                            ),
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
                                    isTask ? "relative min-h-8 list-none py-1 pl-0" : undefined
                                  }
                                >
                                  {children}
                                </li>
                              );
                            },
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
                            blockquote: ({ children }) => (
                              <blockquote className="my-3 border-l-4 border-amber-300 bg-amber-50/70 px-5 py-3 italic text-stone-700">
                                {children}
                              </blockquote>
                            ),
                            hr: () => (
                              <div className="py-6">
                                <hr className="h-0.5 rounded-sm border-none bg-stone-200 bg-clip-content" />
                              </div>
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
                            a: ({ children, href }) => {
                              if (href?.startsWith("mention:")) {
                                const mentionId = decodeURIComponent(href.slice("mention:".length));
                                const isPageMention = mentionId.startsWith("/");

                                if (isPageMention) {
                                  return (
                                    <a
                                      href={`/?page=${mentionId.slice(1)}`}
                                      className="inline-flex items-center rounded-md bg-stone-100 px-1.5 py-0.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-200"
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
                                  href={href}
                                  className="font-medium text-sky-700 underline decoration-sky-700/35 underline-offset-4 transition-colors hover:text-sky-800"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {children}
                                </a>
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

        <RightSidebar
          availableUsers={availableUsers.map((user) => ({ name: user.name }))}
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
          selectedPageRevisions={selectedPageRevisions}
          selectedRevision={selectedRevision}
        />
      </div>
    </main>
  );
}
