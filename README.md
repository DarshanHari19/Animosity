# Animosity

A minimal React + Vite page and Node + Express TypeScript API, with Zod validation.
Replit PostgreSQL stores validated narration only. No authentication, hit points, or game loop.

**This is a limited hypothetical model, not a scientific prediction.** The twelve
animal profiles and trait values were entered from user-provided data. The
environment-level references have been reviewed against zoological sources, with
uncertainties recorded; other trait sources and numerical measurements have not
been independently verified or changed. Habitat evidence does not validate
fighting ability or the model's environment levels (see [METHODOLOGY.md](METHODOLOGY.md)). The scoring
v1 scores body mass, environment, and, where comparable, bite force.
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
an LLM, require a key, or replace scoring in production. The persistence test
uses the development database and deletes its own test row (skipped when no
`DATABASE_URL` is configured). Before running it for the first time:
`pnpm --filter @workspace/db run push`.
Frontend regression tests use test-only HTTP responses with the real API hooks
and fake timers for playback. They run without workflows, `PORT`, or `BASE_PATH`.

## Jev shadow observations

After fresh narration passes every existing check, the backend sends one
`jev-latest` request through Replit AI Integrations for OpenRouter, using managed
credentials (no personal API key; calls are billed to Replit credits).
Server-only `jev_shadow` logs contain each beat's text and probabilities of an
unsupported causal claim or a contradictory overall winner. Only model-written
text is scored: the finish includes the climax, not the appended engine verdict.
A single dodge, evasion, or successful move is not winning overall. Jev never rejects, rewrites,
or approves narration. Invalid narration never reaches Jev; cache hits make no
provider calls. Jev failures/timeouts log `jev_shadow_unavailable` and leave the
validated narration unchanged. The one shadow call has a 10-second timeout and
no retries; it is separate from the unchanged narration retry and daily cap.
TypeSafe requests use `compression: false`: the managed transport does not accept
zstd-compressed bodies.

## Fill in the science

The backend folder is **`artifacts/api-server/server/`**:

- `traits.json`: twelve approved animal profiles:
  Lion, Grizzly bear, Saltwater crocodile, Gorilla, Hippopotamus, Great white
  shark, Rhinoceros, Tiger, Polar bear, African bush elephant, Orca, and Komodo dragon.
  These are the values now sent to the animal selectors
  and API. Review the supplied numbers and URLs for accuracy before relying on
  them. `bite_force_n` accepts `null` for unknown or not applicable, and
  `field_sources` records `{ citation, tier, note }` per trait. `citation` holds
  public bibliographic attribution and a URL when supplied; unknown titles or
  years are not invented. `note` holds internal review instructions and caveats,
  and never reaches the API, Sources list, or narrator evidence. Restart
  the API after edits because JSON is bundled at startup.
- `profile` is `adult_male` or `adult_female`; the starter records use
  `adult_male`. `fighting_style` is one of `ambush`, `sustained`, `bluff`,
  `grapple`, or `charge`. The result card states “Assumes adult males.”
- `environments` assigns `full`, `hampered`, or `cannot` to `land`,
  `shallow_water`, and `deep_water` per [METHODOLOGY.md](METHODOLOGY.md).
  References distinguish reviewed habitat/locomotion evidence from model assumptions. See the
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
`0.5 * (log2(biteA) - log2(biteB))` only when both bites, equal non-null
source tiers, and equal non-null `bite_point` values are present. The bite point
is `canine`, `molar`, `molariform`, `front_teeth`, or unknown (`null`). Otherwise the bite factor is zero. Cutoffs are
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
evidence and sends `{id,text,kind}` items. Anthropic must call exactly one forced
`submit_narration` tool whose schema limits `fact_ids` to those IDs. Free text
is not accepted as a fallback. Each beat cites **1–3 distinct IDs**. The server
resolves them in order to the public **`facts_used: string[]`** field, displayed
by the UI. This replaces the old singular `fact_used`; IDs never reach the UI.
Zod and the existing outcome checks remain the final authority.
SDK automatic retries are disabled so they cannot add hidden attempts.

