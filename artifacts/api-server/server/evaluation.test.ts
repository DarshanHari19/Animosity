import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluationCases, summarizeEvaluation, type EvaluationRun } from "./evaluation";
import { fixtureResult } from "./test-helpers";

test("evaluation preserves all 20 baseline scenarios, seven animals, three environments and both modes", () => {
  assert.equal(evaluationCases.length, 20);
  assert.equal(new Set(evaluationCases.map(c => JSON.stringify(c.input))).size, 20);
  assert.equal(new Set(evaluationCases.flatMap(c => [c.input.animalA, c.input.animalB])).size, 7);
  assert.deepEqual([...new Set(evaluationCases.map(c => c.input.environment))].sort(), ["deep_water", "land", "shallow_water"]);
  assert.deepEqual([...new Set(evaluationCases.map(c => c.input.mode))].sort(), ["forced_fight", "realistic"]);
  assert.equal(evaluationCases.length * 3, 60);
  assert.deepEqual(evaluationCases[9]!.input, { animalA: "Great white shark", animalB: "Lion", environment: "deep_water", mode: "forced_fight", encounter: "face_off" });
});
test("evaluation distinguishes first-pass, recovered retry, invalid and capped outcomes without reading raw logs", () => {
  // Test-only response records; never used by the live evaluator.
  const run = (attempts: number, reason: EvaluationRun["body"]["narration_reason"]): EvaluationRun => ({
    case_id: 1, run: 1, attempts, started: "test", finished: "test",
    body: { result: fixtureResult({ kind: "even" }), beats: [], explanation: null,
      narration_status: reason ? "unavailable" : "available", narration_reason: reason },
  });
  const summary = summarizeEvaluation([
    run(1, null), run(2, null), run(2, "INVALID_NARRATION"), run(0, "NARRATION_DAILY_CAP_REACHED"),
  ]);
  assert.equal(summary.requests, 4);
  assert.equal(summary.first_attempt_passes, 1);
  assert.equal(summary.first_attempt_pass_rate, 0.25);
  assert.equal(summary.final_unavailable_rate, 0.5);
  assert.equal(summary.provider_attempts, 5);
  assert.equal(summary.narration_reason_counts.none, 2);
  assert.equal(summary.narration_reason_counts.INVALID_NARRATION, 1);
  assert.equal(summary.narration_reason_counts.NARRATION_DAILY_CAP_REACHED, 1);
  assert.equal(summary.cases[0]!.unavailable, 2);
});
