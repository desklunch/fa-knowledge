"use client";

import {
  BaselineIcon,
  BoldIcon,
  Code2Icon,
  EllipsisIcon,
  HighlighterIcon,
  ItalicIcon,
  KeyboardIcon,
  PaintBucketIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from "lucide-react";
import { KEYS } from "platejs";
import * as React from "react";

import { useEditor } from "../editor-kit";

import { FixedToolbar } from "./fixed-toolbar";
import { ExportToolbarButton } from "./export-toolbar-button";
import {
  DEFAULT_BACKGROUND_COLORS,
  DEFAULT_COLORS,
  FontColorToolbarButton,
} from "./font-color-toolbar-button";
import { RedoToolbarButton, UndoToolbarButton } from "./history-toolbar-button";
import { IndentToolbarButton, OutdentToolbarButton } from "./indent-toolbar-button";
import { ImportToolbarButton } from "./import-toolbar-button";
import { InsertToolbarButton } from "./insert-toolbar-button";
import { BulletedListToolbarButton, NumberedListToolbarButton, TodoListToolbarButton } from "./list-toolbar-button";
import { LinkToolbarButton } from "./link-toolbar-button";
import { MarkToolbarButton } from "./mark-toolbar-button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Separator } from "./separator";
import { TableToolbarButton } from "./table-toolbar-button";
import { ToolbarButton } from "./toolbar";
import { TurnIntoToolbarButton } from "./turn-into-toolbar-button";

type ToolbarAction = {
  group: string;
  id: string;
  render: () => React.ReactNode;
};

const GROUP_SEPARATOR_WIDTH = 13;
const FALLBACK_OVERFLOW_TRIGGER_WIDTH = 40;

export function FixedToolbarButtons({ exportFilename }: { exportFilename?: string }) {
  const editor = useEditor();
  const [visibleCount, setVisibleCount] = React.useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const overflowTriggerMeasureRef = React.useRef<HTMLDivElement | null>(null);
  const measureRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const actions = React.useMemo<ToolbarAction[]>(
    () => [
      {
        group: "history",
        id: "undo",
        render: () => <UndoToolbarButton />,
      },
      {
        group: "history",
        id: "redo",
        render: () => <RedoToolbarButton />,
      },
      {
        group: "file",
        id: "export",
        render: () => <ExportToolbarButton filename={exportFilename} />,
      },
      {
        group: "file",
        id: "import",
        render: () => <ImportToolbarButton />,
      },
      {
        group: "insert",
        id: "insert",
        render: () => <InsertToolbarButton />,
      },
      {
        group: "insert",
        id: "turn-into",
        render: () => <TurnIntoToolbarButton />,
      },
      {
        group: "marks",
        id: "bold",
        render: () => (
          <MarkToolbarButton nodeType={KEYS.bold} tooltip="Bold">
            <BoldIcon className="h-4 w-4" />
          </MarkToolbarButton>
        ),
      },
      {
        group: "marks",
        id: "italic",
        render: () => (
          <MarkToolbarButton nodeType={KEYS.italic} tooltip="Italic">
            <ItalicIcon className="h-4 w-4" />
          </MarkToolbarButton>
        ),
      },
      {
        group: "marks",
        id: "underline",
        render: () => (
          <MarkToolbarButton nodeType={KEYS.underline} tooltip="Underline">
            <UnderlineIcon className="h-4 w-4" />
          </MarkToolbarButton>
        ),
      },
      {
        group: "marks",
        id: "strikethrough",
        render: () => (
          <MarkToolbarButton nodeType={KEYS.strikethrough} tooltip="Strikethrough">
            <StrikethroughIcon className="h-4 w-4" />
          </MarkToolbarButton>
        ),
      },
      {
        group: "marks",
        id: "code",
        render: () => (
          <MarkToolbarButton nodeType={KEYS.code} tooltip="Code">
            <Code2Icon className="h-4 w-4" />
          </MarkToolbarButton>
        ),
      },
      {
        group: "marks",
        id: "highlight",
        render: () => (
          <MarkToolbarButton nodeType={KEYS.highlight} tooltip="Highlight">
            <HighlighterIcon className="h-4 w-4" />
          </MarkToolbarButton>
        ),
      },
      {
        group: "marks",
        id: "text-color",
        render: () => (
          <FontColorToolbarButton
            colors={DEFAULT_COLORS}
            nodeType={KEYS.color}
            tooltip="Text color"
          >
            <BaselineIcon className="h-4 w-4" />
          </FontColorToolbarButton>
        ),
      },
      {
        group: "marks",
        id: "background-color",
        render: () => (
          <FontColorToolbarButton
            colors={DEFAULT_BACKGROUND_COLORS}
            nodeType={KEYS.backgroundColor}
            tooltip="Background color"
          >
            <PaintBucketIcon className="h-4 w-4" />
          </FontColorToolbarButton>
        ),
      },
      {
        group: "marks",
        id: "keyboard",
        render: () => (
          <MarkToolbarButton nodeType={KEYS.kbd} tooltip="Keyboard">
            <KeyboardIcon className="h-4 w-4" />
          </MarkToolbarButton>
        ),
      },
      {
        group: "lists",
        id: "numbered-list",
        render: () => <NumberedListToolbarButton />,
      },
      {
        group: "lists",
        id: "bulleted-list",
        render: () => <BulletedListToolbarButton />,
      },
      {
        group: "lists",
        id: "todo-list",
        render: () => <TodoListToolbarButton />,
      },
      {
        group: "lists",
        id: "link",
        render: () => <LinkToolbarButton />,
      },
      {
        group: "lists",
        id: "table",
        render: () => <TableToolbarButton />,
      },
      {
        group: "structure",
        id: "code-block",
        render: () => (
          <ToolbarButton
            onClick={() => editor.tf.toggleBlock("code_block")}
            onMouseDown={(event) => event.preventDefault()}
            tooltip="Code block"
          >
            <Code2Icon className="h-4 w-4" />
          </ToolbarButton>
        ),
      },
      {
        group: "structure",
        id: "outdent",
        render: () => <OutdentToolbarButton />,
      },
      {
        group: "structure",
        id: "indent",
        render: () => <IndentToolbarButton />,
      },
    ],
    [editor, exportFilename],
  );

  React.useEffect(() => {
    const calculateVisibleCount = () => {
      const containerWidth = containerRef.current?.getBoundingClientRect().width ?? 0;

      if (!containerWidth) {
        setVisibleCount(actions.length);
        return;
      }

      const actionWidths = actions.map(
        (action) => measureRefs.current[action.id]?.getBoundingClientRect().width ?? 0,
      );

      if (actionWidths.some((width) => width === 0)) {
        setVisibleCount(actions.length);
        return;
      }

      const totalWidth = actionWidths.reduce((sum, width, index) => {
        const separatorWidth =
          index > 0 && actions[index - 1]?.group !== actions[index]?.group
            ? GROUP_SEPARATOR_WIDTH
            : 0;

        return sum + width + separatorWidth;
      }, 0);

      let availableWidth = containerWidth;

      if (totalWidth > containerWidth) {
        availableWidth -=
          overflowTriggerMeasureRef.current?.getBoundingClientRect().width ??
          FALLBACK_OVERFLOW_TRIGGER_WIDTH;
      }

      let nextVisibleCount = actions.length;
      let consumedWidth = 0;

      for (const [index, width] of actionWidths.entries()) {
        const separatorWidth =
          index > 0 && actions[index - 1]?.group !== actions[index]?.group
            ? GROUP_SEPARATOR_WIDTH
            : 0;

        if (consumedWidth + separatorWidth + width > availableWidth) {
          nextVisibleCount = index;
          break;
        }

        consumedWidth += separatorWidth + width;
      }

      setVisibleCount(Math.max(0, nextVisibleCount));
    };

    calculateVisibleCount();

    const resizeObserver = new ResizeObserver(calculateVisibleCount);

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    for (const action of actions) {
      const node = measureRefs.current[action.id];

      if (node) {
        resizeObserver.observe(node);
      }
    }

    if (overflowTriggerMeasureRef.current) {
      resizeObserver.observe(overflowTriggerMeasureRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [actions]);

  const resolvedVisibleCount = visibleCount ?? actions.length;
  const visibleActions = actions.slice(0, resolvedVisibleCount);
  const overflowActions = actions.slice(resolvedVisibleCount);

  return (
    <FixedToolbar>
      <div className="flex w-full min-w-0 items-center" ref={containerRef}>
        <div className="flex min-w-0 flex-1 items-center overflow-hidden">
          {visibleActions.map((action, index) => (
            <React.Fragment key={action.id}>
              {index > 0 && visibleActions[index - 1]?.group !== action.group ? (
                <div className="mx-1.5 shrink-0 py-0.5">
                  <Separator orientation="vertical" />
                </div>
              ) : null}
              <div className="shrink-0">{action.render()}</div>
            </React.Fragment>
          ))}
        </div>

        {overflowActions.length > 0 ? (
          <>
            {visibleActions.length > 0 ? (
              <div className="mx-1.5 shrink-0 py-0.5">
                <Separator orientation="vertical" />
              </div>
            ) : null}
            <OverflowToolbarButton actions={overflowActions} />
          </>
        ) : null}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] top-0 flex h-0 overflow-hidden opacity-0"
      >
        {actions.map((action, index) => (
          <React.Fragment key={action.id}>
            {index > 0 && actions[index - 1]?.group !== action.group ? (
              <div className="mx-1.5 shrink-0 py-0.5">
                <Separator orientation="vertical" />
              </div>
            ) : null}
            <div
              className="shrink-0"
              ref={(node) => {
                measureRefs.current[action.id] = node;
              }}
            >
              {action.render()}
            </div>
          </React.Fragment>
        ))}
        <div className="shrink-0" ref={overflowTriggerMeasureRef}>
          <ToolbarButton tooltip="More tools">
            <EllipsisIcon className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>
    </FixedToolbar>
  );
}

function OverflowToolbarButton({ actions }: { actions: ToolbarAction[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <div className="shrink-0">
          <ToolbarButton pressed={open} tooltip="More tools">
            <EllipsisIcon className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-[320px] p-2">
        <div className="flex max-w-[280px] flex-wrap gap-1">
          {actions.map((action) => (
            <div className="shrink-0" key={action.id}>
              {action.render()}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
