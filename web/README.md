# Ordiva Web

The Next.js App Router interface for Circle email sign-in, sourcing goals, autonomous discovery progress, and supplier-run results.

For the product narrative, architecture, demo flow, setup, environment variables, safety model, and hackathon verification, see the [root README](../README.md).

## Structure

```text
web/
├── src/
│   ├── app/          Home, sign-in, and sourcing-run routes
│   ├── components/   Authentication, goal, session, and workbench UI
│   └── lib/          API client, session state, and run state
├── public/
├── next.config.ts
└── package.json
```

## Package commands

Run from the repository root:

```bash
pnpm dev:web
pnpm --filter @ordiva/web typecheck
pnpm --filter @ordiva/web lint
pnpm --filter @ordiva/web build
```
