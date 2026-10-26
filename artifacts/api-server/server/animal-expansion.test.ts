import assert from "node:assert/strict";
import { test } from "node:test";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { narrationEvidence } from "./narration-evidence";
import type { Animal, EngineContext } from "./schemas";

const animal = (name: string) => animals.find(a => a.name === name)!;
const arena: EngineContext = { environment: "land", mode: "forced_fight", encounter: "face_off" };

test("new profiles preserve supplied numbers, unknowns, provenance and temperament assumptions", () => {
  const added = animals.slice(7);
  assert.deepEqual(added.map(a => [a.name, a.temperament, a.field_sources.temperament!.tier]), [
    ["Tiger", "aggressive", null], ["Polar bear", "defensive", null],
    ["African bush elephant", "defensive", null], ["Orca", "aggressive", null],
    ["Komodo dragon", "aggressive", null],
  ]);
  assert.ok(added.every(a => a.top_speed_kmh === null));
  assert.equal(animal("African bush elephant").length_m, null);
  assert.match(animal("Tiger").field_sources.mass_kg!.note!, /primary paper not yet read/);
  assert.match(animal("Orca").field_sources.mass_kg!.note!, /Two captive adult males/);
  assert.match(animal("Komodo dragon").field_sources.mass_kg!.note!, /sex not recorded/);
  assert.equal(animal("Polar bear").field_sources.length_m!.tier, 1);
  assert.equal(animal("Orca").field_sources.length_m!.tier, 1);
  assert.equal(animal("Komodo dragon").field_sources.length_m!.tier, 1);
  for (const a of animals.filter(a => a.field_sources.bite_force_n!.citation.includes("Christiansen"))) {
    assert.match(a.field_sources.bite_force_n!.note!, /literature averages weighted by sex ratio, not specimen masses/);
  }
});

test("new bites use the existing same-tier same-tooth comparison rule, in both orders", () => {
  const pairs = [
    ["Tiger", "Lion", true], ["Polar bear", "Grizzly bear", true],
    ["Komodo dragon", "Saltwater crocodile", false], ["Komodo dragon", "Gorilla", false],
    ["Komodo dragon", "Komodo dragon", true],
  ] as const;
  for (const [first, second, compared] of pairs) {
    for (const [a, b] of [[animal(first), animal(second)], [animal(second), animal(first)]]) {
      const factor = scoreMatchup(a!, b!, arena).factors.find(f => f.name === "Bite force")!;
      assert.equal(!factor.reason.startsWith("Not compared"), compared, `${first} / ${second}`);
    }
  }
});

test("new unknown and null-tier traits never enter narrator evidence", () => {
  const elephant = animal("African bush elephant"), komodo = animal("Komodo dragon");
  const evidence = narrationEvidence(scoreMatchup(elephant, komodo, arena), elephant, komodo);
  for (const item of evidence) {
    assert.doesNotMatch(item.text, /length_m = null|top_speed_kmh|temperament|sex not recorded|not specimen masses/);
  }
});

test("only the grizzly deep-water correction changes original seven-animal outcomes", () => {
  const originals = animals.slice(0, 7);
  const former = (a: Animal): Animal => a.name === "Grizzly bear"
    ? { ...a, environments: { ...a.environments, deep_water: "cannot" } } : a;
  const expected = new Map([
    ["Lion|forced_fight", "indeterminate->favored:Grizzly bear"],
    ["Lion|realistic", "indeterminate->no_contest"],
    ["Gorilla|forced_fight", "indeterminate->favored:Grizzly bear"],
    ["Gorilla|realistic", "indeterminate->no_contest"],
    ["Rhinoceros|forced_fight", "indeterminate->favored:Grizzly bear"],
    ["Rhinoceros|realistic", "indeterminate->no_contest"],
    ["Grizzly bear|forced_fight", "indeterminate->even"],
    ["Grizzly bear|realistic", "indeterminate->even"],
    ["Saltwater crocodile|realistic", "no_contest->favored:Saltwater crocodile"],
    ["Hippopotamus|realistic", "no_contest->favored:Hippopotamus"],
    ["Great white shark|realistic", "no_contest->favored:Great white shark"],
  ]);
  let changes = 0;
  const seen = new Set<string>();
  for (const a of originals) for (const b of originals) {
    for (const environment of ["land", "shallow_water", "deep_water"] as const) {
      for (const mode of ["realistic", "forced_fight"] as const) {
        const context = { environment, mode, encounter: "face_off" as const };
        const before = scoreMatchup(former(a), former(b), context);
        const after = scoreMatchup(a, b, context);
        if (environment !== "deep_water" || ![a.name, b.name].includes("Grizzly bear")) {
          assert.deepEqual(after, before);
          continue;
        }
        const other = a.name === "Grizzly bear" ? b.name : a.name;
        const key = `${other}|${mode}`;
        const label = (r: typeof after) => r.outcome.kind === "favored"
          ? `favored:${r.outcome.animal}` : r.outcome.kind;
        if (expected.has(key)) {
          assert.equal(`${label(before)}->${label(after)}`, expected.get(key), key);
          seen.add(key);
          changes++;
        } else assert.deepEqual(after.outcome, before.outcome);
      }
    }
  }
  assert.equal(changes, 20, "both orders counted; grizzly mirror match counted once per mode");
  assert.equal(seen.size, expected.size);
});
