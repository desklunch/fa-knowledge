"use client";

import { DndPlugin, getDropPath, useDraggable, useDropLine } from "@platejs/dnd";
import {
  BlockSelectionPlugin,
  useBlockSelected,
} from "@platejs/selection/react";
import { setCellBackground } from "@platejs/table";
import {
  TablePlugin,
  TableProvider,
  useTableBordersDropdownMenuContentState,
  useTableCellElement,
  useTableCellElementResizable,
  useTableElement,
  useTableMergeState,
} from "@platejs/table/react";
import type * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { PopoverAnchor } from "@radix-ui/react-popover";
import { cva } from "class-variance-authority";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CombineIcon,
  EraserIcon,
  Grid2X2Icon,
  GripVertical,
  PaintBucketIcon,
  SquareSplitHorizontalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import {
  KEYS,
  PathApi,
  type TElement,
  type TTableCellElement,
  type TTableElement,
  type TTableRowElement,
} from "platejs";
import {
  PlateElement,
  type PlateElementProps,
  useComposedRef,
  useEditorPlugin,
  useEditorRef,
  useEditorSelector,
  useElement,
  useElementSelector,
  useFocusedLast,
  usePluginOption,
  useReadOnly,
  useRemoveNodeButton,
  useSelected,
  withHOC,
} from "platejs/react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { blockSelectionVariants } from "@/components/ui/block-selection";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent } from "@/components/editor/ui/popover";
import { cn } from "@/lib/utils";

import {
  ColorDropdownMenuItems,
  DEFAULT_BACKGROUND_COLORS,
} from "./font-color-toolbar-button";
import { ResizeHandle } from "./resize-handle";
import {
  BorderAllIcon,
  BorderBottomIcon,
  BorderLeftIcon,
  BorderNoneIcon,
  BorderRightIcon,
  BorderTopIcon,
} from "./table-icons";
import { Toolbar, ToolbarButton, ToolbarGroup } from "./toolbar";

export const TableElement = withHOC(
  TableProvider,
  function TableElement({
    children,
    ...props
  }: PlateElementProps<TTableElement>) {
    const readOnly = useReadOnly();
    const isSelectionAreaVisible = usePluginOption(
      BlockSelectionPlugin,
      "isSelectionAreaVisible",
    );
    const hasControls = !readOnly && !isSelectionAreaVisible;
    const { isSelectingCell, marginLeft, props: tableProps } = useTableElement();
    const isSelectingTable = useBlockSelected(props.element.id as string);

    const content = (
      <PlateElement
        {...props}
        className={cn(
          "overflow-x-auto py-5",
          hasControls && "-ml-2 *:data-[slot=block-selection]:left-2",
        )}
        style={{ paddingLeft: marginLeft }}
      >
        <div className="group/table relative w-fit">
          <table
            className={cn(
              "mr-0 ml-px table h-px table-fixed border-collapse",
              isSelectingCell && "selection:bg-transparent",
            )}
            {...tableProps}
          >
            <tbody className="min-w-full">{children}</tbody>
          </table>

          {isSelectingTable ? (
            <div className={blockSelectionVariants()} contentEditable={false} />
          ) : null}
        </div>
      </PlateElement>
    );

    if (readOnly) return content;

    return <TableFloatingToolbar>{content}</TableFloatingToolbar>;
  },
);

