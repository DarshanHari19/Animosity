import type { MatchupResult } from "@workspace/api-client-react";

function outcomeLabel(outcome: MatchupResult["outcome"]): string {
  switch (outcome.kind) {
    case "favored": return `${outcome.animal} favored`;
    case "even": return "Even matchup";
    case "indeterminate": return "Indeterminate";
    case "no_contest": return "No contest";
    case "no_engagement": return outcome.animals.length === 2
      ? "No fight: both animals back off"
      : `No fight: ${outcome.animals[0]} backs off`;
  }
}

export function MatchupResultCard({ result, explanation }: {
  result: MatchupResult; explanation: string | null;
}) {
  return (
    <div className="border p-3 space-y-1" data-testid="card-result">
      <p data-testid="text-outcome"><strong>{outcomeLabel(result.outcome)}</strong></p>
      <p data-testid="text-deciding-factor">Deciding factor: {result.deciding_factor?.replaceAll("_", " ") ?? "None"}</p>
      <p data-testid="text-evidence-quality">Evidence quality: {{
        mostly_higher_tier: "Mostly higher-tier sources",
        mixed: "Mixed sources",
        mostly_lower_tier_or_unknown: "Mostly lower-tier or unknown sources",
      }[result.evidence_quality]}</p>
      <p data-testid="text-encounter-label">Encounter: {result.encounter_label.replaceAll("_", " ")}</p>
      <p data-testid="text-profile-assumption">Assumes adult males</p>
      {explanation && <p data-testid="text-explanation">{explanation}</p>}
      {result.advantage_score !== null && (
        <p data-testid="text-scoring-scope">v1 scores body mass and, where comparable, bite force only.</p>
      )}
      {result.factors.length > 0 && <>
        <p>Factors:</p>
        <ul className="list-disc pl-5 text-sm">
          {result.factors.map((factor, i) => (
            <li key={i} data-testid={`text-factor-${i}`}>
              <strong>{factor.name}</strong> ({factor.value}): {factor.reason}
            </li>
          ))}
        </ul>
      </>}
    </div>
  );
}
