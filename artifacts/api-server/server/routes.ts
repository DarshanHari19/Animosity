import { Router, type IRouter } from "express";
import { GetAnimalsResponse, CreateFightResponse } from "@workspace/api-zod";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { narrateMatchup } from "./narrator";
import { FightInputSchema, resultSchemaFor, beatsSchemaFor } from "./schemas";
import { FightError } from "./errors";

// Injection enables focused boundary tests, never a production fallback.
export function createFightRouter(
  score: typeof scoreMatchup = scoreMatchup,
  narrate: typeof narrateMatchup = narrateMatchup,
): IRouter {
  const router = Router();
  router.get("/animals", (_req, res) => {
    res.json(GetAnimalsResponse.parse(animals));
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
    const { animalA, animalB, environment } = parsed.data;
    const a = animals.find((animal) => animal.name === animalA);
    const b = animals.find((animal) => animal.name === animalB);
    if (!a || !b) {
      res.status(400).json({ error: "Unknown animal selection. Choose names from /api/animals.", code: "UNKNOWN_ANIMAL" });
      return;
    }
    try {
      const output = resultSchemaFor(a, b).safeParse(score(a, b, environment));
      if (!output.success) {
        throw new FightError("INVALID_ENGINE_OUTPUT", "Engine returned an invalid winner, confidence, or factors.", 502);
      }
      const result = output.data;
      const beats = beatsSchemaFor(a, b).safeParse(await narrate(result, a, b));
      if (!beats.success || beats.data.at(-1)?.animal !== result.winner) {
        throw new FightError("INVALID_NARRATION", "Narration does not match the selected animals and engine winner.", 502);
      }
      res.json(CreateFightResponse.parse({ result, beats: beats.data }));
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
