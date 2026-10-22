import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { narrateMatchup } from "./narrator";
import { narrationEvidence } from "./narration-evidence";
import { deterministicFinish } from "./narration-finish";
import { nonFinishChecks } from "./narration-non-finish";
import { beatsSchemaFor, fightResponseSchemaFor, narrationMatchesOutcome, type Beat, type Environment } from "./schemas";
import { narrationGroundingChecks } from "./narration-grounding";
import { FightError } from "./errors";
import { fixtureBeats, fixtureResult, startFightServer } from "./test-helpers";

const lion = animals.find(a => a.name === "Lion")!;
const hippo = animals.find(a => a.name === "Hippopotamus")!;
const shark = animals.find(a => a.name === "Great white shark")!;
const context = { environment: "land", mode: "realistic", encounter: "face_off" } as const;

test("favored fighting finish uses exact size text and only compared bite text, in either order", () => {
  for (const [a, b] of [[hippo, lion], [lion, hippo]] as const) {
    const result = scoreMatchup(a, b, context);
    const before = JSON.stringify(result);
    const evidence = narrationEvidence(result, a, b);
    const size = evidence.find(e => e.factor_name === "Size")!;
    const finish = deterministicFinish(result, a, b, evidence);
    assert.equal(finish.text, `${hippo.name} is favored. ${size.text}`);
    assert.deepEqual(finish.facts_used, [size.text]);
    assert.equal(finish.animal, hippo.name);
    assert.equal(finish.action, "finish");
    assert.equal(JSON.stringify(result), before);
    assert.deepEqual(narrationGroundingChecks([finish], result, evidence, a, b), []);
  }
  // Test-only verdict override exercises the compared-bite presentation branch;
  // it is never a production score or an engine expectation.
  const compared = scoreMatchup(lion, lion, context);
  const result = { ...compared, outcome: { kind: "favored" as const, animal: lion.name } };
  const evidence = narrationEvidence(result, lion, lion);
  const scored = evidence.filter(e => e.kind === "scored");
  assert.equal(scored.length, 2);
  const finish = deterministicFinish(result, lion, lion, evidence);
  assert.equal(finish.text, `${lion.name} is favored. ${scored.map(e => e.text).join(" ")}`);
  assert.deepEqual(finish.facts_used, scored.map(e => e.text));
});

test("environmental template names the actual winner, other animal and selected environment", () => {
  for (const environment of ["land", "deep_water"] as const) {
    for (const [a, b] of [[shark, lion], [lion, shark]] as const) {
      const result = scoreMatchup(a, b, { ...context, environment, mode: "forced_fight" });
      assert.equal(result.outcome.kind, "favored");
      const winner = environment === "land" ? lion.name : shark.name;
      const other = environment === "land" ? shark.name : lion.name;
      const evidence = narrationEvidence(result, a, b);
      const finish = deterministicFinish(result, a, b, evidence, environment);
      assert.equal(finish.text, `${winner} is favored. ${other} can't function in ${environment.replaceAll("_", " ")}.`);
      assert.equal(finish.animal, winner);
      assert.deepEqual(finish.facts_used, evidence.filter(e => e.kind === "gate").map(e => e.text));
      assert.deepEqual(narrationGroundingChecks([finish], result, evidence, a, b, environment), []);
    }
  }
});

test("even template is exact, null-actor and still independently checked against engine outcome", () => {
  const result = scoreMatchup(lion, lion, context);
  const finish = deterministicFinish(result, lion, lion, narrationEvidence(result, lion, lion));
  assert.equal(finish.text, "Too close to call. Body mass and comparable bite force don't separate these two.");
  assert.equal(finish.animal, null);
  const beats = beatsSchemaFor(lion, lion).parse([...fixtureBeats(lion, null).slice(0, -1), finish]);
  assert.equal(narrationMatchesOutcome(result, beats), true);
  assert.equal(narrationMatchesOutcome(result, [...beats.slice(0, -1), { ...finish, animal: lion.name }]), false);
  const favored = fixtureResult({ kind: "favored", animal: lion.name });
  assert.equal(narrationMatchesOutcome(favored, beats), false);
  assert.equal(narrationMatchesOutcome(favored, [...beats.slice(0, -1), { ...finish, animal: hippo.name }]), false);
});

