import assert from "node:assert/strict";
import { test } from "node:test";
import { animals } from "./animals";
import {
  AnimalSchema, FightInputSchema, resultSchemaFor, beatsSchemaFor, fightResponseSchemaFor,
} from "./schemas";
import { fixtureResult, fixtureBeats } from "./test-helpers";

const a = animals[0]!;
const b = animals[1]!;
const validInput = { animalA: a.name, animalB: b.name, environment: "land" };

test("traits include all seven user-provided animals and their supplied values", () => {
  assert.equal(animals.length, 7);
  assert.equal(new Set(animals.map((item) => item.name)).size, 7);
  assert.deepEqual(animals.map((animal) => animal.name), [
    "Lion", "Grizzly bear", "Saltwater crocodile", "Gorilla",
    "Hippopotamus", "Great white shark", "Rhinoceros",
  ]);
  assert.deepEqual(animals[0], {
    name: "Lion", profile: "adult_male", mass_kg: 190, length_m: 2.5,
    top_speed_kmh: 80, primary_weapon: "bite", bite_force_n: 5500,
    armor: "none", temperament: "aggressive", fighting_style: "ambush",
    environments: { land: "full", shallow_water: "hampered", deep_water: "cannot" },
    field_sources: {
      environments: a.field_sources.environments!,
      mass_kg: { tier: 3, citation: "https://en.wikipedia.org/wiki/Lion" },
      length_m: { tier: 3, citation: "https://en.wikipedia.org/wiki/Lion" },
      top_speed_kmh: { tier: 3, citation: "https://en.wikipedia.org/wiki/Lion" },
      bite_force_n: {
        tier: 2,
        citation: "Wroe et al. 2008 press summary (~560 kg force for a large lion); confirm in Wroe et al. 2005 table",
      },
    },
  });
  assert.equal(animals[6]?.bite_force_n, null);
  assert.equal(animals.every((animal) => animal.profile === "adult_male"), true);
  assert.equal(animals.every((animal) => animal.field_sources !== undefined), true);
  assert.deepEqual(animals.map((animal) => Object.values(animal.environments)), [
    ["full", "hampered", "cannot"], ["full", "full", "cannot"], ["hampered", "full", "full"],
    ["full", "hampered", "cannot"], ["full", "full", "hampered"], ["cannot", "cannot", "full"],
    ["full", "hampered", "cannot"],
  ]);
  assert.deepEqual(
    animals.map(({ mass_kg, length_m, top_speed_kmh, bite_force_n }) =>
      [mass_kg, length_m, top_speed_kmh, bite_force_n]),
    [
      [190, 2.5, 80, 5500], [270, 2.0, 56, null], [450, 5.0, 29, 16400],
      [180, 1.7, 40, null], [1500, 3.5, 30, null], [750, 3.8, 40, null],
      [2300, 3.8, 50, null],
    ],
    "Source review must not silently change the supplied measurements",
  );
});

test("environment sources retain reviewed habitat references and original tiers", () => {
  const expected = [
    { tier: null, urls: ["https://www.sfzoo.org/african-lion/", "https://pmc.ncbi.nlm.nih.gov/articles/PMC11236087/"] },
    { tier: null, urls: [
      "https://www.nps.gov/katm/learn/photosmultimedia/brown-bear-frequently-asked-questions.htm",
      "https://www.nps.gov/katm/learn/nature/natscimamm.htm",
    ] },
    { tier: 3, urls: ["https://australian.museum/learn/animals/reptiles/estuarine-crocodile/"] },
    { tier: null, urls: ["https://denverzoo.org/animals/western-lowland-gorilla/", "https://pmc.ncbi.nlm.nih.gov/articles/PMC1236726/"] },
    { tier: 3, urls: ["https://animals.sandiegozoo.org/animals/hippo"] },
    { tier: 3, urls: [
      "https://www.aquariumofpacific.org/onlinelearningcenter/species/great_white_shark",
      "https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/white-shark",
    ] },
    { tier: null, urls: ["https://www.marylandzoo.org/animal/southern-white-rhinoceros/"] },
  ];
  animals.forEach((animal, index) => {
    const source = animal.field_sources.environments!;
    const reviewed = expected[index]!;
    assert.equal(source.tier, reviewed.tier, animal.name);
    for (const url of reviewed.urls) {
      assert.ok(source.citation.includes(url), `${animal.name}: ${url}`);
    }
  });
});

