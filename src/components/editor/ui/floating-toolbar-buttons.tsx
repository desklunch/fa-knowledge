"use client";

import { Bold, Code2, Highlighter, Italic, Strikethrough, Underline } from "lucide-react";
import { KEYS } from "platejs";
import { useSelectionAcrossBlocks } from "platejs/react";

import { LinkToolbarButton } from "./link-toolbar-button";
import { MarkToolbarButton } from "./mark-toolbar-button";
import { ToolbarGroup } from "./toolbar";

export function FloatingToolbarButtons() {
  const isSelectionAcrossBlocks = useSelectionAcrossBlocks();

  return (
    <div className="flex" style={{ transform: "translateX(calc(-1px))", whiteSpace: "nowrap" }}>
      <ToolbarGroup>
        <MarkToolbarButton nodeType={KEYS.bold} tooltip="Bold">
          <Bold />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.italic} tooltip="Italic">
          <Italic />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.underline} tooltip="Underline">
          <Underline />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.strikethrough} tooltip="Strikethrough">
          <Strikethrough />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.code} tooltip="Code">
          <Code2 />
        </MarkToolbarButton>
        <MarkToolbarButton nodeType={KEYS.highlight} tooltip="Highlight">
          <Highlighter />
        </MarkToolbarButton>
        {!isSelectionAcrossBlocks ? <LinkToolbarButton /> : null}
      </ToolbarGroup>
    </div>
  );
}
