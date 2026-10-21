# Fight Club

Minimal fact-based animal matchup starter. See README.md for setup and limitations.

## Scope rules

- User explicitly wants no database, auth, hit points, game loop, or styling beyond basic layout.
- Use the user-provided seven animal records in `traits.json`. Do not replace or
  silently alter their values; remind users that sources and measurements need
  independent review before being treated as scientific facts.
- The user will implement scoring. Preserve the throwing engine stub unless
  explicitly asked to implement it. Never add production mock scores or narration.
- Use structured outcomes: `favored` with an exact selected animal name,
  `even`, `indeterminate`, or `no_contest`. Never add probability-based results.
- Narrate only favored/even outcomes. A final finish beat identifies the favored
  animal or has a null animal for even; other outcomes use explanations.
- Identical selections are allowed in both API and UI and use the normal
  route without forcing an even result. The Lion-vs-Lion scenario tests this route.
- Environments are `land`, `shallow_water`, `deep_water`; animal capability is
  recorded in `functions_in`. Mode defaults to `realistic`, encounter to `face_off`.

## Run and verify

- API workflow: `artifacts/api-server: API Server`
- Frontend workflow: `artifacts/fight-club: web`
- `pnpm run typecheck`
- `pnpm --filter @workspace/api-server test`
- `pnpm --filter @workspace/api-spec run codegen` after contract changes

## Locations

- API contract: `lib/api-spec/openapi.yaml`
- Traits, schemas, engine stub, narrator and focused tests: `artifacts/api-server/server/`
- Express entry: `artifacts/api-server/src/`
- React page and SVG poses: `artifacts/fight-club/src/`

The backend alone reads LLM_API_KEY from Secrets. The database template is unused.
