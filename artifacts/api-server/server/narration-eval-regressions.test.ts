import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { deterministicFinish } from "./narration-finish";
import { narrationEvidence, type EvidenceItem } from "./narration-evidence";
import { narrationGroundingChecks } from "./narration-grounding";
import { nonFinishChecks } from "./narration-non-finish";
import { narrationTextChecks } from "./narration-text-checks";
import type { Beat, Environment } from "./schemas";
import { fixtureResult } from "./test-helpers";

const lion = animals.find(a => a.name === "Lion")!;
const hippo = animals.find(a => a.name === "Hippopotamus")!;
const gorilla = animals.find(a => a.name === "Gorilla")!;
const bear = animals.find(a => a.name === "Grizzly bear")!;
const context: EvidenceItem = { id: "TEST_CONTEXT", kind: "context", text: "Test-only descriptive context." };
const beat = (text: string, animal = hippo.name): Beat =>
  ({ text, animal, action: "approach", facts_used: [context.text] });

const examples = JSON.parse(readFileSync(new URL("./__fixtures__/last-narration-eval-regressions.json", import.meta.url), "utf8")) as
  Array<{ previous_check: string; animals: [string, string]; environment: Environment; animal: string; text: string }>;

for (const example of examples) {
  test(`latest eval false positive passes (${example.previous_check}): ${example.text}`, () => {
    const a = animals.find(a => a.name === example.animals[0])!;
    const b = animals.find(a => a.name === example.animals[1])!;
    const result = scoreMatchup(a, b, { environment: example.environment, mode: "forced_fight", encounter: "face_off" });
    const evidence = [...narrationEvidence(result, a, b), context];
    const value = beat(example.text, example.animal);
    const finish = deterministicFinish(result, a, b, evidence, example.environment);
    assert.deepEqual(narrationTextChecks([value], result, a, b), []);
    assert.deepEqual(nonFinishChecks([value], result, a, b), []);
    assert.deepEqual(narrationGroundingChecks([value, finish], result, evidence, a, b, example.environment), []);
  });
}

test("first and second identify mirror-match animals, not measurements", () => {
  const shark = animals.find(a => a.name === "Great white shark")!;
  for (const ordinal of ["first", "second"]) {
    const value = beat(`The ${ordinal} shark snaps its jaws toward its rival.`, shark.name);
    assert.deepEqual(narrationTextChecks([value], fixtureResult({ kind: "even" }), shark, shark), []);
  }
});

test("chest beating is not a verdict, but beating the opponent remains a verdict", () => {
  const result = fixtureResult({ kind: "even" });
  for (const text of ["The Gorilla beats its chest.", "The Gorilla beats the chest."]) {
    assert.deepEqual(narrationTextChecks([beat(text, gorilla.name)], result, gorilla, bear), []);
  }
  assert.equal(narrationTextChecks([beat("The Gorilla beats the Grizzly bear.", gorilla.name)], result, gorilla, bear)[0]?.check, "text_consistency");
});

test("missed strikes pass, while missing data and other protected text rules still fail", () => {
  const result = fixtureResult({ kind: "favored", animal: hippo.name });
  for (const text of [
    "Missing data prevents comparison.", "The mass value is missing.",
    "The source tier is unknown.", "A speed of 60 km/h.", "A three-ton animal.",
    "The Lion has a 50% chance.", "The Lion wins.",
  ]) assert.equal(narrationTextChecks([beat(text)], result, hippo, lion)[0]?.check, "text_consistency", text);
});

test("favored pressure and size descriptions need no scored citation; causal explanations still do", () => {
  const result = fixtureResult({ kind: "favored", animal: hippo.name });
  const evidence = [...narrationEvidence(result, hippo, lion), context];
  const finish = deterministicFinish(result, hippo, lion, evidence);
  for (const text of [
    "The heavy Hippopotamus keeps pushing forward.",
    "The massive Hippopotamus keeps pressing forward.",
    "The great Hippopotamus keeps driving forward.",
    "The Hippopotamus keeps pressing the Lion back.",
    "The Hippopotamus keeps driving the Lion back.",
  ]) {
    const value = beat(text);
    assert.deepEqual(narrationGroundingChecks([value, finish], result, evidence, hippo, lion), [], text);
    assert.deepEqual(nonFinishChecks([value], result, hippo, lion), [], text);
  }
  for (const text of [
    "The Hippopotamus wins because of its size.",
    "The Hippopotamus's mass determined the fight.",
    "The Hippopotamus's strength keeps the Lion pinned.",
    "The heavy Hippopotamus keeps pushing forward thanks to its mass.",
  ]) assert.equal(narrationGroundingChecks([beat(text), finish], result, evidence, hippo, lion)[0]?.check, "causal_grounding", text);
  const sized = { ...beat("The Hippopotamus's mass determined the fight."),
    facts_used: [evidence.find(item => item.factor_name === "Size")!.text] };
  assert.deepEqual(narrationGroundingChecks([sized, finish], result, evidence, hippo, lion), []);
  assert.equal(nonFinishChecks([beat("The Lion gains the upper hand.")], result, hippo, lion)[0]?.check, "non_finish_verdict");
  assert.equal(nonFinishChecks([beat("The Lion keeps pressing the Hippopotamus back.", lion.name)], result, hippo, lion)[0]?.check, "non_finish_verdict");
});
