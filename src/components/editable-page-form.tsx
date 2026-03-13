"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PageEditor } from "@/components/page-editor";

type SaveState = "saved" | "saving" | "unsaved" | "error";

type EditablePageFormProps = {
  initialEditorDocJson: unknown;
  initialMarkdown: string;
  initialTitle: string;
  currentRevisionId: string;
  internalLinkTargets: Array<{
    depth: number;
    href: string;
    pageId: string;
    title: string;
  }>;
  mentionUsers: Array<{
    id: string;
    name: string;
  }>;
  pageId: string;
};

export function EditablePageForm({
  currentRevisionId,
  initialEditorDocJson,
  initialMarkdown,
  initialTitle,
  internalLinkTargets,
  mentionUsers,
  pageId,
}: EditablePageFormProps) {
  const router = useRouter();
  const [editorSessionId] = useState(() => crypto.randomUUID());
  const initialEditorDocJsonString = useMemo(
    () => stringifyEditorDocJson(initialEditorDocJson),
    [initialEditorDocJson],
  );

  const [title, setTitle] = useState(initialTitle);
  const [contentMarkdown, setContentMarkdown] = useState(initialMarkdown);
  const [editorDocJson, setEditorDocJson] = useState(initialEditorDocJsonString);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [savedContentMarkdown, setSavedContentMarkdown] = useState(initialMarkdown);
  const [savedEditorDocJson, setSavedEditorDocJson] = useState(initialEditorDocJsonString);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [revisionId, setRevisionId] = useState(currentRevisionId);

  const isDirty =
    title !== savedTitle ||
    contentMarkdown !== savedContentMarkdown ||
    editorDocJson !== savedEditorDocJson;

  const persistDraft = useCallback(
    async (reason: "autosave" | "manual") => {
      if (!isDirty || saveState === "saving") {
        return;
      }

      const titleChanged = title !== savedTitle;
      setSaveState("saving");
      setSaveError(null);

      try {
        const response = await fetch(`/api/pages/${pageId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contentMarkdown,
            currentRevisionId: revisionId,
            editorSessionId,
            editorDocJson: parseEditorDocJson(editorDocJson),
            saveMode: reason,
            title,
          }),
        });

        const payload = (await response.json()) as
          | {
              error?: string;
              page: {
                currentRevisionId: string;
                title: string;
              };
              revision: {
                id: string;
                revisionNumber: number;
              };
            }
          | { error: string };

        if (!response.ok || !("page" in payload) || !("revision" in payload)) {
          throw new Error(payload.error ?? "Failed to save page.");
        }

        setTitle(payload.page.title);
        setSavedTitle(payload.page.title);
        setSavedContentMarkdown(contentMarkdown);
        setSavedEditorDocJson(editorDocJson);
        setRevisionId(payload.page.currentRevisionId);
        setLastSavedAt(new Date());
        setSaveState("saved");

        if (reason === "manual" || titleChanged) {
          router.refresh();
        }
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Failed to save page.");
        setSaveState("error");
      }
    },
    [
      contentMarkdown,
      editorDocJson,
      isDirty,
      pageId,
      editorSessionId,
      revisionId,
      router,
      savedTitle,
      saveState,
      title,
    ],
  );

  useEffect(() => {
    if (!isDirty || saveState === "saving") {
      return;
    }

    setSaveState("unsaved");

    const timeoutId = window.setTimeout(() => {
      void persistDraft("autosave");
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isDirty, persistDraft, saveState]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]");

      if (!anchor) {
        return;
      }

      const href = anchor.getAttribute("href");

      if (!href || href.startsWith("#")) {
        return;
      }

      if (!window.confirm("You have unsaved changes. Leave this page?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty]);

  const handleEditorChange = useCallback(
    (payload: {
      contentMarkdown: string;
      editorDocJson: string;
      isDirty: boolean;
    }) => {
      setContentMarkdown(payload.contentMarkdown);
      setEditorDocJson(payload.editorDocJson);
    },
    [],
  );

  return (
    <form
      className="relative flex h-full min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void persistDraft("manual");
      }}
    >
      <section className="shrink-0 border-b border-stone-200 bg-white p-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <input
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled"
              className="w-full border-0 bg-transparent p-0 text-xl font-semibold tracking-tight text-stone-950 outline-none placeholder:text-stone-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-[10px] font-medium text-stone-600">
              {getSaveStatusLabel(saveState, lastSavedAt)}
            </div>
            <button
              type="submit"
              disabled={saveState === "saving" || !isDirty}
              className="shrink-0 rounded-full bg-stone-900 px-3 py-1 text-[10px] font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              Save version
            </button>
          </div>
        </div>
        {saveState === "error" ? (
          <p className="text-xs text-red-700">{saveError ?? "Saving failed."}</p>
        ) : null}
      </section>

      <PageEditor
        initialEditorDocJson={initialEditorDocJson}
        internalLinkTargets={internalLinkTargets}
        mentionUsers={mentionUsers}
        initialMarkdown={initialMarkdown}
        onChange={handleEditorChange}
        title={title}
      />
    </form>
  );
}

function stringifyEditorDocJson(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value ?? null);
}

function parseEditorDocJson(rawValue: string) {
  if (!rawValue.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function getSaveStatusLabel(state: SaveState, lastSavedAt: Date | null) {
  if (state === "saving") {
    return "Saving...";
  }

  if (state === "unsaved") {
    return "Unsaved changes";
  }

  if (state === "error") {
    return "Save failed";
  }

  if (lastSavedAt) {
    return `Saved ${formatTime(lastSavedAt)}`;
  }

  return "Saved";
}
