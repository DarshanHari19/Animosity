# Animosity Methodology

Version 1 spec, Oct 21, 2026. How Animosity sources animal data and decides who is favored. Updated whenever the method changes.

Status: v1 engine implemented.

## Principles

- **Rules decide, the model narrates.** A deterministic engine picks the outcome from sourced traits. The language model only writes the play-by-play and cannot change the result.
- **Every number has a source tier.** Unknown values are never filled with a guess.
- **No percentages until they mean something.** The engine produces a transparent advantage score, not a win probability.
- **Outcome, evidence, and plausibility are separate.** A matchup can be absurd and still have a clear deciding factor.
- **Restrained labels.** Every claim on a result card must be supported by data in the app.

## Settings

| Setting | Options | Default | Controls |
|---|---|---|---|
| Environment | land, shallow_water, deep_water | land | Where the encounter happens and how well each animal functions there |
| Mode | realistic, forced_fight | realistic | Whether animals are willing to fight |
| Encounter | face_off (ambush planned) | face_off | How the encounter starts |

UI default: Arena (forced_fight). In the wild (realistic) is optional.

**Realistic:** animals behave as they do in the wild. Reluctant animals may back off; an animal that can't function in the environment means no contest.

**Forced fight:** no retreat; environmental disadvantages count. If one animal can't function in the environment, the other is favored by environmental advantage. Example: blue whale vs. African elephant on land favors the elephant; in deep water it favors the whale.

## Outputs

| Output | Values |
|---|---|
| Outcome | favored {animal}, even, no_engagement {animals}, indeterminate, no_contest |
| Deciding factor | fighting_ability, environmental_advantage, behavior, null |
| Evidence quality | mostly_higher_tier, mixed, mostly_lower_tier_or_unknown |
| Encounter label | hypothetical, ranges_overlap, documented (v1: always hypothetical) |
| Advantage score | number, or null for gated outcomes |
| Factors | list of {name, value, reason} |

UI labels: "[Animal] favored", "Too close to call", "No fight: [Animal] backs off" / "No fight: both animals back off", "Indeterminate", "No contest". Evidence: "Mostly higher-tier sources", "Mixed sources", "Mostly lower-tier or unknown sources".
Even explanation: "Scored factors (body mass, comparable bite force, environment) don't separate these two." Result-card scope: "v1 scores body mass, environment, and, where comparable, bite force."
When a scored Environment factor is present, favored verdicts add "and the {Other} is hampered in {environment}" if the other animal is hampered, or "despite being hampered in {environment}" if the favored animal is hampered. These are descriptions of the existing factor, not changes to scoring.

Narration (5 to 8 beats) only for favored and even. Other outcomes return a one-line explanation, no LLM call.

## Source tiers

| Tier | Meaning |
|---|---|
| 1 | Measured on real animals, peer-reviewed |
| 2 | Modeled or estimated in peer-reviewed research |
| 3 | Reference summary not yet traced to a paper (Wikipedia, ADW) |
| null | No reliable source; stored as null, never guessed |

Never used: video compilations, fight forums, "who would win" wikis, language-model knowledge. Bite force stored in newtons. Full list: SOURCES.md.

## Environment levels (replaces functions_in)

Each animal has a level for each environment: full, hampered, or cannot.
- Shallow water: water an adult land mammal can stand in, such as a river edge.
- Deep water: water too deep to stand in.
- Levels are model assumptions, not measurements. Sources support habitat use only (see SOURCES.md, functions_in review). "cannot" is reserved for cases no reasonable person would dispute.

| Animal | Land | Shallow water | Deep water |
|---|---|---|---|
| Lion | full | hampered | cannot |
| Grizzly bear | full | full | cannot |
| Gorilla | full | hampered | cannot |
| Rhinoceros | full | hampered | cannot |
| Hippopotamus | full | full | hampered |
| Saltwater crocodile | hampered | full | full |
| Great white shark | cannot | cannot | full |

## How the outcome is calculated

**Step 0: Input validation.** Runs first, even if a gate would apply. Mass for both animals must be finite and greater than 0; any compared bite force must be finite and greater than 0. Otherwise a clear validation error. Never NaN, Infinity, or a fallback result.

**Step 1: Environment check.** Uses each animal's level for the selected environment.
- Both cannot: indeterminate.
- One cannot: realistic returns no_contest; forced_fight returns the other animal favored, environmental_advantage.
- Otherwise continue to scoring. Gates apply even when the level's source tier is null.

**Step 2: Behavior check (realistic only).**
- reluctant(x) = temperament "avoids" or fighting_style "bluff"
- An animal backs off if it is reluctant and the other is not "aggressive". Checked symmetrically for both.
- If either backs off: no_engagement listing every animal that backs off; deciding factor behavior.

**Step 3: Factors.**

| Factor | Rule | Notes |
|---|---|---|
| Size | 0.8 × (log2(mass A) − log2(mass B)) | Counts doublings so huge ratios don't dominate. 0.8 is a tuning choice |
| Bite force comparison | 0.5 × (log2(bite A) − log2(bite B)), only when both values are non-null and both source tiers are non-null and equal; otherwise 0 | A source-tier filter, not proof of the same measurement method. Compares bites to each other, not bites against defenses |
| Environment handicap | −0.8 if A is hampered; +0.8 if B is hampered; both hampered cancel out | Lost footing, speed, and grappling, not lost mass. 0.8 equals the size score of a 2:1 mass edge. Set by calibration against the anchors below |

