"use client";

import type { DropdownMenuProps } from "@radix-ui/react-dropdown-menu";
import { EraserIcon } from "lucide-react";
import { useEditorRef, useEditorSelector } from "platejs/react";
import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { ToolbarButton, ToolbarGroup } from "./toolbar";

type ColorOption = {
  label: string;
  value: string;
};

export const DEFAULT_COLORS: ColorOption[] = [
  { label: "Default", value: "#111827" },
  { label: "Gray", value: "#6b7280" },
  { label: "Brown", value: "#92400e" },
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Yellow", value: "#ca8a04" },
  { label: "Green", value: "#16a34a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Pink", value: "#db2777" },
];

export const DEFAULT_BACKGROUND_COLORS: ColorOption[] = [
  { label: "Gray", value: "#f3f4f6" },
  { label: "Red", value: "#fee2e2" },
  { label: "Orange", value: "#ffedd5" },
  { label: "Yellow", value: "#fef3c7" },
  { label: "Green", value: "#dcfce7" },
  { label: "Blue", value: "#dbeafe" },
  { label: "Purple", value: "#ede9fe" },
  { label: "Pink", value: "#fce7f3" },
];

export function ColorDropdownMenuItems({
  className,
  colors,
  updateColor,
}: {
  className?: string;
  colors: ColorOption[];
  updateColor: (color: string) => void;
}) {
  return (
    <div className={cn("grid grid-cols-5 gap-1", className)}>
      {colors.map((color) => (
        <button
          aria-label={color.label}
          className="h-7 w-7 rounded-md border border-stone-200 transition hover:scale-[1.04] hover:border-stone-300"
          key={color.value}
          onClick={() => updateColor(color.value)}
          style={{ backgroundColor: color.value }}
          type="button"
        />
      ))}
    </div>
  );
}

export function FontColorToolbarButton({
  children,
  colors,
  nodeType,
  tooltip,
  ...props
}: {
  children: React.ReactNode;
  colors: ColorOption[];
  nodeType: string;
  tooltip?: string;
} & DropdownMenuProps) {
  const editor = useEditorRef();
  const selectionDefined = useEditorSelector((valueEditor) => !!valueEditor.selection, []);
  const currentColor = useEditorSelector(
    (valueEditor) => valueEditor.api.mark(nodeType) as string | undefined,
    [nodeType],
  );
  const [open, setOpen] = React.useState(false);

  const applyColor = React.useCallback(
    (value: string) => {
      if (!editor.selection) return;
      editor.tf.select(editor.selection);
      editor.tf.focus();
      editor.tf.addMarks({ [nodeType]: value });
      setOpen(false);
    },
    [editor, nodeType],
  );

  const clearColor = React.useCallback(() => {
    if (!selectionDefined) return;
    editor.tf.focus();
    editor.tf.removeMarks(nodeType);
    setOpen(false);
  }, [editor, nodeType, selectionDefined]);

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={open} tooltip={tooltip}>
          {children}
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <div className="space-y-3 p-2">
          <ToolbarGroup className="flex-wrap gap-1">
            {colors.map((color) => {
              const isActive = currentColor === color.value;

              return (
                <button
                  className={cn(
                    "flex h-8 min-w-8 items-center justify-center rounded-md border border-stone-200 px-2 text-xs font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50",
                    isActive && "border-stone-900 ring-1 ring-stone-900",
                  )}
                  key={color.value}
                  onClick={() => applyColor(color.value)}
                  style={{ backgroundColor: nodeType === "backgroundColor" ? color.value : undefined, color: nodeType === "color" ? color.value : undefined }}
                  type="button"
                >
                  {nodeType === "color" ? "A" : ""}
                </button>
              );
            })}
          </ToolbarGroup>
          <label className="flex items-center gap-2 rounded-md border border-stone-200 px-2 py-1.5 text-sm text-stone-700">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">Custom</span>
            <input
              className="h-8 w-full cursor-pointer rounded-md border-0 bg-transparent p-0"
              onChange={(event) => applyColor(event.target.value)}
              type="color"
              value={currentColor ?? (nodeType === "backgroundColor" ? "#fef3c7" : "#111827")}
            />
          </label>
        </div>
        {currentColor ? (
          <DropdownMenuItem onSelect={clearColor}>
            <EraserIcon className="size-4" />
            Clear
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
