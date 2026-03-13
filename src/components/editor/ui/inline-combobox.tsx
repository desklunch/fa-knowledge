"use client";

import { filterWords } from "@platejs/combobox";
import {
  type UseComboboxInputResult,
  useComboboxInput,
  useHTMLInputCursorState,
} from "@platejs/combobox/react";
import * as Ariakit from "@ariakit/react";
import { cva, type VariantProps } from "class-variance-authority";
import type { Point, TElement } from "platejs";
import { useEditorRef } from "platejs/react";
import type { HTMLAttributes, ReactNode } from "react";
import React, { useEffect } from "react";

import { cn } from "@/lib/utils";

type FilterFn = (
  item: { group?: string; keywords?: string[]; label?: string; value: string },
  search: string,
) => boolean;

type InlineComboboxContextValue = {
  filter: FilterFn | false;
  inputProps: UseComboboxInputResult["props"];
  inputRef: React.RefObject<HTMLInputElement | null>;
  removeInput: UseComboboxInputResult["removeInput"];
  setHasEmpty: (hasEmpty: boolean) => void;
  showTrigger: boolean;
  trigger: string;
};

const InlineComboboxContext = React.createContext<InlineComboboxContextValue>(null as never);

const defaultFilter: FilterFn = ({ group, keywords = [], label, value }, search) => {
  const uniqueTerms = new Set([value, ...keywords, group, label].filter(Boolean));
  return Array.from(uniqueTerms).some((keyword) => filterWords(keyword!, search));
};

export function InlineCombobox({
  children,
  element,
  filter = defaultFilter,
  hideWhenNoValue = false,
  setValue: setValueProp,
  showTrigger = true,
  trigger,
  value: valueProp,
}: {
  children: ReactNode;
  element: TElement;
  filter?: FilterFn | false;
  hideWhenNoValue?: boolean;
  setValue?: (value: string) => void;
  showTrigger?: boolean;
  trigger: string;
  value?: string;
}) {
  const editor = useEditorRef();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cursorState = useHTMLInputCursorState(inputRef);

  const [valueState, setValueState] = React.useState("");
  const hasValueProp = valueProp !== undefined;
  const value = hasValueProp ? valueProp : valueState;

  const setValue = React.useCallback(
    (newValue: string) => {
      setValueProp?.(newValue);
      if (!hasValueProp) setValueState(newValue);
    },
    [hasValueProp, setValueProp],
  );

  const insertPoint = React.useRef<Point | null>(null);

  useEffect(() => {
    const path = editor.api.findPath(element);
    if (!path) return;
    const point = editor.api.before(path);
    if (!point) return;
    const pointRef = editor.api.pointRef(point);
    insertPoint.current = pointRef.current;
    return () => {
      pointRef.unref();
    };
  }, [editor, element]);

  const { props: inputProps, removeInput } = useComboboxInput({
    autoFocus: true,
    cancelInputOnBlur: false,
    cursorState,
    onCancelInput: (cause) => {
      if (cause !== "backspace") {
        editor.tf.insertText(trigger + value, {
          at: insertPoint.current ?? undefined,
        });
      }

      if (cause === "arrowLeft" || cause === "arrowRight") {
        editor.tf.move({
          distance: 1,
          reverse: cause === "arrowLeft",
        });
      }
    },
    ref: inputRef,
  });

  const [hasEmpty, setHasEmpty] = React.useState(false);

  const contextValue = React.useMemo(
    () => ({
      filter,
      inputProps,
      inputRef,
      removeInput,
      setHasEmpty,
      showTrigger,
      trigger,
    }),
    [filter, inputProps, removeInput, showTrigger, trigger],
  );

  const store = Ariakit.useComboboxStore({
    setValue: (newValue) => React.startTransition(() => setValue(newValue)),
  });

  const items = store.useState("items");

  return (
    <span contentEditable={false}>
      <Ariakit.ComboboxProvider
        open={(items.length > 0 || hasEmpty) && (!hideWhenNoValue || value.length > 0)}
        store={store}
      >
        <InlineComboboxContext.Provider value={contextValue}>
          {children}
        </InlineComboboxContext.Provider>
      </Ariakit.ComboboxProvider>
    </span>
  );
}

