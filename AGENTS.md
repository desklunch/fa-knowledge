# AGENTS.md

## Working Style

- For editor migration and UI fidelity work, proceed autonomously in validated iterative passes.
- Choose the next best implementation step without asking for confirmation unless the change is destructive, high-risk, or introduces a meaningful product tradeoff.
- After each implementation pass, run `npm run lint` and `npm run build`. If both pass, continue to the next best step unless blocked.
- Prefer structural, template-aligned migration work over one-off fixes when reproducing reference editor behavior.
- Keep the app functional after each pass; avoid large speculative rewrites that leave the editor in a broken intermediate state.
- When a choice must be made, favor decisions that improve Playground-template fidelity, renderer consistency, and authoring quality.
