import { Router, type IRouter } from "express";
import { GetAnimalsResponse } from "@workspace/api-zod";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { narrateMatchup } from "./narrator";
import { FightInputSchema, resultSchemaFor, fightResponseSchemaFor, type Animal } from "./schemas";
import { FightError } from "./errors";

// Injection enables focused boundary tests, never a production fallback.
export function createFightRouter(
  score: typeof scoreMatchup = scoreMatchup,
  narrate: typeof narrateMatchup = narrateMatchup,
  catalog: readonly Animal[] = animals,
): IRouter {
  const router = Router();
  router.get("/animals", (_req, res) => {
    res.json(GetAnimalsResponse.parse(catalog));
  });
  router.post("/fight", async (req, res): Promise<void> => {
    const parsed = FightInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`).join("; "),
        code: "INVALID_REQUEST",
      });
      return;
    }
    const { animalA, animalB, environment, mode, encounter } = parsed.data;
    const a = catalog.find((animal) => animal.name === animalA);
    const b = catalog.find((animal) => animal.name === animalB);
    if (!a || !b) {
      res.status(400).json({ error: "Unknown animal selection. Choose names from /api/animals.", code: "UNKNOWN_ANIMAL" });
      return;
    }
    try {
      const output = resultSchemaFor(a, b).safeParse(score(a, b, { environment, mode, encounter }));
      if (!output.success) {
        throw new FightError("INVALID_ENGINE_OUTPUT", "Engine returned an invalid outcome, evidence metadata, or factors.", 502);
      }
      const result = output.data;
      const narrated = result.outcome.kind === "favored" || result.outcome.kind === "even";
      const beats = narrated ? await narrate(result, a, b) : [];
      const label = result.outcome.kind === "no_contest" ? "No contest" : "Indeterminate";
      const reasons = result.factors.map((factor) => factor.reason.replace(/\s+/g, " ").trim()).join(" ");
      const explanation = narrated ? null : [
        `${label}.`,
        reasons.trim() || "The engine supplied no additional explanation.",
      ].join(" ");
      const response = fightResponseSchemaFor(a, b).safeParse({ result, beats, explanation });
      if (!response.success) {
        throw new FightError("INVALID_NARRATION", "Response does not match the selected animals and engine outcome.", 502);
      }
      res.json(response.data);
    } catch (error) {
      if (error instanceof FightError) {
        res.status(error.status).json({ error: error.message, code: error.code });
      } else {
        res.status(500).json({ error: "Unexpected matchup processing error.", code: "INTERNAL_ERROR" });
      }
    }
  });
  return router;
}
