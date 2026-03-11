import {
  createPageAction,
  deletePageAction,
} from "@/app/actions";
import { AppSidebar } from "@/components/app-sidebar";
import { EditablePageForm } from "@/components/editable-page-form";
import { UserSwitcher } from "@/components/user-switcher";
import { getKnowledgeBaseView } from "@/lib/knowledge-base";
import { getImpersonatedUserId } from "@/lib/impersonation";
import {
  Clock3,
  FilePlus2,
  LayoutDashboard,
  PanelLeftOpen,
  RefreshCw,
  Shield,
  Sparkles,
} from "lucide-react";
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
    selectedPage,
    selectedPageId,
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
  const privateWorkspace = visibleWorkspaces.find(
    ({ workspace }) =>
      workspace.type === "private" && workspace.ownerUserId === currentUser.id,
  )?.workspace;
  const sharedWorkspace = visibleWorkspaces.find(
    ({ workspace }) => workspace.type === "shared",
  )?.workspace;

  return (
    <main className="h-screen overflow-hidden bg-[#f3f1ea] text-stone-900">
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-stone-950 text-white">
              <LayoutDashboard className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                fa-knowledge-app
              </p>
              <p className="text-sm font-medium text-stone-900">
                Multi-user knowledge base workspace
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <HeaderButton icon={RefreshCw} label="Refresh" href={selectedPageId ? `/?page=${selectedPageId}` : "/"} />
            {privateWorkspace ? (
              <RootCreateButton
                icon={FilePlus2}
                label="Private root"
                workspaceId={privateWorkspace.id}
                title="Quick private note"
                content="# Quick private note\n\nCreated from the global header."
              />
            ) : null}
            {sharedWorkspace ? (
              <RootCreateButton
                icon={Sparkles}
                label="Shared root"
                workspaceId={sharedWorkspace.id}
                title={`Shared note L${currentUser.permissionLevel}`}
                content="# Shared note\n\nCreated from the global header."
                explicitReadLevel={currentUser.permissionLevel}
                explicitWriteLevel={currentUser.permissionLevel}
              />
            ) : null}
          </div>

          <div className="min-w-0">
            <UserSwitcher
              currentUserId={currentUser.id}
              selectedPageId={selectedPageId}
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
          selectedPageId={selectedPageId}
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

              <div className="min-h-0 flex-1 px-5 py-4">
                {selectedPage.canWrite ? (
                  <EditablePageForm
                    key={`form-${selectedPage.id}-${selectedRevision.id}`}
                    currentRevisionId={selectedRevision.id}
                    currentRevisionNumber={selectedRevision.revisionNumber}
                    effectiveReadLevel={selectedPage.effectiveReadLevel}
                    effectiveWriteLevel={selectedPage.effectiveWriteLevel}
                    pageId={selectedPage.id}
                    initialTitle={selectedPage.title}
                    initialEditorDocJson={selectedRevision.editorDocJson}
                    initialMarkdown={selectedRevision.contentMarkdown}
                    workspaceName={currentWorkspace?.name ?? "Workspace"}
                  />
                ) : (
                  <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white shadow-sm">
                    <div className="shrink-0 border-b border-stone-200 px-6 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                            {currentWorkspace?.name ?? "Workspace"}
                          </p>
                          <h2 className="truncate text-2xl font-semibold tracking-tight text-stone-950">
                            {selectedPage.title}
                          </h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill icon={Shield}>
                            Read {selectedPage.effectiveReadLevel ?? "private"}
                          </StatusPill>
                          <StatusPill icon={Shield}>
                            Write {selectedPage.effectiveWriteLevel ?? "private"}
                          </StatusPill>
                          <StatusPill icon={Clock3}>Revision {selectedRevision.revisionNumber}</StatusPill>
                          <StatusPill icon={PanelLeftOpen}>Read only</StatusPill>
                        </div>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
                    <div className="mx-auto max-w-3xl space-y-3">
                      {selectedRevision.contentMarkdown
                        .split("\n")
                        .map((line, index) =>
                          line.startsWith("# ") ? (
                            <h3 key={`${line}-${index}`} className="text-3xl font-semibold tracking-tight">
                              {line.replace("# ", "")}
                            </h3>
                          ) : line ? (
                            <p key={`${line}-${index}`} className="text-base leading-8 text-stone-700">
                              {line}
                            </p>
                          ) : (
                            <div key={`spacer-${index}`} className="h-2" />
                          ),
                        )}
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

        <aside className="min-h-0 overflow-y-auto border-l border-stone-200 bg-white p-4">
          {selectedPage && selectedRevision ? (
            <div className="space-y-4">
              <SidebarPanel
                title="Page overview"
                body={`${selectedPage.canWrite ? "Writable" : "Read only"} page in ${currentWorkspace?.name ?? "workspace"}.`}
              >
                <div className="grid gap-2 text-sm text-stone-600">
                  <InlineMetric label="Current revision" value={String(selectedRevision.revisionNumber)} />
                  <InlineMetric label="Visible revisions" value={String(selectedPageRevisions.length)} />
                  <InlineMetric label="Read level" value={String(selectedPage.effectiveReadLevel ?? "private")} />
                  <InlineMetric label="Write level" value={String(selectedPage.effectiveWriteLevel ?? "private")} />
                </div>
              </SidebarPanel>

              {selectedPage.canWrite ? (
                <>
                  <SidebarPanel title="Danger zone" body="Deleting a page removes its subtree and all revisions.">
                    <form action={deletePageAction}>
                      <input type="hidden" name="pageId" value={selectedPage.id} />
                      <button type="submit" className="w-full rounded-xl bg-red-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-800">
                        Delete page
                      </button>
                    </form>
                  </SidebarPanel>
                </>
              ) : null}

              <SidebarPanel title="Recent revisions" body="Newest snapshots are listed first.">
                <div className="space-y-2">
                  {selectedPageRevisions.slice(0, 6).map((revision) => (
                    <div key={revision.id} className="rounded-xl bg-stone-50 px-3 py-3 text-sm">
                      <p className="font-medium text-stone-900">
                        Revision {revision.revisionNumber}
                      </p>
                      <p className="mt-1 text-stone-600">{revision.titleSnapshot}</p>
                      <p className="mt-2 text-xs text-stone-500">
                        {revision.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </SidebarPanel>
            </div>
          ) : (
            <SidebarPanel
              title="Workspace status"
              body={`Available identities: ${availableUsers.map((user) => user.name).join(" · ")}`}
            >
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

function HeaderButton({
  href,
  icon: Icon,
  label,
  muted = false,
}: {
  href?: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  muted?: boolean;
}) {
  return (
    <a
      href={href ?? "#"}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
        muted
          ? "border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-900"
          : "border-stone-300 bg-stone-950 text-white hover:bg-stone-800"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </a>
  );
}

function RootCreateButton({
  content,
  explicitReadLevel,
  explicitWriteLevel,
  icon: Icon,
  label,
  title,
  workspaceId,
}: {
  content: string;
  explicitReadLevel?: number;
  explicitWriteLevel?: number;
  icon: ComponentType<{ className?: string }>;
  label: string;
  title: string;
  workspaceId: string;
}) {
  return (
    <form action={createPageAction}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="parentPageId" value="" />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="contentMarkdown" value={content} />
      {typeof explicitReadLevel === "number" ? (
        <input type="hidden" name="explicitReadLevel" value={String(explicitReadLevel)} />
      ) : null}
      {typeof explicitWriteLevel === "number" ? (
        <input type="hidden" name="explicitWriteLevel" value={String(explicitWriteLevel)} />
      ) : null}
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-stone-950 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-stone-800"
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </button>
    </form>
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
  body,
  children,
  title,
}: {
  body: string;
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-stone-600">{body}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InlineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5">
      <span className="text-stone-500">{label}</span>
      <span className="font-medium text-stone-900">{value}</span>
    </div>
  );
}
