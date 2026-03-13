# Plate Editor Technical Overview

This document is the primary ramp-up guide for the Plate editor in this repo.

It explains:

- how the editor is assembled
- where editor state lives
- how markdown and `editorDocJson` interact
- how autosave and revision writes work
- where the major editor features are implemented
- how to safely extend the editor without breaking persistence

The editor is intentionally modeled after the Plate Playground template, but adapted to the app's product constraints:

- markdown remains the canonical content format
- richer Plate-only fidelity is preserved in `editorDocJson`
- saves are session-aware and revision-aware
- page mentions and people mentions are app-specific

## Goals

The current implementation optimizes for three things:

1. A Playground-style editing experience.
2. Markdown-first storage for portability, AI workflows, and inspection.
3. Safe preservation of rich editor fidelity when markdown cannot round-trip a feature cleanly.

Those goals create an intentional split:

- `contentMarkdown` is the canonical persisted body.
- `editorDocJson` preserves richer Plate state.

Future editor work should assume both are important.

## Read First

If you are new to the editor, read these files in this order:

1. `src/components/editable-page-form.tsx`
2. `src/components/page-editor.tsx`
3. `src/components/editor/plate-editor.tsx`
4. `src/components/editor/editor-kit.tsx`
5. `src/components/editor/editor-base-kit.tsx`
6. `src/components/editor/markdown-value.ts`
7. `src/app/api/pages/[pageId]/route.ts`
8. `src/lib/knowledge-base.ts`

That gives you the full path from UI state to persistence.

## High-Level Architecture

The editor is split into four layers.

### 1. Form shell

`src/components/editable-page-form.tsx`

This is the app-facing owner of editing state. It is responsible for:

- page title state
- draft dirty state
- autosave debounce
- manual save
- save status UI
- unsaved navigation protection
- per-session save identity via `editorSessionId`
- conflict-aware writes using `currentRevisionId`

This component does not render the editor internals directly. It owns the page-level editing workflow.

### 2. App-aware editor wrapper

`src/components/page-editor.tsx`

This component creates the Plate editor instance and injects app-specific context.

Responsibilities:

- build the initial Plate value
- prefer `editorDocJson` when available
- create the editor with `usePlateEditor(...)`
- provide page mention targets and people mention targets
- emit serialized editor changes upward

It is intentionally thin. If you are changing editor UI or plugin behavior, this is usually not the right file.

### 3. Plate rendering layer

`src/components/editor/plate-editor.tsx`

This is the core Plate rendering surface. It:

- mounts `<Plate>`
- renders the fixed toolbar
- renders the editable surface
- serializes editor changes into:
  - `contentMarkdown`
  - `editorDocJson`
- handles undo/redo keyboard shortcuts

This is the best place to understand how editor changes become save payloads.

### 4. Plugin and renderer layers

These live in:

- `src/components/editor/editor-base-kit.tsx`
- `src/components/editor/editor-kit.tsx`
- `src/components/editor/plugins/*`
- `src/components/editor/ui/*`

The intent is to keep the editor modular and close to the Playground structure:

- base kit = content model
- editor kit = interaction model
- plugin bundles = grouped behavior
- UI files = node/leaf/tooling renderers

## Data Model and Persistence Contract

Each page revision stores two editor-related values:

- `content_markdown`
- `editor_doc_json`

### Why both exist

Markdown is the canonical app content because it is:

- readable in the database
- exportable
- AI-friendly
- easy to diff

But a strict markdown-only model breaks richer editor fidelity for:

- underline
- highlight
- `kbd`
- text color
- background color
- some MDX-backed nodes
- some richer Plate-only behavior

So the contract is:

- markdown remains canonical
- `editorDocJson` is used to preserve richer fidelity and safe reload behavior

### Load behavior

Load logic lives in `src/components/editor/markdown-value.ts`.

The editor loads in this order:

1. try to parse and use `editorDocJson`
2. if unavailable or invalid, fall back to markdown deserialization
3. if markdown is empty, use the empty paragraph value

This is important. Earlier versions always rehydrated from markdown and that caused fidelity loss after reload.

### Save behavior

Serialization happens in `src/components/editor/plate-editor.tsx`.

On every editor value change:

1. the value is normalized with `normalizeNodeId(...)`
2. the normalized value is stored as `editorDocJson`
3. the same value is passed through `normalizeValueForMarkdown(...)`
4. the markdown-safe value is serialized through `serializeMd(...)`

