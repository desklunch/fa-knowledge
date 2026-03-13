"use client";

import { toggleList, ListStyleType } from "@platejs/list";
import {
  CheckSquareIcon,
  ChevronRightIcon,
  Code2Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  HighlighterIcon,
  KeyboardIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PilcrowIcon,
  QuoteIcon,
} from "lucide-react";
import { KEYS } from "platejs";
import type { TComboboxInputElement } from "platejs";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import type * as React from "react";

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxGroupLabel,
  InlineComboboxInput,
  InlineComboboxItem,
} from "./inline-combobox";

type SlashItem = {
  icon: React.ReactNode;
  keywords?: string[];
  label: string;
  value: string;
  onSelect: (editor: PlateElementProps["editor"]) => void;
};

const basicBlockItems: SlashItem[] = [
  {
    icon: <PilcrowIcon className="size-4" />,
    keywords: ["paragraph", "text"],
    label: "Text",
    value: "p",
    onSelect: (editor) => editor.tf.toggleBlock("p"),
  },
  {
    icon: <Heading1Icon className="size-4" />,
    keywords: ["title", "h1"],
    label: "Heading 1",
    value: "h1",
    onSelect: (editor) => editor.tf.toggleBlock("h1"),
  },
  {
    icon: <Heading2Icon className="size-4" />,
    keywords: ["subtitle", "h2"],
    label: "Heading 2",
    value: "h2",
    onSelect: (editor) => editor.tf.toggleBlock("h2"),
  },
  {
    icon: <Heading3Icon className="size-4" />,
    keywords: ["subtitle", "h3"],
    label: "Heading 3",
    value: "h3",
    onSelect: (editor) => editor.tf.toggleBlock("h3"),
  },
  {
    icon: <ListIcon className="size-4" />,
    keywords: ["unordered", "bulleted", "ul", "-"],
    label: "Bulleted list",
    value: "ul",
    onSelect: (editor) => toggleList(editor, { listStyleType: ListStyleType.Disc }),
  },
  {
    icon: <ListOrderedIcon className="size-4" />,
    keywords: ["ordered", "numbered", "ol", "1"],
    label: "Numbered list",
    value: "ol",
    onSelect: (editor) => toggleList(editor, { listStyleType: ListStyleType.Decimal }),
  },
  {
    icon: <CheckSquareIcon className="size-4" />,
    keywords: ["todo", "task", "checkbox", "[]"],
    label: "Todo list",
    value: "todo",
    onSelect: (editor) => toggleList(editor, { listStyleType: "todo" }),
  },
  {
    icon: <QuoteIcon className="size-4" />,
    keywords: ["blockquote", "quote", ">"],
    label: "Quote",
    value: "blockquote",
    onSelect: (editor) => editor.tf.toggleBlock("blockquote"),
  },
  {
    icon: <Code2Icon className="size-4" />,
    keywords: ["code", "```"],
    label: "Code block",
    value: "code_block",
    onSelect: (editor) => editor.tf.toggleBlock("code_block"),
  },
  {
    icon: <MinusIcon className="size-4" />,
    keywords: ["divider", "separator", "---", "***"],
    label: "Horizontal rule",
    value: "hr",
    onSelect: (editor) =>
      editor.tf.insertNodes({
        type: "hr",
        children: [{ text: "" }],
      }),
  },
];

const inlineItems: SlashItem[] = [
  {
    icon: <HighlighterIcon className="size-4" />,
    keywords: ["mark", "highlight"],
    label: "Highlight",
    value: "highlight",
    onSelect: (editor) => editor.tf.toggleMark(KEYS.highlight),
  },
  {
    icon: <KeyboardIcon className="size-4" />,
    keywords: ["kbd", "keyboard", "shortcut"],
    label: "Keyboard",
    value: "kbd",
    onSelect: (editor) => editor.tf.toggleMark(KEYS.kbd),
  },
];

export function SlashInputElement(
  props: PlateElementProps<TComboboxInputElement>,
) {
  const { editor, element } = props;

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox element={element} trigger="/">
        <InlineComboboxInput />

        <InlineComboboxContent>
          <InlineComboboxEmpty>No results</InlineComboboxEmpty>

          <InlineComboboxGroup>
            <InlineComboboxGroupLabel>Basic blocks</InlineComboboxGroupLabel>

            {basicBlockItems.map(({ icon, keywords, label, value, onSelect }) => (
              <InlineComboboxItem
                group="Basic blocks"
                key={value}
                keywords={keywords}
                label={label}
                onClick={() => onSelect(editor)}
                value={value}
              >
                <div className="mr-2 text-stone-400">{icon}</div>
                {label}
                <ChevronRightIcon className="ml-auto size-3.5 text-stone-300" />
              </InlineComboboxItem>
            ))}
          </InlineComboboxGroup>

          <InlineComboboxGroup>
            <InlineComboboxGroupLabel>Inline</InlineComboboxGroupLabel>

            {inlineItems.map(({ icon, keywords, label, value, onSelect }) => (
              <InlineComboboxItem
                group="Inline"
                key={value}
                keywords={keywords}
                label={label}
                onClick={() => onSelect(editor)}
                value={value}
              >
                <div className="mr-2 text-stone-400">{icon}</div>
                {label}
                <ChevronRightIcon className="ml-auto size-3.5 text-stone-300" />
              </InlineComboboxItem>
            ))}
          </InlineComboboxGroup>
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
}
