import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { FightError } from "./errors";
import { AnimalSchema, type Animal, type EngineContext, type MatchupResult } from "./schemas";
import { startFightServer, fixtureBeats } from "./test-helpers";

test("engine remains an explicit stub in every environment and mode", () => {
  for (const environment of ["land", "shallow_water", "deep_water"] as const) {
    for (const mode of ["realistic", "forced_fight"] as const) {
      assert.throws(
        () => scoreMatchup(animals[0]!, animals[1]!, { environment, mode, encounter: "face_off" }),
        (error: unknown) => error instanceof FightError &&
          error.code === "SCORING_NOT_IMPLEMENTED" && error.status === 501,
      );
    }
  }
});

// Only functions_in is specified for these fixtures. Other values are
// nonfactual test scaffolding, including zero/null numerical unknowns.
// These animals must never be added to the production selectable catalog.
function fixtureAnimal(name: string, functions_in: Animal["functions_in"]): Animal {
  return AnimalSchema.parse({
    name, profile: "adult_male", mass_kg: 0, length_m: 0, top_speed_kmh: 0,
    primary_weapon: "strike", bite_force_n: null, armor: "none",
    temperament: "avoids", fighting_style: "bluff", functions_in,
    field_sources: { functions_in: { tier: 3, ref: "TODO: verify" } },
  });
}
const whale = fixtureAnimal("Blue whale", ["deep_water"]);
const elephant = fixtureAnimal("African elephant", ["land", "shallow_water"]);
const catalog = [...animals, whale, elephant];

type Scenario = {
  title: string; a: string; b: string; context: Partial<EngineContext>;
  expected: MatchupResult["outcome"] | { kind: "tuning"; animal: string };
  deciding?: MatchupResult["deciding_factor"];
};
const scenarios: Scenario[] = [
  { title: "1. Hippo vs Lion: fighting ability", a: "Hippopotamus", b: "Lion",
    context: { environment: "land", mode: "realistic" },
    expected: { kind: "favored", animal: "Hippopotamus" }, deciding: "fighting_ability" },
  { title: "2. Croc vs Lion: realistic deep water", a: "Saltwater crocodile", b: "Lion",
    context: { environment: "deep_water", mode: "realistic" }, expected: { kind: "no_contest" } },
  { title: "3. Croc vs Lion: forced deep water", a: "Saltwater crocodile", b: "Lion",
    context: { environment: "deep_water", mode: "forced_fight" },
    expected: { kind: "favored", animal: "Saltwater crocodile" }, deciding: "environmental_advantage" },
  // TODO: Tune the land matchup; either Croc favored or even is acceptable.
  { title: "4. Croc vs Lion: land tuning", a: "Saltwater crocodile", b: "Lion",
    context: { environment: "land", mode: "realistic" },
    expected: { kind: "tuning", animal: "Saltwater crocodile" } },
  { title: "5. Great white vs Croc: deep water", a: "Great white shark", b: "Saltwater crocodile",
    context: { environment: "deep_water", mode: "realistic" },
    expected: { kind: "favored", animal: "Great white shark" }, deciding: "fighting_ability" },
  { title: "6. Great white vs Lion: forced land", a: "Great white shark", b: "Lion",
    context: { environment: "land", mode: "forced_fight" },
    expected: { kind: "favored", animal: "Lion" }, deciding: "environmental_advantage" },
  { title: "7. Rhino vs Lion: fighting ability", a: "Rhinoceros", b: "Lion",
    context: { environment: "land", mode: "realistic" },
    expected: { kind: "favored", animal: "Rhinoceros" }, deciding: "fighting_ability" },
  { title: "8. Gorilla vs Grizzly: realistic behavior", a: "Gorilla", b: "Grizzly bear",
    context: { environment: "land", mode: "realistic" },
    expected: { kind: "even" }, deciding: "behavior" },
  // TODO: Tune the forced fight; either Grizzly favored or even is acceptable.
  { title: "9. Gorilla vs Grizzly: forced tuning", a: "Gorilla", b: "Grizzly bear",
    context: { environment: "land", mode: "forced_fight" },
    expected: { kind: "tuning", animal: "Grizzly bear" } },
  { title: "10. Hippo vs Croc: shallow water", a: "Hippopotamus", b: "Saltwater crocodile",
    context: { environment: "shallow_water", mode: "realistic" },
    expected: { kind: "favored", animal: "Hippopotamus" }, deciding: "fighting_ability" },
  { title: "11. Lion vs Lion: normal route and default context", a: "Lion", b: "Lion",
    context: { environment: "land" }, expected: { kind: "even" } },
  { title: "12. Whale vs Elephant: forced land", a: whale.name, b: elephant.name,
    context: { environment: "land", mode: "forced_fight" },
    expected: { kind: "favored", animal: elephant.name }, deciding: "environmental_advantage" },
  { title: "13. Whale vs Elephant: realistic land", a: whale.name, b: elephant.name,
    context: { environment: "land", mode: "realistic" }, expected: { kind: "no_contest" } },
  { title: "14. Whale vs Elephant: forced deep water", a: whale.name, b: elephant.name,
    context: { environment: "deep_water", mode: "forced_fight" },
    expected: { kind: "favored", animal: whale.name }, deciding: "environmental_advantage" },
  { title: "15. Great white vs Whale: forced land", a: "Great white shark", b: whale.name,
    context: { environment: "land", mode: "forced_fight" }, expected: { kind: "indeterminate" } },
];

test("future suite defines exactly 15 valid route scenarios", () => {
  // Node skips a describe.skip body entirely, so its reporter does not list the
  // child tests. Verify their definitions here without running any scoring.
  assert.equal(scenarios.length, 15);
  scenarios.forEach((scenario, index) => {
    assert.ok(scenario.title.startsWith(`${index + 1}. `));
    assert.ok(catalog.some((animal) => animal.name === scenario.a));
    assert.ok(catalog.some((animal) => animal.name === scenario.b));
  });
});

// Requested expectations, not established scientific findings. Un-skip after
// implementing scoring. Every case (including 11) exercises the HTTP route,
// real engine and result validation; only external narration is mocked.
describe.skip("Future scoring methodology", () => {
  for (const scenario of scenarios) {
    test(scenario.title, async (t) => {
      const server = await startFightServer(t, scoreMatchup, async (result, a) =>
        fixtureBeats(a, result.outcome.kind === "favored" ? result.outcome.animal : null),
      catalog);
      const response = await server.post({
        animalA: scenario.a, animalB: scenario.b, ...scenario.context,
      });
      assert.equal(response.status, 200);
      const { result } = await response.json() as { result: MatchupResult };
      if (scenario.expected.kind === "tuning") {
        assert.ok(result.outcome.kind === "even" ||
          (result.outcome.kind === "favored" && result.outcome.animal === scenario.expected.animal));
      } else {
        assert.deepEqual(result.outcome, scenario.expected);
      }
      if (scenario.deciding !== undefined) assert.equal(result.deciding_factor, scenario.deciding);
    });
  }
});
