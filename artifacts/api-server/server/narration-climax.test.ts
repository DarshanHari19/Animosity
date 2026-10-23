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

test("climax mode and environmental choreography are guidance, not hard checks", () => {
  assert.deepEqual(climaxChecks(wild, favored, hippo, lion, "realistic", "land"), []);
  assert.deepEqual(climaxChecks(arena, favored, hippo, lion, "forced_fight", "land"), []);
  assert.deepEqual(climaxChecks(wild, favored, hippo, lion, "forced_fight", "land"), []);
  assert.deepEqual(climaxChecks(arena, favored, hippo, lion, "realistic", "land"), []);
  const even = scoreMatchup(lion, bear, context);
  assert.equal(even.outcome.kind, "even");
  assert.deepEqual(climaxChecks(evenText, even, lion, bear, "forced_fight", "land"), []);
  assert.ok(climaxChecks("The Lion drives the Grizzly bear off.", even, lion, bear, "forced_fight", "land").length);
  const environmental = scoreMatchup(shark, lion, { ...context, environment: "deep_water" });
  assert.deepEqual(climaxChecks(
    "The Great white shark circles as the Lion cannot fight in deep water.",
    environmental, shark, lion, "forced_fight", "deep_water",
  ), []);
  assert.deepEqual(climaxChecks(
    "The Great white shark seizes the Lion until the Lion cannot continue.",
    environmental, shark, lion, "forced_fight", "deep_water",
  ), []);
});

test("climax fighting-style moves remain allowed but style matching is guidance only", () => {
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
  assert.deepEqual(climaxChecks(
    "The Hippopotamus seizes the Lion until the Lion cannot continue.",
    favored, hippo, lion, "forced_fight", "land",
  ), []);
});

test("recorded live climax phrasing passes without requiring a scripted ending", () => {
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
  assert.deepEqual(climaxChecks(
    "The Hippopotamus charges full force, knocking the Lion down and ending the forced fight.",
    favored, hippo, lion, "forced_fight", "land",
  ), []); // Explicit inability to continue is now guidance, not a hard check.
});

test("climax rejects only the approved numbers, percentages, reasons and hypothetical wording", () => {
  for (const text of [
    arena.replace("rams", "rams 2 times at"),
    arena.replace("rams", "rams two times at"),
    arena.replace("until", "because"),
    arena.replace("until", "thanks to its weight"),
    arena.replace("until", "due to its weight"),
    "The Hippopotamus prevails, percent by percent.",
    "The Hippopotamus is favored %.",
    "A hypothetical encounter ends.",
    "A HYPOTHETICAL encounter ends.",
  ]) assert.ok(climaxChecks(text, favored, hippo, lion, "forced_fight", "land").length, text);
  const exactly24 = arena.replace("until", `${"firmly ".repeat(13)}until`);
  assert.equal(exactly24.split(/\s+/).length, 24);
  assert.deepEqual(climaxChecks(exactly24, favored, hippo, lion, "forced_fight", "land"), []);
  const exactly25 = exactly24.replace("until", "firmly until");
  assert.equal(exactly25.split(/\s+/).length, 25);
  assert.deepEqual(climaxChecks(exactly25, favored, hippo, lion, "forced_fight", "land"), []);
  for (const text of [
    `${arena} Another sentence.`,
    arena.replace("rams", "rammed"),
    arena.replace("rams", "bloodily kills and rams"),
    "The Hippopotamus looms.", // Both names/action list no longer required.
    "The Hippopotamus is heavier.", // Descriptive wording is not a causal phrase.
    "A hypothetical-looking animal pauses.",
  ]) {
    // Whole-word hypothetical still fails, independent of prose guidance.
    if (text.includes("hypothetical")) assert.ok(climaxChecks(text, favored, hippo, lion, "realistic", "land").length);
    else assert.deepEqual(climaxChecks(text, favored, hippo, lion, "realistic", "land"), []);
  }
});

test("climax rejects the other animal winning and any named winner for even", () => {
  for (const text of ["The Lion wins.", "The winner is Lion.", "The Lion drives the Hippopotamus off.",
    "The Lion pins the Hippopotamus until the Hippopotamus cannot continue."]) {
    assert.ok(climaxChecks(text, favored, hippo, lion, "forced_fight", "land").length, text);
  }
  const even = scoreMatchup(lion, bear, context);
  for (const text of ["The Lion wins.", "The Grizzly bear wins.", "The winner is Lion.", "The Lion overpowers the Grizzly bear."]) {
    assert.ok(climaxChecks(text, even, lion, bear, "forced_fight", "land").length, text);
  }
  assert.deepEqual(climaxChecks("Neither animal wins.", even, lion, bear, "forced_fight", "land"), []);
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
        assert.match(body.messages[0].content, /sports-commentary energy with documentary accuracy/);
        assert.match(body.messages[0].content, /never invent other animals or herds/);
        assert.match(body.messages[0].content, /hampered animal wades, slips, or struggles/);
        assert.match(body.messages[0].content, /The loser may die. No blood, wounds, or gore detail/);
        assert.match(body.messages[0].content, /clamps its jaws on the neck/);
        assert.match(body.messages[0].content, /loser escapes hurt; say how/);
        assert.match(data.climax_requirements, /concrete finishing move/);
        assert.match(data.climax_requirements, /Never say 'cannot continue'/);
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

test("prompt-only climax requirements do not leak back through legacy beat checks", async () => {
  for (const [a, b, environment, mode, climax] of [
    [hippo, lion, "land", "forced_fight", "The Hippopotamus rammed the Lion. The Lion retreats."],
    [hippo, lion, "land", "realistic", "The Hippopotamus holds the Lion."],
    [shark, lion, "deep_water", "forced_fight", "The Great white shark overpowers the Lion."],
    [lion, bear, "land", "forced_fight", "The animals pause."],
  ] as const) {
    let calls = 0;
    const result = scoreMatchup(a, b, { ...context, environment, mode });
    const beats = await narrateMatchup(result, a, b, {
      apiKey: "test-only", environment, mode, reserveProviderCall: () => {},
      fetch: async () => { calls++; return response(climax); },
    });
    assert.equal(calls, 1);
    assert.ok(beats.at(-1)!.text.startsWith(`${climax} `));
    assert.deepEqual(beats.at(-1)!.facts_used,
      narrationEvidence(result, a, b, environment).filter(e => e.kind === (result.deciding_factor === "environmental_advantage" ? "gate" : "scored"))
        .map(e => e.text));
  }
});

test("route passes submitted mode; failed climax preserves HTTP 200 result and empty beats", async t => {
  const server = await startFightServer(t, scoreMatchup, async (result, a, b, options) => {
    assert.equal(options!.mode, "forced_fight");
    return narrateMatchup(result, a, b, {
      ...options, apiKey: "test-only", reserveProviderCall: () => {},
      fetch: async () => response("The Lion wins."), // Wrong winner on both attempts.
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
