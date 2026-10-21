import type { Animal, EngineContext, MatchupResult } from "./schemas";
import { FightError } from "./errors";

export function scoreMatchup(
  _a: Animal,
  _b: Animal,
  _context: EngineContext,
): MatchupResult {
  // TODO: Write scoring using environment, mode and encounter context.
  // Return a structured outcome and evidence metadata; do not invent inputs.
  // Verify every supplied value/source before treating it as authoritative.
  throw new FightError(
    "SCORING_NOT_IMPLEMENTED",
    "Scoring not implemented. Fill in sourced animal traits and implement server/engine.ts.",
    501,
  );
}
