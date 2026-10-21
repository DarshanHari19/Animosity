import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import express, { type ErrorRequestHandler } from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createFightRateLimiter, createNarrationDailyCap, parseNarrationDailyCap } from "./limits";
import { createFightRouter } from "./routes";
import { narrateMatchup } from "./narrator";
import { FightError } from "./errors";
import { animals } from "./animals";
import { fixtureBeats, fixtureResult } from "./test-helpers";
import type { MatchupResult } from "./schemas";

const a = animals[0]!;
const b = animals[1]!;
const input = { animalA: a.name, animalB: b.name };
const favored = fixtureResult({ kind: "favored", animal: a.name });
const hasCode = (code: string) => (error: unknown) =>
  error instanceof FightError && error.code === code;

// Test-only wire narration: never used by production scoring or narration.
const wire = () => Response.json({ choices: [{ message: { content: JSON.stringify({
  beats: fixtureBeats(a, a.name).map(({ fact_used: _unused, ...beat }) => ({ ...beat, fact_id: "E1" })),
}) } }] });
const badWire = () => Response.json({ choices: [{ message: { content: "not JSON" } }] });
function transport(reserveProviderCall: () => void, replies: Array<() => Response | Promise<Response>>) {
  let calls = 0;
  return {
    get calls() { return calls; },
    options: {
      apiKey: "test-only-dummy", reserveProviderCall,
      fetch: (async () => {
        calls++;
        const reply = replies.shift();
        assert.ok(reply, "Unexpected provider call");
        return reply();
      }) as typeof fetch,
    },
  };
}

async function server(
  t: TestContext, score: () => MatchupResult,
  narrate: typeof narrateMatchup = async () => { assert.fail("Unexpected narration"); },
  now: () => number = Date.now,
) {
  const app = express();
  app.set("trust proxy", 1);
  app.use("/api", createFightRouter(score, narrate, animals, createFightRateLimiter(now)));
  const invalidBody: ErrorRequestHandler = (error, _req, res, _next) => {
    res.status(error.status ?? 500).json({ code: "INVALID_JSON", error: "Invalid request body." });
  };
  app.use(invalidBody);
  const listener = app.listen(0, "127.0.0.1");
  await once(listener, "listening");
  t.after(async () => {
    listener.closeAllConnections();
    await new Promise<void>((resolve) => listener.close(() => resolve()));
  });
  const base = `http://127.0.0.1:${(listener.address() as AddressInfo).port}/api`;
  return {
    post: (body: unknown = input, ip = "198.51.100.1", raw = false) => fetch(`${base}/fight`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: raw ? String(body) : JSON.stringify(body),
    }),
    get: () => fetch(`${base}/animals`),
  };
}

function gate(kind: "no_contest" | "no_engagement" | "indeterminate") {
  const result = fixtureResult(kind === "no_engagement" ? { kind, animals: [a.name] } : { kind });
  result.factors = [];
  return result;
}

test("POST rate limit admits 10 per IP, rejects 11, ignores forged prefixes, and resets after a minute", async (t) => {
  let now = 0;
  const api = await server(t, () => gate("no_contest"), undefined, () => now);
  for (let n = 0; n < 10; n++) {
    assert.equal((await api.post(input, `203.0.113.${n + 1}, 198.51.100.1`)).status, 200);
  }
  const blocked = await api.post();
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("Retry-After"), "60");
  assert.equal((await blocked.json() as { code: string }).code, "FIGHT_RATE_LIMITED");
  assert.equal((await api.post(input, "198.51.100.2")).status, 200);
  assert.equal((await api.get()).status, 200);
  now = 60_000;
  assert.equal((await api.post()).status, 200);
});

test("invalid POSTs also consume request-rate slots and blocked requests never score", async (t) => {
  let scores = 0;
  const api = await server(t, () => { scores++; return gate("no_contest"); });
  for (let n = 0; n < 10; n++) assert.equal((await api.post({})).status, 400);
  assert.equal((await api.post()).status, 429);
  assert.equal(scores, 0);
});

test("concurrent POSTs cannot exceed the per-IP allowance", async (t) => {
  const api = await server(t, () => gate("no_contest"));
  const responses = await Promise.all(Array.from({ length: 11 }, () => api.post()));
  assert.equal(responses.filter(({ status }) => status === 200).length, 10);
  assert.equal(responses.filter(({ status }) => status === 429).length, 1);
});

test("malformed JSON consumes request-rate slots before body parsing", async (t) => {
  const api = await server(t, () => { assert.fail("Malformed requests must never score"); });
  for (let n = 0; n < 10; n++) assert.equal((await api.post("{", "198.51.100.1", true)).status, 400);
  const response = await api.post("{", "198.51.100.1", true);
  assert.equal(response.status, 429);
  assert.equal((await response.json() as { code: string }).code, "FIGHT_RATE_LIMITED");
});

