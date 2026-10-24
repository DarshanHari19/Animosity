import assert from "node:assert/strict";
import { test } from "node:test";
import { animals } from "./animals";
import { narrationEvidence } from "./narration-evidence";
import { fixtureResult, startFightServer } from "./test-helpers";

test("animal API publishes citation and tier only, never internal notes", async t => {
  const sentinel = "INTERNAL_REVIEW_SENTINEL_NOT_PUBLIC";
  const catalog = animals.map(animal => ({
    ...animal, field_sources: Object.fromEntries(Object.entries(animal.field_sources)
      .map(([field, source]) => [field, { ...source, note: sentinel }])),
  }));
  const server = await startFightServer(t, undefined, undefined, catalog);
  const response = await server.getAnimals();
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.equal(text.includes(sentinel), false);
  assert.equal(text.includes('"note"'), false);
  const publicAnimals = JSON.parse(text);
  publicAnimals.forEach((animal: typeof animals[number], index: number) => {
    for (const [field, source] of Object.entries(animal.field_sources)) {
      assert.deepEqual(Object.keys(source).sort(), ["citation", "tier"]);
      assert.equal(source.citation, animals[index]!.field_sources[field]!.citation);
      assert.equal(source.tier, animals[index]!.field_sources[field]!.tier);
    }
  });
});

test("narrator evidence uses only public citation and tier, never review notes", () => {
  const sentinel = "INTERNAL_NOTE_DO_NOT_SEND";
  const a = { ...animals[0]!, field_sources: Object.fromEntries(
    Object.entries(animals[0]!.field_sources).map(([field, source]) =>
      [field, { ...source, note: sentinel }])) };
  const evidence = narrationEvidence(fixtureResult({ kind: "favored", animal: a.name }), a, animals[1]!);
  assert.ok(evidence.some(item => item.kind === "context" && item.text.includes("Haas, Hayssen & Krausman")));
  assert.equal(JSON.stringify(evidence).includes(sentinel), false);
  assert.equal(JSON.stringify(evidence).includes("confirm in"), false);
});

test("all stored sources have separate citation/tier/note and environment notes describe current levels", () => {
  for (const animal of animals) {
    for (const source of Object.values(animal.field_sources)) {
      assert.deepEqual(Object.keys(source).sort(), ["citation", "note", "tier"]);
      assert.equal(typeof source.note, "string");
      assert.doesNotMatch(source.citation, /Caveat:|confirm in|TODO|unsourced/i);
    }
    const note = animal.field_sources.environments!.note!;
    assert.ok(note.includes(`land ${animal.environments.land}`), animal.name);
    assert.ok(note.includes(`shallow water ${animal.environments.shallow_water}`), animal.name);
    assert.ok(note.includes(`deep water ${animal.environments.deep_water}`), animal.name);
    assert.doesNotMatch(note, /land-only|functions_in/);
  }
});
