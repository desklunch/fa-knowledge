"use client";

import { cn } from "@/lib/utils";

import { Toolbar } from "./toolbar";

export function FixedToolbar(props: React.ComponentProps<typeof Toolbar>) {
  return (
    <Toolbar
      {...props}
      className={cn(
        "sticky top-0 left-0 z-20 w-full overflow-hidden border-b border-stone-200 bg-white/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/80",
        props.className,
      )}
    />
  );
}
