import type { Animal, Beat, MatchupResult } from "./schemas";
import type { FailureCheck } from "./narration-diagnostics";

const forbiddenNumbers = /\b(?:zero|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|half|quarter)\b/i;
const forbiddenWording = /\b(?:sources?|sourced|unsourced|tiers?|unverified|unavailable|unknown|excluded|unscored)\b|\bmissing\s+(?:data|traits?|values?|measurements?|sources?|evidence|factors?)\b|\b(?:not|cannot|could not|can't|couldn't)\s+(?:be\s+)?(?:compared|scored|counted|included)\b/i;
const missingData = /\b(?:data|trait|value|measurement|evidence|factor|mass|length|speed|bite force)\b[^.!?;,]{0,30}\b(?:is|are|was|were)\s+missing\b/i;

/** Digit-numbers only: "one" / "two" are allowed wording, not measurements. */
function numbers(text: string): string[] {
  return [...text.matchAll(/[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:e[+-]?\d+)?/gi)]
    .map(([token]) => String(Number(token.replaceAll(",", ""))));
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const percentage = /[%％]|\b(?:percent(?:age|ages|s|ile|iles)?|per[\s-]+cent|pct)\b/i;
const positiveClaim = /\b(?:wins?|won|winner|victor|victorious|victory|prevails?|prevailed|defeats?|defeated|favored)\b/i;
const negated = /\b(?:no|not|never|neither|without)\b/i;

function namesWinner(clause: string, name: string): boolean {
  if (negated.test(clause)) return false;
  const animal = `\\b${escapeRegex(name)}\\b`;
  return new RegExp(`${animal}(?:\\s+(?:clearly|decisively|ultimately))?\\s+` +
    `(?:(?:is|was|becomes|became|emerges|emerged|remains|stands)(?:\\s+(?:as|the|clear|sole))*\\s+)?` +
    `(?:wins?|won|winner|victor|victorious|prevails?|prevailed|defeats?|defeated|beats(?!\\s+(?:(?:its|his|her|their|the)\\s+)?chest\\b)|favored)\\b`, "i").test(clause) ||
    new RegExp(`\\b(?:(?:winner|victor)\\s*(?:(?:is|was)\\s*)?[:=]?|victory\\s+goes\\s+to)\\s*${animal}`, "i").test(clause);
}

/** Conservative, deterministic language checks; not semantic fact verification. */
export function narrationTextChecks(
  beats: Beat[], result: MatchupResult, a: Animal, b: Animal,
): FailureCheck[] {
  const failures: FailureCheck[] = [];
  beats.forEach((beat, index) => {
    const path = ["beats", index, "text"];
    const messages: string[] = [];
    const evidenceNumbers = new Set(beat.facts_used.flatMap(numbers));
    for (const value of new Set(numbers(beat.text))) {
      if (!evidenceNumbers.has(value)) messages.push(`Number ${value} is absent from this beat's facts_used.`);
    }
    if (forbiddenNumbers.test(beat.text)) messages.push("Spelled-out numbers other than one and two are forbidden; use digits.");
    if (forbiddenWording.test(beat.text) || missingData.test(beat.text)) messages.push("Do not mention sources, tiers, missing data, or excluded comparisons.");
    if (percentage.test(beat.text)) messages.push("Percent signs and percentage words are forbidden.");
    const clauses = beat.text.split(/[.!?;,]/);
    if (result.outcome.kind === "even") {
      const winnerClaim = clauses.some((clause) => !negated.test(clause) &&
        (positiveClaim.test(clause) || [a.name, b.name].some(name => namesWinner(clause, name))));
      if (winnerClaim) {
        messages.push("An even matchup may not name a winner.");
      }
    } else if (result.outcome.kind === "favored") {
      const favored = result.outcome.animal;
      if ([a.name, b.name].filter((name) => name !== favored)
        .some((name) => clauses.some((clause) => namesWinner(clause, name)))) {
        messages.push("A beat names the other animal as winning.");
      }
    }
    if (messages.length) failures.push({
      check: "text_consistency", path, text: beat.text,
      issues: messages.map((message) => ({ path, message })),
    });
  });
  return failures;
}
