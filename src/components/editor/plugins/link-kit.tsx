"use client";

import { LinkPlugin } from "@platejs/link/react";

import { LinkFloatingToolbar } from "../ui/link-floating-toolbar";
import { LinkElement } from "../ui/link-node";

export const LinkKit = [
  LinkPlugin.configure({
    render: {
      node: LinkElement,
      afterEditable: () => <LinkFloatingToolbar />,
    },
  }),
];
