"use client";

import type { DropdownMenuProps } from "@radix-ui/react-dropdown-menu";
import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Link2Icon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PilcrowIcon,
  PlusIcon,
  QuoteIcon,
  SquareIcon,
  TableIcon,
  TableOfContentsIcon,
} from "lucide-react";
import { KEYS } from "platejs";
import { useEditorRef } from "platejs/react";
import * as React from "react";

import { insertBlock, insertInlineElement } from "@/components/editor/transforms";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ToolbarButton } from "./toolbar";

const groups = [
  {
    group: "Basic blocks",
    items: [
      { icon: <PilcrowIcon className="size-4" />, label: "Paragraph", value: KEYS.p },
      { icon: <Heading1Icon className="size-4" />, label: "Heading 1", value: "h1" },
      { icon: <Heading2Icon className="size-4" />, label: "Heading 2", value: "h2" },
      { icon: <Heading3Icon className="size-4" />, label: "Heading 3", value: "h3" },
      { icon: <TableIcon className="size-4" />, label: "Table", value: KEYS.table },
      { icon: <QuoteIcon className="size-4" />, label: "Quote", value: KEYS.blockquote },
      { icon: <MinusIcon className="size-4" />, label: "Divider", value: KEYS.hr },
      { icon: <TableOfContentsIcon className="size-4" />, label: "Table of contents", value: KEYS.toc },
    ],
  },
  {
    group: "Lists",
    items: [
      { icon: <ListIcon className="size-4" />, label: "Bulleted list", value: KEYS.ul },
      { icon: <ListOrderedIcon className="size-4" />, label: "Numbered list", value: KEYS.ol },
      { icon: <SquareIcon className="size-4" />, label: "To-do list", value: KEYS.listTodo },
    ],
  },
  {
    group: "Inline",
    items: [{ icon: <Link2Icon className="size-4" />, label: "Link", value: KEYS.link }],
  },
] as const;

export function InsertToolbarButton(props: DropdownMenuProps) {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton isDropdown pressed={open} tooltip="Insert">
          <PlusIcon className="size-4" />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="flex max-h-[500px] min-w-0 flex-col overflow-y-auto">
        {groups.map(({ group, items }, groupIndex) => (
          <React.Fragment key={group}>
            {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel>{group}</DropdownMenuLabel>
            {items.map(({ icon, label, value }) => (
              <DropdownMenuItem
                className="min-w-[200px]"
                key={value}
                onSelect={() => {
                  if (group === "Inline") {
                    insertInlineElement(editor, value);
                  } else {
                    insertBlock(editor, value);
                  }
                  editor.tf.focus();
                }}
              >
                {icon}
                {label}
              </DropdownMenuItem>
            ))}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
