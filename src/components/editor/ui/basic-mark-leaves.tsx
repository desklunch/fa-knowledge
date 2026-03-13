"use client";

import type { PlateLeafProps } from "platejs/react";
import { PlateLeaf } from "platejs/react";

export function BoldLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf {...props} as="strong" className="font-bold">
      {props.children}
    </PlateLeaf>
  );
}

export function ItalicLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf {...props} as="em" className="italic">
      {props.children}
    </PlateLeaf>
  );
}

export function UnderlineLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf
      {...props}
      as="span"
      className="underline decoration-[1.5px] underline-offset-[3px]"
    >
      {props.children}
    </PlateLeaf>
  );
}

export function StrikethroughLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf {...props} as="span" className="line-through">
      {props.children}
    </PlateLeaf>
  );
}
