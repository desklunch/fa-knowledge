"use client";

import { MentionPlugin } from "@platejs/mention/react";
import { FileTextIcon, UserIcon } from "lucide-react";
import {
  PlateElement,
  type PlateElementProps,
  useFocused,
  useReadOnly,
  useSelected,
} from "platejs/react";
import { useMemo, useState } from "react";

import { useEditorContext } from "../context";
import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxGroupLabel,
  InlineComboboxInput,
  InlineComboboxItem,
} from "./inline-combobox";

type MentionShape = {
  key?: string;
  value?: string;
};

export function MentionInputElement(props: PlateElementProps) {
  const [placeholder, setPlaceholder] = useState("Mention a person or page...");
  const { children, editor, element } = props;
  const [search, setSearch] = useState("");

  return (
    <PlateElement
      {...props}
      as="span"
      attributes={{
        ...props.attributes,
        "data-slate-value": (element as MentionShape).value,
      }}
    >
      <InlineCombobox
        element={element}
        setValue={setSearch}
        showTrigger={false}
        trigger="@"
        value={search}
      >
        <span className="rounded-md bg-stone-100 px-1.5 py-0.5 align-baseline text-sm text-stone-700 ring-stone-200">
          <span className="font-bold">@</span>
          <InlineComboboxInput
            className="min-w-[120px]"
            placeholder={placeholder}
          />
        </span>

        <InlineComboboxContent variant="mention">
          <InlineComboboxEmpty>No results found</InlineComboboxEmpty>

          <DocumentComboboxGroup
            search={search}
            onDocumentHover={(name) => setPlaceholder(name)}
            onDocumentSelect={(document) => {
              editor.tf.insertNodes({
                key: `/${document.pageId}`,
                children: [{ text: "" }],
                type: MentionPlugin.key,
                value: document.title,
              });
              editor.tf.move({ unit: "offset" });
            }}
          />

          <PeopleComboboxGroup
            search={search}
            onUserHover={(name) => setPlaceholder(name)}
            onUserSelect={(user) => {
              editor.tf.insertNodes({
                key: user.id,
                children: [{ text: "" }],
                type: MentionPlugin.key,
                value: user.name,
              });
              editor.tf.move({ unit: "offset" });
            }}
          />
        </InlineComboboxContent>
      </InlineCombobox>
      {children}
    </PlateElement>
  );
}

function DocumentComboboxGroup({
  search,
  onDocumentHover,
  onDocumentSelect,
}: {
  search: string;
  onDocumentHover: (name: string) => void;
  onDocumentSelect: (document: ReturnType<typeof useEditorContext>["internalLinkTargets"][number]) => void;
}) {
  const { internalLinkTargets } = useEditorContext();
  const pages = useMemo(
    () =>
      internalLinkTargets.filter((page) =>
        page.title.toLowerCase().includes(search.toLowerCase()),
      ),
    [internalLinkTargets, search],
  );

  if (pages.length === 0) return null;

  return (
    <InlineComboboxGroup>
      <InlineComboboxGroupLabel>Pages</InlineComboboxGroupLabel>
      {pages.slice(0, 8).map((page) => (
        <InlineComboboxItem
          key={page.pageId}
          value={page.title}
          onClick={() => onDocumentSelect(page)}
          onFocus={() => onDocumentHover(page.title)}
          onMouseEnter={() => onDocumentHover(page.title)}
        >
          <FileTextIcon className="mr-2.5 size-4 text-stone-400" />
          <span
            className="truncate"
            style={{ paddingLeft: `${Math.max(0, page.depth - 1) * 10}px` }}
          >
            {page.title}
          </span>
        </InlineComboboxItem>
      ))}
    </InlineComboboxGroup>
  );
}

function PeopleComboboxGroup({
  search,
  onUserHover,
  onUserSelect,
}: {
  search: string;
  onUserHover: (name: string) => void;
  onUserSelect: (user: ReturnType<typeof useEditorContext>["mentionUsers"][number]) => void;
}) {
  const { mentionUsers } = useEditorContext();
  const users = useMemo(
    () =>
      mentionUsers.filter((user) =>
        user.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [mentionUsers, search],
  );

  if (users.length === 0) return null;

  return (
    <InlineComboboxGroup>
      <InlineComboboxGroupLabel>People</InlineComboboxGroupLabel>
      {users.slice(0, 8).map((user) => (
        <InlineComboboxItem
          key={user.id}
          value={user.name}
          onClick={() => onUserSelect(user)}
          onFocus={() => onUserHover(user.name)}
          onMouseEnter={() => onUserHover(user.name)}
        >
          <UserIcon className="mr-2.5 size-4 text-stone-400" />
          <span className="truncate">{user.name}</span>
        </InlineComboboxItem>
      ))}
    </InlineComboboxGroup>
  );
}

export function MentionElement(props: PlateElementProps) {
  const { children, element } = props;
  const mention = element as MentionShape;
  const readOnly = useReadOnly();
  const selected = useSelected();
  const focused = useFocused();
  const { internalLinkTargets } = useEditorContext();
  const mentionKey = mention.key ?? "";
  const isPageMention = mentionKey.startsWith("/");
  const pageHref = isPageMention ? `/?page=${mentionKey.slice(1)}` : null;
  const matchingPage = internalLinkTargets.find((page) => page.pageId === mentionKey.slice(1));

  const chipClassName = `inline-flex items-center rounded-md bg-stone-100 px-1.5 py-0.5 align-baseline text-sm font-medium text-stone-700 transition-colors ${
    !readOnly ? "cursor-pointer hover:bg-stone-200" : ""
  } ${selected && focused ? "ring-2 ring-sky-200" : ""}`;

  const chipContent = (
    <>
      {isPageMention ? (
        <FileTextIcon className="mr-1 size-3.5" />
      ) : (
        <UserIcon className="mr-1 size-3.5" />
      )}
      {mention.value}
    </>
  );

  if (readOnly || !isPageMention) {
    return (
      <PlateElement
        {...props}
        as="span"
        attributes={{
          ...props.attributes,
          contentEditable: false,
          "data-slate-value": mention.value,
          draggable: true,
        }}
      >
        {children}
        <span contentEditable={false} className={chipClassName}>
          {chipContent}
        </span>
      </PlateElement>
    );
  }

  return (
    <PlateElement
      {...props}
      as="span"
      attributes={{
        ...props.attributes,
        contentEditable: false,
        "data-slate-value": mention.value,
        draggable: true,
      }}
    >
      {children}
      <button
        type="button"
        contentEditable={false}
        className={chipClassName + " cursor-pointer"}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (pageHref) {
            window.location.assign(pageHref);
          }
        }}
        title={matchingPage?.title ?? mention.value ?? "Open page"}
      >
        {chipContent}
      </button>
    </PlateElement>
  );
}
