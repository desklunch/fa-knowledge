"use client";

import {
  useEditorRef,
  useMarkToolbarButton,
  useMarkToolbarButtonState,
} from "platejs/react";
import type * as React from "react";

import { ToolbarButton } from "./toolbar";

export function MarkToolbarButton({
  clear,
  nodeType,
  ...props
}: React.ComponentProps<typeof ToolbarButton> & {
  clear?: string[] | string;
  nodeType: string;
}) {
  const editor = useEditorRef();
  const state = useMarkToolbarButtonState({ clear, nodeType });
  const { props: buttonProps } = useMarkToolbarButton(state);

  return (
    <ToolbarButton
      {...buttonProps}
      {...props}
      onClick={() => {
        buttonProps.onClick?.();
        editor.tf.focus();
      }}
      pressed={state.pressed}
    />
  );
}
