"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { PlateContentProps, PlateViewProps } from "platejs/react";
import { PlateContainer, PlateContent, PlateView } from "platejs/react";
import type * as React from "react";

import { cn } from "@/lib/utils";

const editorContainerVariants = cva(
  "relative w-full cursor-text select-text overflow-y-auto caret-sky-600 selection:bg-sky-100/80 focus-visible:outline-none [&_.slate-selection-area]:z-50 [&_.slate-selection-area]:border [&_.slate-selection-area]:border-sky-200 [&_.slate-selection-area]:bg-sky-100/60",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "h-full min-h-0",
        fullWidth: "h-full min-h-0",
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
    "group/editor relative w-full cursor-text select-text overflow-x-hidden whitespace-pre-wrap break-words rounded-md ring-offset-background focus-visible:outline-none",
    "**:data-slate-placeholder:!top-1/2 **:data-slate-placeholder:-translate-y-1/2 placeholder:text-stone-400/80 **:data-slate-placeholder:text-stone-400/80 **:data-slate-placeholder:opacity-100!",
    "[&_strong]:font-bold",
  ),
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      disabled: {
        true: "cursor-not-allowed opacity-50",
      },
      focused: {
        true: "ring-2 ring-sky-200 ring-offset-2",
      },
      variant: {
        default:
          "size-full px-16 pt-4 pb-72 text-base sm:px-[max(64px,calc(50%-350px))]",
        fullWidth: "size-full px-16 pt-4 pb-72 text-base sm:px-24",
      },
    },
  },
);

export type EditorProps = PlateContentProps & VariantProps<typeof editorVariants>;

export function Editor({ className, disabled, focused, variant, ...props }: EditorProps) {
  return (
    <PlateContent
      className={cn(editorVariants({ disabled, focused, variant }), className)}
      disableDefaultStyles
      {...props}
    />
  );
}

export function EditorView({
  className,
  variant,
  ...props
}: PlateViewProps & VariantProps<typeof editorVariants>) {
  return (
    <PlateView
      {...props}
      className={cn(editorVariants({ variant }), className)}
    />
  );
}
