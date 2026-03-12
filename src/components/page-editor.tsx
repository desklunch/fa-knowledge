"use client";

import {
  type ReactNode,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

import { BlockPlaceholderPlugin } from "@platejs/utils/react";
import {
  BasicBlocksPlugin,
  BasicMarksPlugin,
  BlockquotePlugin,
  BoldPlugin,
  CodePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  HorizontalRulePlugin,
  HighlightPlugin,
  ItalicPlugin,
  KbdPlugin,
  StrikethroughPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react";
import { CodeBlockPlugin } from "@platejs/code-block/react";
import { DndPlugin } from "@platejs/dnd";
import { IndentPlugin, useIndentButton, useOutdentButton } from "@platejs/indent/react";
import { LinkPlugin } from "@platejs/link/react";
import { upsertLink } from "@platejs/link";
import { ListPlugin, useListToolbarButton, useListToolbarButtonState } from "@platejs/list/react";
import { MarkdownPlugin, markdownToSlateNodes, serializeMd } from "@platejs/markdown";
import { BlockSelectionPlugin } from "@platejs/selection/react";
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Keyboard,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  SeparatorHorizontal,
  SquareCode,
  Strikethrough,
  Underline,
} from "lucide-react";
import { normalizeNodeId } from "platejs";
import {
  Plate,
  type PlateElementProps,
  createPlateEditor,
  useEditorRef,
  useMarkToolbarButton,
  useMarkToolbarButtonState,
  usePlateEditor,
} from "platejs/react";
import remarkGfm from "remark-gfm";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import { BlockDraggable } from "@/components/ui/block-draggable";
import { BlockSelection } from "@/components/ui/block-selection";
import { Editor, EditorContainer } from "@/components/ui/editor";

type PageEditorProps = {
  initialEditorDocJson: unknown;
  initialMarkdown: string;
  onChange: (payload: {
    contentMarkdown: string;
    editorDocJson: string;
    isDirty: boolean;
  }) => void;
};

export type PageEditorHandle = {
  insertMarkdown: (markdown: string) => void;
  replaceMarkdown: (markdown: string) => void;
};

const EMPTY_VALUE = [{ type: "p", children: [{ text: "" }] }];
const EDITOR_PLUGINS = [
  BasicBlocksPlugin,
  BasicMarksPlugin,
  ListPlugin,
  IndentPlugin,
  CodeBlockPlugin,
  LinkPlugin,
  HorizontalRulePlugin.configure({
    render: {
      node: HorizontalRuleElement,
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
  BlockSelectionPlugin.configure({
    options: {
      enableContextMenu: true,
    },
    render: {
      belowRootNodes: (props) => {
        if (!props.attributes.className?.includes("slate-selectable")) return null;

        return <BlockSelection {...(props as unknown as PlateElementProps)} />;
      },
    },
  }),
  DndPlugin.configure({
    options: {
      enableScroller: true,
    },
    render: {
      aboveNodes: BlockDraggable,
      aboveSlate: ({ children }) => <DndProvider backend={HTML5Backend}>{children}</DndProvider>,
    },
  }),
];

function getInitialValue(initialMarkdown: string) {
  if (!initialMarkdown.trim()) {
    return normalizeNodeId(EMPTY_VALUE);
  }

  const fallbackEditor = createPlateEditor({
    plugins: EDITOR_PLUGINS,
    value: EMPTY_VALUE,
  });

  return normalizeNodeId(
    markdownToSlateNodes(fallbackEditor, initialMarkdown, {
      remarkPlugins: [remarkGfm],
    }) as typeof EMPTY_VALUE,
  );
}

export const PageEditor = forwardRef<PageEditorHandle, PageEditorProps>(function PageEditor({
  initialMarkdown,
  onChange,
}, ref) {
  const [initialValue] = useState(() =>
    normalizeNodeId(getInitialValue(initialMarkdown)),
  );
  const [contentMarkdown, setContentMarkdown] = useState(initialMarkdown);
  const [editorDocJson, setEditorDocJson] = useState(() => JSON.stringify(initialValue));
  const editor = usePlateEditor({
    plugins: EDITOR_PLUGINS,
    value: initialValue,
  });

  useImperativeHandle(
    ref,
    () => ({
      insertMarkdown: (markdown: string) => {
        if (!editor || !markdown.trim()) {
          return;
        }

        const nodes = getInitialValue(markdown);
        editor.tf.insertNodes(nodes);
      },
      replaceMarkdown: (markdown: string) => {
        if (!editor) {
          return;
        }

        const nodes = getInitialValue(markdown);
        editor.tf.replaceNodes(nodes, {
          at: [],
          children: true,
        });
      },
    }),
    [editor],
  );

  useEffect(() => {
    onChange({
      contentMarkdown,
      editorDocJson,
      isDirty: contentMarkdown !== initialMarkdown,
    });
  }, [contentMarkdown, editorDocJson, initialMarkdown, onChange]);

  if (!editor) {
    return null;
  }

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <Plate
        editor={editor}
        onValueChange={({ value }) => {
          const normalizedValue = normalizeNodeId(value as typeof EMPTY_VALUE);
          const nextEditorDocJson = JSON.stringify(normalizedValue);
          const nextContentMarkdown = serializeMd(editor, {
            value: normalizedValue,
            remarkPlugins: [remarkGfm],
          });

          setEditorDocJson(nextEditorDocJson);
          setContentMarkdown(nextContentMarkdown);
        }}
      >
        <EditorContainer className="flex min-h-0 flex-1 flex-col overflow-hidden  bg-white shadow-[0_24px_80px_-48px_rgba(28,25,23,0.55)]">
          <Toolbar />
          <Editor
            className="min-h-0 flex-1 overflow-y-auto text-base leading-8 text-stone-800 [&_[data-slate-node='element']]:my-3 [&_[data-slate-node='text']]:leading-8 [&_a]:text-sky-700 [&_a]:underline [&_a]:decoration-sky-300 [&_blockquote]:border-l-4 [&_blockquote]:border-amber-300 [&_blockquote]:bg-amber-50/70 [&_blockquote]:px-5 [&_blockquote]:py-3 [&_blockquote]:italic [&_code]:rounded-md [&_code]:bg-stone-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_h1]:mt-8 [&_h1]:text-5xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mt-7 [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-2xl [&_h3]:font-semibold [&_li>p]:my-0 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:bg-stone-950 [&_pre]:p-5 [&_pre]:text-[0.95rem] [&_pre]:leading-7 [&_pre]:text-stone-100 [&_strong]:font-semibold [&_u]:decoration-2 [&_ul]:list-disc [&_ul]:pl-6"
            placeholder="Write here..."
          />
        </EditorContainer>
      </Plate>
    </div>
  );
});

function HorizontalRuleElement({ attributes, children }: PlateElementProps) {
  return (
    <div {...attributes}>
      <div contentEditable={false} className="my-6">
        <hr className="border-0 border-t border-stone-300" />
      </div>
      {children}
    </div>
  );
}

function Toolbar() {
  const editor = useEditorRef();

  return (
    <div className="sticky top-0 left-0 z-20 w-full overflow-x-auto border-b border-stone-200 bg-white/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex min-w-max items-center gap-1">
        <ToolbarGroup>
          <ToolbarButton label="Paragraph" onClick={() => editor.tf.toggleBlock("p")}>
            <Pilcrow className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Heading 1" onClick={() => editor.tf.toggleBlock(H1Plugin.key)}>
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Heading 2" onClick={() => editor.tf.toggleBlock(H2Plugin.key)}>
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Heading 3" onClick={() => editor.tf.toggleBlock(H3Plugin.key)}>
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Quote"
            onClick={() => editor.tf.toggleBlock(BlockquotePlugin.key)}
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
        </ToolbarGroup>

        <ToolbarSeparator />

        <ToolbarGroup>
          <MarkButton label="Bold" nodeType={BoldPlugin.key}>
            <Bold className="h-4 w-4" />
          </MarkButton>
          <MarkButton label="Italic" nodeType={ItalicPlugin.key}>
            <Italic className="h-4 w-4" />
          </MarkButton>
          <MarkButton label="Underline" nodeType={UnderlinePlugin.key}>
            <Underline className="h-4 w-4" />
          </MarkButton>
          <MarkButton label="Strike" nodeType={StrikethroughPlugin.key}>
            <Strikethrough className="h-4 w-4" />
          </MarkButton>
          <MarkButton label="Highlight" nodeType={HighlightPlugin.key}>
            <Highlighter className="h-4 w-4" />
          </MarkButton>
          <MarkButton label="Key" nodeType={KbdPlugin.key}>
            <Keyboard className="h-4 w-4" />
          </MarkButton>
          <ToolbarButton
            label="Inline code"
            onClick={() => editor.tf.toggleMark(CodePlugin.key)}
          >
            <Code2 className="h-4 w-4" />
          </ToolbarButton>
        </ToolbarGroup>

        <ToolbarSeparator />

        <ToolbarGroup>
          <ListButton label="Bulleted list" nodeType="disc">
            <List className="h-4 w-4" />
          </ListButton>
          <ListButton label="Numbered list" nodeType="decimal">
            <ListOrdered className="h-4 w-4" />
          </ListButton>
          <ToolbarButton
            label="Link"
            onMouseDown={(event) => {
              event.preventDefault();
              promptForLink(editor);
            }}
          >
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Horizontal rule"
            onMouseDown={(event) => {
              event.preventDefault();
              insertHorizontalRule(editor);
            }}
          >
            <SeparatorHorizontal className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Code block"
            onClick={() => editor.tf.toggleBlock("code_block")}
          >
            <SquareCode className="h-4 w-4" />
          </ToolbarButton>
          <IndentToolbarButton />
          <OutdentToolbarButton />
        </ToolbarGroup>

        <div className="ml-3 hidden items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-500 lg:flex">
          <span>Markdown shortcuts enabled</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-stone-400">
            # * &gt;
          </span>
        </div>
      </div>
    </div>
  );
}

function promptForLink(editor: ReturnType<typeof useEditorRef>) {
  const url = window.prompt("Enter link URL");

  if (!url) {
    return;
  }

  editor.tf.focus();
  upsertLink(editor, {
    text: editor.api.string(editor.selection) || url,
    url: normalizeUrl(url),
  });
}

function insertHorizontalRule(editor: ReturnType<typeof useEditorRef>) {
  editor.tf.focus();
  editor.tf.insertNodes({
    type: HorizontalRulePlugin.key,
    children: [{ text: "" }],
  });
}

function normalizeUrl(url: string) {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return "";
  }

  if (
    trimmedUrl.startsWith("/") ||
    trimmedUrl.startsWith("#") ||
    /^[a-z]+:/i.test(trimmedUrl)
  ) {
    return trimmedUrl;
  }

  return `https://${trimmedUrl}`;
}

function ToolbarGroup({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">{children}</div>
  );
}

function ToolbarSeparator() {
  return <div className="mx-2 h-6 w-px shrink-0 bg-stone-200" />;
}

function IndentToolbarButton() {
  const { props } = useIndentButton();

  return (
    <ToolbarButton label="Indent" onClick={props.onClick} onMouseDown={props.onMouseDown}>
      <IndentIncrease className="h-4 w-4" />
    </ToolbarButton>
  );
}

function OutdentToolbarButton() {
  const { props } = useOutdentButton();

  return (
    <ToolbarButton label="Outdent" onClick={props.onClick} onMouseDown={props.onMouseDown}>
      <IndentDecrease className="h-4 w-4" />
    </ToolbarButton>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
  onMouseDown,
  pressed = false,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  onMouseDown?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => {
        if (onMouseDown) {
          onMouseDown(event);
          return;
        }

        event.preventDefault();
      }}
      onClick={onClick}
      title={label}
      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2.5 text-sm font-medium transition ${
        pressed
          ? "bg-stone-900 text-white shadow-sm"
          : "text-stone-700 hover:bg-stone-100 hover:text-stone-900"
      }`}
      aria-pressed={pressed}
    >
      {children}
    </button>
  );
}

function MarkButton({
  children,
  label,
  nodeType,
}: {
  children: ReactNode;
  label: string;
  nodeType: string;
}) {
  const state = useMarkToolbarButtonState({ nodeType });
  const { props } = useMarkToolbarButton(state);

  return (
    <ToolbarButton
      label={label}
      pressed={state.pressed}
      onClick={props.onClick}
      onMouseDown={props.onMouseDown}
    >
      {children}
    </ToolbarButton>
  );
}

function ListButton({
  children,
  label,
  nodeType,
}: {
  children: ReactNode;
  label: string;
  nodeType: string;
}) {
  const state = useListToolbarButtonState({ nodeType });
  const { props } = useListToolbarButton(state);

  return (
    <ToolbarButton
      label={label}
      pressed={state.pressed}
      onClick={props.onClick}
      onMouseDown={props.onMouseDown}
    >
      {children}
    </ToolbarButton>
  );
}
