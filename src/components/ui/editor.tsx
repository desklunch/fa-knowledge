"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { PlateContentProps } from "platejs/react";
import { PlateContainer, PlateContent } from "platejs/react";
import type * as React from "react";

import { cn } from "@/lib/utils";

const editorContainerVariants = cva(
  "relative w-full cursor-text select-text focus-visible:outline-none [&_.slate-selection-area]:z-50 [&_.slate-selection-area]:border [&_.slate-selection-area]:border-amber-300 [&_.slate-selection-area]:bg-amber-200/30",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "h-full min-h-0",
      },
    },
  },
);

export function EditorContainer({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof editorContainerVariants>) {
  return (
    <PlateContainer
      className={cn(editorContainerVariants({ variant }), className)}
      {...props}
    />
  );
}

const editorVariants = cva(
  cn(
    "group/editor relative w-full cursor-text select-text overflow-x-hidden whitespace-pre-wrap break-words rounded-md focus-visible:outline-none",
    "**:data-slate-placeholder:!top-1/2 **:data-slate-placeholder:-translate-y-1/2 **:data-slate-placeholder:text-stone-400 **:data-slate-placeholder:opacity-100!",
    "[&_strong]:font-bold",
  ),
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default:
          "size-full px-6 pt-6 pb-24 text-base sm:pr-[max(64px,calc(50%-350px))] sm:pl-[max(112px,calc(50%-350px))]",
      },
    },
  },
);

export type EditorProps = PlateContentProps & VariantProps<typeof editorVariants>;

export function Editor({ className, variant, ...props }: EditorProps) {
  return (
    <PlateContent
      className={cn(editorVariants({ variant }), className)}
      disableDefaultStyles
      {...props}
    />
  );
}
