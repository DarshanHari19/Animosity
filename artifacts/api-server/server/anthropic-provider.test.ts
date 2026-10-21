import assert from "node:assert/strict";
import { test } from "node:test";
import { createAnthropicProvider, type NarrationMessage } from "./anthropic-provider";
import { FightError } from "./errors";
import { narrationTool } from "./narration-tool";
import { animals } from "./animals";
import { fixtureResult } from "./test-helpers";

const tool = narrationTool(animals[0]!, animals[1]!, [{ id: "E1", text: "Test-only evidence.", kind: "scored" }],
  fixtureResult({ kind: "favored", animal: animals[0]!.name }));

const messages: NarrationMessage[] = [
  { role: "system", content: "Test-only system instructions." },
  { role: "user", content: "Test-only supplied evidence." },
  { role: "user", content: "Test-only corrective instruction." },
];
function mock(responses: Array<Response | Error>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  return {
    calls,
    provider: createAnthropicProvider({
      apiKey: "test-only-dummy", baseURL: "https://anthropic.test.invalid/proxy",
      model: "claude-haiku-5-5",
      tool,
      fetch: async (url, init) => {
        calls.push({ url: String(url), init });
        const response = responses.shift();
        if (response instanceof Error) throw response;
        if (!response) throw new Error("Unexpected provider request");
        return response;
      },
    }),
  };
}
const errorCode = (code: string) => (error: unknown) =>
  error instanceof FightError && error.code === code && error.status === 502;

test("Anthropic adapter forces one Haiku narration tool and normalizes only its input", async () => {
  const subject = mock([Response.json({ content: [
    { type: "thinking", thinking: "Not narration." },
    { type: "text", text: "Not a fallback narration." },
    { type: "tool_use", name: tool.name, input: { beats: [], finish: {} } },
  ] })]);
  const response = await subject.provider(messages);
  assert.deepEqual(await response.json(), { choices: [{ message: { content: '{"beats":[],"finish":{}}' } }] });
  assert.equal(subject.calls.length, 1);
  assert.equal(subject.calls[0]!.url, "https://anthropic.test.invalid/proxy/v1/messages");
  const init = subject.calls[0]!.init!;
  const body = JSON.parse(String(init.body));
  assert.equal(body.model, "claude-haiku-5-5");
  assert.equal(body.max_tokens, 8192);
  assert.deepEqual(body.thinking, { type: "disabled" });
  assert.equal(body.system, messages[0]!.content);
  assert.deepEqual(body.messages, messages.slice(1));
  assert.equal(init.redirect, "error");
  assert.equal(body.response_format, undefined);
  assert.deepEqual(body.tools, [tool]);
  assert.deepEqual(body.tool_choice, {
    type: "tool", name: tool.name, disable_parallel_tool_use: true,
  });
  assert.deepEqual(body.tools[0].input_schema.properties.beats.items.properties.fact_ids.items.enum, ["E1"]);
  assert.equal(body.tools[0].input_schema.properties.beats.items.additionalProperties, false);
  assert.equal(body.tools[0].input_schema.properties.beats.items.properties.animal.type, "string");
  assert.equal(body.tools[0].input_schema.properties.beats.items.properties.action.enum.includes("finish"), false);
  assert.deepEqual(body.tools[0].input_schema.properties.finish.properties.animal.enum, [animals[0]!.name]);
});

test("invalid Anthropic envelopes and JSON keep INVALID_NARRATION", async () => {
  for (const response of [
    Response.json({}), Response.json({ content: [] }),
    Response.json({ content: [{ type: "text", text: 0 }] }),
    Response.json({ content: [{ type: "text", text: '{"beats":[]}' }] }),
    Response.json({ content: [{ type: "tool_use", name: "wrong_tool", input: {} }] }),
    Response.json({ content: [
      { type: "tool_use", name: tool.name, input: {} },
      { type: "tool_use", name: tool.name, input: {} },
    ] }),
    new Response("not JSON", { headers: { "Content-Type": "application/json" } }),
  ]) {
    const subject = mock([response]);
    await assert.rejects(subject.provider(messages), errorCode("INVALID_NARRATION"));
    assert.equal(subject.calls.length, 1);
  }
});

test("Anthropic rate limits retain sanitized provider errors without SDK retries", async () => {
  const subject = mock([new Response("private provider details", { status: 429 })]);
  await assert.rejects(subject.provider(messages), (error: unknown) =>
    errorCode("LLM_PROVIDER_FAILURE")(error) && error instanceof Error &&
    error.message === "Narration provider returned HTTP 429.");
  assert.equal(subject.calls.length, 1);
});

test("Anthropic network failures retain sanitized errors without SDK retries", async () => {
  const subject = mock([new Error("sensitive network details")]);
  await assert.rejects(subject.provider(messages), (error: unknown) =>
    errorCode("LLM_PROVIDER_FAILURE")(error) && error instanceof Error &&
    error.message === "Narration provider request failed or timed out.");
  assert.equal(subject.calls.length, 1);
});
