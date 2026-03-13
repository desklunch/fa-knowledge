"use client";

import { isOrderedList } from "@platejs/list";
import {
  useTodoListElement,
  useTodoListElementState,
} from "@platejs/list/react";
import type { TListElement } from "platejs";
import {
  type PlateElementProps,
  type RenderNodeWrapper,
  useReadOnly,
} from "platejs/react";
import type React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const config: Record<
  string,
  {
    Li: React.FC<PlateElementProps>;
    Marker: React.FC<PlateElementProps>;
  }
> = {
  todo: {
    Li: TodoLi,
    Marker: TodoMarker,
  },
};

export const BlockList: RenderNodeWrapper = (props) => {
  if (!props.element.listStyleType) return;

  return function BlockListWrapper(nextProps) {
    return <List {...nextProps} />;
  };
};

function List(props: PlateElementProps) {
  const { listStart, listStyleType } = props.element as TListElement;
  const { Li, Marker } = config[listStyleType] ?? {};
  const ListTag = isOrderedList(props.element) ? "ol" : "ul";
  const isTodo = listStyleType === "todo";

  return (
    <ListTag
      className={cn(
        "relative m-0 p-0",
        !isTodo && "[list-style-position:outside]",
      )}
      start={isTodo ? undefined : listStart}
      style={isTodo ? undefined : { listStyleType }}
    >
      {Marker ? <Marker {...props} /> : null}
      {Li ? <Li {...props} /> : <li>{props.children}</li>}
    </ListTag>
  );
}

function TodoMarker(props: PlateElementProps) {
  const state = useTodoListElementState({ element: props.element });
  const { checkboxProps } = useTodoListElement(state);
  const readOnly = useReadOnly();
  const { onCheckedChange, ...checkboxComponentProps } = checkboxProps as {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    [key: string]: unknown;
  };

  return (
    <div contentEditable={false}>
      <Checkbox
        className={cn(
          "-left-6 absolute top-1",
          readOnly && "pointer-events-none",
        )}
        onCheckedChange={onCheckedChange}
        {...checkboxComponentProps}
      />
    </div>
  );
}

function TodoLi(props: PlateElementProps) {
  return (
    <li
      className={cn(
        "relative -top-px list-none [&>p]:m-0 [&>p]:py-0 [&>p]:leading-6",
        (props.element.checked as boolean) &&
          "text-stone-400 line-through decoration-[1.5px] decoration-stone-400",
      )}
    >
      {props.children}
    </li>
  );
}
