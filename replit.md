# Fight Club

Minimal fact-based animal matchup starter. See README.md for setup and limitations.

## Scope rules

- User explicitly wants no database, auth, hit points, game loop, or styling beyond basic layout.
- Use the user-provided seven animal records in `traits.json`. Do not replace or
  silently alter their values; remind users that sources and measurements need
  independent review before being treated as scientific facts.
- The user will implement scoring. Preserve the throwing engine stub unless
  explicitly asked to implement it. Never add production mock scores or narration.
- Winner identifiers are exact selected animal names, `no_contest`, or
  `no_decisive_winner`. Narration repeats that identifier on its final finish
  beat; non-winning tokens cannot identify animals in earlier beats.

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
