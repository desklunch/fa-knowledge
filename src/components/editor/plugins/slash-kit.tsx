"use client";

import { SlashInputPlugin, SlashPlugin } from "@platejs/slash-command/react";

import { SlashInputElement } from "../ui/slash-node";

export const SlashKit = [
  SlashPlugin.configure({
    options: {
      triggerQuery: (editor) =>
        !editor.api.some({
          match: { type: "code_block" },
        }),
    },
  }),
  SlashInputPlugin.withComponent(SlashInputElement),
];
