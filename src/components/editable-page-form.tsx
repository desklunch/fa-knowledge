"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PageEditor, type PageEditorHandle } from "@/components/page-editor";

type SaveState = "saved" | "saving" | "unsaved" | "error";

type EditablePageFormProps = {
  initialEditorDocJson: unknown;
  initialMarkdown: string;
  initialTitle: string;
  currentRevisionId: string;
  pageId: string;
};

export function EditablePageForm({
  currentRevisionId,
  initialEditorDocJson,
  initialMarkdown,
  initialTitle,
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
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pastedMarkdown, setPastedMarkdown] = useState("");
  const editorRef = useRef<PageEditorHandle | null>(null);

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

  const applyPastedMarkdown = useCallback(
    (mode: "insert" | "replace") => {
      const normalizedMarkdown = pastedMarkdown.trim();

      if (!normalizedMarkdown) {
        return;
      }

      if (mode === "insert") {
        editorRef.current?.insertMarkdown(normalizedMarkdown);
      } else {
        editorRef.current?.replaceMarkdown(normalizedMarkdown);
      }

      setPastedMarkdown("");
      setIsPasteModalOpen(false);
    },
    [pastedMarkdown],
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
            <button
              type="button"
              onClick={() => setIsPasteModalOpen(true)}
              className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1 text-[10px] font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
            >
              Paste Markdown
            </button>
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
        ref={editorRef}
        initialEditorDocJson={initialEditorDocJson}
        initialMarkdown={initialMarkdown}
        onChange={handleEditorChange}
      />

      {isPasteModalOpen ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-stone-950/35 p-6">
          <div className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white shadow-2xl">
            <div className="border-b border-stone-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-stone-950">Paste Markdown</h2>
              <p className="mt-1 text-sm text-stone-600">
                Insert markdown at the current cursor position or replace the entire body.
              </p>
            </div>
            <div className="px-5 py-4">
              <textarea
                autoFocus
                value={pastedMarkdown}
                onChange={(event) => setPastedMarkdown(event.target.value)}
                placeholder="Paste raw markdown here..."
                className="h-72 w-full rounded-xl border border-stone-200 px-4 py-3 font-mono text-sm leading-6 text-stone-800 outline-none transition focus:border-stone-400"
              />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setIsPasteModalOpen(false);
                  setPastedMarkdown("");
                }}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!pastedMarkdown.trim()}
                  onClick={() => applyPastedMarkdown("insert")}
                  className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                >
                  Insert at cursor
                </button>
                <button
                  type="button"
                  disabled={!pastedMarkdown.trim()}
                  onClick={() => applyPastedMarkdown("replace")}
                  className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  Replace body
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
