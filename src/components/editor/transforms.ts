"use client";

import { triggerFloatingLink } from "@platejs/link/react";
import { TablePlugin } from "@platejs/table/react";
import { KEYS, PathApi, type TElement } from "platejs";
import type { PlateEditor } from "platejs/react";

const insertList = (editor: PlateEditor, type: string) => {
  editor.tf.insertNodes(
    editor.api.create.block({
      indent: 1,
      listStyleType: type,
    }),
    { select: true },
  );
};

const insertBlockMap: Record<string, (editor: PlateEditor, type: string) => void> = {
  [KEYS.listTodo]: insertList,
  [KEYS.ol]: insertList,
  [KEYS.ul]: insertList,
  [KEYS.table]: (editor) =>
    editor.getTransforms(TablePlugin).insert.table({ colCount: 3, rowCount: 3 }, { select: true }),
};

export const insertBlock = (editor: PlateEditor, type: string) => {
  editor.tf.withoutNormalizing(() => {
    const block = editor.api.block();

    if (!block) return;

    const [currentNode, path] = block;
    const isCurrentBlockEmpty = editor.api.isEmpty(currentNode);
    const currentBlockType = getBlockType(currentNode);
    const isSameBlockType = type === currentBlockType;

    if (type in insertBlockMap) {
      insertBlockMap[type](editor, type);
    } else if (type === KEYS.toc) {
      editor.tf.insertNodes(
        {
          children: [{ text: "" }],
          type: KEYS.toc,
        },
        {
          at: PathApi.next(path),
          select: true,
        },
      );
    } else if (type === KEYS.hr) {
      editor.tf.insertNodes(
        {
          children: [{ text: "" }],
          type: "hr",
        },
        {
          at: PathApi.next(path),
          select: true,
        },
      );
    } else {
      editor.tf.insertNodes(editor.api.create.block({ type }), {
        at: PathApi.next(path),
        select: true,
      });
    }

    if (!isSameBlockType || !isCurrentBlockEmpty) {
      editor.tf.removeNodes({ previousEmptyBlock: true });
    }
  });
};

export const setBlockType = (editor: PlateEditor, type: string) => {
  editor.tf.withoutNormalizing(() => {
    const entries = editor.api.blocks({ mode: "lowest" });

    entries.forEach(([node, path]) => {
      if (node[KEYS.listType]) {
        editor.tf.unsetNodes([KEYS.listType, "indent"], { at: path });
      }

      if (type === KEYS.ul || type === KEYS.ol || type === KEYS.listTodo) {
        editor.tf.setNodes(
          editor.api.create.block({
            indent: 1,
            listStyleType: type,
          }),
          { at: path },
        );
        return;
      }

      if (type === KEYS.codeBlock) {
        editor.tf.toggleBlock(KEYS.codeBlock);
        return;
      }

      if (node.type !== type) {
        editor.tf.setNodes({ type }, { at: path });
      }
    });
  });
};

export const insertInlineElement = (editor: PlateEditor, type: string) => {
  if (type === KEYS.link) {
    triggerFloatingLink(editor, { focused: true });
  }
};

const getBlockType = (block: TElement) => {
  if (block[KEYS.listType]) {
    if (block[KEYS.listType] === KEYS.ol) return KEYS.ol;
    if (block[KEYS.listType] === KEYS.listTodo) return KEYS.listTodo;
    return KEYS.ul;
  }

  return block.type;
};
