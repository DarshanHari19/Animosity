import assert from "node:assert/strict";
import { test } from "node:test";
import { animals } from "./animals";
import { narrateMatchup } from "./narrator";
import { FightError } from "./errors";
import type { MatchupResult } from "./schemas";
import { fixtureResult, fixtureBeats, fixtureEvidence, fixtureClimax } from "./test-helpers";
import type { EvidenceItem } from "./narration-tool";
import { unavailableJevReport } from "./jev-telemetry";

// Fictional test-only output; this is NOT a scoring implementation.
const a = animals[0]!;
const b = animals[1]!;
const result = fixtureResult({ kind: "favored", animal: a.name });
const beatsFor = (finalAnimal: string | null) => fixtureBeats(a, finalAnimal);
type FixtureResponse = (evidence: EvidenceItem[]) => Response;
// Fixtures still describe expected public beats. Only their provider wire shape
// changes: exact fixture evidence is encoded as the corresponding fight-local ID.
const provider = (beats: unknown, injectFinish = false): FixtureResponse => (evidence) => Response.json({
  choices: [{ message: { content: JSON.stringify({
    ...fixtureWire(beats, evidence, injectFinish),
  }) } }],
});
function fixtureWire(beats: unknown, evidence: EvidenceItem[], injectFinish = false) {
  if (!Array.isArray(beats)) return { beats };
  const encoded = beats.map(({ facts_used, ...rest }) => ({
    ...rest, fact_ids: Array.isArray(facts_used)
      ? facts_used.map((fact) => evidence.find(({ text }) => text === fact)?.id ?? "E_UNKNOWN") : [],
  }));
  return { beats: encoded.slice(0, -1), climax: fixtureClimax(encoded.at(-1)?.animal ?? null),
    ...(injectFinish ? { finish: encoded.at(-1) } : {}) };
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
  assert.equal(payload.evidence.some(({ text }) => text.includes(".environments")), false);
});

test("shadow runs once after successful validation and cannot change beats or trigger retry", async () => {
  const mock = mockProvider([provider(beatsFor(a.name))]);
  let reviews = 0;
  const output = await narrateMatchup(result, a, b, {
    ...mock.options,
    shadowReview: async (input) => {
      reviews++;
      const publicBeats = beatsFor(a.name);
      assert.deepEqual(input.beats, [...publicBeats.slice(0, -1),
        { ...publicBeats.at(-1)!, text: fixtureClimax(a.name) }]);
      assert.notEqual(input.beats.at(-1)!.text, publicBeats.at(-1)!.text);
      assert.ok(input.evidence.some(({ text }) => text === fixtureEvidence));
      input.beats[0]!.text = "Test-only attempted mutation";
      throw new Error("Shadow provider unavailable");
    },
  });
  assert.equal(reviews, 1);
  assert.equal(mock.calls.length, 1);
  assert.deepEqual(output, beatsFor(a.name));
});

test("invalid narration never reaches Jev or gains acceptance from it", async () => {
  const mock = mockProvider([provider([], true), provider([], true)]);
  let reviews = 0;
  await assert.rejects(narrateMatchup(result, a, b, {
    ...mock.options, shadowReview: async () => { reviews++; },
  }), errorCode("INVALID_NARRATION"));
  assert.equal(reviews, 0);
  assert.equal(mock.calls.length, 2);
});

test("a corrected retry reaches shadow once, not on the rejected attempt", async () => {
  const mock = mockProvider([provider([], true), provider(beatsFor(a.name))]);
  let reviews = 0;
  const output = await narrateMatchup(result, a, b, {
    ...mock.options, shadowReview: async () => { reviews++; },
  });
  assert.equal(reviews, 1);
  assert.equal(mock.calls.length, 2);
  assert.deepEqual(output, beatsFor(a.name));
});

