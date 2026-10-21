import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { TestContext } from "node:test";
import { createFightRouter } from "./routes";
import type { Animal, Beat, MatchupResult } from "./schemas";

// Fictional, test-only metadata and narration; never used by production.
export const fixtureFactor = { name: "Fixture factor", value: 1, reason: "Fixture reason only" };
export function fixtureResult(outcome: MatchupResult["outcome"]): MatchupResult {
  return {
    outcome, deciding_factor: null, evidence_quality: "mixed",
    encounter_label: "hypothetical", advantage_score: null,
    factors: [{ ...fixtureFactor }],
  };
}

export function fixtureBeats(a: Animal, finalAnimal: string | null): Beat[] {
  const fact_used = JSON.stringify(fixtureFactor);
  return [
    ...Array.from({ length: 4 }, (): Beat => ({
      text: "Hypothetical fixture movement.", action: "approach", animal: a.name, fact_used,
    })),
    { text: "Fixture conclusion.", action: "finish", animal: finalAnimal, fact_used },
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
