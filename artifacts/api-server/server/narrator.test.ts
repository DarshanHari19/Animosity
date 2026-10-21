import assert from "node:assert/strict";
import { test } from "node:test";
import { animals } from "./animals";
import { narrateMatchup } from "./narrator";
import { FightError } from "./errors";
import type { MatchupResult } from "./schemas";
import { fixtureResult, fixtureBeats, fixtureEvidence } from "./test-helpers";
import type { EvidenceItem } from "./narration-tool";

// Fictional test-only output; this is NOT a scoring implementation.
const a = animals[0]!;
const b = animals[1]!;
const result = fixtureResult({ kind: "favored", animal: a.name });
const beatsFor = (finalAnimal: string | null) => fixtureBeats(a, finalAnimal);
type FixtureResponse = (evidence: EvidenceItem[]) => Response;
// Fixtures still describe expected public beats. Only their provider wire shape
// changes: exact fixture evidence is encoded as the corresponding fight-local ID.
const provider = (beats: unknown): FixtureResponse => (evidence) => Response.json({
  choices: [{ message: { content: JSON.stringify({
    ...fixtureWire(beats, evidence),
  }) } }],
});
function fixtureWire(beats: unknown, evidence: EvidenceItem[]) {
  if (!Array.isArray(beats)) return { beats };
  const encoded = beats.map(({ facts_used, ...rest }) => ({
    ...rest, fact_ids: Array.isArray(facts_used)
      ? facts_used.map((fact) => evidence.find(({ text }) => text === fact)?.id ?? "E_UNKNOWN") : [],
  }));
  return { beats: encoded.slice(0, -1), finish: encoded.at(-1) };
}
const errorCode = (code: string) => (error: unknown) =>
  error instanceof FightError && error.code === code;

function mockProvider(responses: Array<Response | Error | FixtureResponse>) {
  const calls: Array<{ messages: Array<{ role: string; content: string }> }> = [];
  const mockFetch: typeof fetch = async (_url, init) => {
    const request = JSON.parse(String(init?.body));
    calls.push(request);
    const response = responses.shift();
    if (response instanceof Error) throw response;
    if (!response) throw new Error("Unexpected provider request");
    return typeof response === "function" ? response(
      JSON.parse(request.messages[1].content).evidence,
    ) : response;
  };
  return { calls, options: { fetch: mockFetch, apiKey: "test-only-dummy" } };
}

test("matching favored outcome returns validated beats in one call", async () => {
  const mock = mockProvider([provider(beatsFor(a.name))]);
  assert.deepEqual(await narrateMatchup(result, a, b, mock.options), beatsFor(a.name));
  assert.equal(mock.calls.length, 1);
  assert.match(mock.calls[0]!.messages[0]!.content, /Do not invent/);
  const payload = JSON.parse(mock.calls[0]!.messages[1]!.content) as { evidence: EvidenceItem[] };
  assert.ok(payload.evidence.some(({ text }) => text === fixtureEvidence));
  assert.equal(payload.evidence.some(({ text }) => text.includes(".functions_in")), false);
});

test("wrong favored animal retries once with corrective instruction", async () => {
  const mock = mockProvider([provider(beatsFor(b.name)), provider(beatsFor(a.name))]);
  const beats = await narrateMatchup(result, a, b, mock.options);
  assert.equal(beats.at(-1)!.animal, a.name);
  assert.equal(mock.calls.length, 2);
  assert.match(mock.calls[1]!.messages.at(-1)!.content, /outcome_winner_mismatch/);
  assert.ok(mock.calls[1]!.messages.at(-1)!.content.includes(a.name));
});

