"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

export const inputVariants = cva(
  "flex w-full rounded-md text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default:
          "h-9 border border-stone-200 bg-white px-3 text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-200",
        link: "h-9 border-none bg-transparent px-0 shadow-none",
      },
    },
  },
);

export function Input({
  className,
  variant,
  ...props
}: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return <input className={cn(inputVariants({ variant }), className)} {...props} />;
}
