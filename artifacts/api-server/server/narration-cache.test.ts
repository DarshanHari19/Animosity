import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { animals } from "./animals";
import { fightResponseSchemaFor } from "./schemas";
import { FightError } from "./errors";
import { createNarrationDailyCap } from "./limits";
import { EVAL_BYPASS_HEADER, narrationCacheKey, type NarrationCache } from "./narration-cache";
import type { Beat } from "./schemas";
import { fixtureBeats, fixtureResult, startFightServer } from "./test-helpers";

const a = animals[0]!;
const b = animals[1]!;
const input = { animalA: a.name, animalB: b.name, environment: "land", mode: "forced_fight" };
const result = fixtureResult({ kind: "favored", animal: a.name });
const score = () => result;

function memoryCache() {
  const rows = new Map<string, Beat[]>();
  const stats = { reads: 0, writes: 0 };
  const cache: NarrationCache = {
    async get(key) { stats.reads++; return structuredClone(rows.get(key) ?? null); },
    async put(key, _buildId, beats) {
      stats.writes++;
      if (!rows.has(key)) rows.set(key, structuredClone(beats));
    },
  };
  return { cache, rows, stats };
}

test("a cache hit returns identical beats with zero additional provider calls or cap reservations", async t => {
  const { cache, rows } = memoryCache();
  let calls = 0;
  const reserve = createNarrationDailyCap(1);
  const server = await startFightServer(t, score, async (_result, first, _second, options) => {
    reserve(); calls++; options?.onProviderAttempt?.();
    return fixtureBeats(first, a.name);
  }, undefined, undefined, { cache, buildId: "test-build" });
  const first = await server.post(input);
  const original = await first.json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body));
  assert.equal(original.narration_status, "available");
  assert.equal(original.narration_source, "model");
  assert.equal(first.headers.get("X-Narration-Attempts"), "1");
  const second = await server.post(input);
  const cached = await second.json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body));
  assert.equal(cached.narration_source, "cache");
  assert.deepEqual(cached, { ...original, narration_source: "cache" });
  assert.equal(second.headers.get("X-Narration-Attempts"), "0");
  assert.equal(calls, 1);
  assert.equal(rows.size, 1);
});

test("unavailable responses are never cached, including validation, provider, configuration and daily-cap failures", async t => {
  for (const code of ["INVALID_NARRATION", "LLM_PROVIDER_FAILURE", "NARRATION_DAILY_CAP_REACHED", "LLM_NOT_CONFIGURED"]) {
    const { cache, rows, stats } = memoryCache();
    let calls = 0;
    const server = await startFightServer(t, score, async () => {
      if (++calls === 1) throw new FightError(code, "Test-only failure", 502);
      return fixtureBeats(a, a.name);
    }, undefined, undefined, { cache });
    const failed = await server.post(input);
    const body = await failed.json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body));
    assert.equal(failed.status, 200);
    assert.equal(body.narration_status, "unavailable");
    assert.equal(body.narration_reason, code);
    assert.equal(body.narration_source, "model");
    assert.equal(rows.size, 0);
    assert.equal(stats.writes, 0);
    assert.equal((await (await server.post(input)).json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body))).narration_source, "model");
    assert.equal((await (await server.post(input)).json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body))).narration_source, "cache");
    assert.equal(calls, 2);
  }
});

test("route-rejected schema and outcome mismatches cannot enter the cache", async t => {
  for (const bad of [[], fixtureBeats(a, b.name)]) {
    const { cache, rows } = memoryCache();
    const server = await startFightServer(t, score, async () => bad, undefined, undefined, { cache });
    const body = await (await server.post(input)).json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body));
    assert.equal(body.narration_reason, "INVALID_NARRATION");
    assert.deepEqual(body.beats, []);
    assert.equal(rows.size, 0);
  }
});

test("a new build misses while the same build can reuse a narration across router instances", async t => {
  const { cache } = memoryCache();
  let calls = 0;
  const narrate = async () => { calls++; return fixtureBeats(a, a.name); };
  const old = await startFightServer(t, score, narrate, undefined, undefined, { cache, buildId: "build-one" });
  assert.equal((await (await old.post(input)).json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body))).narration_source, "model");
  const same = await startFightServer(t, score, narrate, undefined, undefined, { cache, buildId: "build-one" });
  assert.equal((await (await same.post(input)).json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body))).narration_source, "cache");
  const next = await startFightServer(t, score, narrate, undefined, undefined, { cache, buildId: "build-two" });
  assert.equal((await (await next.post(input)).json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body))).narration_source, "model");
  assert.equal(calls, 2);
});

