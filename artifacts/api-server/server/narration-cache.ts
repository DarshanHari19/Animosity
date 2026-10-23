import { createHash } from "node:crypto";
import type { Beat, Environment, EngineContext } from "./schemas";

export const EVAL_BYPASS_HEADER = "X-Animosity-Eval-Bypass-Cache";

export interface NarrationCache {
  get(key: string): Promise<unknown | null>;
  put(key: string, buildId: string, beats: Beat[]): Promise<void>;
}

/** Ordered corners are intentional: reversing the matchup is a different narration. */
export function narrationCacheKey(
  animalA: string, animalB: string, environment: Environment,
  mode: EngineContext["mode"], buildId: string,
): string {
  return createHash("sha256").update(JSON.stringify([animalA, animalB, environment, mode, buildId])).digest("hex");
}