Serialization uses:

- `remark-gfm`
- `remarkMdx`

That combination is required because the editor can produce structures that go beyond plain markdown.

## Markdown Normalization Rules

`src/components/editor/markdown-value.ts` is one of the most important files in the editor.

It handles:

- markdown deserialization
- mention restoration
- TOC restoration
- markdown-safe normalization before save

### Markdown import and load

`deserializeMarkdownValue(...)` uses:

- `markdownToSlateNodes(...)`
- `remark-gfm`
- `remarkMdx`

Then it runs an app-specific recovery pass.

### Recovery passes

Currently the editor restores these app-specific concepts from markdown:

- `mention:<id>` links become mention nodes
- `[[toc]]` becomes a TOC node

That is how mentions and the TOC survive markdown-first storage without rendering as plain text after reload.

### Markdown-safe degradation

`normalizeValueForMarkdown(...)` intentionally strips or degrades unsupported rich editor data before markdown serialization.

Today it removes mark fidelity for:

- `underline`
- `color`
- `backgroundColor`
- `fontSize`
- `fontFamily`
- `kbd`
- `highlight`

It also unwraps or degrades problematic MDX/HTML nodes:

- `mdxJsxTextElement` is unwrapped into children
- `html` is downgraded to a paragraph
- `mdxJsxFlowElement` is downgraded to a paragraph

This is a deliberate stability choice. Unsupported MDX wrappers should not crash saves.

## Save Flow and Revision Semantics

The save endpoint is:

- `src/app/api/pages/[pageId]/route.ts`

The route validates input and forwards it to:

- `savePage(...)` in `src/lib/knowledge-base.ts`

### Save payload

`EditablePageForm` sends:

- `title`
- `contentMarkdown`
- `editorDocJson`
- `currentRevisionId`
- `editorSessionId`
- `saveMode`

### Save modes

The editor uses two save modes:

- `autosave`
- `manual`

### Session-aware revision model

The write path is intentionally not “new immutable revision on every autosave”.

Current behavior:

- the first autosave in an editor session creates one immutable revision
- later autosaves in that same session update the edit-session draft
- manual save creates a new immutable revision checkpoint

This is why `EditablePageForm` tracks:

- `editorSessionId`
- `currentRevisionId`

### Conflict-aware saves

Saves are also revision-aware.

The editor includes `currentRevisionId` with writes. If the page has changed underneath the current editor session, the backend can reject the save instead of silently overwriting a newer revision.

This matters most when a page is open in multiple tabs.

## Runtime State Ownership

State ownership is split intentionally.

### `EditablePageForm`

Owns:

- `title`
- `savedTitle`
- `contentMarkdown`
- `editorDocJson`
- saved copies of those values
- `saveState`
- `lastSavedAt`
- `revisionId`
- autosave timer behavior

This is the source of truth for “is the page dirty?” and “what should we save?”

### `PageEditor`

Owns:

- the Plate editor instance
- current editor-emitted markdown
- current editor-emitted json

It bridges the Plate editor and the form shell.

### `PlateEditor`

Owns:

- live `<Plate>` rendering
- keyboard shortcuts
- toolbar composition
- serialization callback

## Plugin Composition

The editor is composed in two layers.

### Base kit

`src/components/editor/editor-base-kit.tsx`

This is the content schema layer.

It includes:

- paragraphs
- headings (`h1`, `h2`, `h3`)
- blockquotes
- bold
- italic
- underline
- strikethrough
- inline code
- code blocks
- links
- mentions
- highlight
- `kbd`
- font/color features
- tables
- TOC
- lists
- indentation
- horizontal rule
- markdown plugin
- block placeholders

If you are adding a new block type or mark, start here.

### Editor kit

`src/components/editor/editor-kit.tsx`

This is the editor interaction layer.

It includes:

- block selection
- cursor overlay
- drag and drop
- autoformat
- slash command
- floating toolbar
- trailing block behavior

If you are changing how editing feels rather than what content types exist, start here.

## App-Specific Editor Context

`src/components/editor/context.tsx`

This provider exists so editor features can access app data without threading props through every toolbar or node renderer.

Current context includes:

- internal page link targets for the current workspace
- mentionable users

This powers:

- page mentions
- people mentions
- internal linking workflows

## Feature Map

This section is the quickest way to find where a capability lives.

