import assert from "node:assert/strict";
import { test } from "node:test";
import { expect } from "expect";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import type { Animal, EngineContext } from "./schemas";

// Arbitrary positive test numbers, not claimed scientific measurements.
function animal(name: string, overrides: Partial<Animal> = {}): Animal {
  return {
    ...animals[0]!, name, mass_kg: 100, bite_force_n: null,
    environments: { land: "full", shallow_water: "cannot", deep_water: "cannot" }, temperament: "defensive", fighting_style: "sustained",
    field_sources: Object.fromEntries(
      ["environments", "temperament", "fighting_style", "mass_kg", "bite_force_n"]
        .map((field) => [field, { tier: 1 as const, citation: "Test-only fixture" }]),
    ),
    ...overrides,
  };
}
const forced: EngineContext = { environment: "land", mode: "forced_fight", encounter: "face_off" };
const realistic: EngineContext = { ...forced, mode: "realistic" };

test("v1 uses exactly the specified log2 mass and comparable bite factors", () => {
  const a = animal("A", { mass_kg: 400, bite_force_n: 1600 });
  const b = animal("B", { mass_kg: 100, bite_force_n: 400 });
  const result = scoreMatchup(a, b, forced);
  assert.deepEqual(result.factors.map(({ name }) => name), ["Size", "Bite force"]);
  expect(result.factors[0]!.value).toBeCloseTo(1.6, 12);
  expect(result.factors[1]!.value).toBeCloseTo(1, 12);
  expect(result.advantage_score).toBeCloseTo(2.6, 12);
  assert.deepEqual(result.outcome, { kind: "favored", animal: "A" });
  assert.equal(result.deciding_factor, "fighting_ability");
  assert.equal(result.encounter_label, "hypothetical");
  assert.equal(result.evidence_quality, "mostly_higher_tier");
});

test("missing bites or unequal/unknown tiers exclude the bite factor", () => {
  const a = animal("A", { bite_force_n: 200 });
  for (const b of [
    animal("B"),
    animal("B", { bite_force_n: 100, field_sources: {} }),
    animal("B", { bite_force_n: 100, field_sources: { bite_force_n: { tier: null, citation: "Unknown" } } }),
    animal("B", { bite_force_n: 100, field_sources: { bite_force_n: { tier: 2, citation: "Different tier" } } }),
  ]) {
    const result = scoreMatchup(a, b, forced);
    assert.equal(result.factors[1]!.value, 0);
    assert.equal(result.factors[1]!.reason,
      "Not compared: a value is missing, or the values come from different source tiers or different teeth.");
  }
  // An invalid bite is not used (or validated) when comparison is excluded.
  assert.equal(scoreMatchup({ ...a, bite_force_n: -1 }, animal("B"), forced).factors[1]!.value, 0);
});

test("equal tiers compare bites only at the same known bite point, in both orders", () => {
  const a = animal("A", { bite_force_n: 200, bite_point: "canine" });
  for (const bite_point of ["molar", "molariform", null] as const) {
    const b = animal("B", { bite_force_n: 100, bite_point });
    for (const [first, second] of [[a, b], [b, a]] as const) {
      const result = scoreMatchup(first, second, forced);
      assert.equal(result.factors[1]!.value, 0);
      assert.equal(result.advantage_score, 0);
      assert.deepEqual(result.outcome, { kind: "even" });
      assert.match(result.factors[1]!.reason, /different source tiers or different teeth/);
    }
  }
  for (const bite_point of ["canine", "molar", "molariform"] as const) {
    const first = { ...a, bite_point };
    const second = animal("B", { bite_force_n: 100, bite_point });
    assert.equal(scoreMatchup(first, second, forced).factors[1]!.value, 0.5);
    assert.equal(scoreMatchup(second, first, forced).factors[1]!.value, -0.5);
  }
  const unknown = { ...a, bite_point: null };
  assert.equal(scoreMatchup(unknown, unknown, forced).factors[1]!.value, 0);
});

test("cutoffs are inclusive at +/-0.5; smaller scored advantages are even", () => {
  const a = animal("A", { bite_force_n: 2 });
  const b = animal("B", { bite_force_n: 1 });
  assert.equal(scoreMatchup(a, b, forced).advantage_score, 0.5);
  assert.equal(scoreMatchup(b, a, forced).advantage_score, -0.5);
  assert.deepEqual(scoreMatchup(a, b, forced).outcome, { kind: "favored", animal: "A" });
  assert.deepEqual(scoreMatchup(b, a, forced).outcome, { kind: "favored", animal: "A" });
  const even = scoreMatchup(animal("A", { mass_kg: 150 }), animal("B"), forced);
  assert.deepEqual(even.outcome, { kind: "even" });
  assert.equal(even.deciding_factor, null);
});

