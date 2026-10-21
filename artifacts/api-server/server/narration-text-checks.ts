import type { Animal, Beat, MatchupResult } from "./schemas";
import type { FailureCheck } from "./narration-diagnostics";

const smallNumbers: Record<string, number> = Object.fromEntries([
  ...["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen"].map((word, value) => [word, value]),
  ...["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
    .map((word, index) => [word, (index + 2) * 10]),
]);
const scales: Record<string, number> = { hundred: 100, thousand: 1000, million: 1e6, billion: 1e9 };
const numberWords = [...Object.keys(smallNumbers), ...Object.keys(scales)].join("|");

/** Numeric literals and ordinary written cardinal numbers, not substring digits. */
function numbers(text: string): string[] {
  const result = [...text.matchAll(/[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:e[+-]?\d+)?/gi)]
    .map(([token]) => String(Number(token.replaceAll(",", ""))));
  const written = new RegExp(`\\b(?:${numberWords})(?:[ -]+(?:and[ -]+)?(?:${numberWords}))*\\b`, "gi");
  for (const [phrase] of text.matchAll(written)) {
    let total = 0;
    let group = 0;
    for (const word of phrase.toLowerCase().split(/[ -]+/)) {
      if (word === "and") continue;
      if (word === "hundred") group = (group || 1) * 100;
      else if (scales[word]) { total += (group || 1) * scales[word]!; group = 0; }
      else group += smallNumbers[word]!;
    }
    result.push(String(total + group));
  }
  return result;
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const percentage = /[%％]|\b(?:percent(?:age|ages|s|ile|iles)?|per[\s-]+cent|pct)\b/i;
const positiveClaim = /\b(?:wins?|won|winner|victor|victorious|victory|prevails?|prevailed|defeats?|defeated|beats|favored)\b/i;
const negated = /\b(?:no|not|never|neither|without)\b/i;

function namesWinner(clause: string, name: string): boolean {
  if (negated.test(clause)) return false;
  const animal = `\\b${escapeRegex(name)}\\b`;
  return new RegExp(`${animal}(?:\\s+(?:clearly|decisively|ultimately))?\\s+` +
    `(?:(?:is|was|becomes|became|emerges|emerged|remains|stands)(?:\\s+(?:as|the|clear|sole))*\\s+)?` +
    `(?:wins?|won|winner|victor|victorious|prevails?|prevailed|defeats?|defeated|beats|favored)\\b`, "i").test(clause) ||
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
    const evidenceNumbers = new Set(numbers(beat.fact_used));
    for (const value of new Set(numbers(beat.text))) {
      if (!evidenceNumbers.has(value)) messages.push(`Number ${value} is absent from this beat's fact_used.`);
    }
    if (percentage.test(beat.text)) messages.push("Percent signs and percentage words are forbidden.");
    const clauses = beat.text.split(/[.!?;,]/);
    if (result.outcome.kind === "even") {
      if (clauses.some((clause) => !negated.test(clause) && positiveClaim.test(clause))) {
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
      check: "text_consistency", path,
      issues: messages.map((message) => ({ path, message })),
    });
  });
  return failures;
}