const implied = JSON.parse(readFileSync(new URL("./__fixtures__/implied-advantage.json", import.meta.url), "utf8")) as { beat: Beat };
test("implied-advantage fixture now fails even if it cites scored evidence", () => {
  for (const facts_used of [implied.beat.facts_used, ["Test-only scored evidence"]]) {
    assert.equal(nonFinishChecks([{ ...implied.beat, facts_used }])[0]?.check, "non_finish_verdict");
  }
  for (const text of [
    "Lion wins.", "Lion is winning.", "Hippopotamus holds the advantage.",
    "Lion controls the exchange.", "Lion forces the other animal back.",
    "Lion cannot free itself.", "Lion struggles to escape.",
  ]) assert.equal(nonFinishChecks([{ ...implied.beat, text }]).length, 1, text);
  assert.deepEqual(nonFinishChecks([{ ...implied.beat, text: "Lion attempts to bite, then steps sideways." }]), []);
});

test("hypothetical is rejected case-insensitively only as a whole word in non-finish beats", () => {
  const beat = fixtureBeats(lion, lion.name)[0]!;
  for (const text of ["A hypothetical approach.", "HYPOTHETICAL movement.", "A hypothetical-looking charge."]) {
    const checks = nonFinishChecks([{ ...beat, text }]);
    assert.equal(checks.length, 1);
    assert.equal(checks[0]!.check, "text_consistency");
    assert.match(checks[0]!.issues![0]!.message, /hypothetical/);
  }
  assert.deepEqual(nonFinishChecks([{ ...beat, text: "Lion approaches." }]), []);
  assert.deepEqual(nonFinishChecks([{ ...beat, text: "Hypothetically, Lion approaches." }]), []);
  assert.deepEqual(nonFinishChecks([{ ...beat, action: "finish", text: "A hypothetical finish." }]), []);
});

test("neutral movements get exactly one server finish; implied wins retry once with no partial fallback", async () => {
  const result = fixtureResult({ kind: "favored", animal: animals[0]!.name });
  const a = animals[0]!, b = animals[1]!;
  for (const failures of [0, 1, 2]) {
    let calls = 0;
    const request = narrateMatchup(result, a, b, {
      apiKey: "test-only", reserveProviderCall: () => {},
      fetch: async (_url, init) => {
        calls++;
        const body = JSON.parse(String(init?.body));
        const prompt = body.messages[0].content;
        assert.match(prompt, /NEVER use the word 'hypothetical'/);
        assert.match(prompt, /named animal physically performing its action/);
        assert.match(prompt, /grapple grabs or wrestles/);
        assert.match(prompt, /charge charges/);
        assert.match(prompt, /nature-documentary play-by-play, present tense, vivid verbs, fewer than 20 words/);
        assert.match(prompt, /No repeated phrases/);
        assert.match(prompt, /Never use 'listed', 'on record', or 'supplied'/);
        assert.match(prompt, /measurements in at most ONE non-finish beat/);
        assert.equal(body.tools[0].input_schema.properties.finish, undefined);
        if (calls === 2) assert.match(body.messages.at(-1).content, /non_finish_verdict/);
        return Response.json({ choices: [{ message: { content: JSON.stringify({
          beats: Array.from({ length: 4 }, () => ({
            text: calls <= failures ? implied.beat.text : "The animal attempts to approach.",
            action: "approach", animal: a.name, fact_ids: ["E1"],
          })),
        }) } }] });
      },
    });
    if (failures === 2) {
      await assert.rejects(request, (e: unknown) => e instanceof FightError && e.code === "INVALID_NARRATION");
      assert.equal(calls, 2);
    } else {
      const beats = await request;
      assert.equal(calls, failures + 1);
      assert.equal(beats.length, 5);
      assert.equal(beats.filter(b => b.action === "finish").length, 1);
      assert.deepEqual(beats.at(-1), deterministicFinish(result, a, b, narrationEvidence(result, a, b)));
    }
  }
});

test("route forwards selected environment and reports actual provider attempts, including a rejected retry", async (t) => {
  for (const environment of ["land", "deep_water"] as Environment[]) {
    let observed: Environment | undefined;
    const server = await startFightServer(t, () => fixtureResult({ kind: "favored", animal: lion.name }),
      async (_result, _a, _b, options) => {
        observed = options?.environment;
        options?.onProviderAttempt?.();
        options?.onProviderAttempt?.();
        throw new FightError("INVALID_NARRATION", "Test-only rejected retry", 502);
      });
    const response = await server.post({ animalA: lion.name, animalB: hippo.name, environment });
    assert.equal(response.status, 200);
    assert.equal(observed, environment);
    assert.equal(response.headers.get("X-Narration-Attempts"), "2");
    const body = fightResponseSchemaFor(lion, hippo).parse(await response.json());
    assert.equal(body.narration_status, "unavailable");
    assert.deepEqual(body.beats, []);
    assert.deepEqual(body.result.outcome, { kind: "favored", animal: lion.name });
  }
});
