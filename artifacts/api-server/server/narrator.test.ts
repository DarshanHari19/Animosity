import assert from "node:assert/strict";
import { test } from "node:test";
import { animals } from "./animals";
import { narrateMatchup } from "./narrator";
import { FightError } from "./errors";
import type { MatchupResult } from "./schemas";
import { fixtureResult, fixtureBeats, fixtureFactor } from "./test-helpers";

// Fictional test-only output; this is NOT a scoring implementation.
const a = animals[0]!;
const b = animals[1]!;
const result = fixtureResult({ kind: "favored", animal: a.name });
const beatsFor = (finalAnimal: string | null) => fixtureBeats(a, finalAnimal);
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

test("matching favored outcome returns validated beats in one call", async () => {
  const mock = mockProvider([provider(beatsFor(a.name))]);
  assert.deepEqual(await narrateMatchup(result, a, b, mock.options), beatsFor(a.name));
  assert.equal(mock.calls.length, 1);
  assert.match(mock.calls[0]!.messages[0]!.content, /Do not invent/);
  const payload = JSON.parse(mock.calls[0]!.messages[1]!.content) as { evidence: string[] };
  assert.ok(payload.evidence.includes(JSON.stringify(fixtureFactor)));
  assert.equal(payload.evidence.some((fact) => fact.includes(".functions_in")), false);
});

test("wrong favored animal retries once with corrective instruction", async () => {
  const mock = mockProvider([provider(beatsFor(b.name)), provider(beatsFor(a.name))]);
  const beats = await narrateMatchup(result, a, b, mock.options);
  assert.equal(beats.at(-1)!.animal, a.name);
  assert.equal(mock.calls.length, 2);
  assert.match(mock.calls[1]!.messages.at(-1)!.content, /narrated outcome was incorrect/);
  assert.ok(mock.calls[1]!.messages.at(-1)!.content.includes(a.name));
});

test("second outcome mismatch fails without third call or fallback", async () => {
  const mock = mockProvider([provider(beatsFor(b.name)), provider(beatsFor(b.name))]);
  await assert.rejects(narrateMatchup(result, a, b, mock.options), errorCode("OUTCOME_MISMATCH"));
  assert.equal(mock.calls.length, 2);
});

test("even outcomes require a final null animal and can retry a named final actor", async () => {
  const even = fixtureResult({ kind: "even" });
  for (const responses of [
    [provider(beatsFor(null))],
    [provider(beatsFor(a.name)), provider(beatsFor(null))],
  ]) {
    const expectedCalls = responses.length;
    const mock = mockProvider(responses);
    const beats = await narrateMatchup(even, a, b, mock.options);
    assert.equal(beats.at(-1)!.animal, null);
    assert.equal(mock.calls.length, expectedCalls);
  }
  const mock = mockProvider([provider(beatsFor(a.name)), provider(beatsFor(b.name))]);
  await assert.rejects(narrateMatchup(even, a, b, mock.options), errorCode("OUTCOME_MISMATCH"));
  assert.equal(mock.calls.length, 2);
});

test("favored outcomes retry an incorrectly even narration", async () => {
  const mock = mockProvider([provider(beatsFor(null)), provider(beatsFor(a.name))]);
  const beats = await narrateMatchup(result, a, b, mock.options);
  assert.equal(beats.at(-1)!.animal, a.name);
  assert.equal(mock.calls.length, 2);
});

test("indeterminate, no_contest and no_engagement reject direct narration before provider access", async () => {
  for (const kind of ["indeterminate", "no_contest", "no_engagement"] as const) {
    const mock = mockProvider([]);
    await assert.rejects(narrateMatchup(fixtureResult(kind === "no_engagement"
      ? { kind, animals: [a.name] } : { kind }), a, b, mock.options),
      errorCode("NARRATION_NOT_APPLICABLE"));
    assert.equal(mock.calls.length, 0);
  }
});