The tool input is `{ "beats": [4–7 non-finish beats], "climax": "one sentence" }`.
Every wire beat has `text`, `action`, `animal`, and `fact_ids`. The tool schema
forbids null actors, any finish action, and a top-level finish field. Non-finish
beats may show the favored animal gaining ground, pushing, driving back, or
pressing its opponent, but must not show the other animal winning or gaining
the upper hand. In even outcomes, neither animal may decisively win. Geographic
phrases such as “the water's edge” are locations, not advantage claims.
The model also supplies one `climax` sentence. The server combines that climax
with its deterministic verdict into exactly one finish beat and maps this
to the existing 5–8 public beats array. Public actions remain `approach`, `charge`,
`bite`, `dodge`, `grapple`, `retreat`, and `finish`. Each `facts_used` entry must
exactly copy an evidence string: a readable scored comparison such as
`Size: Hippopotamus 1500 kg vs Lion 190 kg; Hippopotamus outweighs Lion about 7.9 to 1.`,
or a supplied,
sourced trait reference. Raw `environments` levels are excluded from narrator evidence
regardless of tier. Zero/null numeric traits, tier-null entries, empty
references and `TODO` references are excluded from trait evidence.
The prompt forbids invented facts and requires text to agree with that evidence.
Both supplied masses (or both comparable bite forces in N) are included in
each scored comparison. The engine output and numeric-citation check are
unchanged. Trait source URLs render as links; bibliographic references without
a URL remain text, never an invented link.
Evidence is tagged `scored` for engine comparisons that ran (including equal
comparisons), or `context` for sourced descriptive traits. Factors marked
"Not compared" and their excluded bite traits are removed from the model's
evidence entirely. Unverified raw animal records are not sent to the model.
Only scored evidence may explain ordinary outcomes; an ordinary favored finish
must cite scored evidence. An even finish may not credit any advantage.

The only exception is an environmental-favored engine outcome: a `gate` item
copies only its existing outcome and deciding-factor fields. Its finish must
cite that gate, not scored evidence, and use the selected environment rather
than imply physical superiority. No scores or engine factors
are invented for gates.
Zod validates structure and evidence references; it cannot prove natural-language
claims are scientifically true. Review sources and narration before relying on it.

Finish text is `{model climax} {server verdict}`. The climax is one sentence,
under 25 words, present tense, with no numbers, reasons or gore. In the wild,
the loser escapes hurt, with a concrete escape movement and no death.
In Arena, the favored animal performs a concrete finishing move fitting its
fighting style and the terrain; the loser may die, without blood, wound, or gore
detail. Never use “cannot continue.” These are prompt instructions, not new
validation checks. Even matchups break off
with neither giving ground; environmental finishes show inability to fight in
the setting. Style is choreography, not a new scoring factor.

Server verdict templates (only already-compared evidence is cited):
- Fighting ability, for example: `The Hippopotamus is favored: it outweighs the Lion about 7.9 to 1 (1500 kg vs 190 kg).`
  Append the bite comparison only when bite was compared. Ratios are copied
  from the engine's size reason, not recalculated. If the favored animal is
  lighter, the sentence accurately names the other animal as heavier.
  When an Environment factor is present, append `and the {Other} is hampered in {environment}`
  if the other animal is hampered, or `despite being hampered in {environment}`
  if the favored animal is hampered.
- Environmental: `The {Winner} is favored: the {Other} can't function {environment phrase}.`
  Environment phrases are `on land`, `in shallow water`, and `in deep water`.
  Gate citations use readable text, e.g. `Environment: Great white shark can't function on land.`
- Even: `Too close to call. Scored factors (body mass, comparable bite force, environment) don't separate these two.`

The model receives the engine outcome, mode and fighting styles for the climax.
The public combined finish retains Zod and outcome validation. Hard climax
checks are limited to no numbers, no percentages, no causal phrases (`because`,
`thanks to`, `due to`), no whole-word `hypothetical`, no other animal winning
when favored, and no named winner when even. Length, sentence count, tense,
gore/death, naming both animals, style moves, retreat, decisive endings and
environmental inability are prompt guidance only, not acceptance gates.
All existing wording, citation and grounding checks remain unchanged for the
non-finish beats and server verdict; they do not add extra climax restrictions.
Invalid climaxes use the same single corrective retry.
The verdict is never returned as a finish-only fallback if narration fails.

Only `favored` and `even` outcomes call the narrator. `no_engagement` never does.
The final beat must have
`action: "finish"` and identify the favored animal, or no animal (`null`) for
an even matchup. Any validation failure (JSON, schema, unknown evidence ID, or
outcome mismatch, wording or grounding) receives **one** corrective retry
identifying the failed check and offending text.
A second validation failure raises `INVALID_NARRATION` internally. Provider HTTP/network
failures remain `LLM_PROVIDER_FAILURE` without retries. The route preserves the
validated engine verdict with HTTP 200, `beats: []`,
`narration_status: "unavailable"` and `narration_reason` containing the reason
code. This also covers configuration errors and daily-cap exhaustion; unexpected
narrator exceptions use the sanitized `NARRATION_FAILED` code.
The per-request timeout
is 30 seconds. Raw failed model output is logged only on the server, never in
client error responses; no fallback narration is fabricated.

