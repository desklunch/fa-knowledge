"use client";

import * as ToolbarPrimitive from "@radix-ui/react-toolbar";
import { ChevronDownIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

import { Separator } from "./separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const toolbarVariants = cva("relative flex select-none items-center", {
  defaultVariants: {
    variant: "default",
  },
  variants: {
    variant: {
      default: "gap-1 bg-white",
    },
  },
});

export function Toolbar({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Root> &
  VariantProps<typeof toolbarVariants>) {
  return <ToolbarPrimitive.Root className={cn(toolbarVariants({ variant }), className)} {...props} />;
}

const toolbarButtonVariants = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium text-stone-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
  {
    defaultVariants: {
      size: "sm",
      variant: "default",
    },
    variants: {
      size: {
        sm: "h-8 px-2",
      },
      variant: {
        default:
          "bg-transparent hover:bg-stone-100 aria-checked:bg-stone-900 aria-checked:text-white",
      },
    },
  },
);

export function ToolbarButton({
  children,
  className,
  isDropdown,
  pressed,
  size,
  tooltip,
  variant,
  ...props
}: (Omit<React.ComponentProps<typeof ToolbarPrimitive.ToggleItem>, "asChild" | "value"> & {
  isDropdown?: boolean;
  pressed?: boolean;
  tooltip?: string;
}) &
  VariantProps<typeof toolbarButtonVariants>) {
  const content = typeof pressed === "boolean" ? (
    <ToolbarPrimitive.ToggleGroup disabled={props.disabled} type="single" value={pressed ? "single" : ""}>
      <ToolbarPrimitive.ToggleItem
        className={cn(toolbarButtonVariants({ size, variant }), isDropdown && "justify-between gap-0.5 pr-1", className)}
        value="single"
        {...props}
      >
        {isDropdown ? (
          <>
            <div className="flex flex-1 items-center gap-1 whitespace-nowrap">{children}</div>
            <ChevronDownIcon className="size-3.5 text-stone-400" />
          </>
        ) : (
          children
        )}
      </ToolbarPrimitive.ToggleItem>
    </ToolbarPrimitive.ToggleGroup>
  ) : (
    <ToolbarPrimitive.Button
      className={cn(toolbarButtonVariants({ size, variant }), isDropdown && "pr-1", className)}
      {...props}
    >
      {children}
    </ToolbarPrimitive.Button>
  );

  if (!tooltip) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function ToolbarGroup({ children, className }: React.ComponentProps<"div">) {
  const childArr = React.Children.map(children, (c) => c);
  if (!childArr || childArr.length === 0) return null;

  return (
    <div className={cn("group/toolbar-group relative flex shrink-0", className)}>
      <div className="flex items-center gap-0.5">{children}</div>
      <div className="group-last/toolbar-group:hidden! mx-1.5 hidden py-0.5 group-has-[button]/toolbar-group:block">
        <Separator orientation="vertical" />
      </div>
    </div>
  );
}
