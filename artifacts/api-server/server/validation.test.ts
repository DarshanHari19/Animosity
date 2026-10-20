import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { createFightRouter } from "./routes";
import { FightError } from "./errors";
import {
  AnimalSchema, FightInputSchema, resultSchemaFor, beatsSchemaFor,
  type MatchupResult,
} from "./schemas";

const a = animals[0]!;
const b = animals[1]!;
const validInput = { animalA: a.name, animalB: b.name, environment: "land" };

test("traits are six unique named animals with documented zero/empty placeholders", () => {
  assert.equal(animals.length, 6);
  assert.equal(new Set(animals.map((item) => item.name)).size, 6);
  for (const animal of animals) {
    assert.equal(animal.mass_kg, 0);
    assert.equal(animal.length_m, 0);
    assert.equal(animal.top_speed_kmh, 0);
    assert.equal(animal.bite_force_psi, 0);
    assert.deepEqual(animal.sources, []);
  }
});

test("animal validation uses exact enums and nonnegative nullable numeric fields", () => {
  for (const field of ["primary_weapon", "armor", "temperament"] as const) {
    assert.equal(AnimalSchema.safeParse({ ...a, [field]: "invented" }).success, false);
  }
  assert.equal(AnimalSchema.safeParse({ ...a, habitats: ["air"] }).success, false);
  assert.equal(AnimalSchema.safeParse({ ...a, mass_kg: -1 }).success, false);
  assert.equal(AnimalSchema.safeParse({ ...a, bite_force_psi: null }).success, true);
});

test("request rejects missing, identical, invalid-environment and extra fields", () => {
  for (const input of [
    {}, { ...validInput, animalA: "" }, { ...validInput, animalB: a.name },
    { ...validInput, environment: "air" }, { ...validInput, fake: 1 },
  ]) assert.equal(FightInputSchema.safeParse(input).success, false);
  assert.equal(FightInputSchema.safeParse(validInput).success, true);
});

test("engine throws the explicit not-implemented error in both environments", () => {
  for (const environment of ["land", "water"] as const) {
    assert.throws(() => scoreMatchup(a, b, environment), (error: unknown) =>
      error instanceof FightError && error.code === "SCORING_NOT_IMPLEMENTED" && error.status === 501);
  }
});

test("result validates confidence, factors, and selected-name winner", () => {
  const result = { winner: a.name, confidence: 0.7, factors: ["Fixture factor"] };
  for (const confidence of [-0.1, 1.1, NaN, Infinity]) {
    assert.equal(resultSchemaFor(a, b).safeParse({ ...result, confidence }).success, false);
  }
  for (const winner of ["A", "Unknown", ""]) {
    assert.equal(resultSchemaFor(a, b).safeParse({ ...result, winner }).success, false);
  }
  assert.equal(resultSchemaFor(a, b).safeParse({ ...result, factors: [5] }).success, false);
  assert.equal(resultSchemaFor(a, b).safeParse(result).success, true);
});

test("beat validation rejects unknown identifiers, actions, lengths and non-finish ending", () => {
  const beat = { text: "Fixture text", action: "finish", animal: a.name, fact_used: "Fixture factor" };
  const beats = Array.from({ length: 5 }, () => ({ ...beat }));
  assert.equal(beatsSchemaFor(a, b).safeParse(beats).success, true);
  for (const invalid of [
    beats.slice(1), [...beats, ...beats],
    beats.map((item) => ({ ...item, animal: "A" })),
    beats.map((item) => ({ ...item, action: "punch" })),
    beats.map((item) => ({ ...item, action: "retreat" })),
    beats.map((item) => ({ ...item, fact_used: "" })),
  ]) assert.equal(beatsSchemaFor(a, b).safeParse(invalid).success, false);
});

test("HTTP request boundary rejects unknown/malformed inputs and preserves live stub", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/api", createFightRouter());
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const list = await (await fetch(`${base}/animals`)).json() as unknown[];
  assert.equal(list.length, 6);
  for (const input of [{}, { ...validInput, animalA: "Unknown" }, { ...validInput, animalB: a.name }, { ...validInput, environment: "air" }]) {
    const response = await fetch(`${base}/fight`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json() as { error: string }).error, "string");
  }
  const response = await fetch(`${base}/fight`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validInput),
  });
  assert.equal(response.status, 501);
  assert.equal((await response.json() as { code: string }).code, "SCORING_NOT_IMPLEMENTED");
});

test("route validates future engine output before ever calling narrator", async (t) => {
  const invalidOutputs = [
    { winner: "Unknown", confidence: 0.5, factors: [] },
    { winner: a.name, confidence: 2, factors: [] },
  ];
  let called = false;
  for (const invalid of invalidOutputs) {
    const app = express();
    app.use(express.json());
    app.use("/api", createFightRouter(
      () => invalid as MatchupResult,
      async () => { called = true; throw new Error("Must not run"); },
    ));
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    t.after(() => { server.closeAllConnections(); server.close(); });
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/fight`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validInput),
    });
    assert.equal(response.status, 502);
    assert.equal((await response.json() as { code: string }).code, "INVALID_ENGINE_OUTPUT");
  }
  assert.equal(called, false);
});
