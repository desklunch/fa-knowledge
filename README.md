# fa-knowledge-app

Proof-of-concept knowledge base with private and shared workspaces, inherited page permissions, and revision-ready content storage.

## Getting Started

Copy the example environment file and provide a Postgres connection string:

```bash
cp .env.example .env
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database

Generate migrations, run migrations, and seed the proof-of-concept data:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Current Scope

- Seeded human and agent users with numeric permission tiers
- Private workspaces per user
- Shared workspace with inherited read/write permissions
- Hidden restricted pages omitted from the tree
- Immutable revision-ready content model with markdown as canonical storage

## Next Steps

- Replace demo in-memory reads with real Drizzle queries
- Add impersonation persistence via cookie/session helper
- Build page create/move flows with subtree permission recomputation
- Evaluate Plate vs Tiptap behind an editor adapter
