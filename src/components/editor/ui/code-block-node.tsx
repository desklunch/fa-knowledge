"use client";

import { formatCodeBlock, isLangSupported } from "@platejs/code-block";
import { BracesIcon, CheckIcon, CopyIcon } from "lucide-react";
import { NodeApi, type TCodeBlockElement } from "platejs";
import {
  PlateElement,
  type PlateElementProps,
  useEditorRef,
  useElement,
  useReadOnly,
} from "platejs/react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/editor/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/editor/ui/popover";
import { cn } from "@/lib/utils";

export function CodeBlockElement(props: PlateElementProps<TCodeBlockElement>) {
  const { editor, element } = props;

  return (
    <PlateElement className="py-1.5" {...props}>
      <div className="relative rounded-2xl border border-stone-200 bg-stone-950 text-stone-100">
        <pre className="overflow-x-auto p-6 pr-4 font-mono text-sm leading-[1.65] [tab-size:2]">
          <code>{props.children}</code>
        </pre>

        <div
          className="absolute top-2 right-2 z-10 flex select-none gap-1"
          contentEditable={false}
        >
          {isLangSupported(element.lang) && (
            <Button
              className="size-7 text-xs text-stone-300 hover:bg-stone-800 hover:text-white"
              onClick={() => formatCodeBlock(editor, { element })}
              size="icon-sm"
              title="Format code"
              variant="ghost"
            >
              <BracesIcon className="!size-3.5" />
            </Button>
          )}

          <CodeBlockCombobox />

          <CopyButton
            className="size-7 gap-1 text-stone-300 hover:bg-stone-800 hover:text-white"
            size="icon-sm"
            value={() => NodeApi.string(element)}
            variant="ghost"
          />
        </div>
      </div>
    </PlateElement>
  );
}

function CodeBlockCombobox() {
  const [open, setOpen] = React.useState(false);
  const readOnly = useReadOnly();
  const editor = useEditorRef();
  const element = useElement<TCodeBlockElement>();
  const value = element.lang || "plaintext";
  const [searchValue, setSearchValue] = React.useState("");

  const items = React.useMemo(
    () =>
      languages.filter(
        (language) =>
          !searchValue ||
          language.label.toLowerCase().includes(searchValue.toLowerCase()),
      ),
    [searchValue],
  );

  if (readOnly) return null;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className="h-7 select-none justify-between gap-1 px-2 text-xs text-stone-300 hover:bg-stone-800 hover:text-white"
          role="combobox"
          size="sm"
          variant="ghost"
        >
          {languages.find((language) => language.value === value)?.label ?? "Plain Text"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[220px] p-0"
        onCloseAutoFocus={() => setSearchValue("")}
      >
        <Command shouldFilter={false}>
          <CommandInput
            className="h-9"
            onValueChange={(nextValue) => setSearchValue(nextValue)}
            placeholder="Search language..."
            value={searchValue}
          />
          <CommandEmpty>No language found.</CommandEmpty>

          <CommandList className="h-[320px] overflow-y-auto">
            <CommandGroup>
              {items.map((language) => (
                <CommandItem
                  className="cursor-pointer justify-between"
                  key={language.value}
                  onSelect={(selectedValue) => {
                    editor.tf.setNodes<TCodeBlockElement>(
                      { lang: selectedValue },
                      { at: element },
                    );
                    setSearchValue(selectedValue);
                    setOpen(false);
                  }}
                  value={language.value}
                >
                  <span>{language.label}</span>
                  <CheckIcon
                    className={cn(
                      "size-4 text-stone-400",
                      value === language.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CopyButton({
  value,
  ...props
}: { value: (() => string) | string } & Omit<
  React.ComponentProps<typeof Button>,
  "value"
>) {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (!hasCopied) return;

    const timeoutId = window.setTimeout(() => {
      setHasCopied(false);
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [hasCopied]);

  return (
    <Button
      onClick={() => {
        void navigator.clipboard.writeText(
          typeof value === "function" ? value() : value,
        );
        setHasCopied(true);
      }}
      {...props}
    >
      <span className="sr-only">Copy</span>
      {hasCopied ? (
        <CheckIcon className="!size-3.5" />
      ) : (
        <CopyIcon className="!size-3.5" />
      )}
    </Button>
  );
}

const languages: { label: string; value: string }[] = [
  { label: "Plain Text", value: "plaintext" },
  { label: "Bash", value: "bash" },
  { label: "CSS", value: "css" },
  { label: "Diff", value: "diff" },
  { label: "Go", value: "go" },
  { label: "HTML", value: "html" },
  { label: "JavaScript", value: "javascript" },
  { label: "JSON", value: "json" },
  { label: "Markdown", value: "markdown" },
  { label: "SQL", value: "sql" },
  { label: "TSX", value: "tsx" },
  { label: "TypeScript", value: "typescript" },
  { label: "XML", value: "xml" },
  { label: "YAML", value: "yaml" },
];
