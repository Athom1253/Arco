# Violin Practice Tracker

A responsive practice companion for violin students. It saves practice sessions, repertoire, goals, and plans in PostgreSQL and calculates summaries from those records.

## Features

- Persistent practice timer with start, pause, resume, finish, and discard controls
- Session history with date, piece, and category filters; editable notes and duration
- Repertoire manager with status, difficulty, focus areas, performance dates, and automatically calculated practice totals
- Daily, weekly, piece, and session-count goals with progress derived from completed sessions
- Practice planner with editable blocks and planned-versus-actual summaries
- Dashboard, practice calendar, charts, and milestones calculated from saved data

The first visit is intentionally empty. The app does not add sample student records or claim progress before practice data has been entered.

## Requirements

- Node.js 20 or newer
- pnpm
- A PostgreSQL database

## Setup

1. Install dependencies from the repository root:

   ```sh
   pnpm install
   ```

2. Set `DATABASE_URL` in your local environment to a PostgreSQL connection string. Do not commit `.env` files, passwords, or connection strings.

3. Create or update the database schema:

   ```sh
   pnpm --filter @workspace/db run push
   ```

4. Start the API server in one terminal:

   ```sh
   PORT=5000 pnpm --filter @workspace/api-server run dev
   ```

5. Start the web app in another terminal:

   ```sh
   PORT=5173 BASE_PATH=/ pnpm --filter @workspace/violin-practice-tracker run dev
   ```

The browser app calls the API through `/api`, so both processes should be reachable from the same local origin or reverse proxy. In Replit, the managed workflows supply the ports and path configuration.

## Environment variables

| Variable | Used by | Description |
| --- | --- | --- |
| `DATABASE_URL` | API and Drizzle Kit | PostgreSQL connection string |
| `PORT` | API and Vite | Port supplied by the development environment |
| `BASE_PATH` | Vite | Web app mount path; use `/` for a standalone local run |

## Database

Drizzle schema source lives in `lib/db/src/schema/`. Run the `@workspace/db` `push` command after schema changes in development. For the Replit-managed production database, publish the app and review the schema changes in the Publish flow rather than applying production DDL manually.

## Development

```sh
pnpm run typecheck
pnpm --filter @workspace/api-spec run codegen
```

The OpenAPI contract is in `lib/api-spec/openapi.yaml`; generated Zod validators and React Query hooks are derived from it. API routes are in `artifacts/api-server/src/routes/`.

## Portability and deployment

The app is a standard pnpm TypeScript workspace using React, Vite, Express, Drizzle, and PostgreSQL. Keep `DATABASE_URL` in the target environment's secret manager. For another host, provision PostgreSQL, apply the schema using that environment's migration process, run the API and web processes, and route `/api` to the API server. The frontend is a static Vite build; the API is a Node.js Express service.
