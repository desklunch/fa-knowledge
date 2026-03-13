"use client";

import { BlockPlaceholderPlugin } from "@platejs/utils/react";
import { ParagraphPlugin } from "platejs/react";
import {
  BasicMarksPlugin,
  BlockquotePlugin,
  BoldPlugin,
  CodePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  HighlightPlugin,
  HorizontalRulePlugin,
  ItalicPlugin,
  KbdPlugin,
  StrikethroughPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react";
import { CodeBlockPlugin } from "@platejs/code-block/react";
import { IndentPlugin } from "@platejs/indent/react";
import { ListPlugin } from "@platejs/list/react";
import { MarkdownPlugin } from "@platejs/markdown";
import { KEYS } from "platejs";

import { FontKit } from "@/components/editor/plugins/font-kit";
import { LinkKit } from "@/components/editor/plugins/link-kit";
import { MentionKit } from "@/components/editor/plugins/mention-kit";
import { TableKit } from "@/components/editor/plugins/table-kit";
import { TocKit } from "@/components/editor/plugins/toc-kit";
import { BlockquoteElement } from "@/components/editor/ui/blockquote-node";
import {
  BoldLeaf,
  ItalicLeaf,
  StrikethroughLeaf,
  UnderlineLeaf,
} from "@/components/editor/ui/basic-mark-leaves";
import { CodeBlockElement } from "@/components/editor/ui/code-block-node";
import { CodeLeaf } from "@/components/editor/ui/code-node";
import { H1Element, H2Element, H3Element } from "@/components/editor/ui/heading-node";
import { HighlightLeaf } from "@/components/editor/ui/highlight-node";
import { KbdLeaf } from "@/components/editor/ui/kbd-node";
import { BlockList } from "@/components/editor/ui/block-list";
import { HrElement } from "@/components/editor/ui/hr-node";
import { ParagraphElement } from "@/components/editor/ui/paragraph-node";

export const BaseEditorKit = [
  ParagraphPlugin.withComponent(ParagraphElement),
  H1Plugin.withComponent(H1Element),
  H2Plugin.withComponent(H2Element),
  H3Plugin.withComponent(H3Element),
  BlockquotePlugin.withComponent(BlockquoteElement),
  BoldPlugin.withComponent(BoldLeaf),
  ItalicPlugin.withComponent(ItalicLeaf),
  UnderlinePlugin.withComponent(UnderlineLeaf),
  StrikethroughPlugin.withComponent(StrikethroughLeaf),
  CodeBlockPlugin.withComponent(CodeBlockElement),
  CodePlugin.withComponent(CodeLeaf),
  ...LinkKit,
  ...MentionKit,
  BasicMarksPlugin,
  HighlightPlugin.withComponent(HighlightLeaf),
  KbdPlugin.withComponent(KbdLeaf),
  ...FontKit,
  ...TableKit,
  ...TocKit,
  ListPlugin.configure({
    inject: {
      targetPlugins: [
        ...KEYS.heading,
        KEYS.p,
        KEYS.blockquote,
        KEYS.codeBlock,
      ],
    },
    render: {
      belowNodes: BlockList,
    },
  }),
  IndentPlugin,
  HorizontalRulePlugin.configure({
    render: {
      node: HrElement,
    },
  }),
  MarkdownPlugin,
  BlockPlaceholderPlugin.configure({
    options: {
      className:
        "before:absolute before:top-0 before:left-0 before:pointer-events-none before:text-stone-400 before:content-[attr(placeholder)]",
      placeholders: {
        blockquote: "Quote",
        h1: "Heading 1",
        h2: "Heading 2",
        h3: "Heading 3",
        p: "Type '/' for commands, or just start writing...",
      },
      query: ({ path }) => path.length === 1,
    },
  }),
];