test("Jev telemetry reports success or failure without changing acceptance, beats or provider calls", async () => {
  for (const fails of [false, true]) {
    const mock = mockProvider([provider(beatsFor(a.name))]);
    const reports: unknown[] = [];
    const report = { status: "scored" as const, elapsed_ms: 25, http_status: 200, beats: [{
      beat_index: 0, text: beatsFor(a.name)[0]!.text,
      unsupported_reason_probability: 0.9, contradictory_winner_probability: 0.8,
    }] };
    const output = await narrateMatchup(result, a, b, {
      ...mock.options,
      shadowReview: async () => { if (fails) throw Error("test-only timeout"); return report; },
      onShadowResult: r => { reports.push(r); },
    });
    assert.deepEqual(output, beatsFor(a.name));
    assert.equal(mock.calls.length, 1);
    assert.deepEqual(reports, [fails ? unavailableJevReport() : report]);
  }
});

test("a throwing Jev telemetry observer cannot trigger narration retry or hide valid beats", async () => {
  const mock = mockProvider([provider(beatsFor(a.name))]);
  const output = await narrateMatchup(result, a, b, {
    ...mock.options,
    shadowReview: async () => unavailableJevReport(),
    onShadowResult: () => { throw Error("test-only observer failure"); },
  });
  assert.deepEqual(output, beatsFor(a.name));
  assert.equal(mock.calls.length, 1);
});

test("a model-supplied wrong finish retries once; server keeps the favored actor", async () => {
  const mock = mockProvider([provider(beatsFor(b.name), true), provider(beatsFor(a.name))]);
  const beats = await narrateMatchup(result, a, b, mock.options);
  assert.equal(beats.at(-1)!.animal, a.name);
  assert.equal(mock.calls.length, 2);
  assert.match(mock.calls[1]!.messages.at(-1)!.content, /Zod_schema/);
  assert.match(mock.calls[1]!.messages.at(-1)!.content, /finish/);
});

test("second forged finish fails without third call or finish-only fallback", async () => {
  const mock = mockProvider([provider(beatsFor(b.name), true), provider(beatsFor(b.name), true)]);
  await assert.rejects(narrateMatchup(result, a, b, mock.options), errorCode("INVALID_NARRATION"));
  assert.equal(mock.calls.length, 2);
});

test("even outcomes get a server-owned null finish; model-supplied actors are rejected", async () => {
  const even = fixtureResult({ kind: "even" });
  for (const responses of [
    [provider(beatsFor(null))],
    [provider(beatsFor(a.name), true), provider(beatsFor(null))],
  ]) {
    const expectedCalls = responses.length;
    const mock = mockProvider(responses);
    const beats = await narrateMatchup(even, a, b, mock.options);
    assert.equal(beats.at(-1)!.animal, null);
    assert.equal(mock.calls.length, expectedCalls);
  }
  const mock = mockProvider([provider(beatsFor(a.name), true), provider(beatsFor(b.name), true)]);
  await assert.rejects(narrateMatchup(even, a, b, mock.options), errorCode("INVALID_NARRATION"));
  assert.equal(mock.calls.length, 2);
});

