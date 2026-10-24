import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { z } from "zod";
import { animals } from "./animals";
import { historicalAnimals } from "./__fixtures__/historical-animals";
import { scoreMatchup } from "./engine";
import { narrateMatchup } from "./narrator";
import { narrationEvidence, scoredFactorText, type EvidenceItem } from "./narration-evidence";
import { narrationTool, resolveEvidence } from "./narration-tool";
import { narrationTextChecks } from "./narration-text-checks";
import { narrationGroundingChecks } from "./narration-grounding";
import { beatsSchemaFor, narrationMatchesOutcome, type Beat, type MatchupResult } from "./schemas";
import { fixtureBeats, fixtureResult, fixtureClimax } from "./test-helpers";
import { FightError } from "./errors";

const a = animals[0]!;
const b = animals[1]!;
const scored: EvidenceItem = { id: "E1", kind: "scored", factor_name: "Size", text: "Size: Test-only size comparison" };
const context: EvidenceItem = { id: "E2", kind: "context", text: "Test-only mass: 190 kg" };
const context2: EvidenceItem = { id: "E3", kind: "context", text: "Test-only speed: 80 km/h" };
const favored = fixtureResult({ kind: "favored", animal: a.name });
const environmental = { ...favored, deciding_factor: "environmental_advantage" as const, factors: [] };
const gate: EvidenceItem = {
  id: "E4", kind: "gate",
  text: `Environment: ${b.name} can't function on land.`,
};
const beat = (text: string, facts: EvidenceItem[]): Beat =>
  ({ text, action: "finish", animal: a.name, facts_used: facts.map(({ text }) => text) });

test("tool schema allows only named non-final actors; no model-owned finish", () => {
  for (const result of [favored, fixtureResult({ kind: "even" })]) {
    const schema = JSON.parse(JSON.stringify(narrationTool(a, b, [scored], result).input_schema));
    assert.deepEqual(schema.required, ["beats", "climax"]);
    assert.equal(schema.properties.climax.type, "string");
    assert.equal(schema.properties.beats.minItems, 4);
    assert.equal(schema.properties.beats.maxItems, 7);
    const item = schema.properties.beats.items.properties;
    assert.deepEqual(item.animal.enum, [a.name, b.name]);
    assert.equal(item.animal.type, "string");
    assert.equal(item.action.enum.includes("finish"), false);
    assert.equal(item.fact_ids.minItems, 1);
    assert.equal(item.fact_ids.maxItems, 3);
    assert.equal(schema.properties.finish, undefined);
    assert.equal(schema.additionalProperties, false);
  }
});

