"use client";

import {
  type CursorData,
  type CursorOverlayState,
  useCursorOverlay,
} from "@platejs/selection/react";
import { RangeApi } from "platejs";
import * as React from "react";

import { cn } from "@/lib/utils";

const OVERLAY_ID = "__plate_cursor_overlay__";

export const getCursorOverlayElement = () => document.querySelector(`#${OVERLAY_ID}`);

function Cursor({
  id,
  caretPosition,
  data,
  selection,
  selectionRects,
}: CursorOverlayState<CursorData>) {
  const { style, selectionStyle = style } = data ?? ({} as CursorData);
  const isCursor = RangeApi.isCollapsed(selection);

  return (
    <>
      {selectionRects.map((position, index) => (
        <div
          key={index}
          id={OVERLAY_ID}
          className={cn(
            "pointer-events-none absolute z-10",
            id === "selection" && "bg-stone-300/40",
            id === "selection" && isCursor && "bg-stone-900",
          )}
          style={{ ...selectionStyle, ...position }}
        />
      ))}
      {caretPosition ? (
        <div
          id={OVERLAY_ID}
          className="pointer-events-none absolute z-10 w-0.5 bg-stone-900"
          style={{ ...caretPosition, ...style }}
        />
      ) : null}
    </>
  );
}

export function CursorOverlay() {
  const { cursors } = useCursorOverlay();

  return (
    <>
      {cursors.map((cursor) => (
        <Cursor key={cursor.id} {...cursor} />
      ))}
    </>
  );
}