test("second outcome mismatch fails without third call or fallback", async () => {
  const mock = mockProvider([provider(beatsFor(b.name)), provider(beatsFor(b.name))]);
  await assert.rejects(narrateMatchup(result, a, b, mock.options), errorCode("INVALID_NARRATION"));
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
  await assert.rejects(narrateMatchup(even, a, b, mock.options), errorCode("INVALID_NARRATION"));
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
  const expected = beatsFor(a.name).map((beat, index) => ({
    ...beat, facts_used: index === 4 ? [fact, fixtureEvidence] : [fact],
  }));
  const mock = mockProvider([provider(expected)]);
  const unknownBite = { ...a, bite_force_n: null };
  assert.deepEqual(await narrateMatchup(result, unknownBite, b, mock.options), expected);
  const payload = JSON.parse(mock.calls[0]!.messages[1]!.content) as { evidence: EvidenceItem[] };
  assert.equal(payload.evidence.some(({ text }) => text.includes(".bite_force_n")), false);
  assert.equal(payload.evidence.some(({ text }) => text.includes("TODO")), false);
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
  const payload = JSON.parse(mock.calls[0]!.messages[1]!.content) as { evidence: EvidenceItem[] };
  assert.equal(payload.evidence.some(({ text }) => text.includes(`${a.name}.mass_kg`)), false);
  assert.equal(payload.evidence.some(({ text }) => /\bTODO\b/i.test(text)), false);

  const unverifiedFact = `${a.name}.mass_kg = ${a.mass_kg} [tier 3; ${pending.field_sources.mass_kg.ref}]`;
  const bad = provider(beatsFor(a.name).map((beat) => ({
    ...beat, facts_used: [unverifiedFact],
  })));
  const unsupported = mockProvider([bad, bad]);
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
    const payload = JSON.parse(mock.calls[0]!.messages[1]!.content) as { evidence: EvidenceItem[] };
    assert.equal(payload.evidence.some(({ text }) => text.includes(".functions_in")), false);

    const excludedFact = `${a.name}.functions_in = ${JSON.stringify(a.functions_in)} [tier ${tier}; ${ref}]`;
    const bad = provider(beatsFor(a.name).map((beat) => ({
      ...beat, facts_used: [excludedFact],
    })));
    const unsupported = mockProvider([bad, bad]);
    await assert.rejects(
      narrateMatchup(result, subject, b, unsupported.options),
      errorCode("INVALID_NARRATION"),
    );
  }
});

test("invalid JSON, provider envelope, beat schema and evidence fail after one retry", async () => {
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
    provider(base.map((beat) => ({ ...beat, facts_used: ["Invented evidence"] }))),
    provider(base.map((beat) => ({ ...beat, extra: "unexpected" }))),
    provider([{ ...base[0], animal: null }, ...base.slice(1)]),
    provider([{ ...base[0], action: "finish" }, ...base.slice(1)]),
  ];
  for (const response of invalidResponses) {
    const mock = mockProvider([response, typeof response === "function" ? response : response.clone()]);
    await assert.rejects(narrateMatchup(result, a, b, mock.options), errorCode("INVALID_NARRATION"));
    assert.equal(mock.calls.length, 2);
  }
});

const wire = (fact_id: string) => Response.json({
  choices: [{ message: { content: JSON.stringify({
    ...(() => {
      const encoded = beatsFor(a.name).map(({ facts_used: _unused, ...beat }) => ({ ...beat, fact_ids: [fact_id] }));
      return { beats: encoded.slice(0, -1), finish: encoded.at(-1) };
    })(),
  }) } }],
});

test("unknown fact_id is rejected after exactly one corrective retry", async () => {
  const mock = mockProvider([wire("E_DOES_NOT_EXIST"), wire("E_DOES_NOT_EXIST")]);
  await assert.rejects(narrateMatchup(result, a, b, mock.options), errorCode("INVALID_NARRATION"));
  assert.equal(mock.calls.length, 2);
  assert.match(mock.calls[1]!.messages.at(-1)!.content, /unknown_fact_id/);
  assert.match(mock.calls[1]!.messages.at(-1)!.content, /E_DOES_NOT_EXIST/);
});

test("resolved facts_used contains exact evidence text and fact_ids never escape to the API", async () => {
  const mock = mockProvider([wire("E1")]);
  const beats = await narrateMatchup(result, a, b, mock.options);
  for (const beat of beats) {
    assert.deepEqual(beat.facts_used, [fixtureEvidence]);
    assert.equal("fact_ids" in beat, false);
  }
});

