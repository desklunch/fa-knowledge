"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

const STORAGE_KEY = "fa-knowledge-right-sidebar-collapsed";

type RightSidebarLayoutContextValue = {
  collapsed: boolean;
  toggle: () => void;
};

const RightSidebarLayoutContext = createContext<RightSidebarLayoutContextValue | null>(null);

export function RightSidebarLayout({
  header,
  children,
  rightSidebar,
}: {
  header?: ReactNode;
  children: ReactNode;
  rightSidebar: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  const value = useMemo(
    () => ({
      collapsed,
      toggle: () => setCollapsed((current) => !current),
    }),
    [collapsed],
  );

  return (
    <RightSidebarLayoutContext.Provider value={value}>
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        {header ? <div className="shrink-0">{header}</div> : null}
        <div
          className={cn(
            "grid min-h-0 min-w-0 flex-1 transition-[grid-template-columns]",
            collapsed
              ? "grid-cols-[minmax(0,1fr)_0px]"
              : "grid-cols-[minmax(0,1fr)_320px]",
          )}
        >
          <div className="flex min-h-0 min-w-0 flex-col">{children}</div>
          <div
            className={cn(
              "h-full min-h-0 min-w-0 transition-[width,opacity]",
              collapsed
                ? "w-0 overflow-hidden border-l-0 opacity-0"
                : "w-[320px] border-l border-stone-200 opacity-100",
            )}
          >
            {rightSidebar}
          </div>
        </div>
      </div>
    </RightSidebarLayoutContext.Provider>
  );
}

export function RightSidebarToggleButton() {
  const context = useContext(RightSidebarLayoutContext);

  if (!context) {
    return null;
  }

  return (
    <Button
      aria-label={context.collapsed ? "Expand right sidebar" : "Collapse right sidebar"}
      onClick={context.toggle}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      {context.collapsed ? (
        <PanelRightOpen className="h-4 w-4" />
      ) : (
        <PanelRightClose className="h-4 w-4" />
      )}
    </Button>
  );
}
