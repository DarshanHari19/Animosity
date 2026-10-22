# Narration protocol test migrations

## Conclusive finish and mode-label update

No tests deleted. Existing guarantees remain; provider fixtures now include a
model `climax` string, not a model-owned finish action, actor, verdict or citations.

| Changed test(s) | Old assertion → new assertion | Guarantee preserved |
| --- | --- | --- |
| narrator.test.ts — provider-backed success, forged finish, evidence filters, IDs, retry and text-validation cases | `{beats}` wire → `{beats,climax}`; expected public finish gains the validated climax | Zod, exact IDs/text, filtering, outcomes, all error codes and one retry |
| narration-policy.test.ts — tool schema | Required `beats` → required `beats,climax`; finish field/action still absent | Strict protocol, selected actors, 1–3 distinct allowed IDs |
| narration-policy.test.ts — ID resolution, invalid actors/actions and recorded regressions | Non-finish wire → same wire plus climax; historical public finishes still checked unchanged | Exact citations, TODO/null-tier/functions_in exclusion, every recorded acceptance/rejection |
| narration-readability.test.ts — both Hippo regression fixtures | `{beats}` wire → `{beats,climax}`; original historical finish and numeric assertions retained | Both original numeric failures stay covered; implied-advantage rejection retained |
| anthropic-provider.test.ts — forced-tool request | Required `beats` → required `beats,climax`; string type asserted | One forced tool, actor/action/ID restrictions, strict shape and managed provider behavior |
| limits.test.ts — successful transport fixtures | `{beats}` wire → `{beats,climax}`; cap/call/concurrency assertions unchanged | Per-provider-call budget, retries counted, gated outcomes unaffected |
| narration-finish.test.ts — fighting verdict, both orders and compared bite | Old readable-factor concatenation → exact new verdict wording; same evidence arrays and unchanged result asserted | Actual engine size ratio, compared-bite-only inclusion, no rescoring |
| narration-finish.test.ts — environmental verdict | Old two sentences → exact new colon template; same gate citations and winner | Selected environment, actual engine winner, gate-only evidence |
| narration-finish.test.ts — neutral beats/implied win retry | Server-only finish → validated climax plus server verdict | One finish, neutral non-finish checks, one retry, no partial fallback |
| home.test.tsx — identical selection request | Default realistic → default forced_fight | Same animals use normal route, unchanged API values |
| home.test.tsx — context/captions and submitted heading | Internal mode words → Arena/In the wild and their selected captions | Correct submitted values; pending edits cannot relabel the submitted result |

New tests cover climax bounds/grammar, all fighting styles, wild/Arena/even/
environmental choreography, required climax shape, validation retry and unavailable
responses, route mode forwarding, and both UI labels/default/captions.
Final verification: 147 backend + 66 frontend = 213 tests passed; TypeScript
checks passed. Authentic live paraphrases are covered by acceptance regressions.

## Earlier deterministic-finish migration (historical)

**No tests deleted.** Backend count: 130 → 138; frontend: 65 unchanged.
All 203 tests and workspace TypeScript checks pass.

The provider now returns only non-finish beats. An attempted model-owned finish
is a schema error, not a model verdict the server may accept. Final Zod and
outcome verification still run after the server appends its finish.

Each row describes the old assertion, its replacement, and the retained guarantee.
Unmentioned tests and protected engine expectations are unchanged.

## Existing tests

