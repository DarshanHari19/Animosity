import { Router, json, urlencoded, type IRouter } from "express";
import { GetAnimalsResponse } from "@workspace/api-zod";
import { animals } from "./animals";
import { scoreMatchup } from "./engine";
import { narrateMatchup } from "./narrator";
import { FightInputSchema, resultSchemaFor, fightResponseSchemaFor, beatsSchemaFor, narrationMatchesOutcome, type Animal, type Beat } from "./schemas";
import { FightError } from "./errors";
import { createFightRateLimiter } from "./limits";
import { environmentPhrase, humanWording } from "./wording";
import { BUILD_ID } from "../src/build-id";
import { EVAL_BYPASS_HEADER, narrationCacheKey, type NarrationCache } from "./narration-cache";

type RouterOptions = { cache?: NarrationCache; buildId?: string; development?: boolean };

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
  options: RouterOptions = {},
): IRouter {
  const router = Router();
  router.get("/animals", (_req, res) => {
    // Explicit allowlist boundary: review notes stay on the server even if generated schemas change.
    res.json(GetAnimalsResponse.parse(catalog.map(animal => ({
      ...animal, field_sources: Object.fromEntries(Object.entries(animal.field_sources)
        .map(([field, source]) => [field, { citation: source.citation, tier: source.tier }])),
    }))));
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
      let narration_source: "cache" | "model" = "model";
      const buildId = options.buildId ?? BUILD_ID;
      const bypass = (options.development ?? process.env.NODE_ENV === "development")
        && req.get(EVAL_BYPASS_HEADER) === "1";
      const cache = bypass ? undefined : options.cache;
      const key = narrationCacheKey(a.name, b.name, environment, mode, buildId);
      if (narrated) {
        try {
          let cached: unknown = null;
          if (cache) {
            try { cached = await cache.get(key); }
            catch { console.warn("Narration cache read failed; generating narration normally."); }
          }
          const validated = beatsSchemaFor(a, b).safeParse(cached);
          if (validated.success && narrationMatchesOutcome(result, validated.data)) {
            beats = validated.data;
            narration_source = "cache";
          } else {
            beats = beatsSchemaFor(a, b).parse(await narrate(result, a, b, {
              environment, mode, onProviderAttempt: () => { providerAttempts++; },
            }));
            narration_source = "model";
          }
          if (!narrationMatchesOutcome(result, beats)) {
            throw new FightError("INVALID_NARRATION", "Narration does not match the engine outcome.", 502);
          }
        } catch (error) {
          beats = [];
          narration_status = "unavailable";
          narration_source = "model";
          // Never expose provider messages, raw output, or unexpected error details.
          narration_reason = error instanceof FightError && narrationErrors.has(error.code)
            ? error.code : error instanceof Error && error.name === "ZodError"
              ? "INVALID_NARRATION" : "NARRATION_FAILED";
        }
      }
      let explanation: string | null = null;
      const place = environmentPhrase(environment);
      if (result.outcome.kind === "no_engagement") {
        explanation = result.outcome.animals.length === 2
          ? "In the wild, both animals back off."
          : `In the wild, the ${result.outcome.animals[0]} backs off.`;
      } else if (result.outcome.kind === "indeterminate") {
        explanation = `Neither animal can function ${place}; no numerical factors were scored.`;
      } else if (result.outcome.kind === "no_contest") {
        const unable = [a, b].filter((animal) => animal.environments[environment] === "cannot");
        const names = `${unable.length === 1 ? "a " : ""}${unable.map((animal) => animal.name).join(" and ")}`;
        explanation = `In the wild, ${names} can't function ${place}, so there's no fight.`;
      } else if (result.deciding_factor === "environmental_advantage" && result.outcome.kind === "favored") {
        explanation = `${result.outcome.animal} is favored because the other animal can't function ${place}; Arena counts this environmental disadvantage.`;
      }
      const response = fightResponseSchemaFor(a, b).safeParse({
        result: { ...result, factors: result.factors.map(factor => ({ ...factor, reason: humanWording(factor.reason) })) },
        beats, explanation, narration_status, narration_reason, narration_source,
      });
      if (!response.success) {
        throw new FightError("INVALID_NARRATION", "Response does not match the selected animals and engine outcome.", 502);
      }
      if (cache && narration_status === "available" && narration_source === "model") {
        try { await cache.put(key, buildId, response.data.beats); }
        catch { console.warn("Narration cache write failed; returning the validated model narration."); }
      }
      // Server-owned telemetry for pnpm eval; the UI does not display cache provenance.
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
