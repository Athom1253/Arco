# Violin Practice Tracker

A responsive violin practice companion that tracks sessions, repertoire, goals, plans, and real progress.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/violin-practice-tracker run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/violin-practice-tracker` — React/Vite application
- `artifacts/api-server/src/routes/violin-*.ts` — API routes for tracker data
- `lib/api-spec/openapi.yaml` — API contract source
- `lib/db/src/schema/violin.ts` — PostgreSQL schema
- `README.md` — local setup and environment documentation

## Architecture decisions

- Timer state persists in the database as accumulated seconds plus an active interval start, preserving timing through pauses and reloads.
- Progress and milestones are derived from completed sessions; the app does not seed fictional practice records.
- OpenAPI is the source for generated React Query hooks and server-side Zod validation.

## Product

The app provides a persistent practice timer, editable history, repertoire manager, practice goals and achievements, calendar, and flexible planner.

## User preferences

- Keep the repository straightforward to connect to GitHub and continue developing in Bolt.new; document setup and environment needs and never hardcode secrets.

## Gotchas

- Re-run API codegen after every change to `lib/api-spec/openapi.yaml`.
- Use `pnpm --filter @workspace/db run push` for development schema changes; review production schema changes in Publish.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