function TableFloatingToolbar({
  children,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  const { tf } = useEditorPlugin(TablePlugin);
  const selected = useSelected();
  const element = useElement<TTableElement>();
  const { props: buttonProps } = useRemoveNodeButton({ element });
  const collapsedInside = useEditorSelector(
    (editor) => selected && editor.api.isCollapsed(),
    [selected],
  );
  const isFocusedLast = useFocusedLast();
  const { canMerge, canSplit } = useTableMergeState();

  return (
    <Popover
      modal={false}
      open={isFocusedLast && (canMerge || canSplit || collapsedInside)}
    >
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        asChild
        contentEditable={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
        side="top"
        sideOffset={10}
        variant={null}
        {...props}
      >
        <Toolbar
          className="flex w-auto max-w-[80vw] flex-row overflow-x-auto rounded-xl border border-stone-200 bg-white p-1 shadow-xl"
          contentEditable={false}
        >
          <ToolbarGroup>
            <ColorDropdownMenu tooltip="Background color">
              <PaintBucketIcon className="size-4" />
            </ColorDropdownMenu>
            {canMerge ? (
              <ToolbarButton
                onClick={() => tf.table.merge()}
                onMouseDown={(event) => event.preventDefault()}
                tooltip="Merge cells"
              >
                <CombineIcon className="size-4" />
              </ToolbarButton>
            ) : null}
            {canSplit ? (
              <ToolbarButton
                onClick={() => tf.table.split()}
                onMouseDown={(event) => event.preventDefault()}
                tooltip="Split cell"
              >
                <SquareSplitHorizontalIcon className="size-4" />
              </ToolbarButton>
            ) : null}

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <ToolbarButton tooltip="Cell borders">
                  <Grid2X2Icon className="size-4" />
                </ToolbarButton>
              </DropdownMenuTrigger>

              <DropdownMenuPortal>
                <TableBordersDropdownMenuContent />
              </DropdownMenuPortal>
            </DropdownMenu>

            {collapsedInside ? (
              <ToolbarButton tooltip="Delete table" {...buttonProps}>
                <Trash2Icon className="size-4" />
              </ToolbarButton>
            ) : null}
          </ToolbarGroup>

          {collapsedInside ? (
            <ToolbarGroup>
              <ToolbarButton
                onClick={() => tf.insert.tableRow({ before: true })}
                onMouseDown={(event) => event.preventDefault()}
                tooltip="Insert row before"
              >
                <ArrowUp className="size-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => tf.insert.tableRow()}
                onMouseDown={(event) => event.preventDefault()}
                tooltip="Insert row after"
              >
                <ArrowDown className="size-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => tf.remove.tableRow()}
                onMouseDown={(event) => event.preventDefault()}
                tooltip="Delete row"
              >
                <XIcon className="size-4" />
              </ToolbarButton>
            </ToolbarGroup>
          ) : null}

          {collapsedInside ? (
            <ToolbarGroup>
              <ToolbarButton
                onClick={() => tf.insert.tableColumn({ before: true })}
                onMouseDown={(event) => event.preventDefault()}
                tooltip="Insert column before"
              >
                <ArrowLeft className="size-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => tf.insert.tableColumn()}
                onMouseDown={(event) => event.preventDefault()}
                tooltip="Insert column after"
              >
                <ArrowRight className="size-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => tf.remove.tableColumn()}
                onMouseDown={(event) => event.preventDefault()}
                tooltip="Delete column"
              >
                <XIcon className="size-4" />
              </ToolbarButton>
            </ToolbarGroup>
          ) : null}
        </Toolbar>
      </PopoverContent>
    </Popover>
  );
}

function TableBordersDropdownMenuContent(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Content>,
) {
  const editor = useEditorRef();
  const {
    getOnSelectTableBorder,
    hasBottomBorder,
    hasLeftBorder,
    hasNoBorders,
    hasOuterBorders,
    hasRightBorder,
    hasTopBorder,
  } = useTableBordersDropdownMenuContentState();

  return (
    <DropdownMenuContent
      align="start"
      className="min-w-[220px]"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        editor.tf.focus();
      }}
      side="right"
      sideOffset={0}
      {...props}
    >
      <DropdownMenuGroup>
        <DropdownMenuCheckboxItem checked={hasTopBorder} onCheckedChange={getOnSelectTableBorder("top")}>
          <BorderTopIcon />
          <div>Top border</div>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={hasRightBorder} onCheckedChange={getOnSelectTableBorder("right")}>
          <BorderRightIcon />
          <div>Right border</div>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={hasBottomBorder} onCheckedChange={getOnSelectTableBorder("bottom")}>
          <BorderBottomIcon />
          <div>Bottom border</div>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={hasLeftBorder} onCheckedChange={getOnSelectTableBorder("left")}>
          <BorderLeftIcon />
          <div>Left border</div>
        </DropdownMenuCheckboxItem>
      </DropdownMenuGroup>

      <DropdownMenuGroup>
        <DropdownMenuCheckboxItem checked={hasNoBorders} onCheckedChange={getOnSelectTableBorder("none")}>
          <BorderNoneIcon />
          <div>No borders</div>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={hasOuterBorders} onCheckedChange={getOnSelectTableBorder("outer")}>
          <BorderAllIcon />
          <div>Outside borders</div>
        </DropdownMenuCheckboxItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  );
}

