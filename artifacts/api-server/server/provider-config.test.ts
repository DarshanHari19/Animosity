import assert from "node:assert/strict";
import { test } from "node:test";
import { animals } from "./animals";
import { FightError } from "./errors";
import { narrateMatchup } from "./narrator";
import { requestJev, JevRequestError, type JevRequest } from "./jev-provider";
import {
  DEFAULT_ANTHROPIC_BASE_URL, DEFAULT_NARRATION_MODEL, DEFAULT_OPENROUTER_BASE_URL,
  resolveJevConfig, resolveNarrationConfig, startupConfigWarnings,
} from "./provider-config";
import { fixtureResult } from "./test-helpers";

// Test-only dummy values. These tests never read the real .env and never touch the network.
const KEYS = ["ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "NARRATION_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_BASE_URL"];
async function withEnv<T>(values: Record<string, string>, run: () => Promise<T>): Promise<T> {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, values);
  try { return await run(); }
  finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
}
const [a, b] = [animals[0]!, animals[1]!];
const result = fixtureResult({ kind: "favored", animal: a.name });
const errorCode = (code: string) => (error: unknown) => error instanceof FightError && error.code === code;

test("narration config: defaults to the official API and claude-haiku-5-5", () => {
  assert.deepEqual(resolveNarrationConfig({ ANTHROPIC_API_KEY: "k" }),
    { apiKey: "k", baseURL: undefined, model: "claude-haiku-5-5" });
  assert.equal(DEFAULT_NARRATION_MODEL, "claude-haiku-5-5");
  assert.equal(DEFAULT_ANTHROPIC_BASE_URL, "https://api.anthropic.com");
});

test("narration config: NARRATION_MODEL and ANTHROPIC_BASE_URL override, blank counts as unset", () => {
  const set = resolveNarrationConfig({ ANTHROPIC_API_KEY: "k", NARRATION_MODEL: "other-model", ANTHROPIC_BASE_URL: "https://proxy.example" });
  assert.equal(set.model, "other-model");
  assert.equal(set.baseURL, "https://proxy.example");
  const blank = resolveNarrationConfig({ ANTHROPIC_API_KEY: "", NARRATION_MODEL: "", ANTHROPIC_BASE_URL: "" });
  assert.deepEqual(blank, { apiKey: undefined, baseURL: undefined, model: "claude-haiku-5-5" });
});

test("jev config: OpenRouter key and base URL, with the OpenRouter default", () => {
  assert.deepEqual(resolveJevConfig({ OPENROUTER_API_KEY: "k" }), { apiKey: "k", baseURL: "https://openrouter.ai/api" });
  assert.equal(DEFAULT_OPENROUTER_BASE_URL, "https://openrouter.ai/api");
  assert.equal(resolveJevConfig({ OPENROUTER_API_KEY: "k", OPENROUTER_BASE_URL: "https://or.example" }).baseURL, "https://or.example");
  assert.deepEqual(resolveJevConfig({ OPENROUTER_API_KEY: "", OPENROUTER_BASE_URL: "" }),
    { apiKey: undefined, baseURL: "https://openrouter.ai/api" });
});

test("startup warnings: one per missing key, never containing values", () => {
  assert.equal(startupConfigWarnings({ ANTHROPIC_API_KEY: "sk-test-secret", OPENROUTER_API_KEY: "or-test-secret" }).length, 0);
  const none = startupConfigWarnings({});
  assert.equal(none.length, 2);
  assert.match(none[0]!, /^ANTHROPIC_API_KEY is not set; narration will be unavailable/);
  assert.match(none[1]!, /^OPENROUTER_API_KEY is not set/);
  assert.equal(startupConfigWarnings({ ANTHROPIC_API_KEY: "", OPENROUTER_API_KEY: "x" }).length, 1);
});

test("narrateMatchup: missing or blank ANTHROPIC_API_KEY gives LLM_NOT_CONFIGURED before any call", async () => {
  let calls = 0;
  const countingFetch: typeof fetch = async () => { calls++; throw new Error("must not be called"); };
  for (const env of [{}, { ANTHROPIC_API_KEY: "" }] as Array<Record<string, string>>) {
    await withEnv(env, async () => {
      await assert.rejects(narrateMatchup(result, a, b, { fetch: countingFetch }), errorCode("LLM_NOT_CONFIGURED"));
      await assert.rejects(narrateMatchup(result, a, b), errorCode("LLM_NOT_CONFIGURED"));
    });
  }
  assert.equal(calls, 0);
});

