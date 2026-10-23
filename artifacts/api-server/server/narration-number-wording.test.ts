import assert from "node:assert/strict";
import { test } from "node:test";
import { animals } from "./animals";
import { climaxChecks } from "./narration-climax";
import { narrationTextChecks } from "./narration-text-checks";
import { fixtureResult } from "./test-helpers";
import type { Beat } from "./schemas";

const lion = animals.find(a => a.name === "Lion")!;
const hippo = animals.find(a => a.name === "Hippopotamus")!;
const result = fixtureResult({ kind: "favored", animal: hippo.name });
function checks(text: string) {
  const beat: Beat = { text, animal: hippo.name, action: "approach", facts_used: [] };
  return [
    narrationTextChecks([beat], result, hippo, lion),
    climaxChecks(text, result, hippo, lion, "forced_fight", "land"),
  ];
}

test("half-open posture passes in non-finish text and climax", () => {
  for (const text of [
    "The Hippopotamus moves forward with its jaws half open.",
    "The Hippopotamus raises its half-open jaws.",
    "The Lion watches with eyes half closed.",
    "The Hippopotamus moves forward, half-submerged.",
  ]) for (const failures of checks(text)) assert.deepEqual(failures, [], text);
});

test("real fractions, numbers, and percentages remain rejected", () => {
  for (const text of [
    "The Hippopotamus weighs half a tonne.",
    "The Hippopotamus moves half the distance.",
    "The Hippopotamus crosses a quarter of the arena.",
    "The Hippopotamus moves 3 metres with jaws half open.",
    "The Hippopotamus has a 50% chance.",
  ]) for (const failures of checks(text)) assert.ok(failures.length > 0, text);
});