test("cannot environment gates precede behavior and do not run numerical factors", () => {
  const cannot = { land: "cannot", shallow_water: "cannot", deep_water: "cannot" } as const;
  const unavailable = animal("A", { environments: cannot, temperament: "avoids" });
  const b = animal("B", { temperament: "avoids" });
  const outcomes = [
    scoreMatchup(unavailable, { ...b, environments: cannot }, realistic),
    scoreMatchup(unavailable, b, realistic),
    scoreMatchup(unavailable, b, forced),
  ];
  assert.deepEqual(outcomes.map((result) => result.outcome), [
    { kind: "indeterminate" }, { kind: "no_contest" }, { kind: "favored", animal: "B" },
  ]);
  assert.deepEqual(outcomes.map((result) => result.deciding_factor), [null, null, "environmental_advantage"]);
  for (const result of outcomes) {
    assert.equal(result.advantage_score, null);
    assert.deepEqual(result.factors, []);
    assert.equal(result.evidence_quality, "mostly_higher_tier");
  }
});

test("behavior lists one or both reluctant animals, respects aggression, and skips forced fights", () => {
  const a = animal("A", { temperament: "avoids" });
  const b = animal("B");
  assert.deepEqual(scoreMatchup(a, b, realistic).outcome, { kind: "no_engagement", animals: ["A"] });
  const both = scoreMatchup(a, { ...b, fighting_style: "bluff" }, realistic);
  assert.deepEqual(both.outcome, { kind: "no_engagement", animals: ["A", "B"] });
  assert.equal(both.deciding_factor, "behavior");
  assert.equal(both.advantage_score, null);
  assert.deepEqual(both.factors, []);
  assert.deepEqual(scoreMatchup(a, { ...b, temperament: "aggressive" }, realistic).outcome, { kind: "even" });
  assert.deepEqual(scoreMatchup(a, { ...b, fighting_style: "bluff" }, forced).outcome, { kind: "even" });
});

test("evidence quality uses exact 1/3 and 2/3 boundaries and only stage-consulted fields", () => {
  for (const [higher, expected] of [
    [2, "mostly_lower_tier_or_unknown"], [3, "mixed"], [4, "mostly_higher_tier"],
  ] as const) {
    const a = animal("A", { temperament: "avoids" });
    const b = animal("B");
    const fields = [
      [a, "environments"], [b, "environments"],
      [a, "temperament"], [a, "fighting_style"], [b, "temperament"], [b, "fighting_style"],
    ] as const;
    fields.forEach(([target, field], index) => {
      target.field_sources[field] = { tier: index < higher ? 1 : null, citation: "Test-only fixture" };
    });
    const result = scoreMatchup(a, b, realistic);
    // High-tier mass and bite sources do not count at a behavior gate.
    assert.equal(result.evidence_quality, expected);
  }
  const missingSources = scoreMatchup(animal("A", { field_sources: {} }), animal("B", { field_sources: {} }), forced);
  assert.equal(missingSources.evidence_quality, "mostly_lower_tier_or_unknown");
});

test("claws, horns, armor, speed and fighting style add no numerical score", () => {
  const a = animal("A", { primary_weapon: "horns", armor: "shell", top_speed_kmh: 1000, fighting_style: "charge" });
  const b = animal("B", { primary_weapon: "claws", armor: "none", top_speed_kmh: 1, fighting_style: "bluff" });
  const result = scoreMatchup(a, b, forced);
  assert.equal(result.advantage_score, 0);
  assert.deepEqual(result.factors.map((factor) => factor.value), [0, 0]);
});

test("finite positive extreme inputs never produce nonfinite factors or ratio explanations", () => {
  const result = scoreMatchup(
    animal("A", { mass_kg: Number.MAX_VALUE }), animal("B", { mass_kg: Number.MIN_VALUE }), forced,
  );
  assert.ok(Number.isFinite(result.advantage_score));
  for (const factor of result.factors) {
    assert.ok(Number.isFinite(factor.value));
    assert.doesNotMatch(factor.reason, /Infinity|NaN/);
  }
});