test("daily configuration defaults to 200, permits zero, and rejects invalid values explicitly", () => {
  assert.equal(parseNarrationDailyCap(undefined), 200);
  assert.equal(parseNarrationDailyCap("0"), 0);
  assert.equal(parseNarrationDailyCap("12"), 12);
  for (const value of ["", "-1", "1.5", "NaN", "Infinity", "abc", "9007199254740992"]) {
    assert.throws(() => parseNarrationDailyCap(value), hasCode("NARRATION_CAP_CONFIGURATION"));
  }
  const reserve = createNarrationDailyCap(200);
  for (let n = 0; n < 200; n++) reserve();
  assert.throws(reserve, hasCode("NARRATION_DAILY_CAP_REACHED"));
});

test("daily budget resets at midnight UTC, not 24 hours after the first call", () => {
  let now = Date.UTC(2026, 9, 21, 23, 59, 59);
  const reserve = createNarrationDailyCap(1, () => now);
  reserve();
  assert.throws(reserve, hasCode("NARRATION_DAILY_CAP_REACHED"));
  now += 1000;
  reserve();
  assert.throws(reserve, hasCode("NARRATION_DAILY_CAP_REACHED"));
});

test("a successful corrective retry consumes two provider slots", async () => {
  const mock = transport(createNarrationDailyCap(2), [badWire, wire]);
  assert.equal((await narrateMatchup(favored, a, b, mock.options)).length, 5);
  assert.equal(mock.calls, 2);
  await assert.rejects(narrateMatchup(favored, a, b, mock.options), hasCode("NARRATION_DAILY_CAP_REACHED"));
  assert.equal(mock.calls, 2);
});

test("cap exhaustion between attempts prevents the retry and preserves the cap error", async () => {
  const mock = transport(createNarrationDailyCap(1), [badWire]);
  await assert.rejects(narrateMatchup(favored, a, b, mock.options), hasCode("NARRATION_DAILY_CAP_REACHED"));
  assert.equal(mock.calls, 1);
});

test("zero daily budget prevents any provider call", async () => {
  const mock = transport(createNarrationDailyCap(0), []);
  await assert.rejects(narrateMatchup(favored, a, b, mock.options), hasCode("NARRATION_DAILY_CAP_REACHED"));
  assert.equal(mock.calls, 0);
});

for (const failure of ["HTTP", "network", "timeout"] as const) {
  test(`${failure} provider failures consume a daily slot without a provider retry`, async () => {
    const reply = () => {
      if (failure === "HTTP") return new Response(null, { status: 429 });
      throw failure === "timeout" ? new DOMException("Test timeout", "TimeoutError") : new Error("Test network failure");
    };
    const mock = transport(createNarrationDailyCap(1), [reply]);
    await assert.rejects(narrateMatchup(favored, a, b, mock.options), hasCode("LLM_PROVIDER_FAILURE"));
    await assert.rejects(narrateMatchup(favored, a, b, mock.options), hasCode("NARRATION_DAILY_CAP_REACHED"));
    assert.equal(mock.calls, 1);
  });
}

test("concurrent narrations share the daily budget without overspending", async () => {
  const mock = transport(createNarrationDailyCap(1), [wire]);
  const results = await Promise.allSettled([
    narrateMatchup(favored, a, b, mock.options), narrateMatchup(favored, a, b, mock.options),
  ]);
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  const failed = results.find(({ status }) => status === "rejected");
  assert.ok(failed?.status === "rejected" && hasCode("NARRATION_DAILY_CAP_REACHED")(failed.reason));
  assert.equal(mock.calls, 1);
});

test("HTTP cap covers favored, even and environmental favored, while non-narrated gates bypass it", async (t) => {
  const reserve = createNarrationDailyCap(1);
  reserve();
  const mock = transport(reserve, []);
  let narrationCalls = 0;
  let result = favored;
  const api = await server(t, () => result, async (output, first, second) => {
    narrationCalls++;
    return narrateMatchup(output, first, second, mock.options);
  });
  const environmental = { ...favored, deciding_factor: "environmental_advantage" as const, factors: [] };
  for (const output of [favored, fixtureResult({ kind: "even" }), environmental]) {
    result = output;
    const response = await api.post();
    assert.equal(response.status, 429);
    const body = await response.json() as { code: string; error: string };
    assert.equal(body.code, "NARRATION_DAILY_CAP_REACHED");
    assert.match(body.error, /midnight UTC/);
    assert.equal("beats" in body, false);
  }
  assert.equal(narrationCalls, 3);
  for (const kind of ["no_contest", "no_engagement", "indeterminate"] as const) {
    result = gate(kind);
    const response = await api.post();
    assert.equal(response.status, 200);
    const body = await response.json() as { result: MatchupResult; beats: unknown[]; explanation: string };
    assert.deepEqual(body.beats, []);
    assert.deepEqual(body.result, result);
    assert.equal(typeof body.explanation, "string");
  }
  assert.equal(narrationCalls, 3);
  assert.equal(mock.calls, 0);
});
