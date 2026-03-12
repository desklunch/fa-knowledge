"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type MetadataSaveState = "idle" | "saving" | "saved" | "error";

type PageMetadataFormProps = {
  canWrite: boolean;
  explicitReadLevel: number | null;
  explicitWriteLevel: number | null;
  hasParent: boolean;
  pageId: string;
  workspaceType: "private" | "shared";
};

export function PageMetadataForm({
  canWrite,
  explicitReadLevel,
  explicitWriteLevel,
  hasParent,
  pageId,
  workspaceType,
}: PageMetadataFormProps) {
  const router = useRouter();
  const [readLevel, setReadLevel] = useState(stringifyLevel(explicitReadLevel));
  const [writeLevel, setWriteLevel] = useState(stringifyLevel(explicitWriteLevel));
  const [saveState, setSaveState] = useState<MetadataSaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const canInherit = workspaceType === "shared" && hasParent;
  const isDirty =
    readLevel !== stringifyLevel(explicitReadLevel) ||
    writeLevel !== stringifyLevel(explicitWriteLevel);
  const readOptions = useMemo(
    () => buildLevelOptions(canInherit),
    [canInherit],
  );
  const writeOptions = useMemo(
    () => buildLevelOptions(canInherit),
    [canInherit],
  );

  if (workspaceType === "private") {
    return (
      <div className="space-y-2 text-sm text-stone-600">
        <p>Private workspaces ignore page-level permission settings.</p>
        <p>Only the workspace owner can view and edit these pages.</p>
      </div>
    );
  }

  const handleSave = async () => {
    if (!canWrite || !isDirty) {
      return;
    }

    setSaveState("saving");
    setSaveError(null);

    try {
      const response = await fetch(`/api/pages/${pageId}/metadata`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          explicitReadLevel: parseLevel(readLevel),
          explicitWriteLevel: parseLevel(writeLevel),
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update page metadata.");
      }

      setSaveState("saved");
      router.refresh();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to update page metadata.",
      );
      setSaveState("error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
      <label className="w-full grid gap-2 text-sm">
        <span className="font-medium text-stone-700">Read</span>
        <select
          value={readLevel}
          onChange={(event) => setReadLevel(event.target.value)}
          disabled={!canWrite}
          className="rounded-md border border-stone-200 bg-white px-3 py-2 text-stone-900 disabled:cursor-not-allowed disabled:bg-stone-100"
        >
          {readOptions.map((option) => (
            <option key={option.value} value={option.value} >
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="w-full grid gap-2 text-sm">
        <span className="font-medium text-stone-700">Write</span>
        <select
          value={writeLevel}
          onChange={(event) => setWriteLevel(event.target.value)}
          disabled={!canWrite}
          className="rounded-md border border-stone-200 bg-white px-3 py-2 text-stone-900 disabled:cursor-not-allowed disabled:bg-stone-100"
        >
          {writeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      </div>
      {saveError ? <p className="text-sm text-red-700">{saveError}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium uppercase  text-stone-500">
          {saveState === "saving"
            ? "Saving"
            : saveState === "saved"
              ? "Saved"
              : saveState === "error"
                ? "Error"
                : isDirty
                  ? "Unsaved"
                  : "No changes"}
        </span>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canWrite || !isDirty || saveState === "saving"}
          className="rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {saveState === "saving" ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function buildLevelOptions(canInherit: boolean) {
  return [
    ...(canInherit ? [{ value: "", label: "Inherit from parent" }] : []),
    { value: "1", label: "Level 1" },
    { value: "2", label: "Level 2" },
    { value: "3", label: "Level 3" },
  ];
}

function parseLevel(value: string) {
  if (!value) {
    return null;
  }

  return Number(value);
}

function stringifyLevel(value: number | null) {
  return value === null ? "" : String(value);
}
