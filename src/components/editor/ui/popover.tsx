"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const popoverVariants = cva(
  "z-50 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-stone-200 bg-white text-stone-900 shadow-xl outline-none",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "w-80",
      },
    },
  },
);

export function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root {...props} />;
}

export function PopoverAnchor(props: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor {...props} />;
}

export function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger {...props} />;
}

export function PopoverContent({
  align = "center",
  className,
  sideOffset = 4,
  variant,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> &
  VariantProps<typeof popoverVariants>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        className={cn(popoverVariants({ variant }), className)}
        sideOffset={sideOffset}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