function ColorDropdownMenu({
  children,
  tooltip,
}: {
  children: React.ReactNode;
  tooltip: string;
}) {
  const [open, setOpen] = React.useState(false);
  const editor = useEditorRef();
  const selectedCells = usePluginOption(TablePlugin, "selectedCells");

  const onUpdateColor = React.useCallback(
    (color: string) => {
      setOpen(false);
      setCellBackground(editor, { color, selectedCells: selectedCells ?? [] });
    },
    [editor, selectedCells],
  );

  const onClearColor = React.useCallback(() => {
    setOpen(false);
    setCellBackground(editor, {
      color: null,
      selectedCells: selectedCells ?? [],
    });
  }, [editor, selectedCells]);

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton tooltip={tooltip}>{children}</ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <div className="p-2">
          <ColorDropdownMenuItems
            colors={DEFAULT_BACKGROUND_COLORS}
            updateColor={onUpdateColor}
          />
        </div>
        <DropdownMenuGroup>
          <DropdownMenuItem className="p-2" onClick={onClearColor}>
            <EraserIcon className="size-4" />
            <span>Clear</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TableRowElement({
  children,
  ...props
}: PlateElementProps<TTableRowElement>) {
  const { element } = props;
  const readOnly = useReadOnly();
  const selected = useSelected();
  const isSelectionAreaVisible = usePluginOption(
    BlockSelectionPlugin,
    "isSelectionAreaVisible",
  );
  const hasControls = !readOnly && !isSelectionAreaVisible;

  const { isDragging, nodeRef, previewRef, handleRef } = useDraggable({
    element,
    type: element.type,
    canDropNode: ({ dragEntry, dropEntry }) =>
      PathApi.equals(PathApi.parent(dragEntry[1]), PathApi.parent(dropEntry[1])),
    onDropHandler: (dropEditor, { dragItem, monitor, nodeRef }) => {
      const dragElement = (dragItem as { element: TElement }).element;

      if (!dragElement) return;

      const result = getDropPath(dropEditor, {
        dragItem,
        element,
        monitor,
        nodeRef,
        orientation: "vertical",
      });

      if (!result) return;

      dropEditor.tf.moveNodes({
        at: result.dragPath,
        to: result.to,
      });

      dropEditor.setOption(DndPlugin, "dropTarget", undefined);
      return true;
    },
  });

  return (
    <PlateElement
      {...props}
      as="tr"
      attributes={{
        ...props.attributes,
        "data-selected": selected ? "true" : undefined,
      }}
      className={cn("group/row", isDragging && "opacity-50")}
      ref={useComposedRef(props.ref, previewRef, nodeRef)}
    >
      {hasControls ? (
        <td className="w-2 select-none" contentEditable={false}>
          <RowDragHandle dragRef={handleRef} />
          <RowDropLine />
        </td>
      ) : null}

      {children}
    </PlateElement>
  );
}

function RowDragHandle({ dragRef }: { dragRef: React.Ref<HTMLButtonElement> }) {
  const editor = useEditorRef();
  const element = useElement();

  return (
    <Button
      className={cn(
        "-translate-y-1/2 absolute top-1/2 left-0 z-51 h-6 w-4 p-0 focus-visible:ring-0 focus-visible:ring-offset-0",
        "cursor-grab active:cursor-grabbing",
        "opacity-0 transition-opacity duration-100 group-hover/row:opacity-100 group-has-data-[resizing='true']/row:opacity-0",
      )}
      onClick={() => {
        editor.tf.select(element);
      }}
      ref={dragRef}
      variant="outline"
    >
      <GripVertical className="text-stone-500" />
    </Button>
  );
}

function RowDropLine() {
  const { dropLine } = useDropLine();

  if (!dropLine) return null;

  return (
    <div
      className={cn(
        "absolute inset-x-0 left-2 z-50 h-0.5 bg-sky-500/60",
        dropLine === "top" ? "-top-px" : "-bottom-px",
      )}
    />
  );
}

export function TableCellElement({
  isHeader,
  ...props
}: PlateElementProps<TTableCellElement> & {
  isHeader?: boolean;
}) {
  const { api } = useEditorPlugin(TablePlugin);
  const readOnly = useReadOnly();
  const element = props.element;
  const tableId = useElementSelector(([node]) => node.id as string, [], {
    key: KEYS.table,
  });
  const rowId = useElementSelector(([node]) => node.id as string, [], {
    key: KEYS.tr,
  });
  const isSelectingTable = useBlockSelected(tableId);
  const isSelectingRow = useBlockSelected(rowId) || isSelectingTable;
  const isSelectionAreaVisible = usePluginOption(
    BlockSelectionPlugin,
    "isSelectionAreaVisible",
  );
  const { borders, colIndex, colSpan, minHeight, rowIndex, selected, width } =
    useTableCellElement();
  const { bottomProps, hiddenLeft, leftProps, rightProps } =
    useTableCellElementResizable({
      colIndex,
      colSpan,
      rowIndex,
    });

  return (
    <PlateElement
      {...props}
      as={isHeader ? "th" : "td"}
      attributes={{
        ...props.attributes,
        colSpan: api.table.getColSpan(element),
        rowSpan: api.table.getRowSpan(element),
      }}
      className={cn(
        "h-full overflow-visible border-none bg-white p-0",
        element.background ? "bg-[var(--cellBackground)]" : "bg-white",
        isHeader && "text-left",
        "before:absolute before:inset-0 before:box-border before:select-none before:content-['']",
        selected && "before:z-10 before:bg-sky-500/8",
        borders.bottom?.size && "before:border-b before:border-b-stone-300/80",
        borders.right?.size && "before:border-r before:border-r-stone-300/80",
        borders.left?.size && "before:border-l before:border-l-stone-300/80",
        borders.top?.size && "before:border-t before:border-t-stone-300/80",
      )}
      style={
        {
          "--cellBackground": element.background,
          maxWidth: width || 240,
          minWidth: width || 150,
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          "relative z-20 box-border h-full px-5 py-2.5 text-[17px] leading-[1.35] text-stone-800",
          isHeader &&
            "bg-stone-50/70 text-left text-[17px] font-semibold tracking-tight text-stone-950",
        )}
        style={{ minHeight: isHeader ? Math.max(minHeight ?? 0, 52) : Math.max(minHeight ?? 0, 54) }}
      >
        {props.children}
      </div>

      {!isSelectionAreaVisible ? (
        <div
          className="group absolute top-0 size-full select-none"
          contentEditable={false}
          suppressContentEditableWarning={true}
        >
          {!readOnly ? (
            <>
              <ResizeHandle
                {...rightProps}
                className="-top-2 -right-1 h-[calc(100%_+_8px)] w-2"
                data-col={colIndex}
              />
              <ResizeHandle {...bottomProps} className="-bottom-1 h-2" />
              {!hiddenLeft ? (
                <ResizeHandle
                  {...leftProps}
                  className="-left-1 top-0 w-2"
                  data-resizer-left={colIndex === 0 ? "true" : undefined}
                />
              ) : null}

              <div
                className={cn(
                  "absolute top-0 z-30 hidden h-full w-1 bg-sky-500/60",
                  "right-[-1.5px]",
                  columnResizeVariants({ colIndex: String(colIndex) as ColumnResizeIndex }),
                )}
              />
              {colIndex === 0 ? (
                <div
                  className={cn(
                    "absolute top-0 z-30 h-full w-1 bg-sky-500/60",
                    "left-[-1.5px]",
                    "hidden group-has-[[data-resizer-left]:hover]/table:block group-has-[[data-resizer-left][data-resizing='true']]/table:block",
                  )}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {isSelectingRow ? (
        <div className={blockSelectionVariants()} contentEditable={false} />
      ) : null}
    </PlateElement>
  );
}

export function TableCellHeaderElement(
  props: React.ComponentProps<typeof TableCellElement>,
) {
  return <TableCellElement {...props} isHeader />;
}

type ColumnResizeIndex =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10";

const columnResizeVariants = cva("hidden", {
  variants: {
    colIndex: {
      "0": "group-has-[[data-col='0']:hover]/table:block group-has-[[data-col='0'][data-resizing='true']]/table:block",
      "1": "group-has-[[data-col='1']:hover]/table:block group-has-[[data-col='1'][data-resizing='true']]/table:block",
      "2": "group-has-[[data-col='2']:hover]/table:block group-has-[[data-col='2'][data-resizing='true']]/table:block",
      "3": "group-has-[[data-col='3']:hover]/table:block group-has-[[data-col='3'][data-resizing='true']]/table:block",
      "4": "group-has-[[data-col='4']:hover]/table:block group-has-[[data-col='4'][data-resizing='true']]/table:block",
      "5": "group-has-[[data-col='5']:hover]/table:block group-has-[[data-col='5'][data-resizing='true']]/table:block",
      "6": "group-has-[[data-col='6']:hover]/table:block group-has-[[data-col='6'][data-resizing='true']]/table:block",
      "7": "group-has-[[data-col='7']:hover]/table:block group-has-[[data-col='7'][data-resizing='true']]/table:block",
      "8": "group-has-[[data-col='8']:hover]/table:block group-has-[[data-col='8'][data-resizing='true']]/table:block",
      "9": "group-has-[[data-col='9']:hover]/table:block group-has-[[data-col='9'][data-resizing='true']]/table:block",
      "10": "group-has-[[data-col='10']:hover]/table:block group-has-[[data-col='10'][data-resizing='true']]/table:block",
    },
  },
});
