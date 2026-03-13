"use client";

import { normalizeNodeId } from "platejs";
import { remarkMdx, serializeMd } from "@platejs/markdown";
import remarkGfm from "remark-gfm";
import { Plate, usePlateEditor } from "platejs/react";

import { FixedToolbarButtons } from "./ui/fixed-toolbar-buttons";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { normalizeValueForMarkdown } from "./markdown-value";

type PlateEditorProps = {
  editor: ReturnType<typeof usePlateEditor>;
  exportFilename?: string;
  onValueChange: (payload: {
    contentMarkdown: string;
    editorDocJson: string;
  }) => void;
};

export function PlateEditor({ editor, exportFilename, onValueChange }: PlateEditorProps) {
  if (!editor) {
    return null;
  }

  return (
    <Plate
      editor={editor}
      onValueChange={({ value: nextValue }) => {
        const normalizedValue = normalizeNodeId(nextValue);
        const nextEditorDocJson = JSON.stringify(normalizedValue);
        const markdownValue = normalizeValueForMarkdown(normalizedValue);
        const nextContentMarkdown = serializeMd(editor, {
          value: markdownValue as never,
          remarkPlugins: [remarkGfm, remarkMdx],
        });

        onValueChange({
          contentMarkdown: nextContentMarkdown,
          editorDocJson: nextEditorDocJson,
        });
      }}
    >
      <EditorContainer className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white shadow-[0_24px_80px_-48px_rgba(28,25,23,0.55)]">
        <FixedToolbarButtons exportFilename={exportFilename} />
        <Editor
          className="min-h-0 flex-1 overflow-y-auto text-[15px] leading-7 text-stone-700 [&_[data-slate-node='text']]:leading-7"
          onKeyDown={(event) => {
            const isMod = event.metaKey || event.ctrlKey;

            if (!isMod) return;

            if (event.key.toLowerCase() === "z" && event.shiftKey) {
              event.preventDefault();
              editor.redo();
              return;
            }

            if (event.key.toLowerCase() === "y") {
              event.preventDefault();
              editor.redo();
              return;
            }

            if (event.key.toLowerCase() === "z") {
              event.preventDefault();
              editor.undo();
            }
          }}
          placeholder="Write here..."
        />
      </EditorContainer>
    </Plate>
  );
}
