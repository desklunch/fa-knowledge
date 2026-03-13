"use client";

import { toggleList } from "@platejs/list";
import { CheckSquareIcon, Code2Icon, Heading1Icon, Heading2Icon, Heading3Icon, ListIcon, ListOrderedIcon, MinusIcon, PilcrowIcon, QuoteIcon } from "lucide-react";
import { KEYS } from "platejs";
import * as React from "react";
import { useEditorRef, useEditorSelector } from "platejs/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ToolbarButton } from "./toolbar";

const items = [
  { icon: <PilcrowIcon className="h-4 w-4" />, label: "Text", value: "p" },
  { icon: <Heading1Icon className="h-4 w-4" />, label: "Heading 1", value: "h1" },
  { icon: <Heading2Icon className="h-4 w-4" />, label: "Heading 2", value: "h2" },
  { icon: <Heading3Icon className="h-4 w-4" />, label: "Heading 3", value: "h3" },
  { icon: <ListIcon className="h-4 w-4" />, label: "Bulleted list", value: "disc" },
  { icon: <ListOrderedIcon className="h-4 w-4" />, label: "Numbered list", value: "decimal" },
  { icon: <CheckSquareIcon className="h-4 w-4" />, label: "Todo list", value: "todo" },
  { icon: <QuoteIcon className="h-4 w-4" />, label: "Quote", value: "blockquote" },
  { icon: <Code2Icon className="h-4 w-4" />, label: "Code", value: "code_block" },
  { icon: <MinusIcon className="h-4 w-4" />, label: "Horizontal rule", value: "hr" },
];

export function TurnIntoToolbarButton() {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);
  const currentBlockType = useEditorSelector(
    (valueEditor) => valueEditor.api.block()?.[0]?.type ?? "p",
    [],
  );

  const selectedItem = items.find((item) => item.value === currentBlockType) ?? items[0];

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          className="min-w-[125px] justify-between"
          isDropdown
          pressed={open}
          tooltip="Turn into"
        >
          {selectedItem.label}
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="min-w-[180px]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.tf.focus();
        }}
      >
        {items.map((item) => (
          <DropdownMenuItem
            key={item.value}
            onSelect={() => {
              if (item.value === "disc") {
                toggleList(editor, { listStyleType: KEYS.ul });
              } else if (item.value === "decimal") {
                toggleList(editor, { listStyleType: KEYS.ol });
              } else if (item.value === "todo") {
                toggleList(editor, { listStyleType: KEYS.listTodo });
              } else if (item.value === "hr") {
                editor.tf.insertNodes({
                  type: KEYS.hr,
                  children: [{ text: "" }],
                });
              } else {
                editor.tf.toggleBlock(item.value);
              }
              editor.tf.focus();
            }}
          >
            {item.icon}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