### Fixed toolbar

Main entry:

- `src/components/editor/ui/fixed-toolbar-buttons.tsx`

This is where the editor’s primary authoring controls are composed:

- undo/redo
- import/export
- insert menu
- turn-into menu
- marks
- list controls
- link control
- table control
- color controls
- indentation

### Floating toolbar

Main files:

- `src/components/editor/plugins/floating-toolbar-kit.tsx`
- `src/components/editor/ui/floating-toolbar.tsx`
- `src/components/editor/ui/floating-toolbar-buttons.tsx`

This handles selection-based inline formatting affordances.

### Links

Main files:

- `src/components/editor/plugins/link-kit.tsx`
- `src/components/editor/ui/link-node.tsx`
- `src/components/editor/ui/link-floating-toolbar.tsx`
- `src/components/editor/ui/link-toolbar-button.tsx`

Current link behavior:

- external links render with visible link styling
- external links use `cursor-pointer`
- page links can navigate in-app
- nested Slate text spans are explicitly forced to inherit link styling

### Mentions

Main files:

- `src/components/editor/plugins/mention-kit.tsx`
- `src/components/editor/ui/mention-node.tsx`
- `src/components/editor/ui/inline-combobox.tsx`

Current mention types:

- page mentions
- people mentions

Behavior:

- page mentions are clickable and navigate in-app
- people mentions render as chips only
- mentions serialize through `mention:` links in markdown and are restored on load

### Slash command

Main files:

- `src/components/editor/plugins/slash-kit.tsx`
- `src/components/editor/ui/slash-node.tsx`

This provides block and inline insertion/search behavior with a Playground-style command surface.

### Autoformat

Main file:

- `src/components/editor/plugins/autoformat-kit.tsx`

This powers markdown-like typing shortcuts such as:

- headings
- blockquotes
- lists
- code blocks
- horizontal rules
- inline mark shortcuts

### Tables

Main files:

- `src/components/editor/plugins/table-kit.tsx`
- `src/components/editor/ui/table-node.tsx`
- `src/components/editor/ui/resize-handle.tsx`
- `src/components/editor/ui/table-icons.tsx`

Current table feature set includes:

- table insertion
- row/column add/remove
- merge/split cells
- resize handles
- floating table toolbar
- border controls
- cell background color
- row drag handles
- row drop lines
- explicit row move on drop

Important detail:

The table implementation has required repeated fidelity work. If behavior regresses, compare directly against the local Playground reference before introducing new custom behavior.

### TOC

Main files:

- `src/components/editor/plugins/toc-kit.tsx`
- `src/components/editor/ui/toc-node.tsx`
- `src/components/editor/ui/heading-node.tsx`

Important behavior:

- TOC is stored in markdown as `[[toc]]`
- it is restored into a real TOC node on load
- TOC items scroll to headings using heading anchor ids

### Lists and todos

Main file:

- `src/components/editor/ui/block-list.tsx`

This renderer is very sensitive to visual drift. It controls:

- bullet list rendering
- numbered list rendering
- todo list rendering
- placeholder alignment
- marker spacing
- checkbox alignment

This file should be treated as a Playground-parity surface, not a casual styling target.

### Import / export

Main files:

- `src/components/editor/ui/import-toolbar-button.tsx`
- `src/components/editor/ui/export-toolbar-button.tsx`

Import behavior:

- markdown import uses the same shared deserializer as normal editor load
- html import uses Plate HTML deserialization
- focus is deferred after large imports to avoid pending-operations errors

Export behavior:

- markdown export uses the normalized markdown-safe value
- html export uses rendered editor output
- json export uses editor state

## Keyboard Shortcuts

The editor currently handles:

- `Cmd/Ctrl + Z` -> undo
- `Cmd/Ctrl + Shift + Z` -> redo
- `Cmd/Ctrl + Y` -> redo

These are implemented in `src/components/editor/plate-editor.tsx`.

## Renderers and Styling Ownership

The editor has gradually moved away from one giant surface stylesheet toward explicit node and leaf renderers.

Important renderer files:

- `ui/paragraph-node.tsx`
- `ui/heading-node.tsx`
- `ui/blockquote-node.tsx`
- `ui/block-list.tsx`
- `ui/code-block-node.tsx`
- `ui/hr-node.tsx`
- `ui/table-node.tsx`
- `ui/toc-node.tsx`
- `ui/link-node.tsx`
- `ui/mention-node.tsx`

