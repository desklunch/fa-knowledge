"use client";

import { Command as CommandPrimitive } from "cmdk";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

import { inputVariants } from "./input";

const commandVariants = cva("flex size-full flex-col rounded-md bg-white text-stone-900", {
  defaultVariants: {
    variant: "default",
  },
  variants: {
    variant: {
      combobox: "overflow-visible bg-transparent",
      default: "overflow-hidden",
    },
  },
});

export function Command({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof CommandPrimitive> &
  VariantProps<typeof commandVariants>) {
  return <CommandPrimitive className={cn(commandVariants({ variant }), className)} {...props} />;
}

export function CommandInput({
  className,
  wrapClassName,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
  wrapClassName?: string;
}) {
  return (
    <div className={cn("flex w-full items-center px-3 py-2", wrapClassName)} cmdk-input-wrapper="">
      <CommandPrimitive.Input className={cn(inputVariants(), className)} {...props} />
    </div>
  );
}

export function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn("max-h-72 overflow-y-auto overflow-x-hidden py-1.5", className)}
      {...props}
    />
  );
}

export function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className={cn("py-4 text-center text-sm text-stone-500", className)} {...props} />;
}

export function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "overflow-hidden p-1 text-stone-900 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-stone-400",
        className,
      )}
      {...props}
    />
  );
}

export function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "relative mx-1 flex min-h-9 cursor-default select-none items-center rounded-lg px-2.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-stone-100 data-[disabled=true]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
