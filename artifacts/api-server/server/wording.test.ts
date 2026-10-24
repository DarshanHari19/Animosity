import assert from "node:assert/strict";
import { test } from "node:test";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { narrationEvidence, scoredFactorText } from "./narration-evidence";
import { environmentPhrase, humanWording } from "./wording";
import { startFightServer } from "./test-helpers";
import { fightResponseSchemaFor } from "./schemas";
import { FightError } from "./errors";

const shark = animals.find(a => a.name === "Great white shark")!;
const lion = animals.find(a => a.name === "Lion")!;
const croc = animals.find(a => a.name === "Saltwater crocodile")!;
const context = { mode: "forced_fight", encounter: "face_off" } as const;

test("environment wording has natural prepositions without raw tokens", () => {
  assert.equal(environmentPhrase("land"), "on land");
  assert.equal(environmentPhrase("shallow_water"), "in shallow water");
  assert.equal(environmentPhrase("deep_water"), "in deep water");
  assert.equal(humanWording("Hampered in land, in shallow_water, in deep_water; realistic mode; forced_fight."),
    "Hampered on land, in shallow water, in deep water; In the wild; Arena.");
});

test("readable gate evidence uses the engine verdict rather than JSON or inferred traits", () => {
  for (const environment of ["land", "deep_water"] as const) {
    for (const [a, b] of [[shark, lion], [lion, shark]] as const) {
      const result = scoreMatchup(a, b, { ...context, environment });
      const before = JSON.stringify(result);
      assert.equal(result.outcome.kind, "favored");
      const unable = environment === "land" ? shark : lion;
      // Deliberately contradict the traits: the gate still follows the engine.
      const evidence = narrationEvidence(result, { ...a, environments: { land: "full", shallow_water: "full", deep_water: "full" } }, b, environment);
      assert.equal(evidence[0]!.kind, "gate");
      assert.equal(evidence[0]!.text, `Environment: ${unable.name} can't function ${environmentPhrase(environment)}.`);
      assert.equal(JSON.stringify(result), before);
    }
  }
});

test("scored factor evidence humanizes environment reasons without changing scores or engine text", () => {
  const result = scoreMatchup(croc, lion, { ...context, environment: "shallow_water" });
  const factor = result.factors.find(factor => factor.name === "Environment")!;
  const before = JSON.stringify(result);
  assert.ok(factor.reason.includes("shallow_water"));
  assert.ok(scoredFactorText(factor, croc, lion).includes("in shallow water"));
  assert.equal(scoredFactorText(factor, croc, lion).includes("shallow_water"), false);
  assert.equal(JSON.stringify(result), before);
});

test("no-contest explanations use In the wild and on land", async t => {
  const server = await startFightServer(t, scoreMatchup);
  const response = await server.post({
    animalA: shark.name, animalB: lion.name, environment: "land", mode: "realistic",
  });
  assert.equal(response.status, 200);
  const body = fightResponseSchemaFor(shark, lion).parse(await response.json());
  assert.equal(body.explanation, "In the wild, a Great white shark can't function on land, so there's no fight.");
  assert.equal(body.narration_status, "not_required");
});

test("response factor reasons are readable while all engine numerical outputs stay unchanged", async t => {
  // This checks route wording, not generation. Never contact either AI provider.
  const server = await startFightServer(t, scoreMatchup, async () => {
    throw new FightError("LLM_PROVIDER_FAILURE", "Test-only unavailable narration.", 502);
  });
  const input = { animalA: croc.name, animalB: lion.name, environment: "shallow_water", mode: "realistic" } as const;
  const result = scoreMatchup(croc, lion, { ...context, ...input });
  const response = await server.post(input);
  assert.equal(response.status, 200);
  const body = fightResponseSchemaFor(croc, lion).parse(await response.json());
  assert.deepEqual(body.result, { ...result,
    factors: result.factors.map(factor => ({ ...factor, reason: humanWording(factor.reason) })),
  });
  assert.ok(body.result.factors.some((factor: { reason: string }) => factor.reason.includes("in shallow water")));
  assert.equal(JSON.stringify(body.result).includes("shallow_water"), false);
});
