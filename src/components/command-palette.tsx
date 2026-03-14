"use client";

import { Command as CommandPrimitive } from "cmdk";
import { FilePlus2, History, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RECENT_PAGES_STORAGE_KEY = "fa-knowledge-recent-pages";
const MAX_RECENT_PAGES = 8;

export type CommandPalettePageItem = {
  href: string;
  id: string;
  snippet?: string;
  title: string;
  workspaceLabel: string;
  workspaceType: "private" | "shared";
};

type CommandPaletteProps = {
  currentWorkspaceOptions: {
    personal: {
      id: string;
      label: string;
      workspaceType: "private";
    } | null;
    shared: {
      id: string;
      label: string;
      workspaceType: "shared";
    } | null;
  };
  items: CommandPalettePageItem[];
  onCreatePage: (input: {
    title: string;
    workspaceId: string;
    workspaceType: "private" | "shared";
  }) => Promise<void>;
  onNavigate: (href: string) => void;
  selectedPageId: string | null;
};

export function CommandPalette({
  currentWorkspaceOptions,
  items,
  onCreatePage,
  onNavigate,
  selectedPageId,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentPageIds, setRecentPageIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<CommandPalettePageItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(RECENT_PAGES_STORAGE_KEY);

      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as string[];
      setRecentPageIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRecentPageIds([]);
    }
  }, []);

  useEffect(() => {
    if (!selectedPageId || typeof window === "undefined") {
      return;
    }

    setRecentPageIds((current) => {
      const next = [selectedPageId, ...current.filter((id) => id !== selectedPageId)].slice(
        0,
        MAX_RECENT_PAGES,
      );
      window.localStorage.setItem(RECENT_PAGES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [selectedPageId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      setRemoteResults([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open]);

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 3) {
      setDebouncedQuery("");
      setRemoteResults([]);
      setIsSearching(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(normalizedQuery);
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      return;
    }

    const abortController = new AbortController();

    const fetchResults = async () => {
      setIsSearching(true);

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error("Search failed.");
        }

        const payload = (await response.json()) as {
          results: CommandPalettePageItem[];
        };
        setRemoteResults(payload.results);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setRemoteResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    };

    void fetchResults();

    return () => {
      abortController.abort();
    };
  }, [debouncedQuery]);

  const recentItems = useMemo(() => {
    return recentPageIds
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is CommandPalettePageItem => Boolean(item))
      .slice(0, 6);
  }, [items, recentPageIds]);

  const quickCreateTitle = query.trim();
  const canQuickCreate = quickCreateTitle.length > 0;

  const runCreate = async (input: {
    title: string;
    workspaceId: string;
    workspaceType: "private" | "shared";
  }) => {
    setIsCreating(true);

    try {
      await onCreatePage(input);
      setOpen(false);
      setQuery("");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Button
        className="w-full justify-between "
        onClick={() => setOpen(true)}
        size="default"
        type="button"
        variant="secondary"
      >
        <span className="flex items-center gap-2 text-stone-400">
          <Search className="h-4 w-4" />
          Search
        </span>
        <span className="rounded-sm bg-stone-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-500">
          {typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac")
            ? "⌘K"
            : "Ctrl+K"}
        </span>
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-stone-950/20 px-4 pt-[12vh] backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setOpen(false)}
            role="button"
            tabIndex={-1}
          />
          <CommandPrimitive
            className="relative z-10 flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_24px_80px_-32px_rgba(28,25,23,0.45)]"
            shouldFilter={false}
          >
            <div className="flex items-center gap-3 border-b border-stone-200 px-4 py-3">
              <Search className="h-4 w-4 text-stone-400" />
              <CommandPrimitive.Input
                autoFocus
                className="h-8 flex-1 border-0 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
                ref={inputRef}
                onValueChange={setQuery}
                placeholder="Search pages, jump around, or create something new..."
                value={query}
              />
            </div>

            <CommandPrimitive.List className="max-h-[calc(70vh-57px)] overflow-y-auto p-2">
              {canQuickCreate ? (
                <CommandGroup heading="Create">
                  {currentWorkspaceOptions.personal ? (
                    <CommandActionItem
                      disabled={isCreating}
                      icon={<FilePlus2 className="h-4 w-4" />}
                      keywords={`${quickCreateTitle} private personal`}
                      onSelect={() =>
                        void runCreate({
                          title: quickCreateTitle,
                          workspaceId: currentWorkspaceOptions.personal!.id,
                          workspaceType: "private",
                        })
                      }
                      value={`create-personal-${quickCreateTitle}`}
                    >
                      Create <span className="font-medium">{quickCreateTitle}</span> in{" "}
                      {currentWorkspaceOptions.personal.label}
                    </CommandActionItem>
                  ) : null}

                  {currentWorkspaceOptions.shared ? (
                    <CommandActionItem
                      disabled={isCreating}
                      icon={<Sparkles className="h-4 w-4" />}
                      keywords={`${quickCreateTitle} shared`}
                      onSelect={() =>
                        void runCreate({
                          title: quickCreateTitle,
                          workspaceId: currentWorkspaceOptions.shared!.id,
                          workspaceType: "shared",
                        })
                      }
                      value={`create-shared-${quickCreateTitle}`}
                    >
                      Create <span className="font-medium">{quickCreateTitle}</span> in{" "}
                      {currentWorkspaceOptions.shared.label}
                    </CommandActionItem>
                  ) : null}
                </CommandGroup>
              ) : null}

              {query.trim().length >= 3 ? (
                <CommandGroup heading="Pages">
                  {isSearching ? (
                    <CommandEmptyState message="Searching visible knowledge…" />
                  ) : remoteResults.length > 0 ? (
                    remoteResults.map((item) => (
                      <CommandPageItem
                        item={item}
                        key={item.id}
                        onSelect={() => {
                          onNavigate(item.href);
                          setOpen(false);
                        }}
                      />
                    ))
                  ) : (
                    <CommandEmptyState message="No matching pages in your visible knowledge base." />
                  )}
                </CommandGroup>
              ) : query.trim().length > 0 ? (
                <CommandGroup heading="Pages">
                  <CommandEmptyState message="Keep typing to search. Enter at least 3 characters." />
                </CommandGroup>
              ) : (
                <>
                  <CommandGroup heading="Recent">
                    {recentItems.length > 0 ? (
                      recentItems.map((item) => (
                        <CommandPageItem
                          item={item}
                          key={item.id}
                          onSelect={() => {
                            onNavigate(item.href);
                            setOpen(false);
                          }}
                          prefixIcon={<History className="h-4 w-4" />}
                        />
                      ))
                    ) : (
                      <CommandEmptyState message="Open a few pages and they’ll appear here." />
                    )}
                  </CommandGroup>

                  <CommandGroup heading="Pages">
                    {items.slice(0, 10).map((item) => (
                      <CommandPageItem
                        item={item}
                        key={item.id}
                        onSelect={() => {
                          onNavigate(item.href);
                          setOpen(false);
                        }}
                      />
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </div>
      ) : null}
    </>
  );
}

function CommandGroup({
  children,
  heading,
}: {
  children: React.ReactNode;
  heading: string;
}) {
  return (
    <CommandPrimitive.Group className="mb-2 overflow-hidden rounded-xl border border-stone-100 bg-stone-50/40 p-1">
      <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        {heading}
      </div>
      {children}
    </CommandPrimitive.Group>
  );
}

function CommandPageItem({
  item,
  onSelect,
  prefixIcon,
}: {
  item: CommandPalettePageItem;
  onSelect: () => void;
  prefixIcon?: React.ReactNode;
}) {
  return (
    <CommandPrimitive.Item
      className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-sm text-stone-700 outline-none data-[selected=true]:bg-white data-[selected=true]:text-stone-950"
      onSelect={onSelect}
      value={`${item.title} ${item.workspaceLabel}`}
    >
      <div className="mt-0.5 text-stone-400">{prefixIcon ?? <Search className="h-4 w-4" />}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-stone-900">{item.title}</div>
        <div className="truncate text-xs text-stone-500">
          {item.workspaceLabel}
          {item.snippet ? ` · ${item.snippet}` : ""}
        </div>
      </div>
    </CommandPrimitive.Item>
  );
}

function CommandActionItem({
  children,
  disabled,
  icon,
  keywords,
  onSelect,
  value,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  icon: React.ReactNode;
  keywords?: string;
  onSelect: () => void;
  value: string;
}) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-700 outline-none data-[selected=true]:bg-white data-[selected=true]:text-stone-950",
        disabled && "pointer-events-none opacity-50",
      )}
      keywords={keywords ? [keywords] : undefined}
      onSelect={onSelect}
      value={value}
    >
      <div className="text-stone-400">{icon}</div>
      <div className="min-w-0 flex-1 truncate">{children}</div>
    </CommandPrimitive.Item>
  );
}

function CommandEmptyState({ message }: { message: string }) {
  return (
    <div className="px-3 py-4 text-sm text-stone-500">
      {message}
    </div>
  );
}
