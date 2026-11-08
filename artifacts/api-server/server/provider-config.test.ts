import assert from "node:assert/strict";
import { test } from "node:test";
import { animals } from "./animals";
import { FightError } from "./errors";
import { narrateMatchup } from "./narrator";
import { requestJev, JevRequestError, type JevRequest } from "./jev-provider";
import {
  DEFAULT_ANTHROPIC_BASE_URL, DEFAULT_NARRATION_MODEL, DEFAULT_OPENROUTER_BASE_URL,
  narrationStartupSummary, resolveJevConfig, resolveNarrationConfig, startupConfigWarnings,
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

test("narrateMatchup: missing, blank or malformed ANTHROPIC_API_KEY gives LLM_NOT_CONFIGURED before any call or cap slot", async () => {
  let calls = 0, reservations = 0;
  const countingFetch: typeof fetch = async () => { calls++; throw new Error("must not be called"); };
  const reserveProviderCall = () => { reservations++; };
  for (const env of [{}, { ANTHROPIC_API_KEY: "" }, { ANTHROPIC_API_KEY: "  \t " }, { ANTHROPIC_API_KEY: " \nOTHER=x" }] as Array<Record<string, string>>) {
    await withEnv(env, async () => {
      await assert.rejects(narrateMatchup(result, a, b, { fetch: countingFetch, reserveProviderCall }), errorCode("LLM_NOT_CONFIGURED"));
      await assert.rejects(narrateMatchup(result, a, b, { reserveProviderCall }), errorCode("LLM_NOT_CONFIGURED"));
    });
  }
  assert.equal(calls, 0);
  assert.equal(reservations, 0);
});

test("config resolution: whitespace is trimmed; a key containing whitespace or '=' is unset and warned about by name", () => {
  assert.equal(resolveNarrationConfig({ ANTHROPIC_API_KEY: "  k  ", NARRATION_MODEL: "  ", ANTHROPIC_BASE_URL: " " }).apiKey, "k");
  assert.equal(resolveNarrationConfig({ NARRATION_MODEL: "  " }).model, "claude-haiku-5-5");
  for (const bad of ["a b", "x=y", " \nB=x", "  "]) {
    assert.equal(resolveNarrationConfig({ ANTHROPIC_API_KEY: bad }).apiKey, undefined);
    assert.equal(resolveJevConfig({ OPENROUTER_API_KEY: bad }).apiKey, undefined);
  }
  const warnings = startupConfigWarnings({ ANTHROPIC_API_KEY: "sk-test a=b", OPENROUTER_API_KEY: "ok-key" });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /^ANTHROPIC_API_KEY contains whitespace or "="/);
  assert.equal(warnings[0]!.includes("sk-test"), false);
});