After Zod validation, deterministic text checks reject unsupported numbers,
percent signs/percentage words, claims that the other animal wins a favored
matchup, and positive winner claims in an even matchup. Numbers are compared
as whole digit-number values, against any of that beat's 1–3 resolved citations,
never uncited evidence. Written cardinal numbers other than "one" and "two" are
forbidden; the latter are allowed as ordinary wording such as "one another".
Beat text cannot mention sources, tiers, missing data or excluded comparisons.
Winner and causal-grounding checks use
explicit English claim patterns and negation, not a semantic language model.
These failures use the same single retry and then `INVALID_NARRATION`.
These deterministic English checks are conservative, not semantic fact proof.

## Page and API
- `POST /api/fight` allows **10 requests per minute per IP**, including invalid
  requests and explanation-only outcomes. Further requests return HTTP 429 with
  `FIGHT_RATE_LIMITED` and a `Retry-After` header. Other endpoints are unaffected.
- `NARRATION_DAILY_CAP` is a backend environment variable (default **200**).
  It limits **provider calls**, not fights: corrective retries, failed provider
  requests, and timeouts each consume a call. All narrated outcomes count,
  including environmental-favored outcomes. No-contest, no-engagement, and
  indeterminate outcomes never consume or check this budget. A blocked first
   attempt or retry preserves the verdict with HTTP 200 and narration reason
   `NARRATION_DAILY_CAP_REACHED`, without a provider call or fallback narration.
   Zero disables provider calls; invalid values give narration reason
   `NARRATION_CAP_CONFIGURATION`, also with the verdict intact.
- Both limits remain **in memory, per server process**, separate from the persistent narration cache. The daily
  budget resets at midnight **UTC**; restarting the server resets both limits.
  Multiple server replicas have separate budgets, so this is not a persistent
  account-wide billing limit. IP resolution trusts one immediate reverse-proxy
  hop, not arbitrary forwarded-header chains; review that setting if changing
  the deployment topology. Expired IP windows are pruned without background timers.

- `GET /api/animals` returns the animal records for the selectors.
- `GET /api/health` returns `{ status: "ok", build_id }` with caching disabled.
  The build timestamp is embedded by esbuild and written to
  `artifacts/api-server/dist/build-id.json`. **Before each live narration test**,
  compare this file's `build_id` to `/api/health`; stop on any mismatch.
  Restart the managed API workflow to build and run current code.
  The existing `/api/healthz` endpoint is unchanged.
- `POST /api/fight` accepts `{ animalA, animalB, environment, mode, encounter }`.
  Animal names are required; identical selections are allowed and passed
  unchanged to the engine, with no special result substituted by the route.
  Environment is `land`, `shallow_water`, or `deep_water` (default `land`).
  Mode is `realistic` or `forced_fight` (default `realistic`); encounter is
  `face_off` only (default `face_off`). Missing/unknown names, invalid enums,
  null context fields and unexpected fields are rejected.
- Success returns `{ result, beats, explanation, narration_status, narration_reason, narration_source }`.
  Status is `available` (5–8 beats, null reason), `unavailable` (no beats, reason
  code), or `not_required` (gated outcome, no beats, null reason).
  The UI shows the verdict immediately with “Narration unavailable.” when needed,
  without fabricating narration. Indeterminate/no-contest results have an
  empty beats array and a one-line explanation of the applicable gate,
  without contacting an LLM. This also applies to no-engagement outcomes.
  Environmental favored results retain narration and include an explanation
  on the result card instead of the numerical scoring-scope note.

## Persistent narration cache

Replit's built-in PostgreSQL stores one validated narration per **ordered**
animal A, animal B, environment, mode, and build ID. A cache hit returns the
same beats without calling the provider or reserving daily-cap budget. Failed
or unavailable narrations are never cached. Non-narrated outcomes bypass the
cache entirely. Request rate limits still apply to cache hits.

`narration_source` is `cache` for a hit and `model` for the normal non-cache
path; it is not displayed in the UI. Check `narration_status` to determine
whether narration exists: `model` does not mean a provider call necessarily
occurred (for example, a gate or exhausted daily cap).

The cache survives process restarts of the same built artifact. A new build
has a new build ID and automatically misses; restarting the development
workflow rebuilds the API. Cache failures log a server-side warning and use
the normal narration path; a failed cache write never hides a valid verdict.

