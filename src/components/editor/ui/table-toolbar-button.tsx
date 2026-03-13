"use client";

import { TablePlugin, useTableMergeState } from "@platejs/table/react";
import type { DropdownMenuProps } from "@radix-ui/react-dropdown-menu";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Combine,
  Grid3x3Icon,
  TableIcon,
  Trash2Icon,
  Ungroup,
  XIcon,
} from "lucide-react";
import { KEYS } from "platejs";
import { useEditorPlugin, useEditorSelector } from "platejs/react";
import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { ToolbarButton } from "./toolbar";

export function TableToolbarButton(props: DropdownMenuProps) {
  const tableSelected = useEditorSelector(
    (editor) => editor.api.some({ match: { type: KEYS.table } }),
    [],
  );
  const { editor, tf } = useEditorPlugin(TablePlugin);
  const [open, setOpen] = React.useState(false);
  const mergeState = useTableMergeState();

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton isDropdown pressed={open} tooltip="Table">
          <TableIcon className="size-4" />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="flex w-[180px] min-w-0 flex-col">
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2">
              <Grid3x3Icon className="size-4" />
              <span>Insert table</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="m-0 p-0">
              <TablePicker />
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!tableSelected} className="gap-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
              <div className="size-4" />
              <span>Cell</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!mergeState.canMerge}
                onSelect={() => {
                  tf.table.merge();
                  editor.tf.focus();
                }}
              >
                <Combine className="size-4" />
                Merge cells
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!mergeState.canSplit}
                onSelect={() => {
                  tf.table.split();
                  editor.tf.focus();
                }}
              >
                <Ungroup className="size-4" />
                Split cell
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!tableSelected} className="gap-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
              <div className="size-4" />
              <span>Row</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => { tf.insert.tableRow({ before: true }); editor.tf.focus(); }} disabled={!tableSelected}>
                <ArrowUp className="size-4" />
                Insert row before
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { tf.insert.tableRow(); editor.tf.focus(); }} disabled={!tableSelected}>
                <ArrowDown className="size-4" />
                Insert row after
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { tf.remove.tableRow(); editor.tf.focus(); }} disabled={!tableSelected}>
                <XIcon className="size-4" />
                Delete row
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!tableSelected} className="gap-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
              <div className="size-4" />
              <span>Column</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => { tf.insert.tableColumn({ before: true }); editor.tf.focus(); }} disabled={!tableSelected}>
                <ArrowLeft className="size-4" />
                Insert column before
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { tf.insert.tableColumn(); editor.tf.focus(); }} disabled={!tableSelected}>
                <ArrowRight className="size-4" />
                Insert column after
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { tf.remove.tableColumn(); editor.tf.focus(); }} disabled={!tableSelected}>
                <XIcon className="size-4" />
                Delete column
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem
            className="min-w-[180px]"
            disabled={!tableSelected}
            onSelect={() => {
              tf.remove.table();
              editor.tf.focus();
            }}
          >
            <Trash2Icon className="size-4" />
            Delete table
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TablePicker() {
  const { editor, tf } = useEditorPlugin(TablePlugin);
  const [tablePicker, setTablePicker] = React.useState({
    grid: Array.from({ length: 6 }, () => Array.from({ length: 6 }).fill(0)),
    size: { colCount: 0, rowCount: 0 },
  });

  const onCellMove = (rowIndex: number, colIndex: number) => {
    const newGrid = tablePicker.grid.map((row, currentRowIndex) =>
      row.map((_, currentColumnIndex) =>
        currentRowIndex <= rowIndex && currentColumnIndex <= colIndex ? 1 : 0,
      ),
    );

    setTablePicker({
      grid: newGrid,
      size: { colCount: colIndex + 1, rowCount: rowIndex + 1 },
    });
  };

  return (
    <div
      className="flex! m-0 flex-col p-2"
      onClick={() => {
        tf.insert.table(tablePicker.size, { select: true });
        editor.tf.focus();
      }}
      role="button"
    >
      <div className="grid size-[132px] grid-cols-6 gap-1">
        {tablePicker.grid.map((row, rowIndex) =>
          row.map((value, columnIndex) => (
            <div
              className={cn(
                "size-4 rounded-[3px] border border-stone-300 bg-stone-100",
                value ? "border-stone-900 bg-stone-900/15" : "hover:border-stone-400",
              )}
              key={`(${rowIndex},${columnIndex})`}
              onMouseMove={() => onCellMove(rowIndex, columnIndex)}
            />
          )),
        )}
      </div>

      <div className="pt-2 text-center text-xs text-stone-600">
        {tablePicker.size.rowCount} x {tablePicker.size.colCount}
      </div>
    </div>
  );
}
