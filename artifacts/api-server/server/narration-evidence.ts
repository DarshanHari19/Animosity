import type { Animal, Environment, MatchupResult } from "./schemas";
import { environmentPhrase, humanWording } from "./wording";

export type EvidenceItem = {
  id: string; text: string; kind: "scored" | "context" | "gate";
  factor_name?: string;
};
export const isEnvironmental = (result: MatchupResult) =>
  result.outcome.kind === "favored" && result.deciding_factor === "environmental_advantage";

/** Presentation only: preserve the engine's reason, never recalculate a score. */
export function scoredFactorText(factor: MatchupResult["factors"][number], a: Animal, b: Animal): string {
  const values = factor.name === "Size"
    ? `${a.name} ${a.mass_kg} kg vs ${b.name} ${b.mass_kg} kg; `
    : factor.name === "Bite force"
      ? `${a.name} ${a.bite_force_n} N vs ${b.name} ${b.bite_force_n} N; ` : "";
  return `${factor.name}: ${values}${humanWording(factor.reason)}`;
}

/** Interpret the engine's explicit "Not compared" marker, never recalculate scores. */
export function narrationEvidence(result: MatchupResult, a: Animal, b: Animal, environment: Environment = "land"): EvidenceItem[] {
  const environmental = isEnvironmental(result);
  const ran = result.factors.filter((factor) =>
    !(factor.name === "Bite force" && factor.reason.startsWith("Not compared:")));
  const comparableBites = !environmental && ran.some((factor) => factor.name === "Bite force");
  const items: Omit<EvidenceItem, "id">[] = environmental ? [{
    kind: "gate",
    // Only fields returned by the engine, never an invented score or trait claim.
    text: `Environment: ${result.outcome.kind === "favored" && result.outcome.animal === a.name ? b.name : a.name} can't function ${environmentPhrase(environment)}.`,
  }] : ran.map((factor) => ({
    kind: "scored", factor_name: factor.name, text: scoredFactorText(factor, a, b),
  }));
  for (const animal of [a, b]) {
    for (const [key, value] of Object.entries(animal)) {
      const source = animal.field_sources[key];
      if (key === "field_sources" || key === "environments" ||
        (key === "bite_force_n" && !comparableBites) ||
        value === null || value === 0 || !source || source.tier === null ||
        !source.ref.trim() || /\bTODO\b/i.test(source.ref)) continue;
      items.push({
        kind: "context",
        text: `${animal.name}.${key} = ${JSON.stringify(value)} [tier ${source.tier}; ${source.ref}]`,
      });
    }
  }
  return items.map((item, index) => ({ id: `E${index + 1}`, ...item }));
}
