import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { narrateMatchup } from "./narrator";
import { climaxChecks } from "./narration-climax";
import { narrationEvidence } from "./narration-evidence";
import { resolveEvidence } from "./narration-tool";
import { FightError } from "./errors";
import { startFightServer } from "./test-helpers";
import { fightResponseSchemaFor, type Animal } from "./schemas";

const hippo = animals.find(a => a.name === "Hippopotamus")!;
const lion = animals.find(a => a.name === "Lion")!;
const bear = animals.find(a => a.name === "Grizzly bear")!;
const shark = animals.find(a => a.name === "Great white shark")!;
const context = { environment: "land", mode: "forced_fight", encounter: "face_off" } as const;
const favored = scoreMatchup(hippo, lion, context);
const arena = "The Hippopotamus rams the Lion down until the Lion can't continue.";
const wild = "The Hippopotamus drives the Lion off as the Lion retreats hurt.";
const evenText = "Both animals break off, with neither giving ground.";
const wire = (climax: unknown) => ({
  climax, beats: Array.from({ length: 4 }, () => ({
    text: "The Lion approaches.", action: "approach", animal: lion.name, fact_ids: ["E1"],
  })),
});
const response = (climax: unknown) => Response.json({
  choices: [{ message: { content: JSON.stringify(wire(climax)) } }],
});

test("climax honors wild, Arena, even and environmental choreography without changing verdicts", () => {
  assert.deepEqual(climaxChecks(wild, favored, hippo, lion, "realistic", "land"), []);
  assert.deepEqual(climaxChecks(arena, favored, hippo, lion, "forced_fight", "land"), []);
  assert.ok(climaxChecks(wild, favored, hippo, lion, "forced_fight", "land").length);
  assert.ok(climaxChecks(arena, favored, hippo, lion, "realistic", "land").length);
  const even = scoreMatchup(lion, bear, context);
  assert.equal(even.outcome.kind, "even");
  assert.deepEqual(climaxChecks(evenText, even, lion, bear, "forced_fight", "land"), []);
  assert.ok(climaxChecks("The Lion drives the Grizzly bear off.", even, lion, bear, "forced_fight", "land").length);
  const environmental = scoreMatchup(shark, lion, { ...context, environment: "deep_water" });
  assert.deepEqual(climaxChecks(
    "The Great white shark circles as the Lion cannot fight in deep water.",
    environmental, shark, lion, "forced_fight", "deep_water",
  ), []);
  assert.ok(climaxChecks(
    "The Great white shark seizes the Lion until the Lion cannot continue.",
    environmental, shark, lion, "forced_fight", "deep_water",
  ).length);
});

test("climax choreography matches every fighting style, not an extra scoring factor", () => {
  // Test-only style variants exercise presentation, not animal measurements or engine rules.
  for (const [style, action] of [
    ["charge", "rams the Lion down"], ["ambush", "seizes the Lion"],
    ["grapple", "wrestles the Lion down"], ["bluff", "overpowers the Lion and drives it back"],
    ["sustained", "presses the Lion down"],
  ] as const) {
    const animal: Animal = { ...hippo, fighting_style: style };
    assert.deepEqual(climaxChecks(
      `The Hippopotamus ${action} until the Lion cannot continue.`,
      favored, animal, lion, "forced_fight", "land",
    ), []);
  }
  assert.ok(climaxChecks(
    "The Hippopotamus seizes the Lion until the Lion cannot continue.",
    favored, hippo, lion, "forced_fight", "land",
  ).length);
});

test("meaning-preserving live climax phrasing is accepted without dropping outcome or mode rules", () => {
  const even = scoreMatchup(lion, bear, context);
  for (const text of [
    "The Lion and the Grizzly bear break apart, neither giving ground, and the standoff ends on open grassland.",
    "The Lion and the Grizzly bear break apart, each stepping back, with neither giving ground on the open grassland.",
  ]) assert.deepEqual(climaxChecks(text, even, lion, bear, "forced_fight", "land"), []);
  assert.deepEqual(climaxChecks(
    "The Hippopotamus charges and drives the Lion back, which retreats hurt across the grassland.",
    favored, hippo, lion, "realistic", "land",
  ), []);
  assert.deepEqual(climaxChecks(
    "The Hippopotamus charges full force, knocking the Lion down until the Lion cannot continue.",
    favored, hippo, lion, "forced_fight", "land",
  ), []);
  assert.ok(climaxChecks(
    "The Hippopotamus charges full force, knocking the Lion down and ending the forced fight.",
    favored, hippo, lion, "forced_fight", "land",
  ).length); // Still missing the other's inability to continue.
});

