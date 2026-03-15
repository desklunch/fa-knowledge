import { AppDndProvider } from "@/components/app-dnd-provider";
import { AgentRail } from "@/components/agent-rail";
import { TreePalm } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { RecentView } from "@/components/recent-view";
import { UserSwitcher } from "@/components/user-switcher";
import { getAgentThread } from "@/lib/agent";
import { flatten, getKnowledgeBaseView } from "@/lib/knowledge-base";
import { getImpersonatedUserId } from "@/lib/impersonation";

export default async function RecentPage() {
  const impersonatedUserId = await getImpersonatedUserId();
  const {
    availableUsers,
    currentUser,
    recentActivity,
    visibleWorkspaces,
  } = await getKnowledgeBaseView({
    userId: impersonatedUserId,
  });

  if (!currentUser) {
    throw new Error("No users are available for impersonation.");
  }

  const agentThread = await getAgentThread({ actingUserId: currentUser.id });

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
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-[#f3f1ea] text-stone-900">
      <AppDndProvider>
        <header className="shrink-0 border-b border-stone-200 bg-white/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-4 px-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#f3f1ea] text-stone-900">
                <TreePalm className="h-6 w-6 stroke-[1.25px]" />
              </span>
              <div>
                <h1 className="text-xl font-semibold uppercase">SHVR AI</h1>
              </div>
            </div>

            <div className="min-w-0">
              <UserSwitcher currentUserId={currentUser.id} selectedPageId={null} users={availableUsers} />
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_400px] overflow-hidden">
          <div className="grid min-h-0 min-w-0 grid-cols-[280px_minmax(0,1fr)] overflow-hidden">
            <AppSidebar
              currentUser={{
                id: currentUser.id,
                name: currentUser.name,
                permissionLevel: currentUser.permissionLevel,
                userType: currentUser.userType,
              }}
              searchItems={searchItems}
              selectedPageId={null}
              visibleWorkspaces={visibleWorkspaces}
            />

            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#fbfaf7]">
              <RecentView recentActivity={recentActivity} />
            </div>
          </div>
          <AgentRail initialThread={agentThread} selectedPageAttachment={null} />
        </div>
      </AppDndProvider>
    </main>
  );
}
