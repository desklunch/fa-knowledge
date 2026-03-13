"use client";

import { markdownToSlateNodes, remarkMdx } from "@platejs/markdown";
import { MentionPlugin } from "@platejs/mention/react";
import { normalizeNodeId } from "platejs";
import { createPlateEditor } from "platejs/react";
import remarkGfm from "remark-gfm";

import { EditorKit } from "./editor-kit";

const EMPTY_VALUE = [{ type: "p", children: [{ text: "" }] }];
const TOC_TOKEN = "[[toc]]";
const MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkMdx];

type EditorTextNode = {
  text: string;
  [key: string]: unknown;
};

type EditorElementNode = {
  type?: string;
  url?: string;
  key?: string;
  value?: string;
  children?: EditorValueNode[];
  [key: string]: unknown;
};

type EditorValueNode = EditorElementNode | EditorTextNode;

function isEditorTextNode(node: EditorValueNode): node is EditorTextNode {
  return "text" in node;
}

function getNodeText(node: EditorValueNode): string {
  if (isEditorTextNode(node) && typeof node.text === "string") {
    return node.text;
  }

  const elementNode = node as EditorElementNode;
  return (elementNode.children ?? []).map((child) => getNodeText(child)).join("");
}

function restoreMentionNodes(nodes: EditorValueNode[]): EditorValueNode[] {
  return nodes.map((node) => {
    if (isEditorTextNode(node)) {
      return node;
    }

    const children = restoreMentionNodes((node.children ?? []) as EditorValueNode[]);
    const url = typeof node.url === "string" ? node.url : null;
    const textContent = getNodeText({ ...node, children } as EditorValueNode).trim();

    if (node.type === "a" && url?.startsWith("mention:")) {
      const mentionKey = decodeURIComponent(url.slice("mention:".length));
      const mentionValue = textContent;

      return {
        type: MentionPlugin.key,
        key: mentionKey,
        value: mentionValue,
        children: [{ text: "" }],
      } satisfies EditorElementNode;
    }

    if (node.type === "p" && textContent === TOC_TOKEN) {
      return {
        type: "toc",
        children: [{ text: "" }],
      } satisfies EditorElementNode;
    }

    return {
      ...node,
      children,
    } satisfies EditorElementNode;
  });
}

export function normalizeValueForMarkdown(nodes: EditorValueNode[]): EditorValueNode[] {
  return nodes.flatMap((node) => {
    if (isEditorTextNode(node)) {
      const normalizedTextNode = { ...node };
      delete normalizedTextNode.underline;
      delete normalizedTextNode.color;
      delete normalizedTextNode.backgroundColor;
      delete normalizedTextNode.fontSize;
      delete normalizedTextNode.fontFamily;
      delete normalizedTextNode.kbd;
      delete normalizedTextNode.highlight;

      return normalizedTextNode;
    }

    if (node.type === "mdxJsxTextElement") {
      return normalizeValueForMarkdown((node.children ?? []) as EditorValueNode[]);
    }

    if (node.type === "html" || node.type === "mdxJsxFlowElement") {
      const textContent = getNodeText(node);

      return {
        type: "p",
        children: textContent ? [{ text: textContent }] : [{ text: "" }],
      } satisfies EditorElementNode;
    }

    if (node.type === "toc") {
      return {
        type: "p",
        children: [{ text: TOC_TOKEN }],
      } satisfies EditorElementNode;
    }

    return {
      ...node,
      children: normalizeValueForMarkdown((node.children ?? []) as EditorValueNode[]),
    } satisfies EditorElementNode;
  });
}

function tryParseEditorDocJson(initialEditorDocJson: unknown) {
  try {
    const parsedValue =
      typeof initialEditorDocJson === "string"
        ? JSON.parse(initialEditorDocJson)
        : initialEditorDocJson;

    if (Array.isArray(parsedValue) && parsedValue.length > 0) {
      return normalizeNodeId(parsedValue);
    }
  } catch {
    return null;
  }

  return null;
}

export function getInitialEditorValue(
  initialMarkdown: string,
  initialEditorDocJson?: unknown,
) {
  const parsedEditorDocJson = tryParseEditorDocJson(initialEditorDocJson);

  if (parsedEditorDocJson) {
    return parsedEditorDocJson;
  }

  return getInitialMarkdownValue(initialMarkdown);
}

export function getInitialMarkdownValue(initialMarkdown: string) {
  if (!initialMarkdown.trim()) {
    return normalizeNodeId(EMPTY_VALUE);
  }

  return normalizeNodeId(deserializeMarkdownValue(initialMarkdown) as typeof EMPTY_VALUE);
}

export function deserializeMarkdownValue(markdown: string) {
  const fallbackEditor = createPlateEditor({
    plugins: EditorKit,
    value: EMPTY_VALUE,
  });

  return restoreMentionNodes(
    markdownToSlateNodes(fallbackEditor, markdown, {
      remarkPlugins: MARKDOWN_REMARK_PLUGINS,
    }) as EditorValueNode[],
  );
}
