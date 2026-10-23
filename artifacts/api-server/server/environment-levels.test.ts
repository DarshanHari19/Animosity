import assert from "node:assert/strict";
import { test } from "node:test";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { narrationEvidence } from "./narration-evidence";
import { narrationGroundingChecks } from "./narration-grounding";
import { humanWording } from "./wording";
import type { Animal, Environment, EnvironmentLevel, MatchupResult } from "./schemas";

const find = (name: string) => animals.find(a => a.name === name)!;
const forced = { environment: "land", mode: "forced_fight", encounter: "face_off" } as const;
const level = (name: string, land: EnvironmentLevel): Animal => ({
  ...find("Lion"), name, mass_kg: 100, bite_force_n: null,
  environments: { land, shallow_water: "full", deep_water: "cannot" },
  field_sources: { environments: { tier: null, ref: "Test-only unknown habitat source" } },
});

// Design anchors from METHODOLOGY.md, not measurements or probability claims.
const anchors = [
  ["Saltwater crocodile", "Lion", "shallow_water", "Saltwater crocodile", 1.8],
  ["Saltwater crocodile", "Lion", "land", null, 0.2],
  ["Hippopotamus", "Saltwater crocodile", "deep_water", "Hippopotamus", 0.59],
  ["Saltwater crocodile", "Grizzly bear", "land", null, -0.2],
  ["Hippopotamus", "Lion", "shallow_water", "Hippopotamus", 3.2],
] as const;

for (const [first, second, environment, winner, approximate] of anchors) {
  test(`environment calibration: ${first} vs ${second}, ${environment}`, () => {
    const a = find(first), b = find(second);
    for (const mode of ["realistic", "forced_fight"] as const) {
      const result = scoreMatchup(a, b, { ...forced, environment, mode });
      const swapped = scoreMatchup(b, a, { ...forced, environment, mode });
      assert.deepEqual(result.outcome, winner ? { kind: "favored", animal: winner } : { kind: "even" });
      assert.deepEqual(swapped.outcome, result.outcome);
      assert.ok(Math.abs(result.advantage_score! - approximate) < 0.05);
      assert.equal(swapped.advantage_score, -result.advantage_score!);
      result.factors.forEach((factor, index) => {
        assert.equal(swapped.factors[index]!.name, factor.name);
        assert.equal(swapped.factors[index]!.value, factor.value === 0 ? 0 : -factor.value);
      });
    }
  });
}

test("environment factor is omitted for full/full, signed for one hampered, and cancels when both are hampered", () => {
  for (const [aLevel, bLevel, expected] of [
    ["full", "full", null], ["hampered", "full", -0.8],
    ["full", "hampered", 0.8], ["hampered", "hampered", 0],
  ] as const) {
    const a = level("A", aLevel), b = level("B", bLevel);
    const result = scoreMatchup(a, b, forced);
    const environment = result.factors.find(f => f.name === "Environment");
    assert.equal(environment?.value ?? null, expected);
    assert.equal(result.advantage_score, expected ?? 0);
    if (environment) assert.equal(environment.reason, [a, b]
      .filter(animal => animal.environments.land === "hampered")
      .map(animal => `${animal.name} is hampered in land: footing, speed, and grappling suffer.`).join(" "));
  }
});

test("cannot gates and environment quality consult null tiers without scoring, in either order", () => {
  for (const [aLevel, bLevel] of [["cannot", "cannot"], ["cannot", "hampered"], ["cannot", "full"]] as const) {
    const a = level("A", aLevel), b = level("B", bLevel);
    for (const [first, second] of [[a, b], [b, a]]) {
      for (const mode of ["realistic", "forced_fight"] as const) {
        const result = scoreMatchup(first!, second!, { ...forced, mode });
        const expected: MatchupResult["outcome"] = bLevel === "cannot" ? { kind: "indeterminate" }
          : mode === "realistic" ? { kind: "no_contest" } : { kind: "favored", animal: "B" };
        assert.deepEqual(result.outcome, expected);
        assert.equal(result.advantage_score, null);
        assert.deepEqual(result.factors, []);
        assert.equal(result.evidence_quality, "mostly_lower_tier_or_unknown");
      }
    }
  }
});

test("behavior still gates hampered-but-capable animals before numerical scoring", () => {
  const a = { ...level("A", "hampered"), temperament: "avoids" as const };
  const b = { ...level("B", "full"), temperament: "defensive" as const };
  const result = scoreMatchup(a, b, { ...forced, mode: "realistic" });
  assert.deepEqual(result.outcome, { kind: "no_engagement", animals: ["A"] });
  assert.equal(result.advantage_score, null);
  assert.deepEqual(result.factors, []);
});

test("Environment factor is scored evidence; raw levels never become trait evidence at any source tier", () => {
  const a = find("Saltwater crocodile"), b = find("Lion");
  const environment: Environment = "land";
  const result = scoreMatchup(a, b, { ...forced, environment });
  for (const tier of [1, 2, 3, null] as const) {
    const subject = { ...a, field_sources: { ...a.field_sources, environments: { tier, ref: "Test-only habitat reference" } } };
    const evidence = narrationEvidence(result, subject, b);
    const factor = result.factors.find(f => f.name === "Environment")!;
    const item = evidence.find(e => e.factor_name === "Environment")!;
    assert.equal(item.kind, "scored");
    assert.equal(item.text, `Environment: ${humanWording(factor.reason)}`);
    assert.equal(evidence.some(e => e.text.includes(".environments")), false);
    assert.equal(evidence.some(e => e.text.includes("Test-only habitat reference")), false);
  }
  const favored = scoreMatchup(find("Hippopotamus"), b, { ...forced, environment: "shallow_water" });
  const evidence = narrationEvidence(favored, find("Hippopotamus"), b);
  const fact = evidence.find(e => e.factor_name === "Environment")!;
  const beat = { action: "finish" as const, animal: "Hippopotamus",
    text: "The environment decides the footing and speed and grappling handicap.", facts_used: [fact.text] };
  assert.deepEqual(narrationGroundingChecks([beat], favored, evidence, find("Hippopotamus"), b), []);
  assert.ok(narrationGroundingChecks([{ ...beat, facts_used: [evidence.find(e => e.factor_name === "Size")!.text] }],
    favored, evidence, find("Hippopotamus"), b).length);
  assert.ok(narrationGroundingChecks([{ ...beat, text: "Strength decides the outcome." }],
    favored, evidence, find("Hippopotamus"), b).length);
});
