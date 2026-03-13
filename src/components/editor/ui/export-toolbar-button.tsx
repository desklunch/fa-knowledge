"use client";

import { MarkdownPlugin } from "@platejs/markdown";
import type { DropdownMenuProps } from "@radix-ui/react-dropdown-menu";
import { ArrowDownToLineIcon } from "lucide-react";
import { useEditorRef } from "platejs/react";
import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ToolbarButton } from "./toolbar";

type ExportToolbarButtonProps = DropdownMenuProps & {
  filename?: string;
};

export function ExportToolbarButton({ filename = "document", ...props }: ExportToolbarButtonProps) {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);

  const downloadText = React.useCallback((content: string, extension: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.${extension}`;
    document.body.append(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }, [filename]);

  const exportMarkdown = React.useCallback(() => {
    const md = editor.getApi(MarkdownPlugin).markdown.serialize();
    downloadText(md, "md", "text/markdown;charset=utf-8");
  }, [downloadText, editor]);

  const exportHtml = React.useCallback(() => {
    const editorNode = editor.api.toDOMNode(editor);
    const html = editorNode?.innerHTML ?? "";
    downloadText(
      `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${filename}</title></head><body>${html}</body></html>`,
      "html",
      "text/html;charset=utf-8",
    );
  }, [downloadText, editor, filename]);

  const exportJson = React.useCallback(() => {
    downloadText(JSON.stringify(editor.children, null, 2), "json", "application/json;charset=utf-8");
  }, [downloadText, editor.children]);

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton isDropdown pressed={open} tooltip="Export">
          <ArrowDownToLineIcon className="size-4" />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={exportMarkdown}>Export as Markdown</DropdownMenuItem>
          <DropdownMenuItem onSelect={exportHtml}>Export as HTML</DropdownMenuItem>
          <DropdownMenuItem onSelect={exportJson}>Export as JSON</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
