import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { narrationEvidence } from "./narration-evidence";
import { resolveEvidence } from "./narration-tool";
import { narrationTextChecks } from "./narration-text-checks";
import { narrateMatchup } from "./narrator";
import { FightError } from "./errors";
import { fightResponseSchemaFor, type MatchupResult } from "./schemas";
import { fixtureResult, startFightServer } from "./test-helpers";

const hippo = animals.find(({ name }) => name === "Hippopotamus")!;
const lion = animals.find(({ name }) => name === "Lion")!;
const context = { environment: "land", mode: "realistic", encounter: "face_off" } as const;

test("size and comparable bite evidence includes both values without changing engine output", () => {
  for (const [a, b] of [[hippo, lion], [lion, hippo], [lion, lion]] as const) {
    const result = scoreMatchup(a, b, context);
    const before = JSON.stringify(result);
    const evidence = narrationEvidence(result, a, b);
    const size = evidence.find(({ factor_name }) => factor_name === "Size")!;
    assert.equal(size.text, `Size: ${a.name} ${a.mass_kg} kg vs ${b.name} ${b.mass_kg} kg; ${result.factors[0]!.reason}`);
    const bite = evidence.find(({ factor_name }) => factor_name === "Bite force");
    if (a === b) {
      assert.equal(bite?.text, `Bite force: ${a.name} ${a.bite_force_n} N vs ${b.name} ${b.bite_force_n} N; ${result.factors[1]!.reason}`);
    } else assert.equal(bite, undefined);
    assert.equal(JSON.stringify(result), before);
    assert.equal(evidence.some(({ kind, text }) => kind === "scored" && text.startsWith("{")), false);
  }
});

type Regression = { name: string; original_failure: { missing_number: string }; raw_output: unknown };
const recorded = JSON.parse(readFileSync(new URL("./__fixtures__/hippo-citation-regressions.json", import.meta.url), "utf8")) as { cases: Regression[] };
for (const fixture of recorded.cases) {
  test(`${fixture.name}: original missing number is covered by readable comparison evidence`, async () => {
    const result = scoreMatchup(hippo, lion, context);
    const evidence = narrationEvidence(result, hippo, lion);
    const oldEvidence = evidence.map((item) => item.factor_name === "Size"
      ? { ...item, text: JSON.stringify(result.factors[0]) } : item);
    const old = resolveEvidence(fixture.raw_output, oldEvidence, hippo, lion);
    assert.ok(narrationTextChecks(old.beats, result, hippo, lion).some(({ issues }) =>
      issues?.some(({ message }) => message.includes(`Number ${fixture.original_failure.missing_number} is absent`))));
    let calls = 0;
    const beats = await narrateMatchup(result, hippo, lion, {
      apiKey: "test-only", reserveProviderCall: () => {},
      fetch: async () => {
        calls++;
        return Response.json({ choices: [{ message: { content: JSON.stringify(fixture.raw_output) } }] });
      },
    });
    assert.equal(calls, 1);
    assert.deepEqual(narrationTextChecks(beats, result, hippo, lion), []);
    assert.ok(beats.some(({ facts_used }) => facts_used.includes(evidence[0]!.text)));
    assert.equal(beats.some(({ facts_used }) => facts_used.some((fact) => fact.startsWith("{"))), false);
  });
}

test("every narrator failure preserves favored, even, and environmental verdicts with a sanitized reason", async (t) => {
  const codes = ["INVALID_NARRATION", "LLM_PROVIDER_FAILURE", "NARRATION_DAILY_CAP_REACHED",
    "LLM_NOT_CONFIGURED", "LLM_CONFIGURATION", "NARRATION_CAP_CONFIGURATION"] as const;
  const favored = fixtureResult({ kind: "favored", animal: lion.name });
  const environmental = { ...favored, deciding_factor: "environmental_advantage" as const, factors: [] };
  for (const result of [favored, fixtureResult({ kind: "even" }), environmental]) {
    let failure: Error;
    const server = await startFightServer(t, () => result, async () => { throw failure; });
    for (const code of [...codes, "UNEXPECTED"] as const) {
      failure = code === "UNEXPECTED" ? new Error("private provider text")
        : new FightError(code, "private provider text", 502);
      const response = await server.post({ animalA: lion.name, animalB: hippo.name });
      assert.equal(response.status, 200);
      const body = fightResponseSchemaFor(lion, hippo).parse(await response.json());
      assert.deepEqual(body.result, result);
      assert.deepEqual(body.beats, []);
      assert.equal(body.narration_status, "unavailable");
      assert.equal(body.narration_reason, code === "UNEXPECTED" ? "NARRATION_FAILED" : code);
      assert.doesNotMatch(JSON.stringify(body), /private provider text/);
    }
  }
});

test("response validation rejects contradictory narration status, reason, or beats", () => {
  const result: MatchupResult = fixtureResult({ kind: "favored", animal: lion.name });
  const valid = { result, beats: [], explanation: null,
    narration_status: "unavailable", narration_reason: "INVALID_NARRATION" };
  const schema = fightResponseSchemaFor(lion, hippo);
  assert.equal(schema.safeParse(valid).success, true);
  for (const invalid of [
    { ...valid, narration_reason: null }, { ...valid, narration_reason: "arbitrary private text" },
    { ...valid, narration_status: "available" }, { ...valid, narration_status: "not_required" },
    { ...valid, result: fixtureResult({ kind: "no_contest" }), explanation: "No contest." },
  ]) assert.equal(schema.safeParse(invalid).success, false);
});

test("even prompt distinguishes limited scoring from equal ability or a stalemate", async () => {
  await assert.rejects(narrateMatchup(fixtureResult({ kind: "even" }), lion, hippo, {
    apiKey: "test-only", reserveProviderCall: () => {},
    fetch: async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      assert.match(body.messages[0].content, /scored factors \(body mass, comparable bite force\) don't separate these two/);
      assert.match(body.messages[0].content, /Do not call it a stalemate or say the animals are equally\/evenly matched/);
      return new Response("", { status: 503 });
    },
  }), (error: unknown) => error instanceof FightError && error.code === "LLM_PROVIDER_FAILURE");
});
