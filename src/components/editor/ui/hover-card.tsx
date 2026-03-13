"use client";

import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import type * as React from "react";

import { cn } from "@/lib/utils";

export function HoverCard(props: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root {...props} />;
}

export function HoverCardTrigger(
  props: React.ComponentProps<typeof HoverCardPrimitive.Trigger>,
) {
  return <HoverCardPrimitive.Trigger {...props} />;
}

export function HoverCardContent({
  align = "center",
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        align={align}
        className={cn(
          "z-50 w-64 rounded-xl border border-stone-200 bg-white p-3 text-stone-900 shadow-xl outline-none",
          className,
        )}
        sideOffset={sideOffset}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}
