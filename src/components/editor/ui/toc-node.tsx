"use client";

import { useTocElement, useTocElementState } from "@platejs/toc/react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const depthClassMap = {
  1: "pl-1",
  2: "pl-6",
  3: "pl-11",
} as const;

export function TocElement(props: PlateElementProps) {
  const state = useTocElementState();
  const { props: headingButtonProps } = useTocElement(state);
  const { headingList } = state;

  const scrollToHeading = (headingId: string) => {
    const heading = document.querySelector<HTMLElement>(`[data-heading-id="${headingId}"]`);

    if (!heading) {
      return;
    }

    heading.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
  };

  return (
    <PlateElement {...props} className="my-4 rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
      <div contentEditable={false}>
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
          Table of contents
        </div>
        {headingList.length > 0 ? (
          <div className="space-y-0.5">
            {headingList.map((item) => (
              <Button
                aria-current
                className={cn(
                  "h-auto w-full justify-start rounded-lg px-2 py-1 text-left text-sm font-medium leading-5 text-stone-600 hover:bg-stone-100 hover:text-stone-900",
                  depthClassMap[item.depth as 1 | 2 | 3] ?? "pl-1",
                )}
                key={item.id}
                onClick={(event) => {
                  headingButtonProps.onClick(event, item, "smooth");
                  scrollToHeading(item.id);
                }}
                type="button"
                variant="ghost"
              >
                {item.title}
              </Button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-stone-500">
            Create a heading to display the table of contents.
          </div>
        )}
      </div>
      {props.children}
    </PlateElement>
  );
}