test("narrateMatchup: env key, default model and default official URL reach the transport", async () => {
  const seen: Array<{ url: string; model: string; auth: string | null }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    seen.push({ url: String(url), model: JSON.parse(String(init?.body)).model, auth: new Headers(init?.headers).get("x-api-key") });
    return new Response("{}", { status: 500 });
  }) as typeof fetch;
  try {
    await withEnv({ ANTHROPIC_API_KEY: "test-only-dummy" }, async () => {
      await assert.rejects(narrateMatchup(result, a, b), errorCode("LLM_PROVIDER_FAILURE"));
    });
    await withEnv({ ANTHROPIC_API_KEY: "test-only-dummy", NARRATION_MODEL: "model-override" }, async () => {
      await assert.rejects(narrateMatchup(result, a, b), errorCode("LLM_PROVIDER_FAILURE"));
    });
    await withEnv({ ANTHROPIC_API_KEY: "test-only-dummy", NARRATION_MODEL: "" }, async () => {
      await assert.rejects(narrateMatchup(result, a, b), errorCode("LLM_PROVIDER_FAILURE"));
    });
  } finally { globalThis.fetch = original; }
  assert.deepEqual(seen.map(({ model }) => model), ["claude-haiku-5-5", "model-override", "claude-haiku-5-5"]);
  for (const call of seen) {
    assert.equal(new URL(call.url).origin, "https://api.anthropic.com");
    assert.equal(new URL(call.url).pathname, "/v1/messages");
    assert.equal(call.auth, "test-only-dummy");
  }
});

test("narrateMatchup: ANTHROPIC_BASE_URL keeps its validation (http allowed, credentials rejected)", async () => {
  const seen: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: unknown) => { seen.push(String(url)); return new Response("{}", { status: 500 }); }) as typeof fetch;
  try {
    await withEnv({ ANTHROPIC_API_KEY: "k", ANTHROPIC_BASE_URL: "http://localhost:9999" }, async () => {
      await assert.rejects(narrateMatchup(result, a, b), errorCode("LLM_PROVIDER_FAILURE"));
    });
    for (const bad of ["ftp://x.example", "https://user:pw@x.example", "not a url"]) {
      await withEnv({ ANTHROPIC_API_KEY: "k", ANTHROPIC_BASE_URL: bad }, async () => {
        await assert.rejects(narrateMatchup(result, a, b), errorCode("LLM_CONFIGURATION"));
      });
    }
  } finally { globalThis.fetch = original; }
  assert.equal(seen.length, 1);
  assert.equal(new URL(seen[0]!).origin, "http://localhost:9999");
});

const jevRequest: JevRequest = { model: "jev-latest", state: "s", questions: { q: { type: "noul", instructions: "i" } } };
const jevFetch = (seen: Array<{ url: string; auth: string | null }>): typeof fetch => async (url, init) => {
  seen.push({ url: String(url), auth: new Headers(init?.headers).get("Authorization") });
  return Response.json({ model: "typesafe/test-only", answers: { q: { type: "noul", noul: 0.1 } } });
};

test("jev: OPENROUTER_API_KEY and the default OpenRouter URL are used; override and missing key behave", async () => {
  const seen: Array<{ url: string; auth: string | null }> = [];
  await withEnv({ OPENROUTER_API_KEY: "test-only-dummy" }, async () => {
    await requestJev(jevRequest, () => {}, { fetch: jevFetch(seen) });
  });
  await withEnv({ OPENROUTER_API_KEY: "test-only-dummy", OPENROUTER_BASE_URL: "https://or.example/root" }, async () => {
    await requestJev(jevRequest, () => {}, { fetch: jevFetch(seen) });
  });
  assert.deepEqual(seen, [
    { url: "https://openrouter.ai/api/v1/systemone", auth: "Bearer test-only-dummy" },
    { url: "https://or.example/root/v1/systemone", auth: "Bearer test-only-dummy" },
  ]);
  for (const env of [{}, { OPENROUTER_API_KEY: "" }] as Array<Record<string, string>>) {
    await withEnv(env, async () => {
      await assert.rejects(requestJev(jevRequest, () => {}, { fetch: jevFetch(seen) }),
        (error) => error instanceof JevRequestError && error.category === "configuration_error");
    });
  }
  assert.equal(seen.length, 2);
});
