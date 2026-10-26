import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnimalFigure, bodyTypeFor } from "./animal-figure";

const fig = (name: string, primary_weapon = "bite") =>
  render(<AnimalFigure animal={{ name, primary_weapon } as never} testId="fig" />);

describe("animal figure variants", () => {
  it("maps new animals to explicit variants on compatible base types", () => {
    const cases: [string, string, string][] = [
      ["Tiger", "cat", "tiger"], ["Polar bear", "bear", "polar_bear"],
      ["African bush elephant", "heavy", "elephant"], ["Orca", "shark", "orca"], ["Komodo dragon", "reptile", "komodo"],
    ];
    for (const [name, type, variant] of cases) {
      const t = bodyTypeFor({ name, primary_weapon: "bite" });
      expect([name, t.type, t.variant]).toEqual([name, type, variant]);
      expect(t.horn).toBe(false);
    }
  });

  it("keeps the original seven figures variant-free", () => {
    for (const name of ["Lion", "Grizzly bear", "Gorilla", "Hippopotamus", "Rhinoceros", "Saltwater crocodile", "Great white shark"]) {
      expect(bodyTypeFor({ name, primary_weapon: "bite" }).variant).toBeNull();
      const { unmount } = fig(name);
      expect(screen.getByTestId("fig").getAttribute("data-variant")).toBeNull();
      unmount();
    }
  });

  it("renders distinguishing parts with accessible labels", () => {
    const checks: [string, string][] = [
      ["Tiger", "stripes"], ["African bush elephant", "trunk"], ["Orca", "dorsal-fin"], ["Komodo dragon", "tail"],
    ];
    for (const [name, part] of checks) {
      const { container, unmount } = fig(name);
      expect(screen.getByRole("img", { name })).toBeInTheDocument();
      expect(container.querySelector(`[data-part="${part}"]`)).not.toBeNull();
      expect(container.querySelector('[data-part="horn"]')).toBeNull();
      unmount();
    }
    const el = fig("African bush elephant", "tusks");
    expect(el.container.querySelector('[data-part="tusk"]')).not.toBeNull();
    el.unmount();
    const komodo = fig("Komodo dragon");
    expect(komodo.container.querySelector(".croc-tail")).not.toBeNull();
    komodo.unmount();
  });

  it("draws the polar bear with the bear body in white and darker komodo than crocodile", () => {
    const polar = bodyTypeFor({ name: "Polar bear", primary_weapon: "claws" });
    const grizzly = bodyTypeFor({ name: "Grizzly bear", primary_weapon: "claws" });
    expect(polar.palette.body).toBe("#F1EEE6");
    const { container, unmount } = fig("Polar bear");
    expect(container.querySelectorAll("circle, ellipse, rect").length)
      .toBe(render(<AnimalFigure animal={{ name: "Grizzly bear", primary_weapon: "claws" } as never} />).container.querySelectorAll("circle, ellipse, rect").length);
    expect(grizzly.palette.body).not.toBe(polar.palette.body);
    unmount();
    const lum = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    expect(lum(bodyTypeFor({ name: "Komodo dragon", primary_weapon: "bite" }).palette.body))
      .toBeLessThan(lum(bodyTypeFor({ name: "Saltwater crocodile", primary_weapon: "bite" }).palette.body));
  });

  it("mirrors new variants for the left-facing corner", () => {
    const { container } = render(<AnimalFigure animal={{ name: "Orca", primary_weapon: "bite" } as never} facing="left" />);
    expect(container.querySelector("svg > g")?.getAttribute("transform")).toBe("translate(240 0) scale(-1 1)");
  });
});
