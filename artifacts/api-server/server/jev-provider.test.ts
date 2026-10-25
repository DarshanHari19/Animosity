import assert from "node:assert/strict";
import { test } from "node:test";
import { requestJev, JevRequestError } from "./jev-provider";
import { reviewJevShadow, type ShadowInput } from "./jev-shadow";
import { animals } from "./animals";
import { fixtureBeats, fixtureResult } from "./test-helpers";
import { summarizeJev } from "./jev-telemetry";

const input: ShadowInput = {
  narration_id: "test-only-transport", animals: [animals[0]!.name, animals[1]!.name],
  environment: "land", mode: "forced_fight",
  result: fixtureResult({ kind: "favored", animal: animals[0]!.name }),
  evidence: [{ id: "E1", kind: "scored", text: "Test-only evidence ".repeat(100) }],
  beats: fixtureBeats(animals[0]!, animals[0]!.name),
};
const config = { baseURL: "https://jev.test.invalid", apiKey: "test-only-dummy" };

test("real TypeSafe transport sends requests larger than 1 KiB as uncompressed typed JSON", async () => {
  let calls = 0, ticks = 100;
  const report = await reviewJevShadow(input, {
    now: () => { ticks += 25; return ticks; }, log: () => {},
    request: (request, onStatus) => requestJev(request, onStatus, {
      ...config, fetch: async (url, init) => {
        calls++;
        assert.equal(new URL(url).pathname, "/v1/systemone");
        assert.equal(new Headers(init?.headers).get("Content-Encoding"), null);
        assert.match(new Headers(init?.headers).get("Content-Type")!, /application\/json/);
        assert.equal(typeof init?.body, "string");
        assert.ok(Buffer.byteLength(init!.body as string) > 1024);
        const body = JSON.parse(init!.body as string);
        assert.equal(body.model, "jev-latest");
        assert.equal(body.messages, undefined);
        assert.equal(body.questions.unsupported_0.type, "noul");
        assert.equal(Object.keys(body.questions).length, input.beats.length * 2);
        return Response.json({ model: "typesafe/test-only", usage: { input_tokens: 100, output_tokens: 10 },
          answers: Object.fromEntries(Object.keys(body.questions).map(key => [key, { type: "noul", noul: 0.12 }])) });
      },
    }),
  });
  assert.equal(calls, 1);
  assert.equal(report.status, "scored");
  assert.equal(report.http_status, 200);
  assert.equal(report.elapsed_ms, 25);
  if (report.status === "scored") {
    assert.equal(report.beats.length, input.beats.length);
    assert.ok(report.beats.every(b => b.unsupported_reason_probability === 0.12));
  }
});

test("Jev failure diagnostics distinguish timeout, HTTP status, and parse error without leaking details or retrying", async () => {
  const reports = [];
  for (const category of ["timeout", "http_error", "parse_error"] as const) {
    let calls = 0, ticks = 0;
    const logs: unknown[] = [];
    const report = await reviewJevShadow(input, {
      now: () => { ticks += 40; return ticks; }, log: entry => { logs.push(entry); },
      request: async (request, onStatus) => {
        if (category === "timeout") { calls++; throw new JevRequestError("timeout", null); }
        return requestJev(request, onStatus, { ...config, fetch: async () => {
          calls++;
          return category === "http_error"
            ? new Response("private credentials", { status: 415 })
            : new Response("not valid JSON: private credentials", { status: 200 });
        } });
      },
    });
    assert.equal(calls, 1);
    assert.equal(report.status, "failed");
    if (report.status !== "failed") assert.fail("Expected failed observational report");
    assert.equal(report.failure_category, category);
    assert.equal(report.http_status, category === "timeout" ? null : category === "http_error" ? 415 : 200);
    assert.equal(report.elapsed_ms, 40);
    assert.equal(JSON.stringify({ report, logs }).includes("private credentials"), false);
    reports.push({ case_id: reports.length + 1, run: 1, jev_shadow: report });
  }
  const summary = summarizeJev(reports);
  assert.equal(summary.calls_failed_or_timed_out, 3);
  for (const category of ["timeout", "http_error", "parse_error"]) {
    assert.equal(summary.failure_counts.find(c => c.category === category)?.count, 1);
  }
  assert.deepEqual(summary.http_error_counts, [{ http_status: 415, count: 1 }]);
  assert.equal(summary.calls.length, 3);
  assert.ok(summary.calls.every(c => c.elapsed_ms === 40));
});

test("TypeSafe SDK ten-second timeout is classified and is not retried", { timeout: 15_000 }, async () => {
  let calls = 0;
  await assert.rejects(requestJev({
    model: "jev-latest", state: "test-only", questions: { test: { type: "noul", instructions: "Test?" } },
  }, () => {}, { ...config, fetch: async (_url, init) => {
    calls++;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Error("private timeout details")), { once: true });
    });
  } }),
  (error: unknown) => error instanceof JevRequestError && error.category === "timeout" && error.http_status === null);
  assert.equal(calls, 1);
});
