# Animosity: rules for every agent

Animosity is a fact-based animal matchup simulator. A deterministic engine decides who is favored from sourced data; the AI only narrates. v1 was built on Replit; it is being migrated to self-hosted infrastructure (see docs/MIGRATION_PLAN.md).

## Rules

1. Do not change engine scoring, traits.json values, source tiers, verdict text, or narration validation rules unless the task explicitly says so and METHODOLOGY.md is updated in the same change with a changelog row.
2. Run the backend tests, frontend tests, and type checks after every change. If anything fails, stop and report. Never edit, skip, or delete a test to make it pass.
3. Never commit secrets. Keys live in `.env` locally (gitignored) and in the host's secret settings in production. Keep `.env.example` current with every variable, values blank.
4. Stop and ask before creating accounts, spending money, changing DNS, running paid evals, merging to main, or deleting anything on Replit.
5. End each task with a short report: what changed, test counts, and anything done that wasn't asked for.

## Layout

- `artifacts/api-server/server/`: API, engine (`engine.ts`), narrator, claim checks, eval (`eval.ts`), `traits.json`
- `artifacts/fight-club/src/`: React + Vite frontend
- `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`: OpenAPI spec and generated types
- `lib/db`: database schema (Drizzle)
- `artifacts/mockup-sandbox`: design sandbox, not part of the app

## Commands

- Install: `pnpm install`
- Backend tests: `pnpm --filter @workspace/api-server test`
- Frontend tests: `pnpm --filter @workspace/fight-club test`
- Type checks: `pnpm typecheck`
- Database schema: `pnpm --filter @workspace/db run push`
- Narration eval (paid model calls, 75 fights): `pnpm eval` (ask first)
- CI runs the tests and type checks on every push (`.github/workflows`)

## Source of truth

- `METHODOLOGY.md`: scoring rules, outputs, limitations, changelog
- `SOURCES.md`: data provenance and source tiers
- `docs/MIGRATION_PLAN.md`: current work, one phase at a time

## Project memory

- Before starting, read `~/vault/projects/animosity.md`. The repo docs win if they disagree with it.
- Before ending a session, update the note's Status, Next, and Decisions; add anything that broke and its fix to Gotchas; update the `updated` date. Keep the note under one screen.
- When several agents work on one task, only the agent that finishes the task updates the note.