test("climax rejects extra sentences, 25 words, digits, number words, reasons, gore and past tense", () => {
  for (const text of [
    `${arena} Another sentence.`,
    `The Hippopotamus ${"firmly ".repeat(20)}rams the Lion until the Lion cannot continue.`,
    arena.replace("rams", "rams 2 times at"),
    arena.replace("rams", "rams two times at"),
    arena.replace("until", "because"),
    arena.replace("until", "thanks to its weight"),
    arena.replace("rams", "bloodily kills and rams"),
    arena.replace("rams", "rammed"),
  ]) assert.ok(climaxChecks(text, favored, hippo, lion, "forced_fight", "land").length, text);
  const exactly24 = arena.replace("until", `${"firmly ".repeat(13)}until`);
  assert.equal(exactly24.split(/\s+/).length, 24);
  assert.deepEqual(climaxChecks(exactly24, favored, hippo, lion, "forced_fight", "land"), []);
  const exactly25 = exactly24.replace("until", "firmly until");
  assert.equal(exactly25.split(/\s+/).length, 25);
  assert.match(climaxChecks(exactly25, favored, hippo, lion, "forced_fight", "land")[0]!.issues![0]!.message, /under 25/);
});

test("tool requires a climax string and never accepts a model-owned finish", () => {
  const evidence = narrationEvidence(favored, hippo, lion);
  for (const input of [
    { ...wire(arena), climax: undefined }, wire(null), wire(""),
    { ...wire(arena), finish: { text: arena } },
  ]) assert.throws(() => resolveEvidence(input, evidence, hippo, lion), z.ZodError);
  assert.equal(resolveEvidence(wire(arena), evidence, hippo, lion).climax, arena);
});

test("invalid climax retries once through existing checks, without a verdict-only fallback", async () => {
  for (const failures of [0, 1, 2]) {
    let calls = 0;
    const promise = narrateMatchup(favored, hippo, lion, {
      apiKey: "test-only", environment: "land", mode: "forced_fight", reserveProviderCall: () => {},
      fetch: async (_url, init) => {
        calls++;
        const body = JSON.parse(String(init?.body));
        const data = JSON.parse(body.messages[1].content);
        assert.equal(data.mode, "forced_fight");
        assert.equal(data.animals[0].fighting_style, hippo.fighting_style);
        assert.deepEqual(data.outcome, favored.outcome);
        if (calls === 2) assert.match(body.messages.at(-1).content, /Climax must contain no numbers/);
        return response(calls <= failures ? arena.replace("rams", "rams 2 times at") : arena);
      },
    });
    if (failures === 2) await assert.rejects(promise,
      (error: unknown) => error instanceof FightError && error.code === "INVALID_NARRATION");
    else {
      const beats = await promise;
      const finish = beats.at(-1)!;
      assert.equal(beats.length, 5);
      assert.equal(finish.text, `${arena} The Hippopotamus is favored: it outweighs the Lion about 7.9 to 1 (1500 kg vs 190 kg).`);
      assert.equal(finish.animal, hippo.name);
      assert.deepEqual(finish.facts_used, [narrationEvidence(favored, hippo, lion).find(e => e.factor_name === "Size")!.text]);
    }
    assert.equal(calls, failures === 0 ? 1 : 2);
  }
});

test("route passes submitted mode; failed climax preserves HTTP 200 result and empty beats", async t => {
  const server = await startFightServer(t, scoreMatchup, async (result, a, b, options) => {
    assert.equal(options!.mode, "forced_fight");
    return narrateMatchup(result, a, b, {
      ...options, apiKey: "test-only", reserveProviderCall: () => {},
      fetch: async () => response(wild), // Forbidden Arena retreat on both attempts.
    });
  });
  const http = await server.post({ animalA: hippo.name, animalB: lion.name, ...context });
  assert.equal(http.status, 200);
  const body = fightResponseSchemaFor(hippo, lion).parse(await http.json());
  assert.deepEqual(body.result, favored);
  assert.deepEqual(body.beats, []);
  assert.equal(body.narration_status, "unavailable");
  assert.equal(body.narration_reason, "INVALID_NARRATION");
});