test("startup: URL problems and SDK-read auth variables are warned about by name; summary has host and model only", () => {
  const warnings = startupConfigWarnings({
    ANTHROPIC_API_KEY: "k", OPENROUTER_API_KEY: "k", ANTHROPIC_BASE_URL: "http://remote.example",
    OPENROUTER_BASE_URL: "https://u:p@or.example", ANTHROPIC_AUTH_TOKEN: "tok-secret", ANTHROPIC_CUSTOM_HEADERS: "X: secret",
  });
  assert.deepEqual(warnings.map((w) => w.split(" ")[0]),
    ["ANTHROPIC_BASE_URL", "OPENROUTER_BASE_URL", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_CUSTOM_HEADERS"]);
  assert.equal(warnings.some((w) => /secret|remote\.example|or\.example/.test(w)), false);
  assert.deepEqual(narrationStartupSummary({ ANTHROPIC_API_KEY: "k" }),
    { narration_host: "https://api.anthropic.com", narration_model: "claude-haiku-5-5" });
  assert.deepEqual(narrationStartupSummary({ ANTHROPIC_BASE_URL: "http://localhost:9999", NARRATION_MODEL: "m" }),
    { narration_host: "http://localhost:9999", narration_model: "m" });
  assert.equal(narrationStartupSummary({ ANTHROPIC_BASE_URL: "http://remote.example" }).narration_host, "invalid");
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

test("narrateMatchup: ANTHROPIC_BASE_URL allows https and loopback http only, origin only, and fails before any cap slot", async () => {
  const seen: string[] = [];
  let reservations = 0;
  const reserveProviderCall = () => { reservations++; };
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: unknown) => { seen.push(String(url)); return new Response("{}", { status: 500 }); }) as typeof fetch;
  try {
    for (const ok of ["http://localhost:9999", "http://127.0.0.1:9999", "http://[::1]:9999", "https://proxy.example", "https://proxy.example/"]) {
      await withEnv({ ANTHROPIC_API_KEY: "k", ANTHROPIC_BASE_URL: ok }, async () => {
        await assert.rejects(narrateMatchup(result, a, b, { reserveProviderCall }), errorCode("LLM_PROVIDER_FAILURE"));
      });
    }
    const allowed = reservations;
    for (const bad of ["http://remote.example", "ftp://x.example", "https://user:pw@x.example", "not a url",
      "https://x.example/v1", "https://x.example/api/", "https://x.example?a=1", "https://x.example/?a=1", "https://x.example#frag", "https://x.example?"]) {
      await withEnv({ ANTHROPIC_API_KEY: "k", ANTHROPIC_BASE_URL: bad }, async () => {
        await assert.rejects(narrateMatchup(result, a, b, { reserveProviderCall }), errorCode("LLM_CONFIGURATION"));
      });
    }
    assert.equal(reservations, allowed);
  } finally { globalThis.fetch = original; }
  assert.deepEqual(seen.map((url) => new URL(url).origin),
    ["http://localhost:9999", "http://127.0.0.1:9999", "http://[::1]:9999", "https://proxy.example", "https://proxy.example"]);
});

test("narrateMatchup: explicit options.endpoint stays https-only and origin-only", async () => {
  const fetchStub: typeof fetch = async () => { throw new Error("must not be called"); };
  let reservations = 0;
  const reserveProviderCall = () => { reservations++; };
  for (const endpoint of ["http://localhost:9999", "http://unsafe.example/api", "https://x.example/v1", "https://x.example?a=1"]) {
    await assert.rejects(narrateMatchup(result, a, b, { apiKey: "k", fetch: fetchStub, endpoint, reserveProviderCall }), errorCode("LLM_CONFIGURATION"));
  }
  assert.equal(reservations, 0);
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

test("jev: an invalid OPENROUTER_BASE_URL fails soft as configuration_error without calling out or blocking narration", async () => {
  const seen: Array<{ url: string; auth: string | null }> = [];
  for (const bad of ["http://remote.example", "https://u:p@or.example", "ftp://or.example", "not a url", "https://or.example?x=1", "https://or.example#f"]) {
    await withEnv({ OPENROUTER_API_KEY: "test-only-dummy", OPENROUTER_BASE_URL: bad }, async () => {
      await assert.rejects(requestJev(jevRequest, () => {}, { fetch: jevFetch(seen) }),
        (error) => error instanceof JevRequestError && error.category === "configuration_error");
    });
  }
  await withEnv({ OPENROUTER_API_KEY: "test-only-dummy", OPENROUTER_BASE_URL: "http://localhost:4000" }, async () => {
    await requestJev(jevRequest, () => {}, { fetch: jevFetch(seen) });
  });
  assert.deepEqual(seen.map(({ url }) => url), ["http://localhost:4000/v1/systemone"]);
});

test("NARRATION_MODEL: an invalid model ID falls back to the default, warns by name, and is never logged or sent", async () => {
  for (const bad of ["OPENROUTER_API_KEY=dummy-secret", "a b", "m\nx", "model;rm", "x=y"]) {
    assert.equal(resolveNarrationConfig({ NARRATION_MODEL: bad }).model, "claude-haiku-5-5");
    const summary = narrationStartupSummary({ NARRATION_MODEL: bad });
    assert.equal(summary.narration_model, "claude-haiku-5-5");
    const warnings = startupConfigWarnings({ ANTHROPIC_API_KEY: "k", OPENROUTER_API_KEY: "k", NARRATION_MODEL: bad });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /^NARRATION_MODEL is not a valid model ID/);
    assert.equal(warnings[0]!.includes("dummy-secret"), false);
  }
  for (const good of ["claude-haiku-5-5", "anthropic/claude-x:beta", "model@2025.01"]) {
    assert.equal(resolveNarrationConfig({ NARRATION_MODEL: good }).model, good);
  }
  const sent: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)).model); return new Response("{}", { status: 500 });
  }) as typeof fetch;
  try {
    await withEnv({ ANTHROPIC_API_KEY: "k", NARRATION_MODEL: "OPENROUTER_API_KEY=dummy-secret" }, async () => {
      await assert.rejects(narrateMatchup(result, a, b), errorCode("LLM_PROVIDER_FAILURE"));
    });
  } finally { globalThis.fetch = original; }
  assert.deepEqual(sent, ["claude-haiku-5-5"]);
});

test("the backend test run starts without provider settings from the shell", () => {
  // Guaranteed by test-env-preload.mjs; this fails if the test script stops using it.
  for (const name of KEYS.concat(["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_CUSTOM_HEADERS"])) {
    assert.equal(process.env[name], undefined, name);
  }
});
