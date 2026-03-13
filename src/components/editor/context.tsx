"use client";

import { createContext, useContext } from "react";

type EditorInternalLinkTarget = {
  depth: number;
  href: string;
  pageId: string;
  title: string;
};

type EditorMentionUser = {
  id: string;
  name: string;
};

type EditorContextValue = {
  internalLinkTargets: EditorInternalLinkTarget[];
  mentionUsers: EditorMentionUser[];
};

const EditorContext = createContext<EditorContextValue>({
  internalLinkTargets: [],
  mentionUsers: [],
});

export function EditorContextProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: EditorContextValue;
}) {
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditorContext() {
  return useContext(EditorContext);
}

export type { EditorInternalLinkTarget, EditorMentionUser };
