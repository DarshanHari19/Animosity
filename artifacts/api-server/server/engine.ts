import type { Animal, EngineContext, MatchupResult } from "./schemas";
import { FightError } from "./errors";

function tier(animal: Animal, field: string): number | null {
  return animal.field_sources[field]?.tier ?? null;
}

function requirePositive(animal: Animal, field: "mass_kg" | "bite_force_n"): void {
  const value = animal[field];
  if (value === null || !Number.isFinite(value) || value <= 0) {
    throw new FightError(
      "INVALID_SCORING_INPUT",
      `${animal.name}.${field} must be finite and greater than 0.`,
      400,
    );
  }
}

function evidenceQuality(tiers: Array<number | null>): MatchupResult["evidence_quality"] {
  const higher = tiers.filter((value) => value === 1 || value === 2).length;
  if (3 * higher >= 2 * tiers.length) return "mostly_higher_tier";
  if (3 * higher <= tiers.length) return "mostly_lower_tier_or_unknown";
  return "mixed";
}

function sizeReason(a: Animal, b: Animal): string {
  if (a.mass_kg === b.mass_kg) return `${a.name} and ${b.name} have equal supplied body mass.`;
  const [larger, smaller] = a.mass_kg > b.mass_kg ? [a, b] : [b, a];
  const ratio = larger.mass_kg / smaller.mass_kg;
  // Valid finite inputs can still overflow a quotient; do not print Infinity.
  return Number.isFinite(ratio)
    ? `${larger.name} outweighs ${smaller.name} about ${ratio.toFixed(1)} to 1.`
    : `${larger.name} outweighs ${smaller.name}; supplied masses are ${larger.mass_kg} kg and ${smaller.mass_kg} kg.`;
}

export function scoreMatchup(
  a: Animal,
  b: Animal,
  { environment, mode }: EngineContext,
): MatchupResult {
  // Step 0 intentionally precedes all gates, even for unusable environments.
  requirePositive(a, "mass_kg");
  requirePositive(b, "mass_kg");
  const biteTierA = tier(a, "bite_force_n");
  const biteTierB = tier(b, "bite_force_n");
  const comparableSources = a.bite_force_n !== null && b.bite_force_n !== null &&
    biteTierA !== null && biteTierB !== null && biteTierA === biteTierB;
  const compareBites = comparableSources && a.bite_point != null &&
    a.bite_point === b.bite_point;
  if (compareBites) {
    requirePositive(a, "bite_force_n");
    requirePositive(b, "bite_force_n");
  }

  const consulted = [tier(a, "environments"), tier(b, "environments")];
  const finish = (
    outcome: MatchupResult["outcome"],
    deciding_factor: MatchupResult["deciding_factor"],
    advantage_score: number | null = null,
    factors: MatchupResult["factors"] = [],
  ): MatchupResult => ({
    outcome, deciding_factor, advantage_score, factors,
    evidence_quality: evidenceQuality(consulted), encounter_label: "hypothetical",
  });

  // Step 1: Cannot levels gate regardless of their source tier.
  const aLevel = a.environments[environment];
  const bLevel = b.environments[environment];
  const aFunctions = aLevel !== "cannot";
  const bFunctions = bLevel !== "cannot";
  if (!aFunctions && !bFunctions) return finish({ kind: "indeterminate" }, null);
  if (!aFunctions || !bFunctions) {
    return mode === "realistic"
      ? finish({ kind: "no_contest" }, null)
      : finish({ kind: "favored", animal: aFunctions ? a.name : b.name }, "environmental_advantage");
  }

  // Step 2: Behavior only gates realistic encounters.
  if (mode === "realistic") {
    for (const animal of [a, b]) {
      consulted.push(tier(animal, "temperament"), tier(animal, "fighting_style"));
    }
    const reluctant = (animal: Animal) =>
      animal.temperament === "avoids" || animal.fighting_style === "bluff";
    const aBacksOff = reluctant(a) && b.temperament !== "aggressive";
    const bBacksOff = reluctant(b) && a.temperament !== "aggressive";
    if (aBacksOff || bBacksOff) {
      return finish({
        kind: "no_engagement",
        animals: [...(aBacksOff ? [a.name] : []), ...(bBacksOff ? [b.name] : [])],
      }, "behavior");
    }
  }

  // Steps 3–4: Mass, comparable bites and the specified environment handicap.
  consulted.push(tier(a, "mass_kg"), tier(b, "mass_kg"));
  const factors: MatchupResult["factors"] = [{
    name: "Size",
    value: 0.8 * (Math.log2(a.mass_kg) - Math.log2(b.mass_kg)),
    reason: sizeReason(a, b),
  }, {
    name: "Bite force",
    value: 0,
    reason: comparableSources
      ? "Not compared: bite points are unknown or differ."
      : "Not compared: bite-force values are missing or have different source tiers.",
  }];
  if (compareBites) {
    consulted.push(biteTierA, biteTierB);
    factors[1] = {
      name: "Bite force",
      value: 0.5 * (Math.log2(a.bite_force_n!) - Math.log2(b.bite_force_n!)),
      reason: `${a.name}: ${a.bite_force_n} N; ${b.name}: ${b.bite_force_n} N. Bite point: ${a.bite_point}. Matching source tiers and bite points do not guarantee matching measurement methods; this compares bites to bites, not bites against defenses.`,
    };
  }
  if (aLevel === "hampered" || bLevel === "hampered") {
    factors.push({
      name: "Environment",
      value: (aLevel === "hampered" ? -0.8 : 0) + (bLevel === "hampered" ? 0.8 : 0),
      reason: [a, b].filter(animal => animal.environments[environment] === "hampered")
        .map(animal => `${animal.name} is hampered in ${environment}: footing, speed, and grappling suffer.`).join(" "),
    });
  }
  const advantage = factors.reduce((sum, factor) => sum + factor.value, 0);
  // With bite excluded, a roughly 1.54x mass advantage reaches the favored cutoff.
  if (advantage >= 0.5) return finish({ kind: "favored", animal: a.name }, "fighting_ability", advantage, factors);
  if (advantage <= -0.5) return finish({ kind: "favored", animal: b.name }, "fighting_ability", advantage, factors);
  return finish({ kind: "even" }, null, advantage, factors);
}
