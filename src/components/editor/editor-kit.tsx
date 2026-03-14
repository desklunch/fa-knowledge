"use client";

import { DndPlugin } from "@platejs/dnd";
import {
  BlockSelectionPlugin,
  CursorOverlayPlugin,
} from "@platejs/selection/react";
import { createPlatePlugin, type PlateElementProps, useEditorRef } from "platejs/react";

import { BaseEditorKit } from "@/components/editor/editor-base-kit";
import { AutoformatKit } from "@/components/editor/plugins/autoformat-kit";
import { FloatingToolbarKit } from "@/components/editor/plugins/floating-toolbar-kit";
import { SlashKit } from "@/components/editor/plugins/slash-kit";
import { CursorOverlay } from "@/components/editor/ui/cursor-overlay";
import { BlockDraggable } from "@/components/ui/block-draggable";
import { BlockSelection } from "@/components/ui/block-selection";

export const EditorKit = [
  ...BaseEditorKit,
  BlockSelectionPlugin.configure({
    options: {
      enableContextMenu: true,
    },
    render: {
      belowRootNodes: (props) => {
        if (!props.attributes.className?.includes("slate-selectable")) return null;
        return <BlockSelection {...(props as unknown as PlateElementProps)} />;
      },
    },
  }),
  CursorOverlayPlugin.configure({
    render: {
      afterEditable: () => <CursorOverlay />,
    },
  }),
  DndPlugin.configure({
    options: {
      enableScroller: true,
    },
    render: {
      aboveNodes: BlockDraggable,
    },
  }),
  ...AutoformatKit,
  ...SlashKit,
  ...FloatingToolbarKit,
  createPlatePlugin({
    key: "trailing-block",
  }),
];

export const useEditor = () => useEditorRef();
