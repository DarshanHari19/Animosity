# Animosity

Minimal fact-based animal matchup starter. See README.md for setup and limitations.

## Scope rules
- Treat `engine.ts`, `traits.json`, `METHODOLOGY.md`, `SOURCES.md`, and engine
  test expectations as protected unless the user explicitly authorizes changes.
- Animosity is the display name; keep existing folder names and the Replit project name unchanged.
- The daily narration cap counts every provider call, including retries and
  environmental-favored narration. Never cap/check that budget for no_contest,
  no_engagement, or indeterminate. Request-rate limiting still applies to POSTs.

- `SOURCES.md` and `METHODOLOGY.md` are the source of truth for source tiers and
  engine rules. Do not redefine tiers or change supplied capability lists;
  `functions_in` is model-gating metadata, never narrator evidence.
- User explicitly wants no database, auth, hit points, game loop, or styling beyond basic layout.
- Use the user-provided seven animal records in `traits.json`. Do not replace or
  silently alter their values; remind users that sources and measurements need
  independent review before being treated as scientific facts.
- The user explicitly authorized the v1 scoring rules. Score only mass and
  comparable bites, with the specified function and behavior gates. Do not
  add weights or physical factors. Never add production mock scores or narration.
- Use structured outcomes: `favored` with an exact selected animal name,
  `even`, `indeterminate`, `no_contest`, or `no_engagement` with the names that
  back off. Never add probability-based results.
- Narrate only favored/even outcomes. A final finish beat identifies the favored
  animal or has a null animal for even; other outcomes use explanations.
- Never hide a valid engine verdict because narration fails: HTTP 200 with
  empty beats, unavailable status and a sanitized reason code; no fallback text.
- Display `even` as “Too close to call,” not equal ability or a stalemate.
  The server-owned even finish explains that body mass and comparable bite
  force do not separate the animals.
- Before every live narration test, compare `/api/health` build_id against
  `artifacts/api-server/dist/build-id.json` and stop on mismatch.
- Identical selections are allowed in both API and UI and use the normal
  route without forcing an even result. The Lion-vs-Lion scenario tests this route.
- Environments are `land`, `shallow_water`, `deep_water`; animal capability is
  recorded in `functions_in`. Mode defaults to `realistic`, encounter to `face_off`.

## Run and verify

- API workflow: `artifacts/api-server: API Server`
- Frontend workflow: `artifacts/fight-club: web`
- `pnpm run typecheck`
- `pnpm --filter @workspace/api-server test`
- `pnpm eval` for the baseline 20 scenarios × 3; use `--scenarios 2,10 --runs 1`
  for two live fights only. These are real provider calls under existing limits.
- `pnpm --filter @workspace/api-spec run codegen` after contract changes

## Locations

- API contract: `lib/api-spec/openapi.yaml`
- Traits, schemas, scoring engine, narrator and focused tests: `artifacts/api-server/server/`
- Express entry: `artifacts/api-server/src/`
- React page and SVG poses: `artifacts/fight-club/src/`

Narration uses Replit-managed Anthropic AI Integrations and a Claude Haiku-class
model; no personal LLM_API_KEY. Credentials stay on the backend. Preserve the
narrator's final Zod/outcome validation and single corrective retry for any
validation failure; disable SDK automatic retries. Force the narration tool
  with ONLY 4–7 named non-finish beats. They must not state or imply who is
  winning. Resolve 1–3 evidence IDs per beat into public `facts_used: string[]`.
  Append the server-owned deterministic finish using the exact approved
  templates documented in README.md. Ordinary favored finishes cite size and
  only compared bite evidence; environmental finishes cite only engine gate
  evidence and name the other animal's inability to function in the selected
  environment. Never call gates scored. Never return a finish-only fallback.
The database template is unused.
