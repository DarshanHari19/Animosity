import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { nonFinishChecks } from "./narration-non-finish";
import { narrationGroundingChecks } from "./narration-grounding";
import { deterministicFinish } from "./narration-finish";
import { narrationEvidence } from "./narration-evidence";
import { fixtureResult } from "./test-helpers";
import type { Beat } from "./schemas";
import type { EvidenceItem } from "./narration-evidence";

const hippo = animals.find(a => a.name === "Hippopotamus")!;
const lion = animals.find(a => a.name === "Lion")!;
const context: EvidenceItem = { id: "E1", kind: "context", text: "Test-only description." };
const beat = (text: string, animal = hippo.name): Beat =>
  ({ text, animal, action: "approach", facts_used: [context.text] });
const recorded = JSON.parse(readFileSync(new URL("./__fixtures__/non-finish-eval-regressions.json", import.meta.url), "utf8")) as
  Array<{ animals: [string, string]; texts: string[] }>;

test("recorded pushing, driving and water's-edge examples pass non-finish verdict and grounding checks", () => {
  for (const entry of recorded) {
    const a = animals.find(a => a.name === entry.animals[0])!;
    const b = animals.find(a => a.name === entry.animals[1])!;
    const result = scoreMatchup(a, b, { environment: "land", mode: "forced_fight", encounter: "face_off" });
    const evidence = [...narrationEvidence(result, a, b), context];
    const finish = deterministicFinish(result, a, b, evidence);
    for (const text of entry.texts) {
      const value = beat(text, text.startsWith(`The ${b.name}`) ? b.name : a.name);
      assert.deepEqual(nonFinishChecks([value], result, a, b), [], text);
      assert.deepEqual(narrationGroundingChecks([value, finish], result, evidence, a, b), [], text);
    }
  }
});

test("favored non-finishes allow the winner's pressure but reject the opponent's upper hand, in either order", () => {
  const result = fixtureResult({ kind: "favored", animal: hippo.name });
  for (const [a, b] of [[hippo, lion], [lion, hippo]] as const) {
    for (const text of [
      "The Hippopotamus pushes the Lion back.",
      "The Hippopotamus drives the Lion back.",
      "The Hippopotamus presses the Lion back.",
      "The Hippopotamus gains ground.",
      "The Lion retreats, unable to shake it off.",
    ]) assert.deepEqual(nonFinishChecks([beat(text)], result, a, b), [], text);
    for (const text of [
      "The Lion wins.", "The Lion gains the upper hand.", "The Lion overpowers the Hippopotamus.",
      "The Lion drives the Hippopotamus back.", "The Lion presses the Hippopotamus back.",
      "The Hippopotamus cannot continue.", "The Lion gains ground.",
      "The Hippopotamus holds the advantage, but the Lion wins.",
      "The Hippopotamus approaches, but the other animal gains the upper hand.",
    ]) assert.equal(nonFinishChecks([beat(text)], result, a, b)[0]?.check, "non_finish_verdict", text);
  }
});

test("even non-finishes permit movement but reject either animal decisively winning", () => {
  const result = fixtureResult({ kind: "even" });
  for (const text of ["The Lion drives forward.", "The Hippopotamus pushes the Lion back."]) {
    assert.deepEqual(nonFinishChecks([beat(text)], result, hippo, lion), [], text);
  }
  for (const text of ["The Lion wins.", "The Hippopotamus defeats the Lion.", "The Lion overpowers the Hippopotamus."]) {
    assert.equal(nonFinishChecks([beat(text)], result, hippo, lion)[0]?.check, "non_finish_verdict", text);
  }
});

test("edge as a location passes, but edge as an unsupported advantage still fails grounding", () => {
  const result = fixtureResult({ kind: "even" });
  for (const text of [
    "The Lion approaches the water's edge.", "The Lion approaches the water’s edge.",
    "The Lion stops at the river's edge.", "The Lion stops near the lake edge.",
  ]) assert.deepEqual(narrationGroundingChecks([beat(text)], result, [context], hippo, lion), [], text);
  for (const text of [
    "The Lion gains the edge.", "The Lion has an edge at the water's edge.",
    "The Lion's speed gives it the edge.",
  ]) assert.equal(narrationGroundingChecks([beat(text)], result, [context], hippo, lion)[0]?.check, "causal_grounding", text);
});
