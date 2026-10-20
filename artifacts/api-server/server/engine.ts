import type { Animal, Environment, MatchupResult } from "./schemas";
import { FightError } from "./errors";

export function scoreMatchup(
  _a: Animal,
  _b: Animal,
  _environment: Environment,
): MatchupResult {
  // TODO: Write your scoring here after replacing placeholder traits with
  // sourced data. winner must be a.name or b.name; confidence must be 0..1.
  // Never treat the placeholder zeroes as scientific measurements.
  throw new FightError(
    "SCORING_NOT_IMPLEMENTED",
    "Scoring not implemented. Fill in sourced animal traits and implement server/engine.ts.",
    501,
  );
}
