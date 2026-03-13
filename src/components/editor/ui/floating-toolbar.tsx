"use client";

import {
  type FloatingToolbarState,
  flip,
  offset,
  shift,
  useFloatingToolbar,
  useFloatingToolbarState,
} from "@platejs/floating";
import { BlockSelectionPlugin } from "@platejs/selection/react";
import { KEYS } from "platejs";
import {
  useEditorRef,
  useEventEditorValue,
  usePluginOption,
} from "platejs/react";
import type * as React from "react";

import { cn } from "@/lib/utils";

import { Toolbar } from "./toolbar";

export function FloatingToolbar({
  children,
  state,
  ...props
}: React.ComponentProps<typeof Toolbar> & {
  state?: FloatingToolbarState;
}) {
  const editor = useEditorRef();
  const focusedEditorId = useEventEditorValue("focus");
  const isFloatingLinkOpen = !!usePluginOption({ key: KEYS.link }, "mode");
  const isSelectingSomeBlocks = usePluginOption(BlockSelectionPlugin, "isSelectingSome");

  const floatingToolbarState = useFloatingToolbarState({
    editorId: editor.id,
    focusedEditorId,
    hideToolbar: isFloatingLinkOpen || isSelectingSomeBlocks,
    ...state,
    floatingOptions: {
      middleware: [
        offset({ crossAxis: -24, mainAxis: 12 }),
        shift({ padding: 50 }),
        flip({
          fallbackPlacements: ["top-start", "top-end", "bottom-start", "bottom-end"],
          padding: 12,
        }),
      ],
      placement: "top-start",
      ...state?.floatingOptions,
    },
  });

  const {
    clickOutsideRef,
    hidden,
    props: rootProps,
    ref: floatingRef,
  } = useFloatingToolbar(floatingToolbarState);

  if (hidden) return null;

  return (
    <div ref={clickOutsideRef}>
      <Toolbar
        ref={floatingRef}
        className={cn(
          "absolute z-50 animate-in zoom-in-95 whitespace-nowrap rounded-lg border border-stone-200 bg-white p-1 shadow-xl",
          "max-w-[80vw] overflow-x-auto",
        )}
        {...rootProps}
        {...props}
      >
        {children}
      </Toolbar>
    </div>
  );
}
