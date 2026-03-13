# Knowledge Navigation and Management: Phase 1

This document scopes the first milestone of the broader knowledge navigation workstream.

## Goal

Make the knowledge base fast to navigate and retrieve from anywhere in the app.

Phase 1 focuses on a global search / command palette experience rather than deeper collaboration or activity systems.

## Scope

### Phase 1A: Search foundation

- Sidebar search entry point
- Keyboard shortcut to open the palette
- Search visible pages by title
- Search visible pages by body content
- Open a page directly from results

### Phase 1B: Practical navigation actions

- Recent pages inside the palette
- Quick-create page actions from the palette
- Workspace-aware create actions for:
  - personal workspace
  - shared workspace

### Phase 1C: Ranking and polish

- Better result ranking
- Search result snippets
- Empty states
- Keyboard-first interaction polish

## Deliberate non-goals

Phase 1 does not include:

- full activity feeds
- comments or suggestions
- read-only/editor parity work
- AI workflows
- advanced search ranking infrastructure

## Implementation notes

- Search should only expose pages already visible to the current user.
- The first slice can use the visible page tree already returned by `getKnowledgeBaseView(...)`.
- Client-side search is acceptable for the current scale of the app.
- Recent pages can be stored locally in browser storage for now.
- Page creation actions should reuse the existing sidebar create-page behavior instead of introducing a second backend flow.

## Follow-on work after Phase 1

- Sidebar rename and page-management polish
- Recent changes and recently edited surfaces
- Backlinks / related pages
- richer search ranking and indexing if the data size grows
