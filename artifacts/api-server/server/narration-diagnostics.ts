import { z } from "zod";
import { logger } from "../src/lib/logger";

export type FailureCheck = {
  check: "JSON_parse" | "Zod_schema" | "fact_used_not_in_evidence" |
    "unknown_fact_id" | "outcome_winner_mismatch" | "provider_failure" | "text_consistency";
  path?: Array<string | number>;
  issues?: Array<{ path: Array<string | number>; message: string }>;
  fact_used?: string;
  fact_id?: string;
};

/** Inspect an already-rejected response; this never accepts or changes beats. */
export function failedChecks(error: unknown, parsed: unknown, evidence: string[]): FailureCheck[] {
  if (!(error instanceof z.ZodError)) return [{ check: "JSON_parse" }];
  const unknownIds = error.issues.filter(({ message }) => message.startsWith("Unknown fact_id: "));
  if (unknownIds.length) return unknownIds.map(({ path, message }) => ({
    check: "unknown_fact_id", path, fact_id: message.slice("Unknown fact_id: ".length),
  }));
  const evidenceMessage = "Every fact_used must exactly cite supplied evidence.";
  const structural = error.issues.filter((issue) => issue.message !== evidenceMessage);
  const checks: FailureCheck[] = structural.length ? [{
    check: "Zod_schema",
    issues: structural.map(({ path, message }) => ({ path, message })),
  }] : [];
  if (error.issues.some((issue) => issue.message === evidenceMessage) &&
      typeof parsed === "object" && parsed !== null && "beats" in parsed &&
      Array.isArray(parsed.beats)) {
    const beats: unknown[] = parsed.beats;
    beats.forEach((beat, index) => {
      if (typeof beat === "object" && beat !== null && "fact_used" in beat &&
          typeof beat.fact_used === "string" && !evidence.includes(beat.fact_used)) {
        checks.push({
          check: "fact_used_not_in_evidence", path: ["beats", index, "fact_used"],
          fact_used: beat.fact_used,
        });
      }
    });
  }
  return checks;
}

/** Server-only: never include these diagnostic fields in an HTTP response. */
export function logNarrationFailure(
  context: { animals: string[]; model: string; attempt: number; expectedOutcome: unknown },
  checks: FailureCheck[],
  rawModelText: string | null,
): void {
  logger.warn({
    event: "narration_attempt_failed", ...context,
    checks, raw_model_text: rawModelText,
  }, "Narration attempt failed validation or provider request");
}
