"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DialogActions, SimpleDialog } from "@/components/ui/simple-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MetadataSaveState = "idle" | "saving" | "saved" | "error";
const INHERIT_VALUE = "__inherit__";

type PageMetadataFormProps = {
  canWrite: boolean;
  currentEffectiveReadLevel: number | null;
  currentEffectiveWriteLevel: number | null;
  explicitReadLevel: number | null;
  explicitWriteLevel: number | null;
  hasDescendants: boolean;
  hasParent: boolean;
  pageId: string;
  workspaceType: "private" | "shared";
};

export function PageMetadataForm({
  canWrite,
  currentEffectiveReadLevel,
  currentEffectiveWriteLevel,
  explicitReadLevel,
  explicitWriteLevel,
  hasDescendants,
  hasParent,
  pageId,
  workspaceType,
}: PageMetadataFormProps) {
  const router = useRouter();
  const [readLevel, setReadLevel] = useState(stringifyLevel(explicitReadLevel));
  const [writeLevel, setWriteLevel] = useState(stringifyLevel(explicitWriteLevel));
  const [saveState, setSaveState] = useState<MetadataSaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingDescendantStrategy, setPendingDescendantStrategy] = useState<
    "cascade" | "preserve" | null
  >(null);

  const canInherit = workspaceType === "shared" && hasParent;
  const isDirty =
    readLevel !== stringifyLevel(explicitReadLevel) ||
    writeLevel !== stringifyLevel(explicitWriteLevel);
  const nextReadLevel = parseLevel(readLevel);
  const nextWriteLevel = parseLevel(writeLevel);
  const isLoosening =
    (nextReadLevel !== null &&
      currentEffectiveReadLevel !== null &&
      nextReadLevel < currentEffectiveReadLevel) ||
    (nextWriteLevel !== null &&
      currentEffectiveWriteLevel !== null &&
      nextWriteLevel < currentEffectiveWriteLevel);
  const isTightening =
    (nextReadLevel !== null &&
      (currentEffectiveReadLevel === null || nextReadLevel > currentEffectiveReadLevel)) ||
    (nextWriteLevel !== null &&
      (currentEffectiveWriteLevel === null || nextWriteLevel > currentEffectiveWriteLevel));
  const readOptions = useMemo(
    () => buildLevelOptions(canInherit),
    [canInherit],
  );
  const writeOptions = useMemo(
    () => buildLevelOptions(canInherit),
    [canInherit],
  );

  useEffect(() => {
    setReadLevel(stringifyLevel(explicitReadLevel));
    setWriteLevel(stringifyLevel(explicitWriteLevel));
    setSaveState("idle");
    setSaveError(null);
    setPendingDescendantStrategy(null);
  }, [explicitReadLevel, explicitWriteLevel, pageId]);

  if (workspaceType === "private") {
    return (
      <div className="space-y-2 text-sm text-stone-600">
        <p>Private workspaces ignore page-level permission settings.</p>
        <p>Only the workspace owner can view and edit these pages.</p>
      </div>
    );
  }

  const handleSave = async (overrideDescendantStrategy?: "cascade" | "preserve") => {
    if (!canWrite || !isDirty) {
      return;
    }

    const descendantStrategy = overrideDescendantStrategy ?? pendingDescendantStrategy ?? undefined;

    if (hasDescendants && isLoosening && !descendantStrategy) {
      setPendingDescendantStrategy("preserve");
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
          explicitReadLevel: nextReadLevel,
          explicitWriteLevel: nextWriteLevel,
          descendantStrategy:
            hasDescendants
              ? descendantStrategy ?? (isTightening ? "cascade" : undefined)
              : undefined,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update page metadata.");
      }

      setSaveState("saved");
      setPendingDescendantStrategy(null);
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
        <Select
          disabled={!canWrite}
          onValueChange={setReadLevel}
          value={readLevel}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select read level" />
          </SelectTrigger>
          <SelectContent>
            {readOptions.map((option) => (
              <SelectItem key={option.value || "inherit-read"} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="w-full grid gap-2 text-sm">
        <span className="font-medium text-stone-700">Write</span>
        <Select
          disabled={!canWrite}
          onValueChange={setWriteLevel}
          value={writeLevel}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select write level" />
          </SelectTrigger>
          <SelectContent>
            {writeOptions.map((option) => (
              <SelectItem key={option.value || "inherit-write"} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      </div>
      {isDirty && hasDescendants && isTightening ? (
        <p className="text-sm text-stone-600">
          This stricter setting will also raise descendant restrictions to stay aligned.
        </p>
      ) : null}
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
        <Button
          onClick={() => void handleSave()}
          disabled={!canWrite || !isDirty || saveState === "saving"}
          type="button"
        >
          {saveState === "saving" ? "Saving..." : "Save"}
        </Button>
      </div>

      <SimpleDialog
        description="This change would make the page less restrictive. Do you want descendants that inherit from this page to loosen too, or should they stay unchanged?"
        open={hasDescendants && pendingDescendantStrategy !== null}
        title="Apply looser permissions"
      >
        <DialogActions className="justify-between">
          <Button
            onClick={() => setPendingDescendantStrategy(null)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                void handleSave("preserve");
              }}
              type="button"
              variant="outline"
            >
              Keep descendants unchanged
            </Button>
            <Button
              onClick={() => {
                void handleSave("cascade");
              }}
              type="button"
            >
              Apply to descendants
            </Button>
          </div>
        </DialogActions>
      </SimpleDialog>
    </div>
  );
}

function buildLevelOptions(canInherit: boolean) {
  return [
    ...(canInherit ? [{ value: INHERIT_VALUE, label: "Inherit" }] : []),
    { value: "1", label: "Level 1" },
    { value: "2", label: "Level 2" },
    { value: "3", label: "Level 3" },
  ];
}

function parseLevel(value: string) {
  if (!value || value === INHERIT_VALUE) {
    return null;
  }

  return Number(value);
}

function stringifyLevel(value: number | null) {
  return value === null ? INHERIT_VALUE : String(value);
}
