import type { Beat } from "./schemas";
import type { FailureCheck } from "./narration-diagnostics";

// Conservative English patterns, not semantic proof. The prompt also requires
// neutral attempted movements: no verdict, advantage, or successful domination.
const verdict = /\b(?:win(?:s|ning|ner)?|won|victor(?:y|ious)?|prevail(?:s|ed)?|defeat(?:s|ed)?|favou?red|advantage|edge|upper hand|outcome|decisive|superior|dominant|dominat(?:e|es|ed|ing)|overpower(?:s|ed|ing)?|overmatch(?:es|ed)?|overwhelm(?:s|ed|ing)?|subdu(?:e|es|ed)|pin(?:s|ned|ning)|immobili[sz](?:e|es|ed)|helpless|defenseless|falters?|staggers?|struggl(?:e|es|ing))\b/i;
const inability = /\b(?:unable to|cannot|can't|could not|couldn't|fails? to)\s+(?:\w+\s+){0,3}(?:shake|escape|retreat|free|resist|withstand|dislodge|break away|break free|hold off)\b/i;
const compelled = /\b(?:forces?|forced|drives?|drove|push(?:es|ed)?)\b[^.!?;]{0,70}\b(?:back|away|retreat|ground)\b/i;
const control = /\b(?:controls? (?:the|this) (?:fight|exchange|encounter)|gains? (?:ground|momentum)|gets? the better|wears? .{0,40}down|bears? down on|holds? .{0,25}(?:in place|at bay))\b/i;

export function nonFinishChecks(beats: Beat[]): FailureCheck[] {
  return beats.flatMap((beat, index) => {
    if (beat.action === "finish") return [];
    const path = ["beats", index, "text"];
    const checks: FailureCheck[] = [];
    if (/\bhypothetical\b/i.test(beat.text)) checks.push({
      check: "text_consistency", path, text: beat.text,
      issues: [{ path, message: "Non-finish beats must not use the word 'hypothetical'." }],
    });
    if ([verdict, inability, compelled, control].some((pattern) => pattern.test(beat.text))) checks.push({
      check: "non_finish_verdict", path, text: beat.text,
      issues: [{ path, message: "Non-finish beats must describe neutral attempts, not state or imply who is winning." }],
    });
    return checks;
  });
}