function wire(ids: string[] = ["E1"]) {
  const encoded = fixtureBeats(a, a.name).map(({ facts_used: _unused, ...rest }) => ({ ...rest, fact_ids: ids }));
  return { beats: encoded.slice(0, -1), climax: fixtureClimax(a.name) };
}
test("1–3 IDs resolve in order to exact facts, without leaking IDs or accepting duplicates", () => {
  const evidence = [scored, context, context2];
  for (const ids of [["E1"], ["E2", "E1"], ["E2", "E3", "E1"]]) {
    const output = resolveEvidence(wire(ids), evidence, a, b);
    assert.deepEqual(output.beats[0]!.facts_used, ids.map((id) => evidence.find((item) => item.id === id)!.text));
    assert.equal("fact_ids" in output.beats[0]!, false);
  }
  for (const ids of [[], ["E1", "E1"], ["E1", "E2", "E3", "E4"], ["MADE_UP"]]) {
    assert.throws(() => resolveEvidence(wire(ids), evidence, a, b), z.ZodError);
  }
});
test("a null non-final actor and an early finish are rejected after tool use", () => {
  for (const change of [{ animal: null }, { action: "finish" }]) {
    const input = wire();
    Object.assign(input.beats[0]!, change);
    assert.throws(() => resolveEvidence(input, [scored], a, b), z.ZodError);
  }
});
test("digit-numbers may use any cited item but never uncited evidence", () => {
  const supported = beat("A mass of 190 kg and speed of 80 km/h.", [context, context2]);
  assert.deepEqual(narrationTextChecks([supported], favored, a, b), []);
  assert.ok(narrationTextChecks([{ ...supported, facts_used: [context.text] }], favored, a, b).length);
  assert.deepEqual(narrationTextChecks([beat("Two animals circle one another.", [context])], favored, a, b), []);
});
test("other written numbers and source/missing/excluded wording are rejected", () => {
  for (const text of ["Three animals.", "One hundred kg.", "A tier 2 value.", "The source says so.",
    "Data is missing.", "Bite force was not compared.", "An excluded comparison."]) {
    assert.ok(narrationTextChecks([beat(text, [scored])], favored, a, b).length, text);
  }
});
test("uncompared bites and their warnings are absent from both scored and context evidence", () => {
  const result = scoreMatchup(a, b, { environment: "land", mode: "realistic", encounter: "face_off" });
  const evidence = narrationEvidence(result, a, b);
  assert.ok(result.factors.some(({ reason }) => reason.startsWith("Not compared:")));
  assert.equal(evidence.some(({ text }) => /bite_force_n|Not compared:/.test(text)), false);
  assert.equal(evidence.some(({ text }) => text.includes(".environments")), false);
  assert.ok(evidence.some(({ kind, factor_name }) => kind === "scored" && factor_name === "Size"));
  const same = scoreMatchup(a, a, { environment: "land", mode: "realistic", encounter: "face_off" });
  const compared = narrationEvidence(same, a, a);
  assert.ok(compared.some(({ kind, factor_name }) => kind === "scored" && factor_name === "Bite force"));
  assert.ok(compared.some(({ text }) => text.includes(".bite_force_n")));
});
test("context cannot cause a result, even when a scored size item is also cited", () => {
  for (const facts of [[context], [context, scored]]) {
    assert.ok(narrationGroundingChecks([beat("Speed decided the outcome.", facts)], favored, facts, a, b).length);
  }
  assert.deepEqual(narrationGroundingChecks([beat("Size decided the outcome.", [scored])], favored, [scored], a, b), []);
});
test("an ordinary favored finish with only gate evidence fails", () => {
  const failures = narrationGroundingChecks([beat("The environment decided the fight.", [gate])], favored, [gate], a, b);
  assert.ok(failures.some(({ issues }) => issues?.some(({ message }) => message.includes("Gate evidence"))));
  assert.ok(failures.some(({ issues }) => issues?.some(({ message }) => message.includes("scored engine factor"))));
});
test("environmental gate evidence is derived only from engine outcome fields", () => {
  assert.deepEqual(narrationEvidence(environmental, a, b).filter(({ kind }) => kind === "gate"),
    [{ ...gate, id: "E1" }]);
  assert.equal(narrationEvidence(favored, a, b).some(({ kind }) => kind === "gate"), false);
  assert.deepEqual(narrationGroundingChecks([beat("The environment decided the fight.", [gate])], environmental, [gate], a, b), []);
});
test("an environmental finish cannot cite a made-up scored factor or imply physical superiority", () => {
  const madeUp: EvidenceItem = { id: "E_FAKE", kind: "scored", text: "An invented environmental strength score" };
  for (const facts of [[madeUp], [gate, madeUp]]) {
    assert.ok(narrationGroundingChecks([beat("The environment decided the fight.", facts)], environmental, facts, a, b).length);
  }
  assert.throws(() => resolveEvidence(wire(["E_FAKE"]), [gate], a, b), /Unknown fact_id/);
  for (const text of ["Size decided the fight.", "The environment decided the fight through superior strength."]) {
    assert.ok(narrationGroundingChecks([beat(text, [gate])], environmental, [gate], a, b).length);
  }
});
test("even finishes cannot credit a size advantage despite saying no winner", () => {
  const even = fixtureResult({ kind: "even" });
  const bad = { ...beat("A size advantage favors the bear, but there is no winner.", [scored]), animal: null };
  assert.ok(narrationGroundingChecks([bad], even, [scored], a, b).length);
  assert.deepEqual(narrationGroundingChecks([{ ...bad, text: "The encounter ends evenly with no advantage." }], even, [scored], a, b), []);
});

