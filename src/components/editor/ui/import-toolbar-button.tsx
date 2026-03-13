"use client";

import type { DropdownMenuProps } from "@radix-ui/react-dropdown-menu";
import { ArrowUpToLineIcon } from "lucide-react";
import type { Value } from "platejs";
import { useEditorRef } from "platejs/react";
import { getEditorDOMFromHtmlString } from "platejs/static";
import * as React from "react";
import { useFilePicker } from "use-file-picker";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deserializeMarkdownValue } from "@/components/editor/markdown-value";

import { ToolbarButton } from "./toolbar";

type ImportType = "html" | "markdown";
type InsertMode = "insert" | "replace";

export function ImportToolbarButton(props: DropdownMenuProps) {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);
  const modeRef = React.useRef<InsertMode>("insert");

  const getFileNodes = React.useCallback(
    (text: string, type: ImportType) => {
      if (type === "html") {
        const editorNode = getEditorDOMFromHtmlString(text);
        return editor.api.html.deserialize({ element: editorNode });
      }

      return deserializeMarkdownValue(text);
    },
    [editor],
  );

  const applyNodes = React.useCallback(
    (nodes: Value) => {
      if (modeRef.current === "replace") {
        editor.tf.replaceNodes(nodes, {
          at: [],
          children: true,
        });
      } else {
        editor.tf.insertNodes(nodes);
      }

      requestAnimationFrame(() => {
        try {
          editor.tf.focus();
        } catch {
          // Slate can still have pending operations immediately after large imports.
        }
      });
    },
    [editor],
  );

  const { openFilePicker: openMdFilePicker } = useFilePicker({
    accept: [".md", ".mdx"],
    multiple: false,
    onFilesSelected: async (data: { plainFiles?: File[] }) => {
      const plainFiles = data.plainFiles;
      if (!plainFiles?.[0]) return;
      const text = await plainFiles[0].text();
      applyNodes(getFileNodes(text, "markdown") as Value);
    },
  });

  const { openFilePicker: openHtmlFilePicker } = useFilePicker({
    accept: ["text/html", ".html"],
    multiple: false,
    onFilesSelected: async (data: { plainFiles?: File[] }) => {
      const plainFiles = data.plainFiles;
      if (!plainFiles?.[0]) return;
      const text = await plainFiles[0].text();
      applyNodes(getFileNodes(text, "html") as Value);
    },
  });

  const openPicker = (type: ImportType, mode: InsertMode) => {
    modeRef.current = mode;

    if (type === "html") {
      openHtmlFilePicker();
    } else {
      openMdFilePicker();
    }
  };

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton isDropdown pressed={open} tooltip="Import">
          <ArrowUpToLineIcon className="size-4" />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => openPicker("markdown", "insert")}>
            Insert Markdown file
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openPicker("markdown", "replace")}>
            Replace with Markdown file
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openPicker("html", "insert")}>
            Insert HTML file
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openPicker("html", "replace")}>
            Replace with HTML file
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