test("evidence IDs are deterministic and remain stable across a corrective retry", async () => {
  const mock = mockProvider([wire("E_UNKNOWN"), wire("E1")]);
  await narrateMatchup(result, a, b, mock.options);
  const lists = mock.calls.map(({ messages }) => JSON.parse(messages[1]!.content).evidence as EvidenceItem[]);
  assert.deepEqual(lists[0], lists[1]);
  assert.deepEqual(lists[0]!.map(({ id }) => id), lists[0]!.map((_, index) => `E${index + 1}`));
  assert.equal(lists[0]![0]!.text, fixtureEvidence);
});

test("ID evidence retains zero, null, null-tier, empty-reference and missing-source exclusions", async () => {
  const subject = {
    ...a, mass_kg: 0, bite_force_n: null,
    field_sources: {
      mass_kg: { tier: 1 as const, ref: "Test-only reference" },
      bite_force_n: { tier: 1 as const, ref: "Test-only reference" },
      length_m: { tier: null, ref: "Unverified" },
      top_speed_kmh: { tier: 1 as const, ref: " " },
      temperament: { tier: 1 as const, ref: "TODO: verify" },
      functions_in: { tier: 1 as const, ref: "Excluded capability metadata" },
    },
  };
  const mock = mockProvider([wire("E1")]);
  await narrateMatchup(result, subject, b, mock.options);
  const payload = JSON.parse(mock.calls[0]!.messages[1]!.content) as { evidence: EvidenceItem[] };
  for (const field of ["mass_kg", "bite_force_n", "length_m", "top_speed_kmh", "temperament", "functions_in", "primary_weapon"]) {
    assert.equal(payload.evidence.some(({ text }) => text.startsWith(`${a.name}.${field} =`)), false, field);
  }
});

for (const [check, bad] of [
  ["JSON_parse", () => Response.json({ choices: [{ message: { content: "not JSON" } }] })],
  ["Zod_schema", () => provider(beatsFor(a.name).map((beat) => ({ ...beat, action: "punch" })))],
  ["unknown_fact_id", () => wire("E_UNKNOWN")],
  ["outcome_winner_mismatch", () => provider(beatsFor(b.name))],
] as const) {
  test(`${check} receives one retry with the failed check identified`, async () => {
    const mock = mockProvider([bad(), provider(beatsFor(a.name))]);
    assert.deepEqual(await narrateMatchup(result, a, b, mock.options), beatsFor(a.name));
    assert.equal(mock.calls.length, 2);
    assert.ok(mock.calls[1]!.messages.at(-1)!.content.includes(check));
  });
}

for (const [label, text, outcome] of [
  ["unsupported number", "It moves at 999 km/h.", { kind: "favored", animal: a.name }],
  ["percentage", "Its advantage is 1 percent.", { kind: "favored", animal: a.name }],
  ["other animal winning", `${b.name} wins.`, { kind: "favored", animal: a.name }],
  ["even winner", `${a.name} wins.`, { kind: "even" }],
] as const) {
  test(`${label} fails after Zod validation, retries once, then rejects a second bad response`, async () => {
    const metadata = fixtureResult(outcome);
    const good = beatsFor(outcome.kind === "favored" ? a.name : null);
    const bad = provider(good.map((beat, index) => index === 0 ? { ...beat, text } : beat));
    const recovered = mockProvider([bad, provider(good)]);
    assert.deepEqual(await narrateMatchup(metadata, a, b, recovered.options), good);
    assert.equal(recovered.calls.length, 2);
    assert.match(recovered.calls[1]!.messages.at(-1)!.content, /text_consistency/);
    const rejected = mockProvider([bad, bad]);
    await assert.rejects(narrateMatchup(metadata, a, b, rejected.options), errorCode("INVALID_NARRATION"));
    assert.equal(rejected.calls.length, 2);
  });
}

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