test("favored outcomes reject an injected null finish before the server supplies its winner", async () => {
  const mock = mockProvider([provider(beatsFor(null), true), provider(beatsFor(a.name))]);
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
  const fact = `${a.name}.mass_kg = ${a.mass_kg} [tier ${source.tier}; ${source.citation}]`;
  const expected = beatsFor(a.name).map((beat, index) => ({
    ...beat, facts_used: index === 4 ? [fixtureEvidence] : [fact],
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
      mass_kg: { tier: 3 as const, citation: "TODO: verify measurement" },
    },
  };
  const mock = mockProvider([provider(beatsFor(a.name))]);
  await narrateMatchup(result, pending, b, mock.options);
  const payload = JSON.parse(mock.calls[0]!.messages[1]!.content) as { evidence: EvidenceItem[] };
  assert.equal(payload.evidence.some(({ text }) => text.includes(`${a.name}.mass_kg`)), false);
  assert.equal(payload.evidence.some(({ text }) => /\bTODO\b/i.test(text)), false);

  const unverifiedFact = `${a.name}.mass_kg = ${a.mass_kg} [tier 3; ${pending.field_sources.mass_kg.citation}]`;
  const bad = provider(beatsFor(a.name).map((beat) => ({
    ...beat, facts_used: [unverifiedFact],
  })));
  const unsupported = mockProvider([bad, bad]);
  await assert.rejects(narrateMatchup(result, pending, b, unsupported.options), errorCode("INVALID_NARRATION"));
});

test("internal source notes never enter the provider prompt or returned facts", async () => {
  const sentinel = "INTERNAL_NOTE_NOT_FOR_PROVIDER";
  const subject = {
    ...a,
    field_sources: Object.fromEntries(Object.entries(a.field_sources).map(([field, source]) =>
      [field, { ...source, note: sentinel }])),
  };
  const mock = mockProvider([provider(beatsFor(a.name))]);
  const beats = await narrateMatchup(result, subject, b, mock.options);
  assert.equal(JSON.stringify(mock.calls).includes(sentinel), false);
  assert.equal(JSON.stringify(beats).includes(sentinel), false);
  assert.equal(JSON.stringify(mock.calls).includes("confirm in"), false);
});

test("raw environments are never accepted as trait evidence, regardless of tier", async () => {
  for (const tier of [1, 2, 3, null] as const) {
    const citation = "Test-only capability reference";
    const subject = {
      ...a,
      field_sources: {
        ...a.field_sources,
        environments: { tier, citation },
      },
    };
    const mock = mockProvider([provider(beatsFor(a.name))]);
    await narrateMatchup(result, subject, b, mock.options);
    const payload = JSON.parse(mock.calls[0]!.messages[1]!.content) as { evidence: EvidenceItem[] };
    assert.equal(payload.evidence.some(({ text }) => text.includes(".environments")), false);

    const excludedFact = `${a.name}.environments = ${JSON.stringify(a.environments)} [tier ${tier}; ${citation}]`;
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
    provider(base.map((beat) => ({ ...beat, action: "retreat" })), true),
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
      return { beats: encoded.slice(0, -1), climax: fixtureClimax(a.name) };
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
      mass_kg: { tier: 1 as const, citation: "Test-only reference" },
      bite_force_n: { tier: 1 as const, citation: "Test-only reference" },
      length_m: { tier: null, citation: "Unverified" },
      top_speed_kmh: { tier: 1 as const, citation: " " },
      temperament: { tier: 1 as const, citation: "TODO: verify" },
      environments: { tier: 1 as const, citation: "Excluded environment metadata" },
    },
  };
  const mock = mockProvider([wire("E1")]);
  await narrateMatchup(result, subject, b, mock.options);
  const payload = JSON.parse(mock.calls[0]!.messages[1]!.content) as { evidence: EvidenceItem[] };
  for (const field of ["mass_kg", "bite_force_n", "length_m", "top_speed_kmh", "temperament", "environments", "primary_weapon"]) {
    assert.equal(payload.evidence.some(({ text }) => text.startsWith(`${a.name}.${field} =`)), false, field);
  }
});

for (const [check, bad] of [
  ["JSON_parse", () => Response.json({ choices: [{ message: { content: "not JSON" } }] })],
  ["Zod_schema", () => provider(beatsFor(a.name).map((beat) => ({ ...beat, action: "punch" })))],
  ["unknown_fact_id", () => wire("E_UNKNOWN")],
  ["Zod_schema (forged finish)", () => provider(beatsFor(b.name), true)],
] as const) {
  test(`${check} receives one retry with the failed check identified`, async () => {
    const mock = mockProvider([bad(), provider(beatsFor(a.name))]);
    assert.deepEqual(await narrateMatchup(result, a, b, mock.options), beatsFor(a.name));
    assert.equal(mock.calls.length, 2);
    assert.ok(mock.calls[1]!.messages.at(-1)!.content.includes(check.split(" ")[0]!));
  });
}

for (const [label, text, outcome] of [
  ["hypothetical wording", `${a.name} makes a hypothetical approach.`, { kind: "favored", animal: a.name }],
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