| Test | Old assertion → new assertion | Guarantee preserved |
|---|---|---|
| Narrator: matching favored outcome | Full provider beats equal fixture → provider non-finish beats plus exact server finish equal fixture | One validated call; correct verdict; evidence supplied; capability metadata excluded |
| Narrator: wrong favored animal | Wrong model finish triggers outcome retry → injected wrong finish field triggers schema retry; server actor is correct | Model cannot override engine winner; one corrective retry identifies the failure |
| Narrator: second outcome mismatch | Two wrong finishes fail → two injected finishes fail | At most two calls; `INVALID_NARRATION`; no partial/finish-only fallback |
| Narrator: even final actor | Model must return null, named actor retries → server returns null; injected named finishes retry/reject | Even has no winner actor; model cannot replace the final actor |
| Narrator: incorrectly even narration | Injected null favored finish causes outcome retry → injected finish field causes schema retry | Favored verdict cannot become even |
| Narrator: sourced trait evidence | Trait citations accepted including final → trait citations accepted in non-finish beats; final cites scored evidence only | Exact verified trait evidence is accepted; unknown/TODO evidence excluded |
| Narrator: TODO references | Full provider fixture → non-finish-only fixture; same exclusion and rejection assertions | TODO excluded regardless of tier; fabricated citation rejected |
| Narrator: functions_in | Full provider fixture → non-finish-only fixture; same all-tier exclusion assertions | Capability metadata never becomes narration evidence |
| Narrator: invalid JSON/envelope/schema/evidence | Old wire bounds and final-action checks → new wire bounds and forbidden finish-field/action checks | JSON, envelopes, bounds, actors, actions, extra fields, citations and null non-final actors rejected after one retry |
| Narrator: unknown fact_id | Unknown ID in full wire → unknown ID in non-finish wire | Unknown ID rejected; correction names the check/ID; no third call |
| Narrator: exact facts_used | All model beats resolve IDs → non-finish IDs resolve exactly; server final uses exact scored text | No fuzzy evidence replacement or leaked IDs |
| Narrator: stable IDs | Full-wire failure/retry → non-finish-wire failure/retry | Same deterministic evidence IDs on both attempts |
| Narrator: zero/null/null-tier/empty/missing sources | Full fixture wire → non-finish-only wire; unchanged excluded-field assertions | All source/value filters preserved |
| Narrator: JSON_parse retry | Old valid recovery wire → non-finish recovery wire | One recovery attempt; failed check named |
| Narrator: Zod_schema retry | Old valid recovery wire → non-finish recovery wire | Invalid actions retry once with schema diagnostic |
| Narrator: unknown_fact_id retry | Old valid recovery wire → non-finish recovery wire | Unknown citations retry once with ID diagnostic |
| Narrator: outcome_winner_mismatch retry | Wrong model final actor → forbidden model finish field; independent final outcome checks added | Engine verdict remains authoritative; protocol violation retries once |
| Narrator: unsupported number | Old full wire → non-finish wire; same recovery/rejection assertions | Uncited numbers fail existing unchanged numeric check |
| Narrator: percentage | Old full wire → non-finish wire; same recovery/rejection assertions | Percentages forbidden |
| Narrator: other animal winning | Old full wire → non-finish wire; existing text check plus new neutral-beat check | Opposing winner rejected; one retry then error |
| Narrator: even winner | Old full wire → non-finish wire; existing text check plus new neutral-beat check | Even narration cannot name a winner |
| Anthropic: forced Haiku tool | Normalize `{beats,finish}` and constrain finish actor → normalize `{beats}` and forbid finish fields | Exactly one forced tool, same model/settings, no text fallback, ID whitelist, strict object/actions/actors |
| Policy: tool actor/schema | Separate actor-constrained finish → no finish property; named non-finish actors retained | Null non-final actors and early finish actions forbidden |
| Policy: 1–3 IDs | Full wire → non-finish-only wire; same ID assertions | Exact ordered resolution; no unknown, duplicate, empty or excessive IDs |
| Policy: null actor / early finish | Full wire → non-finish-only wire | Malicious null/finish still rejected after tool use |
| Policy: fabricated environmental scored ID | Fabricated ID in model finish → fabricated ID in environmental non-finish narration | Unknown/fabricated scored evidence rejected after exactly one retry; separate environmental-final grounding tests unchanged |
| Policy: causal failure correction | Bad causal text in model finish → same bad text in first non-finish beat | Failed grounding check and offending text included in correction |
| Recorded: Lion vs Grizzly bear attempt 1 | Migrate legacy wire including finish → resolve non-finish wire and validate historical public finish separately | Original text, actors, citation identity, outcome/text/grounding verdict preserved |
| Recorded: Lion vs Grizzly bear attempt 2 | Same structural migration | Original verdict and evidence guarantees preserved |
| Recorded: Lion vs Lion attempt 1 | Same structural migration | Original verdict and evidence guarantees preserved |
| Recorded: Lion vs Lion attempt 2 | Same structural migration | Original verdict and evidence guarantees preserved |
| Recorded: Hippopotamus vs Lion attempt 1 | Same structural migration | Original verdict and evidence guarantees preserved |
| Recorded: Saltwater crocodile vs Lion attempt 1 | Same structural migration | Original verdict and evidence guarantees preserved |
| Recorded: Saltwater crocodile vs Lion attempt 2 | Same structural migration | Original verdict and evidence guarantees preserved |
| Recorded: Gorilla vs Grizzly bear attempt 1 | Same structural migration | Original verdict and evidence guarantees preserved |
| Recorded: Gorilla vs Grizzly bear attempt 2 | Same structural migration | Original verdict and evidence guarantees preserved |
| Readability: Hippopotamus citation failure 1 | Old evidence fails / readable evidence accepted live → same numeric assertions over unchanged historical full text; new protocol rejects implied-advantage non-finish text | Missing 190 regression still checked; readable comparisons fix citations without excusing newly prohibited verdict claims |
| Readability: Hippopotamus citation failure 2 | Same separation of numeric validation from stricter non-finish policy | Missing 1500 regression still checked; exact readable text retained; implied advantage retries then rejects |
| Readability: even prompt | Prompt owns even-finish wording → exact server even template plus prompt's neutrality/no-stalemate/no-equal-ability rules | Limited scoring not represented as equal fighting ability or an actual stalemate |
| Limits: successful corrective retry | Old full wire fixture → non-finish-only fixture; same counters | Two provider slots consumed; subsequent call capped |
| Limits: cap between attempts | Old full recovery wire → non-finish-only recovery wire | Exhausted budget prevents retry and preserves cap reason |
| Limits: concurrent narrations | Old full successful wire → non-finish-only successful wire; same concurrency assertions | Shared budget cannot overspend |
| Limits: HTTP cap/gated cases | Old transport wire → non-finish-only wire; same outcomes and budget assertions | Favored/even/environmental narration capped; non-narrated gates bypass provider budget |

Shared test metadata now identifies its fictional scored factor as `Size` so
the real deterministic template is exercised. It remains explicitly test-only;
no production score or trait measurement was introduced.

## Eight added tests

- Fighting finish: exact size text, compared bite only, both animal orders, engine result unchanged.
- Environmental finish: exact winner/other/environment, both orders, engine gate citations only.
- Even finish: exact text/null actor; independent outcome check rejects forged winners.
- Implied-advantage fixture and explicit/implied winning phrases: reject even with scored citations; neutral attempts accepted.
- Model-neutrality integration: first-pass success, one corrective retry, then rejection without partial fallback.
- Route telemetry: selected environment forwarded; actual attempt counter returned; verdict retained with empty beats after failure.
- Evaluation matrix: 20 distinct baseline cases, all seven animals, three environments, both modes; default 60 requests.
- Evaluation metrics: first pass vs recovered retry vs invalid/capped; exact reason/call counts without raw-log inference.