test("animal validation uses exact enums and nonnegative nullable numeric fields", () => {
  for (const field of ["primary_weapon", "armor", "temperament"] as const) {
    assert.equal(AnimalSchema.safeParse({ ...a, [field]: "invented" }).success, false);
  }
  for (const fighting_style of ["invented", "approach"]) {
    assert.equal(AnimalSchema.safeParse({ ...a, fighting_style }).success, false);
  }
  for (const fighting_style of ["ambush", "sustained", "bluff", "grapple", "charge"]) {
    assert.equal(AnimalSchema.safeParse({ ...a, fighting_style }).success, true);
  }
  assert.equal(AnimalSchema.safeParse({ ...a, functions_in: ["air"] }).success, false);
  assert.equal(AnimalSchema.safeParse({ ...a, environments: { ...a.environments, land: "air" } }).success, false);
  assert.equal(AnimalSchema.safeParse({ ...a, environments: { land: "full", deep_water: "cannot" } }).success, false);
  assert.equal(AnimalSchema.safeParse({ ...a, environments: { ...a.environments, air: "full" } }).success, false);
  assert.equal(AnimalSchema.safeParse({ ...a, profile: "adult_juvenile" }).success, false);
  assert.equal(AnimalSchema.safeParse({ ...a, profile: "adult_female" }).success, true);
  assert.equal(AnimalSchema.safeParse({ ...a, profile: undefined }).success, false);
  assert.equal(AnimalSchema.safeParse({ ...a, mass_kg: -1 }).success, false);
  assert.equal(AnimalSchema.safeParse({ ...a, bite_force_n: null }).success, true);
  assert.equal(AnimalSchema.safeParse({ ...a, bite_force_n: -1 }).success, false);
  assert.equal(AnimalSchema.safeParse({ ...a, bite_force_psi: 5500 }).success, false);
  assert.equal(AnimalSchema.safeParse({ ...a, sources: [] }).success, false);
  assert.equal(AnimalSchema.safeParse({
    ...a,
    field_sources: {
      mass_kg: { tier: 4, citation: "invalid tier" },
    },
  }).success, false);
  assert.equal(AnimalSchema.safeParse({
    ...a,
    field_sources: {
      mass_kg: { tier: null, citation: "Valid unknown-tier note" },
      new_trait: { tier: 1, citation: "Valid arbitrary trait key" },
    },
  }).success, true);
  assert.equal(AnimalSchema.safeParse({
    ...a,
    field_sources: { mass_kg: { tier: 1, citation: 123 } },
  }).success, false);
  assert.equal(AnimalSchema.safeParse({
    ...a,
    field_sources: { mass_kg: { tier: 1, citation: "valid", extra: true } },
  }).success, false);
  assert.equal(AnimalSchema.safeParse({ ...a, field_sources: undefined }).success, false);
});

test("request validates context, applies defaults and permits identical animals", () => {
  for (const input of [
    {}, { ...validInput, animalA: "" }, { animalA: a.name },
    { ...validInput, environment: "air" }, { ...validInput, fake: 1 },
    { ...validInput, mode: "invented" }, { ...validInput, encounter: "ambush" },
    { ...validInput, environment: null }, { ...validInput, mode: null },
    { ...validInput, encounter: null },
  ]) assert.equal(FightInputSchema.safeParse(input).success, false);
  assert.deepEqual(FightInputSchema.parse({ animalA: a.name, animalB: a.name }), {
    animalA: a.name, animalB: a.name, environment: "land",
    mode: "realistic", encounter: "face_off",
  });
  for (const environment of ["land", "shallow_water", "deep_water"]) {
    for (const mode of ["realistic", "forced_fight"]) {
      assert.equal(FightInputSchema.safeParse({ ...validInput, environment, mode }).success, true);
    }
  }
});

