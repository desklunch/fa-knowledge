"use client";

import { ChevronDownIcon, CircleIcon, List, ListOrdered, ListTodoIcon, SquareIcon } from "lucide-react";
import {
  useIndentTodoToolBarButton,
  useIndentTodoToolBarButtonState,
  useListToolbarButton,
  useListToolbarButtonState,
} from "@platejs/list/react";
import { KEYS } from "platejs";
import { useEditorRef } from "platejs/react";
import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { ToolbarButton } from "./toolbar";

function BaseListToolbarButton({
  children,
  nodeType,
  tooltip,
}: {
  children: React.ReactNode;
  nodeType: string;
  tooltip: string;
}) {
  const state = useListToolbarButtonState({ nodeType });
  const { props } = useListToolbarButton(state);

  return (
    <ToolbarButton
      onClick={props.onClick}
      onMouseDown={props.onMouseDown}
      pressed={state.pressed}
      tooltip={tooltip}
    >
      {children}
    </ToolbarButton>
  );
}

function applyListStyle(
  editor: ReturnType<typeof useEditorRef>,
  type: typeof KEYS.ul | typeof KEYS.ol,
  listStyleType?: string,
) {
  editor.api.blocks({ mode: "lowest" }).forEach(([, path]) => {
    editor.tf.setNodes(
      {
        indent: 1,
        listStyleType,
        type,
      },
      { at: path },
    );
  });

  editor.tf.focus();
}

function SplitToolbarDropdown({
  children,
  content,
  open,
  onOpenChange,
  tooltip,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tooltip: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {children}
      <DropdownMenu modal={false} onOpenChange={onOpenChange} open={open}>
        <DropdownMenuTrigger asChild>
          <ToolbarButton
            className="w-5 px-0"
            pressed={open}
            tooltip={tooltip}
          >
            <ChevronDownIcon className="size-3.5" />
          </ToolbarButton>
        </DropdownMenuTrigger>
        {content}
      </DropdownMenu>
    </div>
  );
}

const BULLET_STYLE_OPTIONS = [
  {
    icon: <div className="size-3 rounded-full bg-current" />,
    label: "Default",
    value: "disc",
  },
  {
    icon: <CircleIcon className="size-4" />,
    label: "Circle",
    value: "circle",
  },
  {
    icon: <SquareIcon className="size-3.5 fill-current" />,
    label: "Square",
    value: "square",
  },
] as const;

const NUMBER_STYLE_OPTIONS = [
  { label: "Decimal (1, 2, 3)", value: "decimal" },
  { label: "Lower Alpha (a, b, c)", value: "lower-alpha" },
  { label: "Upper Alpha (A, B, C)", value: "upper-alpha" },
  { label: "Lower Roman (i, ii, iii)", value: "lower-roman" },
  { label: "Upper Roman (I, II, III)", value: "upper-roman" },
] as const;

export function BulletedListToolbarButton() {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);

  return (
    <SplitToolbarDropdown
      content={
        <DropdownMenuContent align="start" className="min-w-56 rounded-2xl p-2">
          {BULLET_STYLE_OPTIONS.map((option) => (
            <DropdownMenuItem
              className="gap-3 rounded-xl px-3 py-2.5 text-base"
              key={option.value}
              onSelect={() => applyListStyle(editor, KEYS.ul, option.value)}
            >
              <span className="flex size-5 items-center justify-center text-stone-950">
                {option.icon}
              </span>
              <span>{option.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      }
      onOpenChange={setOpen}
      open={open}
      tooltip="Bulleted list styles"
    >
      <BaseListToolbarButton nodeType="disc" tooltip="Bulleted list">
        <List className="h-4 w-4" />
      </BaseListToolbarButton>
    </SplitToolbarDropdown>
  );
}

export function NumberedListToolbarButton() {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);

  return (
    <SplitToolbarDropdown
      content={
        <DropdownMenuContent align="start" className="min-w-72 rounded-2xl p-2">
          {NUMBER_STYLE_OPTIONS.map((option) => (
            <DropdownMenuItem
              className={cn("rounded-xl px-5 py-3 text-base")}
              key={option.value}
              onSelect={() => applyListStyle(editor, KEYS.ol, option.value)}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      }
      onOpenChange={setOpen}
      open={open}
      tooltip="Numbered list styles"
    >
      <BaseListToolbarButton nodeType="decimal" tooltip="Numbered list">
        <ListOrdered className="h-4 w-4" />
      </BaseListToolbarButton>
    </SplitToolbarDropdown>
  );
}

export function TodoListToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>,
) {
  const state = useIndentTodoToolBarButtonState({ nodeType: "todo" });
  const { props: buttonProps } = useIndentTodoToolBarButton(state);

  return (
    <ToolbarButton {...props} {...buttonProps} tooltip="Todo list">
      <ListTodoIcon className="h-4 w-4" />
    </ToolbarButton>
  );
}
