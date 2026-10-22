import type { Animal, Beat, Environment, MatchupResult } from "./schemas";
import { FightError } from "./errors";
import { isEnvironmental, type EvidenceItem } from "./narration-evidence";

/** Presentation of the engine verdict only. Never infer or recalculate a winner. */
export function deterministicFinish(
  result: MatchupResult, a: Animal, b: Animal, evidence: EvidenceItem[], environment: Environment = "land",
): Beat {
  if (result.outcome.kind !== "favored" && result.outcome.kind !== "even") {
    throw new FightError("NARRATION_NOT_APPLICABLE", "This outcome does not have a narrated finish.", 502);
  }
  if (isEnvironmental(result) && result.outcome.kind === "favored") {
    const winner = result.outcome.animal;
    const other = winner === a.name ? b.name : a.name;
    const gate = evidence.find(({ kind }) => kind === "gate");
    if (!gate) throw new FightError("INVALID_NARRATION", "Environmental outcome evidence is missing.", 502);
    return {
      text: `The ${winner} is favored: the ${other} can't function in ${environment.replaceAll("_", " ")}.`,
      action: "finish", animal: winner, facts_used: [gate.text],
    };
  }
  const size = evidence.find(({ kind, factor_name }) => kind === "scored" && factor_name === "Size");
  const bite = evidence.find(({ kind, factor_name }) => kind === "scored" && factor_name === "Bite force");
  if (!size) throw new FightError("INVALID_NARRATION", "Scored size evidence is missing.", 502);
  const facts_used = [size.text, ...(bite ? [bite.text] : [])];
  const winner = result.outcome.kind === "favored" ? result.outcome.animal : null;
  const [favored, other] = winner === b.name ? [b, a] : [a, b];
  // Rephrase the engine's comparison, never recalculate its ratio or score.
  const reason = result.factors.find(f => f.name === "Size")!.reason;
  const ratio = reason.match(/\babout ([\d.]+) to 1\.$/)?.[1];
  const comparison = ratio
    ? favored.mass_kg >= other.mass_kg
      ? `it outweighs the ${other.name} about ${ratio} to 1 (${favored.mass_kg} kg vs ${other.mass_kg} kg).`
      : `the ${other.name} outweighs it about ${ratio} to 1 (${other.mass_kg} kg vs ${favored.mass_kg} kg).`
    : `body masses are ${favored.mass_kg} kg vs ${other.mass_kg} kg.`;
  const biteComparison = bite
    ? ` Comparable bite force: the ${a.name} ${a.bite_force_n} N vs the ${b.name} ${b.bite_force_n} N.`
    : "";
  return result.outcome.kind === "even" ? {
    text: "Too close to call. Body mass and comparable bite force don't separate these two.",
    action: "finish", animal: null, facts_used,
  } : {
    text: `The ${winner} is favored: ${comparison}${biteComparison}`,
    action: "finish", animal: result.outcome.animal, facts_used,
  };
}
