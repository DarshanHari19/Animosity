import type { Animal, Environment, EngineContext, MatchupResult } from "./schemas";
import type { FailureCheck } from "./narration-diagnostics";

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const number = /\d|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|half|quarter)\b/i;
const reason = /\b(?:because|thanks to|due to)\b/i;
const percentage = /[%％]|\b(?:percent(?:age|ages|s|ile|iles)?|per[\s-]+cent|pct)\b/i;
const positiveClaim = /\b(?:wins?|won|winner|victor|victorious|victory|prevails?|prevailed|defeats?|defeated|beats|favou?red)\b/i;
const negated = /\b(?:no|not|never|neither|without|cannot|can't)\b/i;

function namesWinner(clause: string, name: string): boolean {
  if (negated.test(clause)) return false;
  const animal = `\\b${escape(name)}\\b`;
  return new RegExp(`${animal}(?:\\s+(?:clearly|decisively|ultimately))?\\s+` +
    `(?:(?:is|was|becomes|became|emerges|emerged|remains|stands)(?:\\s+(?:as|the|clear|sole))*\\s+)?` +
    `(?:wins?|won|winner|victor|victorious|prevails?|prevailed|defeats?|defeated|beats|favou?red|overpowers?|pins?)\\b`, "i").test(clause) ||
    new RegExp(`\\b(?:(?:winner|victor)\\s*(?:(?:is|was)\\s*)?[:=]?|victory\\s+goes\\s+to)\\s*${animal}`, "i").test(clause) ||
    new RegExp(`${animal}\\s+drives?\\b[^.!?;]*\\b(?:off|back|away)\\b`, "i").test(clause);
}

/** Only the approved hard limits. Choreography and prose style are prompt guidance. */
export function climaxChecks(
  text: string, result: MatchupResult, a: Animal, b: Animal,
  _mode: EngineContext["mode"], _environment: Environment,
): FailureCheck[] {
  const messages: string[] = [];
  if (number.test(text)) messages.push("Climax must contain no numbers.");
  if (percentage.test(text)) messages.push("Climax must contain no percentages.");
  if (reason.test(text)) messages.push("Climax must not give reasons for the outcome.");
  if (/\bhypothetical\b/i.test(text)) messages.push("Climax must not use 'hypothetical'.");
  const clauses = text.split(/[.!?;,]|\b(?:until|while|although|but|as)\b/i);
  if (result.outcome.kind === "even") {
    if (clauses.some(clause => (!negated.test(clause) && positiveClaim.test(clause)) ||
      [a.name, b.name].some(name => namesWinner(clause, name)))) {
      messages.push("An even climax must not name a winner.");
    }
  } else if (result.outcome.kind === "favored") {
    const favored = result.outcome.animal;
    if ([a.name, b.name].filter(name => name !== favored)
      .some(name => clauses.some(clause => namesWinner(clause, name)))) {
      messages.push("A favored climax must not show the other animal winning.");
    }
  }
  return messages.length ? [{
    check: "text_consistency", path: ["climax"], text,
    issues: messages.map(message => ({ path: ["climax"], message })),
  }] : [];
}
