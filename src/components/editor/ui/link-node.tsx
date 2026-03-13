"use client";

import { getLinkAttributes } from "@platejs/link";
import type { TLinkElement } from "platejs";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

import { cn } from "@/lib/utils";

export function LinkElement(props: PlateElementProps<TLinkElement>) {
  const isInternal = props.element.url?.startsWith("/?page=");

  return (
    <PlateElement
      {...props}
      as="a"
      attributes={{
        ...props.attributes,
        ...getLinkAttributes(props.editor, props.element),
        onClick: (event) => {
          if (!isInternal) {
            return;
          }

          event.preventDefault();
          window.location.assign(props.element.url);
        },
        onMouseOver: (event) => {
          event.stopPropagation();
        },
      }}
      className={cn(
        "cursor-pointer font-medium text-sky-700 underline decoration-sky-700/80 underline-offset-4 transition-colors hover:text-sky-800 [&_[data-slate-node='text']]:cursor-pointer [&_[data-slate-node='text']]:text-inherit [&_[data-slate-node='text']]:underline [&_[data-slate-node='text']]:decoration-inherit [&_[data-slate-node='text']]:underline-offset-4",
      )}
    >
      {props.children}
    </PlateElement>
  );
}