export function InlineComboboxInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  const { inputProps, inputRef, showTrigger, trigger } = React.useContext(InlineComboboxContext);
  const store = Ariakit.useComboboxContext()!;
  const value = store.useState("value");

  return (
    <>
      {showTrigger ? trigger : null}
      <span className="relative min-h-[1lh]">
        <span aria-hidden="true" className="invisible overflow-hidden text-nowrap">
          {value || props.placeholder || "\u200B"}
        </span>

        <Ariakit.Combobox
          autoSelect
          className={cn(
            "absolute top-0 left-0 size-full bg-transparent outline-hidden",
            className,
          )}
          ref={inputRef}
          value={value}
          {...inputProps}
          {...props}
        />
      </span>
    </>
  );
}

const comboboxVariants = cva(
  "z-50 mt-1 h-full max-h-[40vh] min-w-[220px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-xl",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "",
        mention: "w-[320px]",
      },
    },
  },
);

const comboboxItemVariants = cva(
  "relative mx-1 flex select-none items-center rounded-sm px-2 py-1 text-sm text-stone-800 outline-hidden transition [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    defaultVariants: {
      interactive: true,
    },
    variants: {
      interactive: {
        false: "",
        true: "cursor-pointer hover:bg-stone-100 hover:text-stone-900 data-[active-item=true]:bg-stone-100 data-[active-item=true]:text-stone-900",
      },
    },
  },
);

export function InlineComboboxContent({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof Ariakit.ComboboxPopover> &
  VariantProps<typeof comboboxVariants>) {
  return (
    <Ariakit.Portal>
      <Ariakit.ComboboxPopover
        className={cn(comboboxVariants({ variant }), className)}
        {...props}
      >
        {props.children}
      </Ariakit.ComboboxPopover>
    </Ariakit.Portal>
  );
}

export function InlineComboboxItem({
  className,
  focusEditor = true,
  group,
  keywords,
  label,
  onClick,
  ...props
}: {
  focusEditor?: boolean;
  group?: string;
  keywords?: string[];
  label?: string;
} & Ariakit.ComboboxItemProps &
  Required<Pick<Ariakit.ComboboxItemProps, "value">>) {
  const { value } = props;
  const { filter, removeInput } = React.useContext(InlineComboboxContext);
  const store = Ariakit.useComboboxContext()!;
  const search = filter && store.useState("value");

  const visible = React.useMemo(
    () => !filter || filter({ group, keywords, label, value }, search as string),
    [filter, group, keywords, label, search, value],
  );

  if (!visible) return null;

  return (
    <Ariakit.ComboboxItem
      className={cn(comboboxItemVariants(), className)}
      onClick={(event) => {
        removeInput(focusEditor);
        onClick?.(event);
      }}
      {...props}
    />
  );
}

export function InlineComboboxEmpty({
  children,
  className,
}: HTMLAttributes<HTMLDivElement>) {
  const { setHasEmpty } = React.useContext(InlineComboboxContext);
  const store = Ariakit.useComboboxContext()!;
  const items = store.useState("items");

  useEffect(() => {
    setHasEmpty(true);
    return () => {
      setHasEmpty(false);
    };
  }, [setHasEmpty]);

  if (items.length > 0) return null;

  return (
    <div
      className={cn(
        comboboxItemVariants({ interactive: false }),
        "my-1.5 text-stone-500",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function InlineComboboxGroup({
  className,
  ...props
}: React.ComponentProps<typeof Ariakit.ComboboxGroup>) {
  return (
    <Ariakit.ComboboxGroup
      className={cn("hidden not-last:border-b py-1.5 [&:has([role=option])]:block", className)}
      {...props}
    />
  );
}

export function InlineComboboxGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof Ariakit.ComboboxGroupLabel>) {
  return (
    <Ariakit.ComboboxGroupLabel
      className={cn(
        "mt-1.5 mb-2 px-3 text-xs font-medium text-stone-400",
        className,
      )}
      {...props}
    />
  );
}
