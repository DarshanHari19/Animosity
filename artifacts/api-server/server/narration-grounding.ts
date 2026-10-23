import type { Animal, Beat, Environment, MatchupResult } from "./schemas";
import type { EvidenceItem } from "./narration-evidence";
import { isEnvironmental } from "./narration-evidence";
import type { FailureCheck } from "./narration-diagnostics";
import { deterministicFinish } from "./narration-finish";

const causal = /\b(?:because|due to|thanks to|decid(?:e|es|ed|ing)|determin(?:e|es)|determined\s+(?:(?:the|this|that)\s+)?(?:fight|outcome|winner|matchup|result|victory|defeat|which|who|whether|by)|decisive|carried|carries|prevails?|wins?|winner|outcome|advantage|edge|favou?rs?|favou?red|offset|keeps)\b/i;
const physical = /\b(?:size|mass|weight|heavier|outweighs|bite|speed|strength|power|reach|length|physical|bulk)\b/i;
const advantage = /\b(?:advantage|edge|favou?rs?|favou?red|outweighs|heavier|stronger|faster|superior|offset)\b/i;
const negative = /\b(?:no|not|neither|without|never)\b/i;
const clauses = (text: string) => text.split(/[.!?;,]|\b(?:but|although|yet|while)\b/i);
const geographicEdge = /\b(?:water|river|shore|coast|bank|grass|field|lake|sea|stream)(?:['’]s)?\s+edge\b/gi;
const withoutGeographicEdge = (text: string) => text.replace(geographicEdge, "");
const hasCausalSignal = (text: string) => causal.test(
  // Continuing a physical movement is not itself a reason for the verdict;
  // nonFinishChecks separately rejects pressure that contradicts the outcome.
  withoutGeographicEdge(text).replace(/\bkeeps\s+(?=(?:pushing|pressing|driving)\b)/gi, ""),
);
const hasAdvantageSignal = (text: string) => advantage.test(withoutGeographicEdge(text));

/** Conservative English checks supplement the prompt; no scoring is done here. */
export function narrationGroundingChecks(
  beats: Beat[], result: MatchupResult, evidence: EvidenceItem[], a: Animal, b: Animal, environment: Environment = "land",
): FailureCheck[] {
  const failures: FailureCheck[] = [];
  const environmental = isEnvironmental(result);
  beats.forEach((beat, index) => {
    const messages: string[] = [];
    const cited = evidence.filter((item) => beat.facts_used.includes(item.text));
    const scored = cited.filter((item) => item.kind === "scored");
    const final = index === beats.length - 1;
    if (!environmental && cited.some((item) => item.kind === "gate")) {
      messages.push("Gate evidence is allowed only for an engine environmental outcome.");
    }
    if (final && result.outcome.kind === "favored") {
      if (environmental) {
        if (!cited.some((item) => item.kind === "gate") || scored.length) {
          messages.push("An environmental finish must cite the engine gate, not a scored factor.");
        }
        const serverTemplate = evidence.some(item => item.kind === "gate") &&
          beat.text.endsWith(deterministicFinish(result, a, b, evidence, environment).text) &&
          !physical.test(beat.text);
        if (!serverTemplate && (!/\benvironment(?:al)?\b/i.test(beat.text) ||
          !/\b(?:decid(?:e|es|ed|ing)|determin(?:e|es|ed)|decisive|because|due to)\b/i.test(beat.text) ||
          physical.test(beat.text))) {
          messages.push("The finish must say the environment decided the fight, without a physical advantage.");
        }
      } else if (!scored.length) messages.push("An ordinary favored finish must cite a scored engine factor.");
    }
    if (final && result.outcome.kind === "even" &&
      clauses(beat.text).some((clause) => hasAdvantageSignal(clause) && !negative.test(clause))) {
      messages.push("An even finish may not credit any advantage.");
    }
    for (const clause of clauses(beat.text)) {
      if (!hasCausalSignal(clause) || negative.test(clause)) continue;
      if (!scored.length && !cited.some((item) => environmental && item.kind === "gate")) {
        messages.push("Context evidence is description only, not a reason for the outcome.");
        break;
      }
      const scoredNames = scored.map((item) => item.factor_name);
      const environmentHandicap = scoredNames.includes("Environment") &&
        /\b(?:environment|hampered|footing)\b/i.test(clause);
      if (/\b(?:length|reach|strength|style|bluff|strike|armor|hide|claws|horns|tusks)\b/i.test(clause) ||
        (/\b(?:speed|grappling)\b/i.test(clause) && !environmentHandicap) ||
        (/\bbite\b/i.test(clause) && !scoredNames.includes("Bite force"))) {
        messages.push("An unscored trait is presented as a reason for the outcome.");
        break;
      }
    }
    if (messages.length) {
      const path = ["beats", index, "text"];
      failures.push({ check: "causal_grounding", path, text: beat.text,
        issues: messages.map((message) => ({ path, message })) });
    }
  });
  return failures;
}
