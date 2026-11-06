---
updated: 2026-11-04
repo: https://github.com/DarshanHari19/Animosity
live: https://animosityarena.replit.app
---

# Animosity

## Goal
Fact-based animal matchup simulator where code decides who's favored from sourced data and AI only narrates. "Shows its work."

## Stack / setup
- pnpm monorepo, Node + Express + TypeScript API, React + Vite frontend, Zod, OpenAPI in `lib/api-spec`
- API: `artifacts/api-server/server/` (engine.ts, narrator, checks, eval.ts, traits.json)
- Frontend: `artifacts/fight-club/src/`
- Postgres narration cache (keyed by matchup, terrain, mode, build ID)
- Narration: Claude Haiku. Jev (TypeSafe, via OpenRouter) runs in shadow mode as a quality monitor
- Commands: `pnpm test`, `pnpm typecheck`, `pnpm eval` (75 fights, a few cents)
- Source of truth: `METHODOLOGY.md` (rules), `SOURCES.md` (data provenance), `docs/MIGRATION_PLAN.md`
- CI: GitHub Actions runs all tests on every push

## Decisions
- Rules decide, the model narrates. The engine writes the verdict; the AI writes action beats and a climax only
- Scored: body mass (log scale), environment (full / hampered / cannot, 0.8 handicap), bite force only at same tier and same tooth. Within ±0.5 = "Too close to call." No win percentages
- Every trait has a source tier (1 measured, 2 modeled, 3 reference, null unknown). The tier follows the original measurement, not a paper that repeats it
- Hard checks on prose are safety rules only (numbers, percentages, reasons, wrong winner). Style is prompt guidance
- A failed narration never hides the verdict
- Jev stays a monitor, not a blocker: no threshold separated real problems from false alarms
- Next factor after launch: weapons and defenses (horns, teeth, claws, hide)
- Moving off Replit to my own keys, Neon, Railway or Render, and my own domain. Story: started on Replit with Replit Agent; now my own engineering

## Status
- v1 live on Replit with 12 animals, 3 terrains, Arena / In the wild, tale of the tape, How it works page
- Eval: 0 of 75 narrations unavailable, 90.7% first-attempt pass (was 23.3% unavailable at the start)
- Tests: 225 backend, 125 frontend
- Migration plan written; Phase 0 (inventory, tag v1-replit) not started

## Next
1. Migration Phase 0 and 1: clone, inventory Replit dependencies, run locally, write CLAUDE.md
2. Phase 2 and 3: own Anthropic and OpenRouter keys, then eval gate (≤2 of 75 unavailable, ≥85% first pass)
3. Case study and 60 to 90 second demo video

## Gotchas
- Never let an agent edit tests or loosen checks to make them pass
- Word-pattern checks cause false rejections; reject only what contradicts the engine
- An "available" integration check with a tiny payload can pass while real calls fail (Jev: zstd compression on requests over 1 KB returned HTTP 415; fix is compression: false)
- Stale server processes can serve old code; check `/api/health` build ID before live tests
- `pnpm eval` must bypass the narration cache, or it measures nothing
- Dev and production databases are separate; production cache starts empty after each deploy
- The in-memory rate limit and daily cap assume one long-running server (avoid serverless)
- Viral animal stats are often wrong: lion 5,500 N bite (press release), hippo "1,800 psi" (TV). Trace every number to its origin
