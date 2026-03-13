"use client";

import { createPlatePlugin } from "platejs/react";

import { FloatingToolbarButtons } from "../ui/floating-toolbar-buttons";
import { FloatingToolbar } from "../ui/floating-toolbar";

export const FloatingToolbarKit = [
  createPlatePlugin({
    key: "floating-toolbar",
    render: {
      afterEditable: () => (
        <FloatingToolbar>
          <FloatingToolbarButtons />
        </FloatingToolbar>
      ),
    },
  }),
];
