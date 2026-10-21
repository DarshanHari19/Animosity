# Fight Club

A minimal React + Vite page and Node + Express TypeScript API, with Zod validation.
No database, authentication, hit points, or game loop.

**This is intentionally not a working scientific simulator yet.** The seven
animal profiles and trait values were entered from user-provided data; their
sources and measurements have not been independently verified. The scoring
engine throws `SCORING_NOT_IMPLEMENTED` (HTTP 501). No fake results or fallback
narration are substituted. A valid Fight request reaches that error before
contacting an LLM.

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

- `traits.json`: seven animal records copied from the user-provided file:
  Lion, Grizzly bear, Saltwater crocodile, Gorilla, Hippopotamus, Great white
  shark, and Rhinoceros. These are the values now sent to the animal selectors
  and API. Review the supplied numbers and URLs for accuracy before relying on
  them. `bite_force_n` accepts `null` for unknown or not applicable, and
  `field_sources` records a tier and reference per trait. Restart
  the API after edits because JSON is bundled at startup.
- `profile` is `adult_male` or `adult_female`; the starter records use
  `adult_male`. `fighting_style` is one of `ambush`, `sustained`, `bluff`,
  `grapple`, or `charge`. The result card states “Assumes adult males.”
- `functions_in` lists `land`, `shallow_water`, and/or `deep_water`. The
  supplied capability lists have tier-3 source entries marked `TODO: verify`;
  these are not established scientific findings.
- `engine.ts`: implement `scoreMatchup(a, b, { environment, mode, encounter })`
  yourself. The body is
  deliberately a TODO and an explicit throw, not a hidden scoring formula.
  Validate data readiness and source quality in your scoring implementation.
- `schemas.ts`: shared Zod-derived types used by the engine, narrator, and routes.
  Exact enums are defined by `lib/api-spec/openapi.yaml`; regenerate contract
  helpers after edits with `pnpm --filter @workspace/api-spec run codegen`.

Return the following structured result; the API validates it before use:

- `outcome`: `{ kind: "favored", animal: "<exact selected name>" }`,
  `{ kind: "even" }`, `{ kind: "indeterminate" }`, or `{ kind: "no_contest" }`.
  Only `favored` includes `animal`.
- `deciding_factor`: `fighting_ability`, `environmental_advantage`, `behavior`,
  or `null`.
- `evidence_quality`: `mostly_measured`, `mixed`, or `mostly_estimated`.
- `encounter_label`: `hypothetical`, `ranges_overlap`, or `documented`.
- `advantage_score`: a finite number or `null`, with no predefined bounds.
- `factors`: an array of `{ name: string, value: number, reason: string }`,
  with finite numeric values.

`server/engine.test.ts` contains **15 future scoring cases inside
`describe.skip`**, with real assertions to enable after scoring is implemented.
All use the normal HTTP route, including Lion vs Lion; only narration is mocked.
Blue whale and African elephant are test-only fixtures with zero/null unknown
measurements, never selectable production animals. The scenarios are requested
expectations, not established scientific facts. Active tests separately confirm
that the real engine still throws `SCORING_NOT_IMPLEMENTED`, and cover schemas,
route behavior and mocked provider responses without requiring a key.

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
`animal` must match one of the two selected names, except that the final
`finish` beat must use `animal: null` for an even matchup. Earlier beats cannot
have null actors, and only the final beat may use `finish`. `fact_used` must
exactly copy an evidence string: an engine factor serialized with
`JSON.stringify({ name, value, reason })` in that field order, or a supplied,
sourced trait reference. Zero/null numeric traits, tier-null entries, empty
references and `TODO` references are excluded from trait evidence.
The prompt forbids invented facts and requires text to agree with that evidence.
Zod validates structure and evidence references; it cannot prove natural-language
claims are scientifically true. Review sources and narration before relying on it.

Only `favored` and `even` outcomes call the narrator. The final beat must have
`action: "finish"` and identify the favored animal, or no animal (`null`) for
an even matchup. The narrator explicitly checks this; a mismatched outcome
receives **one** corrective retry. Another mismatch returns an error. Invalid JSON/schema,
unsupported evidence, HTTP errors, and a 30-second request timeout return readable
errors without fabricated fallback content or exposed provider details.

## Page and API

- `GET /api/animals` returns the animal records for the selectors.
- `POST /api/fight` accepts `{ animalA, animalB, environment, mode, encounter }`.
  Animal names are required; identical selections are allowed and passed
  unchanged to the engine, with no special result substituted by the route.
  Environment is `land`, `shallow_water`, or `deep_water` (default `land`).
  Mode is `realistic` or `forced_fight` (default `realistic`); encounter is
  `face_off` only (default `face_off`). Missing/unknown names, invalid enums,
  null context fields and unexpected fields are rejected.
- Success returns `{ result, beats, explanation }`. Favored/even results have
  5–8 beats and a null explanation. Indeterminate/no-contest results have an
  empty beats array and a one-line explanation derived from the engine factors,
  without contacting an LLM.
- The page is in `artifacts/fight-club/src/pages/home.tsx`. A successful response
  reveals the first narrated beat immediately, then one every 1.5 seconds. Both SVG
  figures have explicit poses for the seven actions. The end card follows the
  last beat; explanation-only outcomes show their card immediately without a
  playback timer. Even finishes do not show either figure defeated. The mode
  caption reads “Forced fight: no retreat; environmental disadvantages count.”
  There is no encounter picker yet. Playback timers are cleared on restart and unmount, and late responses
  are ignored. Until scoring is implemented, successful live playback is
  intentionally unavailable.
