"use client";

import type { PlateLeafProps } from "platejs/react";
import { PlateLeaf } from "platejs/react";

export function HighlightLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf
      {...props}
      as="mark"
      className="rounded-sm bg-amber-100/80 px-[0.08em] text-inherit"
    >
      {props.children}
    </PlateLeaf>
  );
}
