import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cubeRootScale, edgeSide, readFact, readSelectionFromUrl, selectionSearch, signed, skipsBout } from "./arena";
import { AnimalFigure, bodyTypeFor } from "@/components/arena/animal-figure";
import { responseFixture } from "@/test/fixtures";

describe("arena helpers", () => {
  it("scales by the cube root of relative mass", () => {
    const [h, l] = cubeRootScale(1500, 190);
    expect(h).toBe(1);
    expect(l).toBeCloseTo(Math.cbrt(190 / 1500), 10);
    expect(h / l).toBeCloseTo(1.99, 2);
    expect(cubeRootScale(8, 1)).toEqual([1, 0.5]);
    expect(cubeRootScale(0, 100)).toEqual([1, 1]);
  });

  it("assigns EDGE from the scored factor sign relative to red, never on even or unscored", () => {
    const favored = { kind: "favored", animal: "X" } as const;
    expect(edgeSide({ name: "Size", value: 2, reason: "r" }, favored)).toBe("red");
    expect(edgeSide({ name: "Size", value: -0.3, reason: "r" }, favored)).toBe("blue");
    expect(edgeSide({ name: "Size", value: 0, reason: "r" }, favored)).toBeNull();
    expect(edgeSide({ name: "Size", value: 2, reason: "r" }, { kind: "even" })).toBeNull();
    expect(edgeSide({ name: "Bite force", value: 0, reason: "Not compared: x" }, favored)).toBeNull();
    expect(edgeSide(undefined, favored)).toBeNull();
  });

  it("rounds signed values to two decimals", () => {
    expect(signed(2.3847129416418364)).toBe("+2.38");
    expect(signed(-0.8)).toBe("\u22120.80");
    expect(signed(0.001)).toBe("0");
  });

  it("round-trips selections and rejects unknown enums", () => {
    const sel = { a: "Grizzly bear", b: "Lion", environment: "deep_water", mode: "realistic" } as const;
    expect(readSelectionFromUrl(selectionSearch(sel))).toEqual(sel);
    expect(readSelectionFromUrl("?a=Lion&environment=lava&mode=x")).toEqual({ a: "Lion" });
  });

  it("reads trait facts with real links only", () => {
    expect(readFact("Lion.mass_kg = 190 [tier 3; https://en.wikipedia.org/wiki/Lion]")).toMatchObject({
      text: "Lion weight, 190 kg", links: [{ href: "https://en.wikipedia.org/wiki/Lion", label: "Wikipedia" }],
    });
    expect(readFact("Lion.bite_force_n = 5500 [tier 2; Wroe et al. 2008]")).toMatchObject({ links: [], note: "Wroe et al. 2008" });
    expect(readFact("Lion.mass_kg = 1 [tier 3; javascript:alert(1)]").links).toEqual([]);
  });

  it("skips the bout only for gated outcomes or beat-less non-narrated results", () => {
    expect(skipsBout(responseFixture({ kind: "no_contest" }))).toBe(true);
    expect(skipsBout(responseFixture())).toBe(false);
    expect(skipsBout({ ...responseFixture(), beats: [], narration_status: "unavailable" })).toBe(false);
  });

  it("draws six original body types, with a horn only for the rhinoceros", () => {
    const names = ["Lion", "Grizzly bear", "Gorilla", "Hippopotamus", "Rhinoceros", "Saltwater crocodile", "Great white shark"];
    expect(names.map((name) => bodyTypeFor({ name, primary_weapon: "bite" }).type))
      .toEqual(["cat", "bear", "ape", "heavy", "heavy", "reptile", "shark"]);
    const { container, unmount } = render(<AnimalFigure animal={{ name: "Rhinoceros", primary_weapon: "horns" }} />);
    expect(container.querySelector('[data-part="horn"]')).not.toBeNull();
    expect(screen.getByRole("img", { name: "Rhinoceros" })).toBeInTheDocument();
    unmount();
    const hippo = render(<AnimalFigure animal={{ name: "Hippopotamus", primary_weapon: "bite" }} />);
    expect(hippo.container.querySelector('[data-part="horn"]')).toBeNull();
  });
});
