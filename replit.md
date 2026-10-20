# Fight Club

Minimal fact-based animal matchup starter. See README.md for setup and limitations.

## Scope rules

- User explicitly wants no database, auth, hit points, game loop, or styling beyond basic layout.
- Keep numerical traits as documented zero placeholders and sources empty until
  the user fills them in. Do not invent scientific measurements.
- The user will implement scoring. Preserve the throwing engine stub unless
  explicitly asked to implement it. Never add production mock scores or narration.
- Winner identifiers are exact animal names in engine output and narration.

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
