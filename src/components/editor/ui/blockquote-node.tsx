"use client";

import { PlateElement, type PlateElementProps } from "platejs/react";

export function BlockquoteElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="blockquote"
      className="my-1 border-l-2 border-stone-300 pl-6 italic text-stone-600"
      {...props}
    />
  );
}
