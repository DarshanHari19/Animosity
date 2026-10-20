import assert from "node:assert/strict";
import { test } from "node:test";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { FightError } from "./errors";
import type { Environment } from "./schemas";

// These are future scoring expectations supplied by the user, not verified
// scientific predictions. Until scoring exists, every case must throw.
function expectUnimplemented(nameA: string, nameB: string, environment: Environment) {
  const a = animals.find((animal) => animal.name === nameA);
  const b = animals.find((animal) => animal.name === nameB);
  assert.ok(a, `Missing animal fixture: ${nameA}`);
  assert.ok(b, `Missing animal fixture: ${nameB}`);
  assert.throws(
    () => scoreMatchup(a, b, environment),
    (error: unknown) => error instanceof FightError &&
      error.code === "SCORING_NOT_IMPLEMENTED" && error.status === 501,
  );
}

test("Hippo vs Lion on land: scoring not implemented", () => {
  // Once scoring exists: Hippopotamus wins with high confidence.
  expectUnimplemented("Hippopotamus", "Lion", "land");
});

test("Saltwater crocodile vs Lion in water: scoring not implemented", () => {
  // Once scoring exists: Saltwater crocodile wins with high confidence.
  expectUnimplemented("Saltwater crocodile", "Lion", "water");
});

test("Saltwater crocodile vs Lion on land: scoring not implemented", () => {
  // Once scoring exists: close matchup, low confidence; no fixed winner.
  expectUnimplemented("Saltwater crocodile", "Lion", "land");
});

test("Great white vs Saltwater crocodile in water: scoring not implemented", () => {
  // Once scoring exists: close matchup, low confidence; no fixed winner.
  expectUnimplemented("Great white shark", "Saltwater crocodile", "water");
});

test("Great white vs any other animal on land: scoring not implemented", () => {
  // Once scoring exists: shark cannot fight on land; return no_contest.
  const opponents = animals.filter((animal) => animal.name !== "Great white shark");
  assert.ok(opponents.length > 0);
  for (const opponent of opponents) {
    expectUnimplemented("Great white shark", opponent.name, "land");
  }
});

test("Rhinoceros vs Lion on land: scoring not implemented", () => {
  // Once scoring exists: Rhinoceros wins with medium confidence.
  expectUnimplemented("Rhinoceros", "Lion", "land");
});

test("Gorilla vs Grizzly on land: scoring not implemented", () => {
  // Once scoring exists: Grizzly bear wins with medium confidence.
  expectUnimplemented("Gorilla", "Grizzly bear", "land");
});

test("Gorilla vs any aggressive animal: scoring not implemented", () => {
  // Once scoring exists: Gorilla likely retreats; allow no_decisive_winner.
  const opponents = animals.filter(
    (animal) => animal.name !== "Gorilla" && animal.temperament === "aggressive",
  );
  assert.ok(opponents.length > 0);
  for (const opponent of opponents) {
    for (const environment of ["land", "water"] as const) {
      expectUnimplemented("Gorilla", opponent.name, environment);
    }
  }
});

test("Hippo vs Saltwater crocodile in water: scoring not implemented", () => {
  // Once scoring exists: Hippopotamus wins with medium confidence.
  expectUnimplemented("Hippopotamus", "Saltwater crocodile", "water");
});

test("Lion vs Lion: scoring not implemented", () => {
  // Once scoring exists: confidence near 50 percent. Test the engine directly;
  // identical selections remain invalid at the HTTP request boundary.
  expectUnimplemented("Lion", "Lion", "land");
});
