# Fight Club

A minimal React + Vite page and Node + Express TypeScript API, with Zod validation.
No database, authentication, hit points, or game loop.

**This is intentionally not a working scientific simulator yet.** All numeric
traits are zero placeholders, sources are empty, and the scoring engine throws
`SCORING_NOT_IMPLEMENTED` (HTTP 501). No fake results or fallback narration are
substituted. A valid Fight request reaches that error before contacting an LLM.

## Run

Install dependencies with `pnpm install`. In Replit, start the existing
`artifacts/api-server: API Server` and `artifacts/fight-club: web` workflows.
The preview opens the page at `/`; the API is served at `/api`.
The workflows supply each service's port and routing configuration.

For local development outside Replit, use two terminals:

```sh
PORT=5000 pnpm --filter @workspace/api-server run dev
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/fight-club run dev
```

Route `/api` to port 5000 and `/` to port 5173 with your local reverse proxy.
Replit already provides that routing; no custom Vite proxy is needed there.

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server test
```

Tests use fictional fixtures and mocked LLM responses only. They do not call
an LLM, require a key, or replace scoring in production.

## Fill in the science

The backend folder is **`artifacts/api-server/server/`**:

- `traits.json`: six hand-written animal records. Replace every numeric zero
  with researched values and add citations to `sources`. Zero means **unknown,
  not an actual measurement**. `bite_force_psi` also accepts `null` for unknown
  or not applicable. Categorical assignments are starter examples, not verified
  facts; review those and specify species before trusting them. Restart the API
  after edits because JSON is bundled at startup.
- `profile` is `adult_male` or `adult_female`; the starter records use
  `adult_male`. The result card currently states “Assumes adult males.”
- `engine.ts`: implement `scoreMatchup(a, b, environment)` yourself. The body is
  deliberately a TODO and an explicit throw, not a hidden scoring formula.
  Validate data readiness in your scoring implementation; do not score zeros
  as real measurements.
- `schemas.ts`: shared Zod-derived types used by the engine, narrator, and routes.
  Exact enums are defined by `lib/api-spec/openapi.yaml`; regenerate contract
  helpers after edits with `pnpm --filter @workspace/api-spec run codegen`.

Return `{ winner, confidence, factors }`: `winner` must be **the exact selected
animal name**, never `"A"`, `"B"`, or a numeric ID. `confidence` is finite and
between 0 and 1; `factors` is a string array explaining your scoring. The
API validates the output before sending it to the narrator.

## Configure narration

After scoring is ready, add **`LLM_API_KEY` through Replit's Secrets tool**.
Never put it in source code, chat, a frontend `VITE_` variable, or a commit.
Only `server/narrator.ts` reads this secret, on the backend.

Defaults:

- Full chat-completions endpoint: `https://api.openai.com/v1/chat/completions`
- Model: `gpt-4o-mini`
- Optional backend environment variables: `LLM_API_URL` (full HTTPS endpoint)
  and `LLM_MODEL`. Use a trusted OpenAI-compatible provider that supports
  `response_format: { type: "json_object" }`. Your key is sent to that endpoint.

The provider must return `{ "beats": [...] }` with 5–8 beats, each containing
`text`, `action`, `animal`, and `fact_used`. Actions are exactly `approach`,
`charge`, `bite`, `dodge`, `grapple`, `retreat`, and `finish`.
`animal` must match one of the two selected names. `fact_used` must exactly
copy an engine factor or a supplied, sourced trait evidence string; zero/null
numeric traits and unsourced records are excluded from trait evidence.
The prompt forbids invented facts and requires text to agree with that evidence.
Zod validates structure and evidence references; it cannot prove natural-language
claims are scientifically true. Review sources and narration before relying on it.

The final beat must have `action: "finish"` and `animal === result.winner`.
The narrator explicitly checks this; a mismatched final winner receives **one**
corrective retry. Another mismatch returns an error. Invalid JSON/schema,
unsupported evidence, HTTP errors, and a 30-second request timeout return readable
errors without fabricated fallback content or exposed provider details.

## Page and API

- `GET /api/animals` returns the animal records for the selectors.
- `POST /api/fight` accepts `{ animalA, animalB, environment }`, with exact animal
  names and `environment` equal to `"land"` or `"water"`. Missing, unknown, and
  identical selections are rejected. Success returns `{ result, beats }`.
- The page is in `artifacts/fight-club/src/pages/home.tsx`. A successful response
  reveals the first beat immediately, then one every 1.5 seconds. Both SVG
  figures have explicit poses for the seven actions. The end card follows the
  last beat. Playback timers are cleared on restart and unmount, and late responses
  are ignored. Until scoring is implemented, successful live playback is
  intentionally unavailable.
