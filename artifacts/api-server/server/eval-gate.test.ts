import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { animals } from "./animals";
import { narrateMatchup } from "./narrator";
import { evalBypassGranted, evalTokenWarning, normalizeEvalToken } from "./eval-gate";
import { EVAL_BYPASS_HEADER, type NarrationCache } from "./narration-cache";
import { fixtureBeats, fixtureResult, startFightServer } from "./test-helpers";
import { diagnosticsFromResponse, recordSchema } from "./narration-diagnostic-store";
import type { Beat } from "./schemas";

const a = animals[0]!;
const b = animals[1]!;
const input = { animalA: a.name, animalB: b.name, environment: "land", mode: "forced_fight" };
const score = () => fixtureResult({ kind: "favored", animal: a.name });
const TOKEN = "unit-test-token-0123456789abcdef";

test("gate: a matching token is honored in production and development", () => {
  for (const development of [false, true]) {
    assert.equal(evalBypassGranted({ header: TOKEN, token: TOKEN, development }), true);
  }
});

test("gate: a wrong, truncated or longer token is refused", () => {
  for (const header of ["wrong", TOKEN.slice(0, -1), `${TOKEN}x`, "1", ""]) {
    for (const development of [false, true]) {
      assert.equal(evalBypassGranted({ header, token: TOKEN, development }), false);
    }
  }
});

test("gate: production without EVAL_TOKEN never honors the header", () => {
  for (const header of ["1", TOKEN, "anything", undefined]) {
    assert.equal(evalBypassGranted({ header, token: undefined, development: false }), false);
    assert.equal(evalBypassGranted({ header, token: "", development: false }), false);
  }
});

test("gate: the header without an env var is honored only as the legacy 1 in development", () => {
  assert.equal(evalBypassGranted({ header: "1", token: undefined, development: true }), true);
  assert.equal(evalBypassGranted({ header: "2", token: undefined, development: true }), false);
  assert.equal(evalBypassGranted({ header: undefined, token: undefined, development: true }), false);
});

function memoryCache() {
  const rows = new Map<string, Beat[]>();
  const stats = { reads: 0, writes: 0 };
  const cache: NarrationCache = {
    async get(key) { stats.reads++; return structuredClone(rows.get(key) ?? null); },
    async put(key, _buildId, beats) { stats.writes++; rows.set(key, structuredClone(beats)); },
  };
  return { cache, stats };
}

test("route: only a matching token bypasses the cache and adds eval telemetry", async t => {
  const { cache, stats } = memoryCache();
  let calls = 0;
  const server = await startFightServer(t, score, async () => { calls++; return fixtureBeats(a, a.name); },
    undefined, undefined, { cache, development: false, evalToken: TOKEN });
  await server.post(input); // fills the cache
  assert.equal(stats.writes, 1);
  for (const headers of [{ [EVAL_BYPASS_HEADER]: "1" }, { [EVAL_BYPASS_HEADER]: "wrong" }]) {
    const body = z.object({}).passthrough().parse(await (await server.post(input, headers)).json());
    assert.equal(body.narration_source, "cache");
    assert.ok(!("jev_shadow" in body));
    assert.ok(!("eval_diagnostics" in body));
  }
  assert.equal(calls, 1);
  const ok = z.object({}).passthrough().parse(await (await server.post(input, { [EVAL_BYPASS_HEADER]: TOKEN })).json());
  assert.equal(ok.narration_source, "model");
  assert.deepEqual(ok.jev_shadow, { status: "not_scored" });
  assert.ok(!("eval_diagnostics" in ok)); // omitted when there were no failed attempts
  assert.equal(calls, 2);
});

test("route: production with no EVAL_TOKEN ignores the header, including the legacy 1", async t => {
  const { cache } = memoryCache();
  let calls = 0;
  const server = await startFightServer(t, score, async () => { calls++; return fixtureBeats(a, a.name); },
    undefined, undefined, { cache, development: false, evalToken: undefined });
  await server.post(input);
  for (const value of ["1", TOKEN]) {
    const body = z.object({}).passthrough().parse(await (await server.post(input, { [EVAL_BYPASS_HEADER]: value })).json());
    assert.equal(body.narration_source, "cache");
    assert.ok(!("jev_shadow" in body));
  }
  assert.equal(calls, 1);
});

test("route: with EVAL_TOKEN set, development no longer honors the legacy 1", async t => {
  const { cache } = memoryCache();
  const server = await startFightServer(t, score, async () => fixtureBeats(a, a.name),
    undefined, undefined, { cache, development: true, evalToken: TOKEN });
  await server.post(input);
  const body = z.object({}).passthrough().parse(await (await server.post(input, { [EVAL_BYPASS_HEADER]: "1" })).json());
  assert.equal(body.narration_source, "cache");
  assert.ok(!("jev_shadow" in body));
});

