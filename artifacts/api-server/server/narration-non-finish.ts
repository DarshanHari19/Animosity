import type { Animal, Beat, MatchupResult } from "./schemas";
import type { FailureCheck } from "./narration-diagnostics";

// These conservative patterns only identify explicit verdicts or control claims.
// Directional pushing and driving are considered against the engine winner below.
const decisive = /\b(?:win(?:s|ning)?|won|winner|victor(?:y|ious)?|prevail(?:s|ed|ing)?|defeat(?:s|ed|ing)?|favou?red|upper hand|advantage|dominat(?:e|es|ed|ing)|overpower(?:s|ed|ing)|overmatch(?:es|ed|ing)|overwhelm(?:s|ed|ing)|subdu(?:e|es|ed|ing)|pin(?:s|ned|ning)|immobili[sz](?:e|es|ed|ing)|helpless|defenseless|controls? (?:the|this) (?:fight|exchange|encounter)|gets? the better|wears? .{0,40}down|bears? down on)\b/i;
const unableToContinue = /\b(?:unable to|cannot|can't|could not|couldn't|fails? to|struggles? to)\s+(?:\w+\s+){0,3}(?:shake|escape|retreat|free|resist|withstand|dislodge|break away|break free|hold off|continue)\b/i;
const forcedBack = /\b(?:forces?|forced|drives?|drove|push(?:es|ed)?)\b[^.!?;]{0,70}\b(?:back|away|retreat|ground)\b/i;
const negated = /\b(?:not|never|no longer|doesn't|does not|isn't|is not|cannot|can't)\b/i;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const aliases: Record<string, string[]> = {
  "Grizzly bear": ["bear"],
  "Saltwater crocodile": ["crocodile", "croc"],
  "Great white shark": ["shark"],
  Hippopotamus: ["hippo"],
  Rhinoceros: ["rhino"],
};

function claimedAnimal(
  text: string, end: number, beat: Beat, a: Animal, b: Animal, result: MatchupResult,
): Animal | null {
  const prefix = text.slice(0, end);
  const options = [a, b].flatMap(animal => [animal.name, ...(aliases[animal.name] ?? [])]
    .map(name => ({ animal, name }))).sort((left, right) => right.name.length - left.name.length);
  const match = new RegExp(`\\b(?:${options.map(({ name }) => escapeRegex(name)).join("|")})\\b`, "ig");
  let latest: Animal | undefined;
  for (const found of prefix.matchAll(match)) {
    const option = options.find(({ name }) => name.toLowerCase() === found[0]!.toLowerCase());
    if (option) latest = option.animal;
  }
  if (latest) return latest;

  const recent = prefix.slice(-60);
  if (/\b(?:the other animal|the opponent)\b/i.test(recent) && result.outcome.kind === "favored") {
    return result.outcome.animal === a.name ? b : a;
  }
  if (/\b(?:it|he|she)\s+(?:is\s+|was\s+)?$/i.test(recent)) {
    return beat.animal === a.name ? a : beat.animal === b.name ? b : null;
  }
  return null;
}

function contradictsOutcome(beat: Beat, result: MatchupResult, a: Animal, b: Animal): boolean {
  if (result.outcome.kind !== "favored" && result.outcome.kind !== "even") return false;
  const checks: Array<{ phrase: RegExp; incapacity: boolean }> = [
    { phrase: decisive, incapacity: false },
    { phrase: unableToContinue, incapacity: true },
    ...(result.outcome.kind === "favored" ? [{ phrase: forcedBack, incapacity: false }] : []),
  ];
  const clauses = beat.text.split(/[.!?;]/);
  return clauses.some((clause) => checks.some(({ phrase, incapacity }) => {
    const claim = phrase.exec(clause);
    if (!claim || (negated.test(clause.slice(Math.max(0, claim.index - 24), claim.index)))) return false;
    const subject = claimedAnimal(clause, claim.index, beat, a, b, result);
    if (result.outcome.kind === "even") {
      return subject !== null || /\b(?:one of the animals|either animal|the other animal|someone)\b/i.test(clause);
    }
    if (incapacity) return subject?.name === result.outcome.animal;
    return subject !== null && subject.name !== result.outcome.animal;
  }));
}

export function nonFinishChecks(beats: Beat[], result: MatchupResult, a: Animal, b: Animal): FailureCheck[] {
  return beats.flatMap((beat, index) => {
    if (beat.action === "finish") return [];
    const path = ["beats", index, "text"];
    const checks: FailureCheck[] = [];
    if (/\bhypothetical\b/i.test(beat.text)) checks.push({
      check: "text_consistency", path, text: beat.text,
      issues: [{ path, message: "Non-finish beats must not use the word 'hypothetical'." }],
    });
    if (contradictsOutcome(beat, result, a, b)) checks.push({
      check: "non_finish_verdict", path, text: beat.text,
      issues: [{ path, message: "This non-finish beat contradicts the engine verdict by assigning a win or upper hand to the other animal." }],
    });
    return checks;
  });
}
