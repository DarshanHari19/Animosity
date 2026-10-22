import { Router, json, urlencoded, type IRouter } from "express";
import { GetAnimalsResponse } from "@workspace/api-zod";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { narrateMatchup } from "./narrator";
import { FightInputSchema, resultSchemaFor, fightResponseSchemaFor, beatsSchemaFor, narrationMatchesOutcome, type Animal, type Beat } from "./schemas";
import { FightError } from "./errors";
import { createFightRateLimiter } from "./limits";

const narrationErrors = new Set([
  "INVALID_NARRATION", "LLM_PROVIDER_FAILURE", "NARRATION_DAILY_CAP_REACHED",
  "LLM_NOT_CONFIGURED", "LLM_CONFIGURATION", "NARRATION_CAP_CONFIGURATION",
]);

// Injection enables focused boundary tests, never a production fallback.
export function createFightRouter(
  score: typeof scoreMatchup = scoreMatchup,
  narrate: typeof narrateMatchup = narrateMatchup,
  catalog: readonly Animal[] = animals,
  rateLimit = createFightRateLimiter(),
): IRouter {
  const router = Router();
  router.get("/animals", (_req, res) => {
    res.json(GetAnimalsResponse.parse(catalog));
  });
  router.post("/fight", rateLimit, json({ limit: "16kb" }), urlencoded({ extended: true }), async (req, res): Promise<void> => {
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
      let beats: Beat[] = [];
      let narration_status = narrated ? "available" : "not_required";
      let narration_reason: string | null = null;
      let providerAttempts = 0;
      if (narrated) {
        try {
          beats = beatsSchemaFor(a, b).parse(await narrate(result, a, b, {
            environment, mode, onProviderAttempt: () => { providerAttempts++; },
          }));
          if (!narrationMatchesOutcome(result, beats)) {
            throw new FightError("INVALID_NARRATION", "Narration does not match the engine outcome.", 502);
          }
        } catch (error) {
          beats = [];
          narration_status = "unavailable";
          // Never expose provider messages, raw output, or unexpected error details.
          narration_reason = error instanceof FightError && narrationErrors.has(error.code)
            ? error.code : error instanceof Error && error.name === "ZodError"
              ? "INVALID_NARRATION" : "NARRATION_FAILED";
        }
      }
      let explanation: string | null = null;
      const place = environment.replaceAll("_", " ");
      if (result.outcome.kind === "no_engagement") {
        explanation = result.outcome.animals.length === 2
          ? "Both animals back off in this realistic encounter."
          : `${result.outcome.animals[0]} backs off in this realistic encounter.`;
      } else if (result.outcome.kind === "indeterminate") {
        explanation = `Neither animal can function in ${place}; no numerical factors were scored.`;
      } else if (result.outcome.kind === "no_contest") {
        const unable = [a, b].filter((animal) => !animal.functions_in.includes(environment));
        explanation = `No contest: ${unable.map((animal) => animal.name).join(" and ")} cannot function in ${place} in realistic mode.`;
      } else if (result.deciding_factor === "environmental_advantage" && result.outcome.kind === "favored") {
        explanation = `${result.outcome.animal} is favored because the other animal cannot function in ${place}; forced fight counts this environmental disadvantage.`;
      }
      const response = fightResponseSchemaFor(a, b).safeParse({
        result, beats, explanation, narration_status, narration_reason,
      });
      if (!response.success) {
        throw new FightError("INVALID_NARRATION", "Response does not match the selected animals and engine outcome.", 502);
      }
      // Server-owned telemetry for pnpm eval; public JSON and UI are unchanged.
      res.setHeader("X-Narration-Attempts", String(providerAttempts));
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