The database schema is in `lib/db/src/schema/narration-cache.ts`. Apply it to
the development database with `pnpm --filter @workspace/db run push`.
Publishing applies the development schema to production; no startup-time DDL
or custom production migration is used. Local development also needs a
PostgreSQL `DATABASE_URL`.
- The page is in `artifacts/fight-club/src/pages/home.tsx`. A successful response
  reveals the first narrated beat immediately, then one every 1.5 seconds. Both SVG
  figures have explicit poses for the seven actions. The end card follows the
  last beat; explanation-only outcomes show their card immediately without a
  playback timer. Even finishes do not show either figure defeated. The mode
  UI defaults to **Arena** (`forced_fight`) with “No retreat. Environmental
  disadvantages still count.” **In the wild** (`realistic`) shows “Animals may
  back off, the way most real encounters end.” API defaults remain unchanged.
  There is no encounter picker yet. Playback timers are cleared on restart and unmount, and late responses
  are ignored. Numerical results show the v1 scoring-scope note; gate results
  show explanations. Narrated playback requires a configured provider; verdicts do not.
  API outcome `even` is displayed as **Too close to call**, with
  “Scored factors (body mass, comparable bite force, environment) don't separate these two.”
  The deterministic finish preserves this distinction; the prompt also forbids
  claims of a stalemate or equally matched animals.

## Live narration evaluation

With the managed API workflow running, use the Shell from the project root:

```sh
pnpm eval                            # 20 baseline + 5 added scenarios × 3 runs
pnpm eval --scenarios 2,10 --runs 1   # just two scenarios once
pnpm eval --help
```

This makes real `POST /api/fight` calls through the running server, using its
normal rate limit and daily provider-call cap. It never reads LLM credentials or
resets/bypasses limits. It sends `X-Animosity-Eval-Bypass-Cache: 1`, which bypasses
cache reads **and writes only in development**; production ignores this header.
Requests start at least 6.5 seconds apart; expect the full
batch to take several minutes and use up to 150 narration-provider calls,
plus one Jev shadow call per accepted narration.

Before every fight it compares `/api/health` against the current build manifest
and stops on a mismatch. Default host is `REPLIT_DEV_DOMAIN`; `--base-url` can
select another development origin, but it must serve that same build.
`X-Narration-Attempts` is a server-owned response header counting actual provider
attempts (0–2, including retries). The evaluator uses it rather than guessing
first-attempt results from buffered logs. The public JSON response is unchanged.

The summary prints first-attempt pass rate, final unavailable rate, every
`narration_reason` count, and a per-scenario table. A successful retry is not a
first-attempt pass. Gated/non-narrated scenarios stop the evaluation rather than
inflate pass rates. Validated public responses and summary JSON are saved under
`generated-artifacts/narration-eval/`, excluded from Git and deployment.

It also prints failed-check counts **across all provider attempts**, including
failed first attempts recovered by retry, plus up to three distinct example
sentences per check name. Each check counts once per failed attempt, even if it
affects multiple beats; totals across different checks can overlap.
Structural/JSON failures may have no sentence to display.

These details come from the server-only, synchronous journal at
`generated-artifacts/narration-diagnostics/attempts.jsonl`, not HTTP responses
or buffered console output. Evaluation reads only new records and correlates
server timestamps, animal selections and server-generated narration IDs.
The running API and Shell must share this workspace; `--base-url` does not
retrieve remote logs. Missing, truncated or ambiguous diagnostics stop the run
with an explicit incomplete-summary error instead of reporting invented zeroes.
The saved evaluation JSON includes the matched diagnostics and check summary.
Raw model output remains in server logs and is never sent through the API.

The **Jev shadow** section reports narrations scored, calls failed or timed out,
and narrations not scored (for example, rejected before Jev). For each question,
it counts beats strictly above 0.5, 0.7, and 0.9, and shows up to ten examples
per disjoint band: `0.5 < p <= 0.7`, `0.7 < p <= 0.9`, and `p > 0.9`,
with their probabilities. These counts are
observations, not acceptance thresholds. The saved JSON includes per-run scores
and the Jev summary.

Jev telemetry comes from the `jev_shadow` response extension, returned only when
`X-Animosity-Eval-Bypass-Cache: 1` is sent to a **development** API. Normal
responses (and production responses even with that header) are unchanged. Eval
stops on missing/invalid Jev telemetry instead of assuming zero scores.
Each Jev call now records `elapsed_ms` and `http_status` (null if no HTTP response
was received). Failures include a sanitized `failure_category`: `timeout`,
`http_error`, `parse_error`, or the separate `transport_error`,
`configuration_error`, and `internal_error` categories. Eval prints category
counts, HTTP-error counts by status, and a per-call latency table; the saved JSON
includes these fields too. SDK error messages, headers, and raw error bodies are
never included in this telemetry.
