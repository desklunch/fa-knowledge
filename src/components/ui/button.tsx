"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import type * as React from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-xs outline-none transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      size: {
        default: "h-9 px-3 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-sm px-3 has-[>svg]:px-2.5",
        icon: "size-9",
        "icon-sm": "size-8",
      },
      variant: {
        default: "bg-stone-950 text-white hover:bg-stone-800",
        secondary: "bg-stone-100 text-stone-600 hover:bg-stone-200",
        ghost: "hover:bg-stone-100 hover:text-stone-900", 
        outline: "border border-stone-200 bg-white hover:bg-stone-100",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  },
);

export const Button = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(function Button(
  {
    asChild = false,
    className,
    size,
    variant,
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ className, size, variant }))}
      data-slot="button"
      ref={ref}
      {...props}
    />
  );
});

Button.displayName = "Button";
