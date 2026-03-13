"use client";

import { useEffect, useMemo, useState } from "react";

import { normalizeNodeId } from "platejs";
import { usePlateEditor } from "platejs/react";

import { EditorContextProvider, type EditorInternalLinkTarget } from "@/components/editor/context";
import { EditorKit } from "@/components/editor/editor-kit";
import { getInitialEditorValue } from "@/components/editor/markdown-value";
import { PlateEditor } from "@/components/editor/plate-editor";

type PageEditorProps = {
  initialEditorDocJson: unknown;
  initialMarkdown: string;
  internalLinkTargets: EditorInternalLinkTarget[];
  mentionUsers: Array<{
    id: string;
    name: string;
  }>;
  title: string;
  onChange: (payload: {
    contentMarkdown: string;
    editorDocJson: string;
    isDirty: boolean;
  }) => void;
};

export function PageEditor({
  initialEditorDocJson,
  initialMarkdown,
  internalLinkTargets,
  mentionUsers,
  onChange,
  title,
}: PageEditorProps) {
  const initialValue = useMemo(
    () => normalizeNodeId(getInitialEditorValue(initialMarkdown, initialEditorDocJson)),
    [initialEditorDocJson, initialMarkdown],
  );
  const [contentMarkdown, setContentMarkdown] = useState(initialMarkdown);
  const [editorDocJson, setEditorDocJson] = useState(() => JSON.stringify(initialValue));
  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialValue,
  });

  useEffect(() => {
    onChange({
      contentMarkdown,
      editorDocJson,
      isDirty: contentMarkdown !== initialMarkdown,
    });
  }, [contentMarkdown, editorDocJson, initialMarkdown, onChange]);

  return (
    <EditorContextProvider value={{ internalLinkTargets, mentionUsers }}>
      <div className="min-h-0 flex flex-1 flex-col">
        <PlateEditor
          editor={editor}
          exportFilename={sanitizeFilename(title)}
          onValueChange={({ contentMarkdown: nextContentMarkdown, editorDocJson: nextEditorDocJson }) => {
            setEditorDocJson(nextEditorDocJson);
            setContentMarkdown(nextContentMarkdown);
          }}
        />
      </div>
    </EditorContextProvider>
  );
}

function sanitizeFilename(title: string) {
  const value = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return value || "document";
}
