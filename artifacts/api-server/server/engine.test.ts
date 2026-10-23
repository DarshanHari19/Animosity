import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { FightError } from "./errors";
import { AnimalSchema, type Animal, type EngineContext, type MatchupResult } from "./schemas";
import { startFightServer, fixtureBeats } from "./test-helpers";

test("step 0 rejects invalid mass for either animal before any gate", () => {
  for (const value of [0, -1, NaN, Infinity, -Infinity]) {
    for (const index of [0, 1]) {
      const pair = [animals[0]!, animals[1]!];
      const bad = { ...pair[index]!, mass_kg: value, environments: { land: "cannot", shallow_water: "cannot", deep_water: "cannot" } as const };
      pair[index] = bad;
      for (const mode of ["realistic", "forced_fight"] as const) {
        assert.throws(
          () => scoreMatchup(pair[0]!, pair[1]!, { environment: "deep_water", mode, encounter: "face_off" }),
          (error: unknown) => error instanceof FightError && error.status === 400 &&
            error.code === "INVALID_SCORING_INPUT" &&
            error.message.includes(`${bad.name}.mass_kg`),
        );
      }
    }
  }
});

test("step 0 rejects invalid comparable bites before an environment gate", () => {
  for (const value of [0, -1, NaN, Infinity, -Infinity]) {
    for (const index of [0, 1]) {
      const pair = [animals[0]!, {
        ...animals[1]!, bite_force_n: 100,
        field_sources: { bite_force_n: { tier: 2 as const, citation: "Test fixture" } },
      }];
      const bad = { ...pair[index]!, bite_force_n: value, environments: { land: "cannot", shallow_water: "cannot", deep_water: "cannot" } as const };
      pair[index] = bad;
      assert.throws(
        () => scoreMatchup(pair[0]!, pair[1]!, { environment: "land", mode: "realistic", encounter: "face_off" }),
        (error: unknown) => error instanceof FightError && error.code === "INVALID_SCORING_INPUT" &&
          error.message.includes(`${bad.name}.bite_force_n`),
      );
    }
  }
});

// The 2 kg Blue whale and 1 kg African elephant masses are synthetic,
// test-only values, NOT real measurements. Different masses catch accidental
// numerical scoring in gated outcomes. Other zero/null values are unknowns.
// These animals must never be added to the production selectable catalog.
function fixtureAnimal(name: string, mass_kg: number, environments: Animal["environments"]): Animal {
  return AnimalSchema.parse({
    name, profile: "adult_male", mass_kg, length_m: 0, top_speed_kmh: 0,
    primary_weapon: "strike", bite_force_n: null, armor: "none",
    temperament: "avoids", fighting_style: "bluff", environments,
    field_sources: { environments: { tier: 3, citation: "TODO: verify" } },
  });
}
const whale = fixtureAnimal("Blue whale", 2, { land: "cannot", shallow_water: "cannot", deep_water: "full" });
const elephant = fixtureAnimal("African elephant", 1, { land: "full", shallow_water: "full", deep_water: "cannot" });

test("test-only Whale vs Elephant shallow water remains no_contest in the wild and elephant favored in Arena", () => {
  for (const [a, b] of [[whale, elephant], [elephant, whale]]) {
    for (const mode of ["realistic", "forced_fight"] as const) {
      const result = scoreMatchup(a!, b!, { environment: "shallow_water", mode, encounter: "face_off" });
      assert.deepEqual(result.outcome, mode === "realistic" ? { kind: "no_contest" } : { kind: "favored", animal: elephant.name });
      assert.equal(result.advantage_score, null);
      assert.deepEqual(result.factors, []);
    }
  }
});
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
  { title: "4. Croc vs Lion: land calibration anchor", a: "Saltwater crocodile", b: "Lion",
    context: { environment: "land", mode: "realistic" },
    expected: { kind: "even" } },
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
    expected: { kind: "no_engagement", animals: ["Gorilla"] }, deciding: "behavior" },
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

test("suite defines exactly 15 route scenarios", () => {
  assert.equal(scenarios.length, 15);
  scenarios.forEach((scenario, index) => {
    assert.ok(scenario.title.startsWith(`${index + 1}. `));
    assert.ok(catalog.some((animal) => animal.name === scenario.a));
    assert.ok(catalog.some((animal) => animal.name === scenario.b));
  });
});

// Requested expectations, not established scientific findings.
// Every case (including 11) exercises the HTTP route,
// real engine and result validation; only external narration is mocked.
async function runScenario(t: TestContext, scenario: Scenario, swapped = false): Promise<MatchupResult> {
  const server = await startFightServer(t, scoreMatchup, async (result, a) =>
    fixtureBeats(a, result.outcome.kind === "favored" ? result.outcome.animal : null),
  catalog);
  const response = await server.post({
    animalA: swapped ? scenario.b : scenario.a,
    animalB: swapped ? scenario.a : scenario.b, ...scenario.context,
  });
  const body = await response.json() as { result: MatchupResult; error?: string };
  assert.equal(response.status, 200, body.error);
  // This helper runs for both original and swapped requests for every case.
  // Use the expected gate, so accidentally scoring that gate cannot evade this check.
  if (["no_contest", "indeterminate", "no_engagement"].includes(scenario.expected.kind) ||
      scenario.deciding === "environmental_advantage") {
    assert.deepEqual(
      { advantage_score: body.result.advantage_score, factors: body.result.factors },
      { advantage_score: null, factors: [] },
      "Gated outcomes must have no numerical score or factors in either order.",
    );
  }
  return body.result;
}

function canonicalOutcome(outcome: MatchupResult["outcome"]) {
  return outcome.kind === "no_engagement"
    ? { kind: outcome.kind, animals: [...new Set(outcome.animals)].sort() }
    : outcome;
}

describe("Scoring methodology", () => {
  for (const scenario of scenarios) {
    test(scenario.title, async (t) => {
      const result = await runScenario(t, scenario);
      if (scenario.expected.kind === "tuning") {
        assert.ok(result.outcome.kind === "even" ||
          (result.outcome.kind === "favored" && result.outcome.animal === scenario.expected.animal));
      } else {
        assert.deepEqual(result.outcome, scenario.expected);
      }
      if (scenario.deciding !== undefined) assert.equal(result.deciding_factor, scenario.deciding);
    });
    test(`${scenario.title} (swapped order)`, async (t) => {
      const swapped = await runScenario(t, scenario, true);
      const forward = await runScenario(t, scenario);
      assert.deepEqual(canonicalOutcome(swapped.outcome), canonicalOutcome(forward.outcome));
      assert.equal(swapped.advantage_score, forward.advantage_score === null
        ? null : forward.advantage_score === 0 ? 0 : -forward.advantage_score);
      assert.equal(swapped.factors.length, forward.factors.length);
      forward.factors.forEach((factor, index) => {
        assert.equal(swapped.factors[index]!.name, factor.name);
        assert.equal(swapped.factors[index]!.value, factor.value === 0 ? 0 : -factor.value);
      });
    });
  }
});
