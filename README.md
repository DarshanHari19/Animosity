# Fight Club

A minimal React + Vite page and Node + Express TypeScript API, with Zod validation.
No database, authentication, hit points, or game loop.

**This is a limited hypothetical model, not a scientific prediction.** The seven
animal profiles and trait values were entered from user-provided data; their
sources and measurements have not been independently verified. The scoring
v1 engine scores body mass and, when source tiers match, bite force only.
No fake results or fallback narration are substituted. Favored/even outcomes
require a configured LLM provider; gate outcomes can return explanations without it.

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
pnpm --filter @workspace/fight-club test
```

Tests use fictional fixtures and mocked LLM responses only. They do not call
an LLM, require a key, or replace scoring in production.
Frontend regression tests use test-only HTTP responses with the real API hooks
and fake timers for playback. They run without workflows, `PORT`, or `BASE_PATH`.

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
- `engine.ts`: `scoreMatchup(a, b, { environment, mode, encounter })` implements
  the exact v1 rules: validate inputs, check function, check realistic behavior,
  then score mass and comparable bites. Both masses must be finite and positive
  before any gate; comparable bites must also be finite and positive. Invalid
  inputs return a named field error, never a fallback result.
- `schemas.ts`: shared Zod-derived types used by the engine, narrator, and routes.
  Exact enums are defined by `lib/api-spec/openapi.yaml`; regenerate contract
  helpers after edits with `pnpm --filter @workspace/api-spec run codegen`.

Return the following structured result; the API validates it before use:

- `outcome`: `{ kind: "favored", animal: "<exact selected name>" }`,
  `{ kind: "even" }`, `{ kind: "indeterminate" }`, `{ kind: "no_contest" }`,
  or `{ kind: "no_engagement", animals: ["<animal that backs off>"] }`.
  Only `favored` includes `animal`; `no_engagement` lists one or both animals.
- `deciding_factor`: `fighting_ability`, `environmental_advantage`, `behavior`,
  or `null`.
- `evidence_quality`: `mostly_higher_tier`, `mixed`, or
  `mostly_lower_tier_or_unknown`. This describes source tiers, not measurement
  quality or method comparability.
- `encounter_label`: `hypothetical`, `ranges_overlap`, or `documented`.
- `advantage_score`: a finite number or `null`, with no predefined bounds.
- `factors`: an array of `{ name: string, value: number, reason: string }`,
  with finite numeric values.

The numerical score is
`0.8 * (log2(massA) - log2(massB))`, plus
`0.5 * (log2(biteA) - log2(biteB))` only when both bites and equal non-null
source tiers are present. Otherwise the bite factor is zero. Cutoffs are
`>= 0.5` for A favored, `<= -0.5` for B favored, and even otherwise; with bite
excluded this requires roughly a 1.54x mass advantage. No other physical traits
contribute. Matching tiers do not establish that measurement methods match, and
bites are not compared against defenses.

Function gates run before realistic behavior gates, and gates have no numerical
score. Forced fight skips retreat behavior. Source quality counts only the fields
consulted at each stage: function always, behavior fields when checked, mass when
scored, and bites only when compared. Missing tiers count as lower-tier; a tier-1/2
share at least two-thirds is mostly higher-tier, at most one-third mostly lower-tier
or unknown, and otherwise mixed. Encounter labels are always hypothetical.

`server/engine.test.ts` enables all 15 route scenarios, including Lion vs Lion,
and adds a swap-order check for each. Only narration is mocked. Blue whale and
African elephant remain test-only fixtures, never selectable production animals.
Their masses are explicitly synthetic: 2 kg for Blue whale and 1 kg for African
elephant, not real measurements. The differing masses help catch accidental
numerical scoring at gates; every gated route case asserts a null score and no
factors in both orders. Other zero/null fixture values remain unknowns.
The scenario expectations are not established scientific findings. Additional
tests cover exact scoring rules, validation, routes and mocked provider responses.

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

Only `favored` and `even` outcomes call the narrator. `no_engagement` never does.
The final beat must have
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
  empty beats array and a one-line explanation of the applicable gate,
  without contacting an LLM. This also applies to no-engagement outcomes.
  Environmental favored results retain narration and include an explanation
  on the result card instead of the numerical scoring-scope note.
- The page is in `artifacts/fight-club/src/pages/home.tsx`. A successful response
  reveals the first narrated beat immediately, then one every 1.5 seconds. Both SVG
  figures have explicit poses for the seven actions. The end card follows the
  last beat; explanation-only outcomes show their card immediately without a
  playback timer. Even finishes do not show either figure defeated. The mode
  caption reads “Forced fight: no retreat; environmental disadvantages count.”
  There is no encounter picker yet. Playback timers are cleared on restart and unmount, and late responses
  are ignored. Numerical results show the v1 scoring-scope note; gate results
  show explanations. Favored/even live playback requires a configured provider.
