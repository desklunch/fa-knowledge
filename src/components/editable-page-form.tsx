"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PageEditor } from "@/components/page-editor";

type SaveState = "saved" | "saving" | "unsaved" | "error";

type EditablePageFormProps = {
  currentRevisionId: string;
  currentRevisionNumber: number;
  effectiveReadLevel: number | null;
  effectiveWriteLevel: number | null;
  initialEditorDocJson: unknown;
  initialMarkdown: string;
  initialTitle: string;
  pageId: string;
  workspaceName: string;
};

export function EditablePageForm({
  currentRevisionId,
  currentRevisionNumber,
  effectiveReadLevel,
  effectiveWriteLevel,
  initialEditorDocJson,
  initialMarkdown,
  initialTitle,
  pageId,
  workspaceName,
}: EditablePageFormProps) {
  const router = useRouter();
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
  const [revisionNumber, setRevisionNumber] = useState(currentRevisionNumber);
  const [revisionId, setRevisionId] = useState(currentRevisionId);

  const isDirty =
    title !== savedTitle ||
    contentMarkdown !== savedContentMarkdown ||
    editorDocJson !== savedEditorDocJson;

  const wordCount = countWords(contentMarkdown);
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 220));

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
            editorDocJson: parseEditorDocJson(editorDocJson),
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
        setRevisionNumber(payload.revision.revisionNumber);
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
      className="flex h-full min-h-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void persistDraft("manual");
      }}
    >
      <section className="shrink-0 rounded-[1.5rem] border border-stone-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              {workspaceName}
            </p>
            <input
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled"
              className="mt-2 w-full border-0 bg-transparent p-0 text-3xl font-semibold tracking-tight text-stone-950 outline-none placeholder:text-stone-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <HeaderPill label={`Read ${effectiveReadLevel ?? "private"}`} />
            <HeaderPill label={`Write ${effectiveWriteLevel ?? "private"}`} />
            <HeaderPill label={`Revision ${revisionNumber}`} />
            <HeaderPill label={`${wordCount} words`} />
            <HeaderPill label={`${readingMinutes} min read`} />
            <HeaderPill label={getSaveLabel(saveState, lastSavedAt)} />
          </div>
        </div>
      </section>

      <PageEditor
        initialEditorDocJson={initialEditorDocJson}
        initialMarkdown={initialMarkdown}
        onChange={handleEditorChange}
      />

      <div className="shrink-0 flex flex-col gap-4 rounded-[1.5rem] border border-stone-200 bg-white px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-stone-800">
            Every save writes a new immutable revision snapshot.
          </p>
          <p className="text-sm text-stone-600">
            {saveState === "error"
              ? saveError ?? "Saving failed."
              : isDirty
                ? "Unsaved changes will autosave after a short pause."
                : lastSavedAt
                  ? `Last saved at ${formatTime(lastSavedAt)}.`
                  : "All document changes are saved to the latest revision."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            {saveState === "saving"
              ? "Saving"
              : saveState === "error"
                ? "Error"
                : isDirty
                  ? "Unsaved"
                  : "Synced"}
          </span>
          <SaveButton isDirty={isDirty} isSaving={saveState === "saving"} />
        </div>
      </div>
    </form>
  );
}

function HeaderPill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600">
      {label}
    </span>
  );
}

function SaveButton({
  isDirty,
  isSaving,
}: {
  isDirty: boolean;
  isSaving: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={isSaving || !isDirty}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        isSaving || !isDirty
          ? "cursor-not-allowed bg-stone-300 text-stone-600"
          : "bg-stone-900 text-white hover:bg-stone-700"
      }`}
    >
      {isSaving ? "Saving..." : "Save page"}
    </button>
  );
}

function countWords(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/).length;
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

function getSaveLabel(state: SaveState, lastSavedAt: Date | null) {
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
