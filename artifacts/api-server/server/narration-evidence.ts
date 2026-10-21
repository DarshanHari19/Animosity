import type { Animal, MatchupResult } from "./schemas";

export type EvidenceItem = { id: string; text: string; kind: "scored" | "context" | "gate" };
export const isEnvironmental = (result: MatchupResult) =>
  result.outcome.kind === "favored" && result.deciding_factor === "environmental_advantage";

/** Interpret the engine's explicit "Not compared" marker, never recalculate scores. */
export function narrationEvidence(result: MatchupResult, a: Animal, b: Animal): EvidenceItem[] {
  const environmental = isEnvironmental(result);
  const ran = result.factors.filter((factor) =>
    !(factor.name === "Bite force" && factor.reason.startsWith("Not compared:")));
  const comparableBites = !environmental && ran.some((factor) => factor.name === "Bite force");
  const items: Omit<EvidenceItem, "id">[] = environmental ? [{
    kind: "gate",
    // Only fields returned by the engine, never an invented score or trait claim.
    text: JSON.stringify({ outcome: result.outcome, deciding_factor: result.deciding_factor }),
  }] : ran.map((factor) => ({ kind: "scored", text: JSON.stringify(factor) }));
  for (const animal of [a, b]) {
    for (const [key, value] of Object.entries(animal)) {
      const source = animal.field_sources[key];
      if (key === "field_sources" || key === "functions_in" ||
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
