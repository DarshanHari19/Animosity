import { z } from "zod";
import { logger } from "../src/lib/logger";
import { appendDiagnostic } from "./narration-diagnostic-store";

export type FailureCheck = {
  check: "JSON_parse" | "Zod_schema" | "fact_used_not_in_evidence" |
    "unknown_fact_id" | "outcome_winner_mismatch" | "provider_failure" | "text_consistency" | "causal_grounding" | "non_finish_verdict";
  path?: Array<string | number>;
  issues?: Array<{ path: Array<string | number>; message: string }>;
  fact_used?: string;
  fact_id?: string;
  text?: string;
};

/** Inspect an already-rejected response; this never accepts or changes beats. */
export function failedChecks(error: unknown, parsed: unknown, evidence: string[]): FailureCheck[] {
  if (!(error instanceof z.ZodError)) return [{ check: "JSON_parse" }];
  const unknownIds = error.issues.filter(({ message }) => message.startsWith("Unknown fact_id: "));
  if (unknownIds.length) return unknownIds.map(({ path, message }) => ({
    check: "unknown_fact_id", path, fact_id: message.slice("Unknown fact_id: ".length),
  }));
  const evidenceMessage = "Every facts_used entry must exactly cite supplied evidence.";
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
      if (typeof beat === "object" && beat !== null && "facts_used" in beat && Array.isArray(beat.facts_used)) {
        for (const fact of beat.facts_used) if (typeof fact === "string" && !evidence.includes(fact)) {
          checks.push({ check: "fact_used_not_in_evidence", path: ["beats", index, "facts_used"], fact_used: fact });
        }
      }
    });
  }
  return checks;
}

/** Add the offending beat text to diagnostics and corrective instructions. */
export function withOffendingText(checks: FailureCheck[], parsed: unknown, raw: string | null): FailureCheck[] {
  const wire = parsed as { beats?: Array<{ text?: unknown }>; finish?: { text?: unknown }; climax?: unknown } | null;
  return checks.map((check) => {
    const path = check.path ?? check.issues?.[0]?.path;
    const index = path?.[0] === "beats" && typeof path[1] === "number" ? path[1] : undefined;
    const text = index !== undefined ? (wire?.beats?.[index]?.text ?? wire?.finish?.text)
      : path?.[0] === "finish" ? wire?.finish?.text : path?.[0] === "climax" ? wire?.climax : undefined;
    return { ...check, text: check.text ?? (typeof text === "string" ? text : raw?.slice(0, 500) ?? undefined) };
  });
}

/** Server-only: never include these diagnostic fields in an HTTP response. */
export function logNarrationFailure(
  context: { narration_id: string; animals: string[]; model: string; attempt: number; expectedOutcome: unknown },
  checks: FailureCheck[],
  rawModelText: string | null,
): void {
  try {
    appendDiagnostic({
      timestamp: new Date().toISOString(), narration_id: context.narration_id,
      animals: context.animals, attempt: context.attempt, checks,
    });
  } catch {
    // Observability must never change narration, retry or HTTP behavior.
    logger.error("Could not write server narration diagnostics; eval will report incomplete diagnostics.");
  }
  logger.warn({
    event: "narration_attempt_failed", ...context,
    checks, raw_model_text: rawModelText,
  }, "Narration attempt failed validation or provider request");
}
