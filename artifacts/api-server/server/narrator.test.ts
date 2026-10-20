import assert from "node:assert/strict";
import { test } from "node:test";
import { animals } from "./animals";
import { narrateMatchup } from "./narrator";
import { FightError } from "./errors";
import type { Beat } from "./schemas";

// Fictional test-only output; this is NOT a scoring implementation.
const a = animals[0]!;
const b = animals[1]!;
const result = { winner: a.name, confidence: 0.5, factors: ["Fixture factor only"] };
const beatsFor = (winner: string): Beat[] => [
  ...Array.from({ length: 4 }, (): Beat => ({
    text: "Hypothetical fixture movement.", action: "approach",
    animal: a.name, fact_used: result.factors[0]!,
  })),
  { text: "Fixture conclusion.", action: "finish", animal: winner, fact_used: result.factors[0]! },
];
const provider = (beats: unknown) => Response.json({
  choices: [{ message: { content: JSON.stringify({ beats }) } }],
});
const errorCode = (code: string) => (error: unknown) =>
  error instanceof FightError && error.code === code;

function mockProvider(responses: Array<Response | Error>) {
  const calls: Array<{ messages: Array<{ role: string; content: string }> }> = [];
  const mockFetch: typeof fetch = async (_url, init) => {
    calls.push(JSON.parse(String(init?.body)));
    const response = responses.shift();
    if (response instanceof Error) throw response;
    if (!response) throw new Error("Unexpected provider request");
    return response;
  };
  return { calls, options: { fetch: mockFetch, apiKey: "test-only-dummy" } };
}

test("matching final winner returns validated beats in one call", async () => {
  const mock = mockProvider([provider(beatsFor(a.name))]);
  assert.deepEqual(await narrateMatchup(result, a, b, mock.options), beatsFor(a.name));
  assert.equal(mock.calls.length, 1);
  assert.match(mock.calls[0]!.messages[0]!.content, /Do not invent/);
  assert.match(mock.calls[0]!.messages[1]!.content, /Fixture factor only/);
});

test("wrong final winner retries once with corrective instruction", async () => {
  const mock = mockProvider([provider(beatsFor(b.name)), provider(beatsFor(a.name))]);
  const beats = await narrateMatchup(result, a, b, mock.options);
  assert.equal(beats.at(-1)!.animal, result.winner);
  assert.equal(mock.calls.length, 2);
  assert.match(mock.calls[1]!.messages.at(-1)!.content, /final winner was incorrect/);
  assert.ok(mock.calls[1]!.messages.at(-1)!.content.includes(result.winner));
});

test("second winner mismatch fails without third call or fallback", async () => {
  const mock = mockProvider([provider(beatsFor(b.name)), provider(beatsFor(b.name))]);
  await assert.rejects(narrateMatchup(result, a, b, mock.options), errorCode("WINNER_MISMATCH"));
  assert.equal(mock.calls.length, 2);
});

test("invalid JSON, provider envelope, beat schema and evidence fail clearly", async () => {
  const base = beatsFor(a.name);
  const invalidResponses = [
    new Response("not JSON", { status: 200 }),
    Response.json({ choices: [{ message: { content: "not JSON" } }] }),
    Response.json({ choices: [] }),
    provider(base.slice(1)),
    provider(base.map((beat) => ({ ...beat, animal: "Unknown" }))),
    provider(base.map((beat) => ({ ...beat, action: "punch" }))),
    provider(base.map((beat) => ({ ...beat, action: "retreat" }))),
    provider(base.map((beat) => ({ ...beat, fact_used: "Invented evidence" }))),
    provider(base.map((beat) => ({ ...beat, extra: "unexpected" }))),
  ];
  for (const response of invalidResponses) {
    const mock = mockProvider([response]);
    await assert.rejects(narrateMatchup(result, a, b, mock.options), errorCode("INVALID_NARRATION"));
    assert.equal(mock.calls.length, 1);
  }
});

test("provider rejection and network/timeout errors never echo sensitive errors", async () => {
  for (const response of [new Response("private provider details", { status: 429 }), new Error("sensitive network details")]) {
    const mock = mockProvider([response]);
    await assert.rejects(narrateMatchup(result, a, b, mock.options), (error: unknown) =>
      errorCode("LLM_PROVIDER_FAILURE")(error) &&
      error instanceof Error && !/private|sensitive/.test(error.message));
    assert.equal(mock.calls.length, 1);
  }
});

test("missing key and invalid result fail before a provider call", async () => {
  const mock = mockProvider([]);
  await assert.rejects(narrateMatchup(result, a, b, { ...mock.options, apiKey: "" }), errorCode("LLM_NOT_CONFIGURED"));
  await assert.rejects(narrateMatchup({ ...result, confidence: 3 }, a, b, mock.options), errorCode("INVALID_ENGINE_OUTPUT"));
  await assert.rejects(narrateMatchup(result, a, b, { ...mock.options, endpoint: "http://unsafe.example/api" }), errorCode("LLM_CONFIGURATION"));
  assert.equal(mock.calls.length, 0);
});
