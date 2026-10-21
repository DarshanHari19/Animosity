import assert from "node:assert/strict";
import { test } from "node:test";
import { narrationTextChecks } from "./narration-text-checks";
import { animals } from "./animals";
import { fixtureBeats, fixtureResult } from "./test-helpers";

const a = animals[0]!;
const b = animals[1]!;
const favored = fixtureResult({ kind: "favored", animal: a.name });
const even = fixtureResult({ kind: "even" });
function check(text: string, fact_used = "Test-only evidence: 1", result = favored) {
  const beat = { ...fixtureBeats(a, a.name)[0]!, text, fact_used };
  return narrationTextChecks([beat], result, a, b);
}

test("numbers must match this beat's evidence as whole numeric values", () => {
  assert.ok(check("It moves at 999 km/h.").length);
  assert.ok(check("It has mass 19 kg.", "Test-only evidence: 190 kg").length);
  assert.equal(check("Its mass is 1,500 kg.", "Test-only evidence: 1500 kg").length, 0);
  assert.equal(check("The ratio is 7.9 to 1.", "Test-only evidence: 7.9 to 1").length, 0);
  assert.equal(check("Two hundred kilograms.", "Test-only evidence: 200 kg").length, 0);
  assert.ok(check("Two animals engage.", "Test-only evidence: 190 kg").length);
});

test("percent signs and percentage words are rejected even when their numbers are supported", () => {
  for (const text of ["1%", "1 percent", "1 percentage point", "1 per cent", "1 pct"]) {
    assert.ok(check(text).some(({ issues }) => issues?.some(({ message }) => message.includes("percentage"))), text);
  }
});

test("a favored narration cannot name the other animal as winning", () => {
  for (const text of [
    `${b.name} wins.`, `${b.name} is the winner.`, `${b.name} emerges victorious.`,
    `The winner is ${b.name}.`, `Victory goes to ${b.name}.`,
  ]) assert.ok(check(text).length, text);
  assert.equal(check(`${a.name} wins.`).length, 0);
  assert.equal(check(`${b.name} is not the winner.`).length, 0);
});

test("an even narration cannot name any winner, including a name outside the selected pair", () => {
  for (const text of [`${a.name} wins.`, "Elephant is the winner.", "Victory goes to Gorilla."]) {
    assert.ok(check(text, "Test-only evidence", even).length, text);
  }
  assert.equal(check("Neither animal wins. The encounter has no winner.", "Test-only evidence", even).length, 0);
});
