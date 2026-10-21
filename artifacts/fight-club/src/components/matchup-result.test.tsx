import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MatchupResult } from "@workspace/api-client-react";
import { MatchupResultCard } from "./matchup-result";
import { resultFixture } from "../test/fixtures";

describe("MatchupResultCard", () => {
  it("renders the exact field order, adult-male assumption, explanation and ordered factors", () => {
    render(<MatchupResultCard result={resultFixture()} explanation="Fixture explanation." />);
    const card = screen.getByTestId("card-result");
    expect(Array.from(card.children, (child) => child.textContent)).toEqual([
      "Lion favored",
      "Deciding factor: environmental advantage",
      "Evidence quality: Mostly lower-tier or unknown sources",
      "Encounter: ranges overlap",
      "Assumes adult males",
      "Fixture explanation.",
      "Factors:",
      "Fixture factor (1): Fictional fixture reason only.Second fixture (-1): Another fictional reason.",
    ]);
    expect(Array.from(card.children, (child) => child.getAttribute("data-testid"))).toEqual([
      "text-outcome", "text-deciding-factor", "text-evidence-quality",
      "text-encounter-label", "text-profile-assumption", "text-explanation", null, null,
    ]);
    expect(screen.getByTestId("text-factor-0")).toHaveTextContent(
      "Fixture factor (1): Fictional fixture reason only.",
    );
    expect(screen.getByTestId("text-factor-1")).toHaveTextContent(
      "Second fixture (-1): Another fictional reason.",
    );
  });

  const outcomes: [MatchupResult["outcome"], string][] = [
    [{ kind: "favored", animal: "Grizzly bear" }, "Grizzly bear favored"],
    [{ kind: "even" }, "Even matchup"],
    [{ kind: "indeterminate" }, "Indeterminate"],
    [{ kind: "no_contest" }, "No contest"],
    [{ kind: "no_engagement", animals: ["Gorilla"] }, "No fight: Gorilla backs off"],
    [{ kind: "no_engagement", animals: ["Lion", "Grizzly bear"] }, "No fight: both animals back off"],
  ];
  it.each(outcomes)("labels %j without probabilities or a substitute winner", (outcome, label) => {
    render(<MatchupResultCard result={resultFixture(outcome)} explanation={null} />);
    expect(screen.getByTestId("text-outcome")).toHaveTextContent(label);
    expect(screen.getByTestId("text-profile-assumption").textContent).toBe("Assumes adult males");
    expect(screen.queryByTestId("text-explanation")).not.toBeInTheDocument();
  });

  it("shows None for a null deciding factor and omits an empty factors section", () => {
    const result = {
      ...resultFixture({ kind: "even" }),
      deciding_factor: null,
      evidence_quality: "mixed" as const,
      encounter_label: "hypothetical" as const,
      factors: [],
    };
    render(<MatchupResultCard result={result} explanation={null} />);
    expect(Array.from(screen.getByTestId("card-result").children, (child) => child.textContent)).toEqual([
      "Even matchup", "Deciding factor: None", "Evidence quality: Mixed sources",
      "Encounter: hypothetical", "Assumes adult males",
    ]);
    expect(screen.queryByText("Factors:")).not.toBeInTheDocument();
  });
});
