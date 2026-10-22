import type { Animal, Environment, EngineContext, MatchupResult } from "./schemas";
import type { FailureCheck } from "./narration-diagnostics";
import { isEnvironmental } from "./narration-evidence";

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const number = /\d|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|half|quarter)\b/i;
const reason = /\b(?:because|thanks to|due to|owing to|outweighs|heavier|stronger|faster|advantage|superior)\b/i;
const gore = /\b(?:blood\w*|bleed\w*|gore|gory|entrails|disembowel\w*|decapitat\w*|dismember\w*)\b/i;
const death = /\b(?:kill\w*|dead|death|dies|fatal|lethal)\b/i;
const notPresent = /\b(?:will|would|was|were|had|drove|rammed|knocked|pinned|seized|dragged|wrestled|held|overpowered|retreated|broke|ended)\b/i;
const styles: Record<Animal["fighting_style"], RegExp> = {
  charge: /\b(?:ram(?:s|ming)?|knock(?:s|ing)? (?:.{1,40} )?down|pin(?:s|ning)?)\b/i,
  ambush: /\b(?:seiz(?:es|ing)|drag(?:s|ging)? (?:.{1,40} )?down)\b/i,
  grapple: /\b(?:wrestl(?:es|ing) (?:.{1,40} )?down|hold(?:s|ing)?)\b/i,
  bluff: /\boverpowers?\b.*\bdrives?\b.*\bback\b/i,
  sustained: /\b(?:presses?|overpowers?|holds?)\b/i,
};

/** Conservative choreography checks, scoped to the newly approved finish climax. */
export function climaxChecks(
  text: string, result: MatchupResult, a: Animal, b: Animal,
  mode: EngineContext["mode"], environment: Environment,
): FailureCheck[] {
  const messages: string[] = [];
  if (text.split(/\s+/).length >= 25) messages.push("Climax must be under 25 words.");
  if (!/^[^.!?\n]+[.!?]$/.test(text)) messages.push("Climax must be exactly one sentence.");
  if (number.test(text)) messages.push("Climax must contain no numbers.");
  if (reason.test(text)) messages.push("Climax must not give reasons for the outcome.");
  if (gore.test(text)) messages.push("Climax must contain no gore.");
  if (mode === "realistic" && death.test(text)) messages.push("In the wild the climax must contain no death.");
  if (notPresent.test(text)) messages.push("Climax must use present tense.");
  if (result.outcome.kind === "even") {
    const namesBoth = a.name !== b.name && text.includes(a.name) && text.includes(b.name);
    if ((!/\bboth\b/i.test(text) && !namesBoth) || !/\bbreak(?:s)? (?:off|away|apart)\b/i.test(text) ||
      !/\bneither\b.*\b(?:giving|gives?|yielding|yields?) ground\b/i.test(text)) {
      messages.push("Even climax must show both breaking off with neither giving ground.");
    }
  } else if (result.outcome.kind === "favored") {
    const winner = result.outcome.animal;
    const favored = winner === a.name ? a : b;
    const other = winner === a.name ? b : a;
    if (!text.includes(winner) || !text.includes(other.name)) messages.push("Name both animals in the climax.");
    if (isEnvironmental(result)) {
      if (!new RegExp(`${escape(other.name)}\\b[^.!?]*\\b(?:can't|cannot|is unable to) (?:fight|continue|function)\\b`, "i").test(text) ||
        !text.toLowerCase().includes(environment.replaceAll("_", " "))) {
        messages.push("Environmental climax must show the other animal unable to fight in the selected setting.");
      }
    } else {
      const actor = new RegExp(`${escape(winner)}\\s+(?:\\w+ly\\s+)?(?:charges?|drives?|rams?|knocks?|pins?|seizes?|drags?|wrestles?|holds?|overpowers?|presses?)\\b`, "i");
      if (!actor.test(text)) messages.push("The favored animal must perform the conclusive action.");
      if (mode === "realistic") {
        if (!/\bdrives?\b.*\b(?:off|back|away)\b/i.test(text) ||
          !new RegExp(`${escape(other.name)}\\b[^.!?]*\\b(?:retreats?|breaks? away)\\b`, "i").test(text)) {
          messages.push("In the wild the favored animal drives the other off, and the other retreats or breaks away hurt.");
        }
        if (/\bbreaks? away\b/i.test(text) && !/\bhurt\b/i.test(text)) messages.push("A breakaway must say hurt.");
      } else {
        if (/\b(?:retreat\w*|breaks? away|flees?|escapes?)\b/i.test(text)) messages.push("Arena favored climax allows no retreat.");
        if (!styles[favored.fighting_style].test(text)) messages.push(`Climax must fit ${favored.fighting_style} fighting style.`);
        if (!new RegExp(`${escape(other.name)}\\b[^.!?]*\\b(?:can't|cannot|is unable to) continue\\b`, "i").test(text)) {
          messages.push("Arena favored climax must end with the other animal unable to continue.");
        }
      }
    }
  }
  return messages.length ? [{
    check: "text_consistency", path: ["climax"], text,
    issues: messages.map(message => ({ path: ["climax"], message })),
  }] : [];
}
