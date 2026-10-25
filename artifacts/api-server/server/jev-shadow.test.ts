import assert from "node:assert/strict";
import { test } from "node:test";
import { animals } from "./animals";
import { fixtureBeats, fixtureResult } from "./test-helpers";
import { reviewJevShadow, type ShadowInput } from "./jev-shadow";

const input: ShadowInput = {
  narration_id: "test-only-shadow",
  animals: [animals[0]!.name, animals[1]!.name],
  environment: "land", mode: "forced_fight",
  result: fixtureResult({ kind: "favored", animal: animals[0]!.name }),
  evidence: [{ id: "E1", kind: "scored", factor_name: "Size", text: "Test-only size evidence" }],
  beats: fixtureBeats(animals[0]!, animals[0]!.name),
};

test("Jev makes one request with all evidence/beats and logs two probabilities per beat", async () => {
  let calls = 0;
  const logs: Record<string, unknown>[] = [];
  const before = structuredClone(input);
  const report = await reviewJevShadow(input, {
    log: (entry) => { logs.push(entry); },
    request: async (request) => {
      calls++;
      assert.equal(request.model, "jev-latest");
      const state = JSON.parse(request.state);
      assert.deepEqual(state.evidence, input.evidence);
      assert.deepEqual(state.engine, input.result);
      assert.deepEqual(state.beats, input.beats.map((beat, index) => ({ index, ...beat })));
      assert.equal(Object.keys(request.questions).length, input.beats.length * 2);
      assert.match(request.questions.contradiction_0!.instructions, /even.*either animal/);
      return { answers: Object.fromEntries(Object.keys(request.questions).map((key) =>
        [key, { noul: key.startsWith("unsupported") ? 0.9 : 0.8 }])) };
    },
  });
  assert.equal(calls, 1);
  assert.equal(logs.length, input.beats.length);
  logs.forEach((entry, index) => {
    assert.equal(entry.text, input.beats[index]!.text);
    assert.equal(entry.unsupported_reason_probability, 0.9);
    assert.equal(entry.contradictory_winner_probability, 0.8);
  });
  assert.deepEqual(input, before, "even high probabilities never alter beats or verdict");
  assert.equal(report.status, "scored");
  if (report.status === "scored") {
    assert.equal(report.beats.length, input.beats.length);
    assert.equal(report.beats[0]!.text, input.beats[0]!.text);
    assert.equal(report.beats[0]!.unsupported_reason_probability, 0.9);
    assert.equal(report.beats[0]!.contradictory_winner_probability, 0.8);
  }
});

test("Jev provider failure is sanitized, not retried, and cannot reject narration", async () => {
  let calls = 0;
  const logs: Record<string, unknown>[] = [];
  const report = await reviewJevShadow(input, {
    request: async () => { calls++; throw new Error("private provider credentials"); },
    log: (entry) => { logs.push(entry); },
  });
  assert.equal(calls, 1);
  assert.deepEqual(logs, [{ event: "jev_shadow_unavailable", narration_id: input.narration_id }]);
  assert.deepEqual(report, { status: "failed", reason: "failed_or_timed_out" });
});

test("invalid Jev probabilities never become decisions or partial successful logs", async () => {
  const logs: Record<string, unknown>[] = [];
  await reviewJevShadow(input, {
    request: async () => ({ answers: { unsupported_0: { noul: 1.2 } } }),
    log: (entry) => { logs.push(entry); },
  });
  assert.deepEqual(logs, [{ event: "jev_shadow_unavailable", narration_id: input.narration_id }]);
});

test("shadow logging failure cannot escape", async () => {
  await assert.doesNotReject(reviewJevShadow(input, {
    request: async () => { throw new Error("timeout"); },
    log: () => { throw new Error("logger unavailable"); },
  }));
});