test("sourced trait evidence is accepted; unknown values and TODO references are excluded", async () => {
  const source = a.field_sources.mass_kg!;
  const fact = `${a.name}.mass_kg = ${a.mass_kg} [tier ${source.tier}; ${source.ref}]`;
  const expected = beatsFor(a.name).map((beat) => ({ ...beat, fact_used: fact }));
  const mock = mockProvider([provider(expected)]);
  const unknownBite = { ...a, bite_force_n: null };
  assert.deepEqual(await narrateMatchup(result, unknownBite, b, mock.options), expected);
  const payload = JSON.parse(mock.calls[0]!.messages[1]!.content) as { evidence: string[] };
  assert.equal(payload.evidence.some((item) => item.includes(".bite_force_n")), false);
  assert.equal(payload.evidence.some((item) => item.includes("TODO")), false);
});

test("TODO references remain excluded even with a non-null source tier", async () => {
  const pending = {
    ...a,
    field_sources: {
      ...a.field_sources,
      mass_kg: { tier: 3 as const, ref: "TODO: verify measurement" },
    },
  };
  const mock = mockProvider([provider(beatsFor(a.name))]);
  await narrateMatchup(result, pending, b, mock.options);
  const payload = JSON.parse(mock.calls[0]!.messages[1]!.content) as { evidence: string[] };
  assert.equal(payload.evidence.some((fact) => fact.includes(`${a.name}.mass_kg`)), false);
  assert.equal(payload.evidence.some((fact) => /\bTODO\b/i.test(fact)), false);

  const unverifiedFact = `${a.name}.mass_kg = ${a.mass_kg} [tier 3; ${pending.field_sources.mass_kg.ref}]`;
  const unsupported = mockProvider([provider(beatsFor(a.name).map((beat) => ({
    ...beat, fact_used: unverifiedFact,
  })))]);
  await assert.rejects(narrateMatchup(result, pending, b, unsupported.options), errorCode("INVALID_NARRATION"));
});

test("functions_in is never accepted as trait evidence, regardless of tier", async () => {
  for (const tier of [1, 2, 3, null] as const) {
    const ref = "Test-only capability reference";
    const subject = {
      ...a,
      field_sources: {
        ...a.field_sources,
        functions_in: { tier, ref },
      },
    };
    const mock = mockProvider([provider(beatsFor(a.name))]);
    await narrateMatchup(result, subject, b, mock.options);
    const payload = JSON.parse(mock.calls[0]!.messages[1]!.content) as { evidence: string[] };
    assert.equal(payload.evidence.some((fact) => fact.includes(".functions_in")), false);

    const excludedFact = `${a.name}.functions_in = ${JSON.stringify(a.functions_in)} [tier ${tier}; ${ref}]`;
    const unsupported = mockProvider([provider(beatsFor(a.name).map((beat) => ({
      ...beat, fact_used: excludedFact,
    })))]);
    await assert.rejects(
      narrateMatchup(result, subject, b, unsupported.options),
      errorCode("INVALID_NARRATION"),
    );
  }
});

test("invalid JSON, provider envelope, beat schema and evidence fail clearly", async () => {
  const base = beatsFor(a.name);
  const invalidResponses = [
    new Response("not JSON", { status: 200 }),
    Response.json({ choices: [{ message: { content: "not JSON" } }] }),
    Response.json({ choices: [] }),
    provider(base.slice(1)),
    provider([...base, ...base]),
    provider(base.map((beat) => ({ ...beat, animal: "Unknown" }))),
    provider(base.map((beat) => ({ ...beat, action: "punch" }))),
    provider(base.map((beat) => ({ ...beat, action: "retreat" }))),
    provider(base.map((beat) => ({ ...beat, fact_used: "Invented evidence" }))),
    provider(base.map((beat) => ({ ...beat, extra: "unexpected" }))),
    provider([{ ...base[0], animal: null }, ...base.slice(1)]),
    provider([{ ...base[0], action: "finish" }, ...base.slice(1)]),
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
  await assert.rejects(narrateMatchup({ ...result, evidence_quality: "invented" } as unknown as MatchupResult,
    a, b, mock.options), errorCode("INVALID_ENGINE_OUTPUT"));
  await assert.rejects(narrateMatchup(result, a, b, { ...mock.options, endpoint: "http://unsafe.example/api" }), errorCode("LLM_CONFIGURATION"));
  assert.equal(mock.calls.length, 0);
});
