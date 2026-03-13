"use client";

import { useIndentButton, useOutdentButton } from "@platejs/indent/react";
import { IndentIncrease, IndentDecrease } from "lucide-react";
import type * as React from "react";

import { ToolbarButton } from "./toolbar";

export function IndentToolbarButton(props: React.ComponentProps<typeof ToolbarButton>) {
  const { props: buttonProps } = useIndentButton();

  return (
    <ToolbarButton {...props} {...buttonProps} tooltip="Indent">
      <IndentIncrease className="h-4 w-4" />
    </ToolbarButton>
  );
}

export function OutdentToolbarButton(props: React.ComponentProps<typeof ToolbarButton>) {
  const { props: buttonProps } = useOutdentButton();

  return (
    <ToolbarButton {...props} {...buttonProps} tooltip="Outdent">
      <IndentDecrease className="h-4 w-4" />
    </ToolbarButton>
  );
}