Important leaf files:

- `ui/basic-mark-leaves.tsx`
- `ui/code-node.tsx`
- `ui/highlight-node.tsx`
- `ui/kbd-node.tsx`

The current direction is:

- keep global editor surface styles minimal
- move visual responsibility into explicit renderers
- stay close to Playground for spacing and interaction patterns

## How to Extend the Editor Safely

### Add a new mark or block

Recommended sequence:

1. Add the plugin to `editor-base-kit.tsx` or a plugin bundle.
2. Add a dedicated renderer in `src/components/editor/ui/` if the node/mark needs custom styling or behavior.
3. Decide whether markdown can represent it safely.
4. If markdown cannot preserve it, update `normalizeValueForMarkdown(...)`.
5. If import needs special handling, update `deserializeMarkdownValue(...)` or the recovery passes.
6. Add toolbar, slash, or autoformat entry points if the feature should be authorable.

### Add a new toolbar control

Start here:

- `src/components/editor/ui/fixed-toolbar-buttons.tsx`
- `src/components/editor/ui/floating-toolbar-buttons.tsx`

Then follow the specific button component the toolbar uses.

### Change link behavior

Start here:

- `plugins/link-kit.tsx`
- `ui/link-node.tsx`
- `ui/link-floating-toolbar.tsx`
- `ui/link-toolbar-button.tsx`
- `markdown-value.ts`

### Change mention behavior

Start here:

- `plugins/mention-kit.tsx`
- `ui/mention-node.tsx`
- `ui/inline-combobox.tsx`
- `context.tsx`
- `markdown-value.ts`

### Change save behavior

Start here:

- `editable-page-form.tsx`
- `app/api/pages/[pageId]/route.ts`
- `lib/knowledge-base.ts`

### Change import behavior

Start here:

- `ui/import-toolbar-button.tsx`
- `markdown-value.ts`

Import issues are often parser issues, not renderer issues.

## Common Pitfalls

These are the failure modes that have come up repeatedly during implementation.

### 1. Rich formatting disappears after reload

Usually means one of these:

- `editorDocJson` is not being saved
- the load path is rebuilding from markdown instead of preferring `editorDocJson`
- a feature is not restorable from markdown and is being judged only from the markdown path

### 2. Save crashes on unknown MDX nodes

Usually means:

- import produced `mdxJsxFlowElement` or `mdxJsxTextElement`
- `normalizeValueForMarkdown(...)` is not unwrapping or downgrading that node before `serializeMd(...)`

### 3. Imported markdown renders as plain text

Usually means:

- the import path is not using the shared markdown deserializer
- required remark plugins are missing
- a feature needs a custom recovery pass after markdown parsing

### 4. Mentions render as plain links after reload

Usually means the markdown recovery pass did not convert `mention:` links back into mention nodes.

### 5. TOC saves but fails to behave like a TOC block after reload

Usually means:

- `[[toc]]` is not being restored to a `toc` node
- or TOC insertion is bypassing the normal restore path

### 6. List spacing or placeholder alignment drifts

Do not try to solve that with broad editor surface padding first.

Start with:

- `src/components/editor/ui/block-list.tsx`

and compare directly against the Playground structure.

### 7. Table row drag/drop breaks

Start with:

- `src/components/editor/ui/table-node.tsx`

Check these first:

- the row draggable `nodeRef` is attached to `<tr>`
- the drop line is rendering
- the drop path calculation still has the correct DOM node
- recent layout/styling changes did not interfere with hit-testing

## Validation Workflow

The easiest way to validate changes is to test across three scenarios:

1. live editing
2. save + reload
3. import + save + reload

For any new feature, validate:

- authoring works
- autosave does not crash
- manual save still creates a revision
- reload preserves expected fidelity
- markdown export degrades gracefully when the feature is not markdown-native

## Practical Guidance for Future Engineers

When you need to make a change quickly:

- prefer structural alignment with the Playground template over local one-off fixes
- treat `markdown-value.ts` as part of the feature, not a separate concern
- remember that editor rendering and persistence are tightly coupled here
- if a feature is “working live but broken after reload”, the bug is usually in serialization or rehydration, not UI
- if a feature is “saving but crashing”, inspect markdown normalization before touching the backend

If you follow those rules, most editor changes in this repo stay understandable and reversible.
