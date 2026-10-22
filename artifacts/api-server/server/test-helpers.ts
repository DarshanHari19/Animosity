import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { TestContext } from "node:test";
import { createFightRouter } from "./routes";
import type { Animal, Beat, MatchupResult } from "./schemas";
import { animals } from "./animals";
import { scoredFactorText } from "./narration-evidence";
import { deterministicFinish } from "./narration-finish";

// Fictional, test-only metadata and narration; never used by production.
export const fixtureFactor = { name: "Size", value: 1, reason: "Fixture reason only" };
export const fixtureEvidence = scoredFactorText(fixtureFactor, animals[0]!, animals[1]!);
export function fixtureClimax(finalAnimal: string | null): string {
  const other = finalAnimal === animals[0]!.name ? animals[1]!.name : animals[0]!.name;
  return finalAnimal === null ? "Both animals break off, with neither giving ground."
    : `The ${finalAnimal} drives the ${other} off as the ${other} retreats hurt.`;
}
export function fixtureResult(outcome: MatchupResult["outcome"]): MatchupResult {
  return {
    outcome, deciding_factor: null, evidence_quality: "mixed",
    encounter_label: "hypothetical", advantage_score: null,
    factors: [{ ...fixtureFactor }],
  };
}

export function fixtureBeats(a: Animal, finalAnimal: string | null): Beat[] {
  const facts_used = [fixtureEvidence];
  const verdict = deterministicFinish(
    fixtureResult(finalAnimal === null ? { kind: "even" } : { kind: "favored", animal: finalAnimal }),
    a, animals[1]!, [{ id: "E1", kind: "scored", factor_name: "Size", text: fixtureEvidence }],
  );
  return [
    ...Array.from({ length: 4 }, (): Beat => ({
      text: `${a.name} approaches.`, action: "approach", animal: a.name, facts_used,
    })),
    { ...verdict, text: `${fixtureClimax(finalAnimal)} ${verdict.text}` },
  ];
}

export async function startFightServer(
  t: TestContext,
  ...dependencies: Parameters<typeof createFightRouter>
) {
  const app = express();
  app.use(express.json());
  app.use("/api", createFightRouter(...dependencies));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  return {
    getAnimals: () => fetch(`${base}/animals`),
    post: (input: unknown) => fetch(`${base}/fight`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  };
}
