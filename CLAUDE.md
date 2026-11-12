# Animosity: rules for every agent

Animosity is a fact-based animal matchup simulator. A deterministic engine decides who is favored from sourced data; the AI only narrates. v1 was built on Replit; it is being migrated to self-hosted infrastructure (see docs/MIGRATION_PLAN.md).

## Rules

1. Do not change engine scoring, traits.json values, source tiers, verdict text, or narration validation rules unless the task explicitly says so and METHODOLOGY.md is updated in the same change with a changelog row.
2. Run the backend tests, frontend tests, and type checks after every change. If anything fails, stop and report. Never edit, skip, or delete a test to make it pass.
3. Never commit secrets. Keys live in `.env` locally (gitignored) and in the host's secret settings in production. Keep `.env.example` current with every variable, values blank.
4. Stop and ask before creating accounts, spending money, changing DNS, running paid evals, merging to main, or deleting anything on Replit.
5. Stay inside the repo. Stop and ask before installing system software (Homebrew, global npm packages, runtimes), changing files outside the repo (except the vault note in Project memory), or deleting anything outside the repo, including caches. Project dependencies through `pnpm install` are fine.
6. End each task with a short report: what changed, test counts, and anything done that wasn't asked for.

## Layout

- `artifacts/api-server/server/`: API, engine (`engine.ts`), narrator, claim checks, eval (`eval.ts`), `traits.json`
- `artifacts/fight-club/src/`: React + Vite frontend
- `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`: OpenAPI spec and generated types
- `lib/db`: database schema (Drizzle)
- `artifacts/mockup-sandbox`: design sandbox, not part of the app

## Commands

Node 24 (`.nvmrc`) and pnpm 10.26.1 (`packageManager`). Run from the repo root.

- First-time setup: `cp .env.example .env` and edit it (set `DATABASE_URL`), `pnpm install`, `pnpm db:migrate`. Default database is Neon staging when `.env` points there; for the Docker fallback also set `POSTGRES_PORT` and the `DATABASE_URL` port if 5432 is taken and run `docker compose up -d` first
- Dev (API on `PORT`, default 8080; web on `WEB_PORT`, default 5173, proxying `/api`): `pnpm dev`
- Tests (backend + frontend): `pnpm test` (loads `.env` but strips the provider keys and URLs, so tests never use billable keys)
  - Backend only: `pnpm --filter @workspace/api-server test`
  - Frontend only: `pnpm --filter @workspace/fight-club test`
- Type checks: `pnpm typecheck`
- Database schema: `pnpm db:migrate` (alias `pnpm db:push`; runs drizzle-kit push, over `DATABASE_URL_UNPOOLED` only when it is the `-pooler`-less twin of `DATABASE_URL` (same database, port and user), else `DATABASE_URL`)
- Database: Neon staging is the default (pooled `DATABASE_URL`, optional direct `DATABASE_URL_UNPOOLED`, used only when it is the `-pooler`-less twin of `DATABASE_URL`). Docker is the fallback: set `DATABASE_URL` to the Docker URL and clear `DATABASE_URL_UNPOOLED`. `db:migrate` prints the target host before pushing
- Narration eval (paid model calls, 75 fights): `pnpm eval` (ask first). Target is `--base-url`, then `EVAL_BASE_URL`, then `http://localhost:$PORT` (default 8080)
- Root scripts load the repo-root `.env`; variables already in the shell win
- CI runs the tests and type checks on every push (`.github/workflows`)

## Source of truth

- `METHODOLOGY.md`: scoring rules, outputs, limitations, changelog
- `SOURCES.md`: data provenance and source tiers
- `docs/MIGRATION_PLAN.md`: current work, one phase at a time

## Project memory

- Before starting, read `~/vault/projects/animosity.md`. The repo docs win if they disagree with it.
- Before ending a session, update the note's Status, Next, and Decisions; add anything that broke and its fix to Gotchas; update the `updated` date. Keep the note under one screen.
- When several agents work on one task, only the agent that finishes the task updates the note.