test("unknown fabricated scored IDs in environmental narration retry once then fail", async () => {
  let calls = 0;
  const input = wire(["E_FAKE_SCORED"]);
  await assert.rejects(narrateMatchup(environmental, a, b, {
    apiKey: "test-only", reserveProviderCall: () => {},
    fetch: async () => {
      calls++;
      return Response.json({ choices: [{ message: { content: JSON.stringify(input) } }] });
    },
  }), (error: unknown) => error instanceof FightError && error.code === "INVALID_NARRATION");
  assert.equal(calls, 2);
});
test("causal failure retry names the failed check and offending beat text", async () => {
  let calls = 0;
  const bad = wire();
  bad.beats[0]!.text = "Speed decided the outcome.";
  await assert.rejects(narrateMatchup(favored, a, b, {
    apiKey: "test-only", reserveProviderCall: () => {},
    fetch: async (_url, options) => {
      calls++;
      const request = JSON.parse(String(options?.body));
      if (calls === 2) {
        const correction = request.messages.at(-1).content;
        assert.match(correction, /causal_grounding/);
        assert.match(correction, /Speed decided the outcome/);
      }
      return Response.json({ choices: [{ message: { content: JSON.stringify(bad) } }] });
    },
  }), (error: unknown) => error instanceof FightError && error.code === "INVALID_NARRATION");
  assert.equal(calls, 2);
});

type Recorded = {
  name: string; animals: [string, string]; mode: "realistic" | "forced_fight";
  raw_output: { beats: Array<{ text: string; action: string; animal: string | null; fact_id: string }> };
  recorded_evidence: EvidenceItem[];
  expected_under_new_rules: { verdict: "accept" | "reject" };
};
const fixtures = JSON.parse(fs.readFileSync(new URL("./__fixtures__/narration-regressions.json", import.meta.url), "utf8")) as { cases: Recorded[] };
for (const fixture of fixtures.cases) {
  test(`recorded regression: ${fixture.name} → ${fixture.expected_under_new_rules.verdict}`, () => {
    const first = historicalAnimals.find(({ name }) => name === fixture.animals[0])!;
    const second = historicalAnimals.find(({ name }) => name === fixture.animals[1])!;
    const result = scoreMatchup(first, second, { environment: "land", mode: fixture.mode, encounter: "face_off" });
    const evidence = narrationEvidence(result, first, second);
    // Structural migration only: text/actors are untouched; do not add citations.
    const encoded = fixture.raw_output.beats.map(({ fact_id, ...rest }) => {
      const oldText = fixture.recorded_evidence.find(({ id }) => id === fact_id)?.text;
      // The public factor presentation changed, not the recorded comparison.
      const originalFactor = result.factors.find((factor) => JSON.stringify(factor) === oldText);
      // Bibliographic labels changed too. Match the identical trait/value prefix,
      // not the old attribution formatting; do not add or alter any cited trait.
      const context = evidence.find(item => item.kind === "context" &&
        item.text.split(" [tier ")[0] === oldText?.split(" [tier ")[0]);
      const currentText = originalFactor ? scoredFactorText(originalFactor, first, second)
        : context?.text ?? oldText;
      return { ...rest, fact_ids: [evidence.find(({ text }) => text === currentText)?.id ?? "REMOVED_EVIDENCE"] };
    });
    let accepted = false;
    try {
      const output = resolveEvidence({ beats: encoded.slice(0, -1), climax: fixtureClimax(null) }, evidence, first, second);
      // Historical finish is evaluated as public data to retain the original
      // outcome/evidence/grounding regression, not sent through the new tool.
      const final = encoded.at(-1)!;
      const finish = {
        text: final.text, action: final.action, animal: final.animal,
        facts_used: final.fact_ids.map(id => evidence.find(item => item.id === id)?.text ?? "REMOVED_EVIDENCE"),
      };
      const beats = beatsSchemaFor(first, second).parse([...output.beats, finish]);
      accepted = narrationMatchesOutcome(result, beats) &&
        narrationTextChecks(beats, result, first, second).length === 0 &&
        narrationGroundingChecks(beats, result, evidence, first, second).length === 0;
    } catch (error) { if (!(error instanceof z.ZodError)) throw error; }
    assert.equal(accepted, fixture.expected_under_new_rules.verdict === "accept");
  });
}