test("cache keys separate ordered animals, environment, mode and build ID", () => {
  const key = (first = a.name, second = b.name, place: "land" | "shallow_water" | "deep_water" = "land",
    mode: "realistic" | "forced_fight" = "realistic", build = "one") =>
    narrationCacheKey(first, second, place, mode, build);
  assert.equal(key(), key());
  assert.equal(new Set([
    key(), key(b.name, a.name), key(a.name, a.name),
    key(a.name, b.name, "shallow_water"), key(a.name, b.name, "deep_water"),
    key(a.name, b.name, "land", "forced_fight"), key(a.name, b.name, "land", "realistic", "two"),
  ]).size, 7);
});

test("development eval header bypasses cache reads and writes without replacing the saved narration", async t => {
  const { cache, stats } = memoryCache();
  let calls = 0;
  const server = await startFightServer(t, score, async () => {
    calls++;
    const beats = fixtureBeats(a, a.name);
    if (calls === 2) beats[0]!.text = "The Lion pads forward.";
    return beats;
  }, undefined, undefined, { cache, development: true });
  const original = await (await server.post(input)).json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body));
  const { jev_shadow, ...bypassBody } = z.object({}).passthrough().parse(
    await (await server.post(input, { [EVAL_BYPASS_HEADER]: "1" })).json());
  assert.deepEqual(jev_shadow, { status: "not_scored" }); // injected narrator makes no Jev call
  const bypass = fightResponseSchemaFor(animals[0]!, animals[1]!).parse(bypassBody);
  assert.equal(bypass.narration_source, "model");
  assert.notDeepEqual(original.beats, bypass.beats);
  assert.equal(stats.reads, 1);
  assert.equal(stats.writes, 1);
  const cached = await (await server.post(input)).json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body));
  assert.equal(cached.narration_source, "cache");
  assert.deepEqual(cached.beats, original.beats);
  assert.equal(calls, 2);
});

test("production ignores the eval bypass header", async t => {
  const { cache } = memoryCache();
  let calls = 0;
  const server = await startFightServer(t, score, async () => {
    calls++; return fixtureBeats(a, a.name);
  }, undefined, undefined, { cache, development: false });
  await server.post(input);
  const cached = await (await server.post(input, { [EVAL_BYPASS_HEADER]: "1" })).json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body));
  assert.equal(cached.narration_source, "cache");
  assert.equal(calls, 1);
});

test("gated outcomes never read or write narration cache or call a provider", async t => {
  for (const outcome of [
    { kind: "no_contest" }, { kind: "indeterminate" }, { kind: "no_engagement", animals: [a.name] },
  ] as const) {
    const { cache, stats } = memoryCache();
    const gated = { ...fixtureResult(outcome.kind === "no_engagement"
      ? { kind: outcome.kind, animals: [...outcome.animals] } : outcome), factors: [] };
    const server = await startFightServer(t, () => gated, async () => {
      assert.fail("Gated outcomes must not call the provider.");
    }, undefined, undefined, { cache });
    const response = await server.post(input);
    const body = await response.json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body));
    assert.equal(response.status, 200);
    assert.equal(body.narration_status, "not_required");
    assert.deepEqual(stats, { reads: 0, writes: 0 });
  }
});

test("invalid persisted beats are never served; validated model narration is returned instead", async t => {
  const { cache, rows } = memoryCache();
  const key = narrationCacheKey(a.name, b.name, "land", "forced_fight", "test-build");
  rows.set(key, fixtureBeats(a, b.name)); // Valid shape, wrong winner: never serve it.
  let calls = 0;
  const server = await startFightServer(t, score, async () => {
    calls++; return fixtureBeats(a, a.name);
  }, undefined, undefined, { cache, buildId: "test-build" });
  const body = await (await server.post(input)).json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body));
  assert.equal(body.narration_source, "model");
  assert.equal(body.beats.at(-1)!.animal, a.name);
  assert.equal(calls, 1);
});
