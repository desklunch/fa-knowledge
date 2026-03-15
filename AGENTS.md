# AGENTS.md

## Cursor Cloud specific instructions

**Product:** SHVR AI — a proof-of-concept knowledge base app (Next.js 16 + TypeScript + Plate editor + Drizzle ORM).

**Single service:** This is a monolithic Next.js app; there is no separate backend or database service to manage. The app has a dual-mode data layer:
- Without `DATABASE_URL`: uses an in-memory fallback store seeded from `src/db/seed-data.ts` (sufficient for dev/testing).
- With `DATABASE_URL` pointing to PostgreSQL: uses Drizzle ORM for persistent storage.

**Standard commands** (see `package.json` scripts):
- `npm run dev` — start dev server on port 3000
- `npm run lint` — ESLint
- `npm run test` — Node.js built-in test runner with tsx
- `npm run build` — production build (uses `--webpack` flag)

**Non-obvious caveats:**
- The app uses **query-param routing** for pages: `/?page=<uuid>`, **not** `/pages/<uuid>`. Navigating to `/pages/...` will 404.
- User impersonation is cookie-based (`fa_active_user`). Mutating operations (create, save, move, delete) require an active user. Click the user dropdown in the top-right to set the cookie before testing mutations.
- The in-memory store resets on server restart; data created during a session is lost on restart.