test("result validates strict outcome variants, selected names and evidence metadata", () => {
  const result = fixtureResult({ kind: "favored", animal: a.name });
  for (const outcome of [
    { kind: "favored", animal: a.name }, { kind: "favored", animal: b.name },
    { kind: "even" }, { kind: "indeterminate" }, { kind: "no_contest" },
    { kind: "no_engagement", animals: [a.name] },
    { kind: "no_engagement", animals: [a.name, b.name] },
  ]) {
    assert.equal(resultSchemaFor(a, b).safeParse({ ...result, outcome }).success, true);
  }
  for (const outcome of [
    { kind: "favored", animal: "Unknown" }, { kind: "favored" },
    { kind: "even", animal: a.name }, { kind: "indeterminate", animal: a.name },
    { kind: "no_contest", extra: true }, { kind: "invented" },
    { kind: "no_engagement", animals: [] }, { kind: "no_engagement", animals: ["Unknown"] },
    { kind: "no_engagement", animals: [a.name, a.name] },
  ]) {
    assert.equal(resultSchemaFor(a, b).safeParse({ ...result, outcome }).success, false);
  }
  for (const invalid of [
    { ...result, deciding_factor: "invented" }, { ...result, evidence_quality: "invented" },
    { ...result, encounter_label: "invented" }, { ...result, extra: true },
    { ...result, factors: [5] }, { ...result, advantage_score: Infinity },
    { ...result, factors: [{ name: "Fixture", value: NaN, reason: "Fixture" }] },
    { ...result, factors: [{ name: "Fixture", value: Infinity, reason: "Fixture" }] },
    { ...result, factors: [{ name: "Fixture", value: 1, reason: "" }] },
    { ...result, factors: [{ name: "Fixture", value: 1, reason: "Fixture", extra: true }] },
    { ...result, factors: undefined }, { ...result, evidence_quality: undefined },
  ]) {
    assert.equal(resultSchemaFor(a, b).safeParse(invalid).success, false);
  }
  for (const advantage_score of [-1000, 0, 1000, null]) {
    assert.equal(resultSchemaFor(a, b).safeParse({ ...result, advantage_score }).success, true);
  }
});

test("beats require selected names, valid actions, 5–8 beats and a sole final finish", () => {
  const beats = fixtureBeats(a, a.name);
  assert.equal(beatsSchemaFor(a, b).safeParse(beats).success, true);
  assert.equal(beatsSchemaFor(a, b).safeParse(fixtureBeats(a, null)).success, true);
  for (const invalid of [
    beats.slice(1), [...beats, ...beats],
    beats.map((item) => ({ ...item, animal: "A" })),
    beats.map((item) => ({ ...item, action: "punch" })),
    beats.map((item) => ({ ...item, action: "retreat" })),
    beats.map((item) => ({ ...item, facts_used: [] })),
    beats.map((item) => ({ ...item, facts_used: [""] })),
    beats.map((item) => ({ ...item, facts_used: ["a", "b", "c", "d"] })),
    [{ ...beats[0], animal: null }, ...beats.slice(1)],
    [{ ...beats[0], action: "finish" }, ...beats.slice(1)],
  ]) assert.equal(beatsSchemaFor(a, b).safeParse(invalid).success, false);
});

test("response validation enforces narration versus explanation and final outcome", () => {
  const schema = fightResponseSchemaFor(a, b);
  for (const outcome of [{ kind: "no_contest" }, { kind: "indeterminate" }] as const) {
    const response = { result: fixtureResult(outcome), beats: [], explanation: "Fixture explanation.",
      narration_status: "not_required", narration_reason: null };
    assert.equal(schema.safeParse(response).success, true);
    for (const invalid of [
      { ...response, beats: fixtureBeats(a, a.name) },
      { ...response, explanation: null }, { ...response, explanation: "" },
      { ...response, explanation: "two\nlines" },
    ]) assert.equal(schema.safeParse(invalid).success, false);
  }
  for (const outcome of [{ kind: "favored", animal: a.name }, { kind: "even" }] as const) {
    const final = outcome.kind === "favored" ? a.name : null;
    const response = { result: fixtureResult(outcome), beats: fixtureBeats(a, final), explanation: null,
      narration_status: "available", narration_reason: null };
    assert.equal(schema.safeParse(response).success, true);
    assert.equal(schema.safeParse({ ...response, beats: fixtureBeats(a, b.name) }).success, false);
    assert.equal(schema.safeParse({ ...response, explanation: "unexpected" }).success, false);
    assert.equal(schema.safeParse({ ...response, beats: [] }).success, false);
  }
});