**Calibration anchors** (design expectations, not findings):
- Saltwater crocodile vs Lion, shallow water: crocodile favored (about +1.8)
- Saltwater crocodile vs Lion, land: too close to call (about +0.2)
- Hippopotamus vs Saltwater crocodile, deep water: hippopotamus favored (about +0.59)
- Saltwater crocodile vs Grizzly bear, land: too close to call (about −0.2)
- Hippopotamus vs Lion, shallow water: hippopotamus favored (about +3.2)

Differences of logs are used instead of log of a ratio to avoid overflow.

**Step 4: Decide.** advantage_score = sum of factors. 0.5 or more favors A; −0.5 or less favors B; otherwise even (no decisive advantage on the scored factors). With bite excluded, an animal needs about a **1.54x mass advantage** to be favored, since 0.8 × log2(1.54) ≈ 0.5.

**Step 5: Evidence quality.** Tiers of every field consulted: environment level always; temperament and fighting_style when the behavior check ran; mass when factors ran; bite force when compared. Null counts as lower tier. Share of tier 1 or 2 at 2/3 or more: mostly_higher_tier. 1/3 or less: mostly_lower_tier_or_unknown. Otherwise mixed.

**Step 6: Encounter label.** Always hypothetical in v1.

## Tests

- 15 matchup expectations (see REPLIT_BUILD_LOG.md and engine.test.ts). These are requested design expectations, not verified scientific findings.
- Swap-order tests for all 15: scores and factor values reverse sign; the outcome stays the same.
- Validation tests for step 0.
- If a test fails, the rule or expectation changes only by an explicit, logged decision.

## Known limitations and open questions

- [ ] **Confidence method.** None validated yet.
- [ ] **Fighting style weights.** Charging, grappling, ambush matter, but any numeric value today would be arbitrary.
- [ ] **Ambush encounter.** Disabled until first-strike effects have a basis.
- [ ] **Defenses.** The bite comparison measures who bites harder, not how well a bite gets through the other animal's body. Needs sourced hide_thickness_mm and canine_length_mm for most animals first.
- [ ] **Estimating missing bite force.** Only with a validated relationship for that animal group, and only if it doesn't double-count size.
- [ ] **Encounter labels.** Ranges overlap needs range data; documented needs a curated list of field studies.
- [ ] **Both animals incapacitated.** Returns indeterminate; no endurance comparison until there's evidence.
- [ ] **Sex and age.** All profiles are adult males; adult females planned.
- [ ] **Tuning cases.** Gorilla vs. grizzly in forced fight (about +0.47, even). Decide and log.
- [ ] **Environment handicap size.** One fixed value for every hampered animal. Real effects vary by animal, opponent, depth, and footing.
- [ ] **Two water levels.** If shallow vs. deep keeps causing confusion, merge them into a single water environment.

## Changelog (newest first)

| Date | Change | Reason |
|---|---|---|
| Oct 22, 2026 | Environment levels (full, hampered, cannot) replace functions_in; environment handicap factor of 0.8 | A lion in shallow water can fight, but not at full strength; on/off gates couldn't express that |
| Oct 22, 2026 | UI shows forced_fight as "Arena" (default) and realistic as "In the wild"; even shown as "Too close to call" | Most users want the fight; "even" read as 50/50 |
| Oct 22, 2026 | Engine writes the verdict sentence; model writes action beats and a climax; failed narration still returns the verdict | Model-written verdicts caused most narration failures |
| Oct 21, 2026 | functions_in sources reviewed; zoo and aquarium pages are tier 3; unresolved lists stay null; functions_in excluded from narration | Replace TODO refs without redefining tiers |
| Oct 21, 2026 | Added no_engagement outcome (one or both animals back off); symmetric behavior check | "Even" was conflating no fight with equal ability; input order changed results |
| Oct 21, 2026 | Renamed evidence labels to higher-tier / lower-tier wording | Tiers describe source quality, not measurement method |
| Oct 21, 2026 | Renamed weapon factor to bite force comparison; require equal non-null tiers | It compares bites, not weapons vs. defenses |
| Oct 21, 2026 | Input validation before scoring; log differences instead of log ratios | Avoid NaN, Infinity, and accidental even results |
| Oct 21, 2026 | Swap-order tests | Catch any rule that depends on input order |
| Oct 20, 2026 | Dropped win percentages | Logistic output was not a validated probability |
| Oct 20, 2026 | Removed charge, grapple, ambush bonuses | Arbitrary values; charge double-counted size |
| Oct 20, 2026 | Encounter labels limited to hypothetical / ranges overlap / documented | Shared habitat type doesn't establish that a pairing happens |
| Oct 20, 2026 | Forced fight mode with environmental advantage; no endurance fallback | Satisfying absurd matchups without inventing a model |
| Oct 20, 2026 | Split water into shallow and deep; functions_in per animal | Survival and fighting ability differ by depth |
| Oct 20, 2026 | Source tiers per trait; bite force in newtons | Visible evidence quality; corrects psi mislabeling |
| Oct 20, 2026 | Profile field, default adult male | Strong sex differences; great white reversed |
