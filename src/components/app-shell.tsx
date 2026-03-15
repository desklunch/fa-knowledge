"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { TreePalm } from "lucide-react";
import { useState } from "react";

type AppShellProps = {
  children: React.ReactNode;
  currentUser: {
    id: string;
    name: string;
    permissionLevel: number;
    userType: string;
  };
  searchItems: {
    href: string;
    id: string;
    title: string;
    workspaceLabel: string;
    workspaceType: "private" | "shared";
  }[];
  selectedPageId: string | null;
  userSwitcher: React.ReactNode;
  visibleWorkspaces: {
    workspace: {
      id: string;
      name: string;
      type: "private" | "shared";
      ownerUserId: string | null;
    };
    pages: import("@/lib/knowledge-base").VisiblePageNode[];
  }[];
};

export function AppShell({
  children,
  currentUser,
  searchItems,
  selectedPageId,
  userSwitcher,
  visibleWorkspaces,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-[#f3f1ea] text-stone-900 ">
      <header className="shrink-0 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-3">
            <Button
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="h-9 w-9 rounded-md"
              onClick={() => setSidebarCollapsed((current) => !current)}
              size="icon"
              type="button"
              variant="secondary"
            >
              <TreePalm className="h-6 w-6 stroke-[1.25px]" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold uppercase ">SHVR AI</h1>
            </div>
          </div>

          <div className="min-w-0">{userSwitcher}</div>
        </div>
      </header>

      <div
        className="grid min-h-0 flex-1"
        style={{ gridTemplateColumns: sidebarCollapsed ? "48px minmax(0,1fr)" : "280px minmax(0,1fr)" }}
      >
        <AppSidebar
          collapsed={sidebarCollapsed}
          currentUser={currentUser}
          searchItems={searchItems}
          selectedPageId={selectedPageId}
          visibleWorkspaces={visibleWorkspaces}
        />
        <div className="min-h-0 min-w-0">{children}</div>
      </div>
    </main>
  );
}
