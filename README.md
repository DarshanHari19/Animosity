# Animosity

A minimal React + Vite page and Node + Express TypeScript API, with Zod validation.
No database, authentication, hit points, or game loop.

**This is a limited hypothetical model, not a scientific prediction.** The seven
animal profiles and trait values were entered from user-provided data. The
`functions_in` references have been reviewed against zoological sources, with
uncertainties recorded; other trait sources and numerical measurements have not
been independently verified or changed. Habitat evidence does not validate
fighting ability or the model's binary environment gates. The scoring
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
- `functions_in` lists `land`, `shallow_water`, and/or `deep_water`. All seven
  supplied lists are retained, but their references now distinguish reviewed
  habitat/locomotion evidence from unresolved model assumptions. See the
  functions_in review in [SOURCES.md](SOURCES.md); these are not established
  fighting capabilities. [METHODOLOGY.md](METHODOLOGY.md) defines the engine rules.
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

Narration uses **Replit AI Integrations for Anthropic** with Replit-managed
credentials. No personal API key or `LLM_API_KEY` is required. Usage is billed
to your Replit credits.

- Default model: **`claude-haiku-5-5`**, a Claude Haiku-class model.
- Replit provisions `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` and
  `AI_INTEGRATIONS_ANTHROPIC_API_KEY`. The backend uses these through the
  Anthropic SDK; credentials never go to the browser or logs.
- If managed configuration is missing, narration returns `LLM_NOT_CONFIGURED`
  with an instruction to enable the Anthropic AI integration, not to add a key.
- Legacy `LLM_API_KEY`, `LLM_API_URL`, and `LLM_MODEL` are no longer read.

The backend assigns stable fight-local IDs (`E1`, `E2`, …) to the filtered
evidence and sends `{id,text}` items. Anthropic must call exactly one forced
`submit_narration` tool whose schema limits `fact_id` to those IDs. Free text
is not accepted as a fallback. The server resolves each ID to the exact evidence
text before returning the existing public `fact_used` field; IDs never reach
the UI. Zod and the existing outcome checks remain the final authority.
SDK automatic retries are disabled so they cannot add hidden attempts.

The tool input must contain `{ "beats": [...] }` with 5–8 beats, each containing
`text`, `action`, `animal`, and `fact_id`. Public beats contain `fact_used`
instead of `fact_id`. Actions are exactly `approach`,
`charge`, `bite`, `dodge`, `grapple`, `retreat`, and `finish`.
`animal` must match one of the two selected names, except that the final
`finish` beat must use `animal: null` for an even matchup. Earlier beats cannot
have null actors, and only the final beat may use `finish`. `fact_used` must
exactly copy an evidence string: an engine factor serialized with
`JSON.stringify({ name, value, reason })` in that field order, or a supplied,
sourced trait reference. `functions_in` is excluded from narrator evidence
regardless of tier. Zero/null numeric traits, tier-null entries, empty
references and `TODO` references are excluded from trait evidence.
The prompt forbids invented facts and requires text to agree with that evidence.
Zod validates structure and evidence references; it cannot prove natural-language
claims are scientifically true. Review sources and narration before relying on it.

Only `favored` and `even` outcomes call the narrator. `no_engagement` never does.
The final beat must have
`action: "finish"` and identify the favored animal, or no animal (`null`) for
an even matchup. Any validation failure (JSON, schema, unknown evidence ID, or
outcome mismatch) receives **one** corrective retry identifying the failed check.
A second validation failure returns `INVALID_NARRATION`. Provider HTTP/network
failures remain `LLM_PROVIDER_FAILURE` without retries. The per-request timeout
is 30 seconds. Raw failed model output is logged only on the server, never in
client error responses; no fallback narration is fabricated.

After Zod validation, deterministic text checks reject unsupported numbers,
percent signs/percentage words, claims that the other animal wins a favored
matchup, and positive winner claims in an even matchup. Numbers are compared
as whole numeric values (including ordinary written cardinal numbers), only
against that beat's resolved evidence—not other beats. Winner checks use
explicit English claim patterns and negation, not a semantic language model.
These failures use the same single retry and then `INVALID_NARRATION`.

## Page and API
- `POST /api/fight` allows **10 requests per minute per IP**, including invalid
  requests and explanation-only outcomes. Further requests return HTTP 429 with
  `FIGHT_RATE_LIMITED` and a `Retry-After` header. Other endpoints are unaffected.
- `NARRATION_DAILY_CAP` is a backend environment variable (default **200**).
  It limits **provider calls**, not fights: corrective retries, failed provider
  requests, and timeouts each consume a call. All narrated outcomes count,
  including environmental-favored outcomes. No-contest, no-engagement, and
  indeterminate outcomes never consume or check this budget. A blocked first
  attempt or retry returns HTTP 429, `NARRATION_DAILY_CAP_REACHED`, without a
  provider call or fallback narration. Zero disables provider calls; invalid
  values return HTTP 503, `NARRATION_CAP_CONFIGURATION`.
- Both limits are **in memory, per server process**, with no database. The daily
  budget resets at midnight **UTC**; restarting the server resets both limits.
  Multiple server replicas have separate budgets, so this is not a persistent
  account-wide billing limit. IP resolution trusts one immediate reverse-proxy
  hop, not arbitrary forwarded-header chains; review that setting if changing
  the deployment topology. Expired IP windows are pruned without background timers.

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
