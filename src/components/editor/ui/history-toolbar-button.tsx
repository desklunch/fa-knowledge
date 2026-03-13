"use client";

import { Redo2Icon, Undo2Icon } from "lucide-react";
import { useEditorRef, useEditorSelector } from "platejs/react";
import type * as React from "react";

import { ToolbarButton } from "./toolbar";

export function RedoToolbarButton(props: React.ComponentProps<typeof ToolbarButton>) {
  const editor = useEditorRef();
  const disabled = useEditorSelector((valueEditor) => valueEditor.history.redos.length === 0, []);

  return (
    <ToolbarButton
      {...props}
      disabled={disabled}
      onClick={() => editor.redo()}
      onMouseDown={(event) => event.preventDefault()}
      tooltip="Redo"
    >
      <Redo2Icon />
    </ToolbarButton>
  );
}

export function UndoToolbarButton(props: React.ComponentProps<typeof ToolbarButton>) {
  const editor = useEditorRef();
  const disabled = useEditorSelector((valueEditor) => valueEditor.history.undos.length === 0, []);

  return (
    <ToolbarButton
      {...props}
      disabled={disabled}
      onClick={() => editor.undo()}
      onMouseDown={(event) => event.preventDefault()}
      tooltip="Undo"
    >
      <Undo2Icon />
    </ToolbarButton>
  );
}
