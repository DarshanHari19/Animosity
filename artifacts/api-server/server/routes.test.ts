import assert from "node:assert/strict";
import { test } from "node:test";
import { animals } from "./animals";
import { startFightServer, fixtureResult, fixtureBeats } from "./test-helpers";
import type { EngineContext, MatchupResult } from "./schemas";

const a = animals[0]!;
const b = animals[1]!;
const input = { animalA: a.name, animalB: b.name };

test("HTTP boundary rejects unknown/invalid inputs and exposes the real stub", async (t) => {
  const server = await startFightServer(t);
  const list = await (await server.getAnimals()).json() as unknown[];
  assert.equal(list.length, 7);
  for (const invalid of [
    {}, { ...input, animalA: "Unknown" }, { ...input, environment: "air" },
    { ...input, mode: "invented" }, { ...input, encounter: "ambush" }, { ...input, extra: 1 },
  ]) {
    const response = await server.post(invalid);
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json() as { error: string }).error, "string");
  }
  // Both distinct and identical selections reach the real engine, not a shortcut.
  for (const animalB of [b.name, a.name]) {
    const response = await server.post({ ...input, animalB });
    assert.equal(response.status, 501);
    assert.equal((await response.json() as { code: string }).code, "SCORING_NOT_IMPLEMENTED");
  }
});

test("route forwards defaults and explicit context; identical inputs preserve engine output", async (t) => {
  const contexts: EngineContext[] = [];
  const result = fixtureResult({ kind: "favored", animal: a.name });
  const server = await startFightServer(t,
    (first, second, context) => {
      assert.equal(first, a);
      assert.equal(second, a);
      contexts.push(context);
      return result; // Test fixture, deliberately not even.
    },
    async () => fixtureBeats(a, a.name),
  );
  for (const context of [{}, { environment: "deep_water", mode: "forced_fight", encounter: "face_off" }]) {
    const response = await server.post({ animalA: a.name, animalB: a.name, ...context });
    assert.equal(response.status, 200);
    const body = await response.json() as { result: MatchupResult };
    assert.deepEqual(body.result, result);
  }
  assert.deepEqual(contexts, [
    { environment: "land", mode: "realistic", encounter: "face_off" },
    { environment: "deep_water", mode: "forced_fight", encounter: "face_off" },
  ]);
});

test("indeterminate and no_contest skip the narrator and return one-line explanations", async (t) => {
  for (const kind of ["indeterminate", "no_contest"] as const) {
    const result = fixtureResult({ kind });
    result.factors[0]!.reason = "Fixture\nreason only";
    const server = await startFightServer(t, () => result, async () => {
      assert.fail("Narrator must not be called");
    });
    const response = await server.post(input);
    assert.equal(response.status, 200);
    const body = await response.json() as { result: MatchupResult; beats: unknown[]; explanation: string };
    assert.deepEqual(body.result, result);
    assert.deepEqual(body.beats, []);
    assert.match(body.explanation, /Fixture reason only/);
    assert.doesNotMatch(body.explanation, /[\r\n]/);
  }
});

test("favored/even outcomes call narration and validate the final actor", async (t) => {
  for (const outcome of [{ kind: "favored", animal: a.name }, { kind: "even" }] as const) {
    const result = fixtureResult(outcome);
    let calls = 0;
    const expected = fixtureBeats(a, outcome.kind === "favored" ? a.name : null);
    const server = await startFightServer(t, () => result, async (received, first, second) => {
      calls++;
      assert.deepEqual(received, result);
      assert.equal(first, a);
      assert.equal(second, b);
      return expected;
    });
    const response = await server.post(input);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { result, beats: expected, explanation: null });
    assert.equal(calls, 1);
  }
});

test("invalid engine outputs fail before narration", async (t) => {
  const result = fixtureResult({ kind: "favored", animal: a.name });
  for (const invalid of [
    { ...result, outcome: { kind: "favored", animal: "Unknown" } },
    { ...result, evidence_quality: "invented" },
    { ...result, outcome: { kind: "even", animal: a.name } },
  ]) {
    const server = await startFightServer(t, () => invalid as MatchupResult, async () => {
      assert.fail("Must not narrate invalid engine output");
    });
    const response = await server.post(input);
    assert.equal(response.status, 502);
    assert.equal((await response.json() as { code: string }).code, "INVALID_ENGINE_OUTPUT");
  }
});

test("route rejects mismatched or malformed narration", async (t) => {
  const result = fixtureResult({ kind: "even" });
  for (const beats of [fixtureBeats(a, a.name), [], fixtureBeats(a, "Unknown")]) {
    const server = await startFightServer(t, () => result, async () => beats);
    const response = await server.post(input);
    assert.equal(response.status, 502);
    assert.equal((await response.json() as { code: string }).code, "INVALID_NARRATION");
  }
});
