import type {
  Animal, Beat, FightResponse, MatchupResult,
} from "@workspace/api-client-react";

// Fictional test-only data. Never import this module into the app or scorer.
export const animals: Animal[] = ["Lion", "Grizzly bear"].map((name) => ({
  name,
  profile: "adult_male",
  mass_kg: 0,
  length_m: 0,
  top_speed_kmh: 0,
  primary_weapon: "bite",
  bite_force_n: null,
  bite_point: null,
  armor: "none",
  temperament: "defensive",
  fighting_style: "grapple",
  environments: { land: "full", shallow_water: "cannot", deep_water: "cannot" },
  field_sources: {},
}));

export function resultFixture(outcome: MatchupResult["outcome"] = {
  kind: "favored", animal: "Lion",
}): MatchupResult {
  return {
    outcome,
    deciding_factor: "environmental_advantage",
    evidence_quality: "mostly_lower_tier_or_unknown",
    encounter_label: "ranges_overlap",
    advantage_score: null,
    factors: [
      { name: "Fixture factor", value: 1, reason: "Fictional fixture reason only." },
      { name: "Second fixture", value: -1, reason: "Another fictional reason." },
    ],
  };
}

export function responseFixture(
  outcome: MatchupResult["outcome"] = { kind: "favored", animal: "Lion" },
): FightResponse {
  const result = resultFixture(outcome);
  if (outcome.kind === "indeterminate" || outcome.kind === "no_contest" || outcome.kind === "no_engagement") {
    return {
      result,
      beats: [],
      explanation: `${outcome.kind}: Fictional fixture reason only.`,
      narration_status: "not_required",
      narration_reason: null,
      narration_source: "model",
    };
  }
  const facts_used = [`${result.factors[0]!.name}: ${result.factors[0]!.reason}`];
  const actions: Beat["action"][] = ["approach", "charge", "dodge", "grapple", "finish"];
  return {
    result,
    beats: actions.map((action, i) => ({
      action,
      animal: action === "finish"
        ? outcome.kind === "favored" ? outcome.animal : null
        : i % 2 === 0 ? "Lion" : "Grizzly bear",
      text: `Fictional beat ${i + 1}.`,
      facts_used,
    })),
    explanation: null,
    narration_status: "available",
    narration_reason: null,
    narration_source: "model",
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}
