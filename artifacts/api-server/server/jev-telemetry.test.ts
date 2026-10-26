import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { animals } from "./animals";
import { fixtureBeats, fixtureResult, startFightServer } from "./test-helpers";
import { JevReportSchema, summarizeJev, unavailableJevReport, type JevReport } from "./jev-telemetry";
import { EVAL_BYPASS_HEADER } from "./narration-cache";
import type { narrateMatchup } from "./narrator";
import { FightError } from "./errors";
import { fightResponseSchemaFor } from "./schemas";

const a = animals[0]!, b = animals[1]!;
const input = { animalA: a.name, animalB: b.name, environment: "land", mode: "forced_fight" };
const result = fixtureResult({ kind: "favored", animal: a.name });
const scored: JevReport = {
  status: "scored", elapsed_ms: 27, http_status: 200, beats: [{ beat_index: 0, text: "Test-only beat.",
    unsupported_reason_probability: 0.92, contradictory_winner_probability: 0.72 }],
};

test("only the development eval header exposes Jev scores or failures; regular API shape stays identical", async t => {
  for (const report of [scored, unavailableJevReport()]) {
    for (const development of [true, false]) {
      let observed = 0;
      const narrate: typeof narrateMatchup = async (_r, _a, _b, options) => {
        if (options?.onShadowResult) { observed++; options.onShadowResult(report); }
        return fixtureBeats(a, a.name);
      };
      const server = await startFightServer(t, () => result, narrate, undefined, undefined, { development });
      const regular = z.object({}).passthrough().parse(await (await server.post(input)).json());
      assert.equal("jev_shadow" in regular, false);
      fightResponseSchemaFor(a, b).parse(regular);
      const evalBody = z.object({}).passthrough().parse(
        await (await server.post(input, { [EVAL_BYPASS_HEADER]: "1" })).json());
      const { jev_shadow, ...publicBody } = evalBody;
      assert.deepEqual(publicBody, regular);
      if (development) assert.deepEqual(JevReportSchema.parse(jev_shadow), report);
      else assert.equal("jev_shadow" in evalBody, false);
      assert.equal(observed, development ? 1 : 0);
    }
  }
});

test("narration rejected before Jev is explicitly not scored, not a failed Jev call", async t => {
  const server = await startFightServer(t, () => result, async () => {
    throw new FightError("INVALID_NARRATION", "Test-only invalid narration.", 502);
  }, undefined, undefined, { development: true });
  const body = z.object({}).passthrough().parse(
    await (await server.post(input, { [EVAL_BYPASS_HEADER]: "1" })).json());
  assert.deepEqual(body.jev_shadow, { status: "not_scored" });
  assert.equal(body.narration_reason, "INVALID_NARRATION");
  assert.equal(body.narration_status, "unavailable");
});

test("Jev summary preserves strict thresholds and groups examples in disjoint probability bands", () => {
  const values = [0.5, 0.5001, 0.7, 0.7001, 0.9, 0.9001, 1];
  const report: JevReport = { status: "scored", elapsed_ms: 27, http_status: 200, beats: values.map((p, index) => ({
    beat_index: index, text: `Test beat ${index}`,
    unsupported_reason_probability: p, contradictory_winner_probability: 0.1,
  })) };
  const summary = summarizeJev([
    { case_id: 1, run: 1, jev_shadow: report },
    { case_id: 2, run: 1, jev_shadow: unavailableJevReport() },
    { case_id: 3, run: 1, jev_shadow: { status: "not_scored" } },
  ]);
  assert.equal(summary.narrations_scored, 1);
  assert.equal(summary.calls_failed_or_timed_out, 1);
  assert.equal(summary.not_scored, 1);
  assert.equal(summary.missing_telemetry, 0);
  const [unsupported, contradictory] = summary.questions;
  assert.deepEqual([unsupported!.above_0_5, unsupported!.above_0_7, unsupported!.above_0_9], [6, 4, 2]);
  assert.equal(unsupported!.beats_scored, 7);
  assert.deepEqual(unsupported!.bands.map(b => b.count), [2, 2, 2]);
  assert.deepEqual(unsupported!.bands.map(b => b.examples.map(e => e.probability)),
    [[0.7, 0.5001], [0.9, 0.7001], [1, 0.9001]]);
  assert.deepEqual(unsupported!.bands[2]!.examples[0], {
    case_id: 1, run: 1, beat_index: 6, text: "Test beat 6", probability: 1,
  });
  assert.deepEqual([contradictory!.above_0_5, contradictory!.above_0_7, contradictory!.above_0_9], [0, 0, 0]);
  assert.ok(contradictory!.bands.every(b => b.count === 0 && b.examples.length === 0));
});

test("Jev summary caps examples at ten independently for every question and band", () => {
  const records = Array.from({ length: 12 }, (_, index) => ({
    case_id: index + 1, run: 1, jev_shadow: {
      ...scored, beats: [0.6, 0.8, 0.95].map((p, beat_index) => ({
        beat_index, text: `Example ${index}/${beat_index}`,
        unsupported_reason_probability: p, contradictory_winner_probability: p,
      })),
    },
  }));
  const summary = summarizeJev(records);
  for (const question of summary.questions) {
    assert.deepEqual(question.bands.map(b => b.count), [12, 12, 12]);
    assert.deepEqual(question.bands.map(b => b.examples.length), [10, 10, 10]);
  }
});

test("missing telemetry is distinguishable from zero failures, and malformed probabilities are rejected", () => {
  assert.equal(summarizeJev([{ case_id: 1, run: 1 }]).missing_telemetry, 1);
  assert.equal(JevReportSchema.safeParse(undefined).success, false);
  assert.equal(JevReportSchema.safeParse({ status: "scored", beats: [] }).success, false);
  assert.equal(JevReportSchema.safeParse({ status: "scored", beats: [{
    ...scored.beats[0], unsupported_reason_probability: 1.2,
  }] }).success, false);
});
