"use client";

import {
  BaselineIcon,
  BoldIcon,
  Code2Icon,
  HighlighterIcon,
  ItalicIcon,
  KeyboardIcon,
  PaintBucketIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from "lucide-react";
import { KEYS } from "platejs";

import { useEditor } from "../editor-kit";

import { ExportToolbarButton } from "./export-toolbar-button";
import { FixedToolbar } from "./fixed-toolbar";
import {
  DEFAULT_BACKGROUND_COLORS,
  DEFAULT_COLORS,
  FontColorToolbarButton,
} from "./font-color-toolbar-button";
import { RedoToolbarButton, UndoToolbarButton } from "./history-toolbar-button";
import { IndentToolbarButton, OutdentToolbarButton } from "./indent-toolbar-button";
import { ImportToolbarButton } from "./import-toolbar-button";
import { InsertToolbarButton } from "./insert-toolbar-button";
import { LinkToolbarButton } from "./link-toolbar-button";
import { BulletedListToolbarButton, NumberedListToolbarButton, TodoListToolbarButton } from "./list-toolbar-button";
import { MarkToolbarButton } from "./mark-toolbar-button";
import { TableToolbarButton } from "./table-toolbar-button";
import { ToolbarButton, ToolbarGroup } from "./toolbar";
import { TurnIntoToolbarButton } from "./turn-into-toolbar-button";

export function FixedToolbarButtons({ exportFilename }: { exportFilename?: string }) {
  const editor = useEditor();

  return (
    <FixedToolbar>
      <div className="flex w-full">
        <ToolbarGroup>
          <UndoToolbarButton />
          <RedoToolbarButton />
        </ToolbarGroup>

        <ToolbarGroup>
          <ExportToolbarButton filename={exportFilename} />
          <ImportToolbarButton />
        </ToolbarGroup>

        <ToolbarGroup>
          <InsertToolbarButton />
          <TurnIntoToolbarButton />
        </ToolbarGroup>

        <ToolbarGroup>
          <MarkToolbarButton nodeType={KEYS.bold} tooltip="Bold">
            <BoldIcon className="h-4 w-4" />
          </MarkToolbarButton>
          <MarkToolbarButton nodeType={KEYS.italic} tooltip="Italic">
            <ItalicIcon className="h-4 w-4" />
          </MarkToolbarButton>
          <MarkToolbarButton nodeType={KEYS.underline} tooltip="Underline">
            <UnderlineIcon className="h-4 w-4" />
          </MarkToolbarButton>
          <MarkToolbarButton nodeType={KEYS.strikethrough} tooltip="Strikethrough">
            <StrikethroughIcon className="h-4 w-4" />
          </MarkToolbarButton>
          <MarkToolbarButton nodeType={KEYS.code} tooltip="Code">
            <Code2Icon className="h-4 w-4" />
          </MarkToolbarButton>
          <MarkToolbarButton nodeType={KEYS.highlight} tooltip="Highlight">
            <HighlighterIcon className="h-4 w-4" />
          </MarkToolbarButton>
          <FontColorToolbarButton
            colors={DEFAULT_COLORS}
            nodeType={KEYS.color}
            tooltip="Text color"
          >
            <BaselineIcon className="h-4 w-4" />
          </FontColorToolbarButton>
          <FontColorToolbarButton
            colors={DEFAULT_BACKGROUND_COLORS}
            nodeType={KEYS.backgroundColor}
            tooltip="Background color"
          >
            <PaintBucketIcon className="h-4 w-4" />
          </FontColorToolbarButton>
          <MarkToolbarButton nodeType={KEYS.kbd} tooltip="Keyboard">
            <KeyboardIcon className="h-4 w-4" />
          </MarkToolbarButton>
        </ToolbarGroup>

        <ToolbarGroup>
          <NumberedListToolbarButton />
          <BulletedListToolbarButton />
          <TodoListToolbarButton />
          <LinkToolbarButton />
          <TableToolbarButton />
        </ToolbarGroup>

        <ToolbarGroup>
          <ToolbarButton
            tooltip="Code block"
            onClick={() => editor.tf.toggleBlock("code_block")}
            onMouseDown={(event) => event.preventDefault()}
          >
            <Code2Icon className="h-4 w-4" />
          </ToolbarButton>
          <OutdentToolbarButton />
          <IndentToolbarButton />
        </ToolbarGroup>
      </div>
    </FixedToolbar>
  );
}