test("remote eval diagnostics: counts must match the attempts the server reported", () => {
  const record = (attempt: number) => ({
    timestamp: new Date().toISOString(), narration_id: "n1", animals: [a.name, b.name], attempt,
    checks: [{ check: "JSON_parse" }],
  });
  assert.equal(diagnosticsFromResponse([], { attempts: 1, available: true }).length, 0);
  assert.equal(diagnosticsFromResponse([record(1)], { attempts: 2, available: true }).length, 1);
  assert.throws(() => diagnosticsFromResponse([], { attempts: 2, available: true }), /eval_diagnostics/);
  assert.equal(diagnosticsFromResponse(undefined, { attempts: 1, available: true }).length, 0);
  assert.throws(() => diagnosticsFromResponse(undefined, { attempts: 2, available: true }), /eval_diagnostics/);
  assert.throws(() => diagnosticsFromResponse([record(1), record(1)], { attempts: 2, available: false }), /eval_diagnostics/);
});

test("gate: the token is trimmed, and one shorter than 32 characters disables the bypass everywhere", () => {
  assert.equal(evalBypassGranted({ header: TOKEN, token: `  ${TOKEN}\n`, development: false }), true);
  const weak = "short-secret";
  for (const development of [false, true]) {
    for (const header of [weak, "1", TOKEN]) {
      assert.equal(evalBypassGranted({ header, token: weak, development }), false);
    }
  }
  assert.equal(evalBypassGranted({ header: "x".repeat(31), token: "x".repeat(31), development: true }), false);
  assert.equal(evalBypassGranted({ header: "x".repeat(32), token: "x".repeat(32), development: false }), true);
});

test("gate: warning names the variable, never the value, and only for weak tokens", () => {
  assert.equal(evalTokenWarning(undefined), null);
  assert.equal(evalTokenWarning("   "), null);
  assert.equal(evalTokenWarning(TOKEN), null);
  const warning = evalTokenWarning("short-secret")!;
  assert.match(warning, /EVAL_TOKEN/);
  assert.ok(!warning.includes("short-secret"));
  assert.equal(normalizeEvalToken("").kind, "unset");
});

// Real narrator with a failing transport and a dummy key: no network, no billable key.
const failingNarrate = (transport: typeof fetch): typeof import("./narrator").narrateMatchup =>
  (output, first, second, options) => narrateMatchup(output, first, second, { ...options, fetch: transport, apiKey: "test-only-dummy" });

test("route: eval_diagnostics follows failed attempts, only for the correct token", async t => {
  for (const [label, transport, attempts] of [
    ["transport failure", (async () => { throw new Error("socket closed"); }) as typeof fetch, 1],
    ["unparseable output", (async () => Response.json({ choices: [{ message: { content: "not json" } }] })) as typeof fetch, 2],
  ] as const) {
    const server = await startFightServer(t, score, failingNarrate(transport),
      undefined, undefined, { development: false, evalToken: TOKEN });
    const call = async (headers: Record<string, string>) => {
      const response = await server.post(input, headers);
      return { attempts: response.headers.get("X-Narration-Attempts"), body: z.object({}).passthrough().parse(await response.json()) };
    };
    const ok = await call({ [EVAL_BYPASS_HEADER]: TOKEN });
    assert.equal(ok.body.narration_status, "unavailable", label);
    assert.equal(ok.attempts, String(attempts), label);
    const records = z.array(recordSchema).parse(ok.body.eval_diagnostics);
    assert.equal(records.length, attempts, label);
    assert.deepEqual(records.map(record => record.attempt), Array.from({ length: attempts }, (_, i) => i + 1), label);
    assert.deepEqual(diagnosticsFromResponse(ok.body.eval_diagnostics, { attempts, available: false }), records);
    assert.ok(!JSON.stringify(ok.body).includes(TOKEN));
    for (const headers of [{} as Record<string, string>, { [EVAL_BYPASS_HEADER]: "wrong" }, { [EVAL_BYPASS_HEADER]: "1" }]) {
      const denied = await call(headers);
      assert.equal(denied.body.narration_status, "unavailable", label); // the attempts did fail
      assert.equal(denied.attempts, String(attempts), label);
      assert.ok(!("eval_diagnostics" in denied.body), label);
      assert.ok(!("jev_shadow" in denied.body), label);
    }
  }
});
