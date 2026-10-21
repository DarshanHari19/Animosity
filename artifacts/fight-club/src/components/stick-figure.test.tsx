import { render, screen } from "@testing-library/react";
import type { BeatAction } from "@workspace/api-client-react";
import { describe, expect, it } from "vitest";
import { StickFigure } from "./stick-figure";

// Explicit, test-only SVG expectations, independent of the pose implementation.
const idleArms = "M-14 0 L0 -8 L14 0";
const idleLegs = "M-10 40 L0 15 L10 40";
const mouthPath = "M6 -24 L14 -22 L6 -20";
type Side = "left" | "right";
type ExpectedPose = {
  left: string;
  right: string;
  arms: string;
  legs: string;
  mouth?: boolean;
};
const neutral: ExpectedPose = {
  left: "translate(90 100) scale(1 1) rotate(0)",
  right: "translate(230 100) scale(-1 1) rotate(0)",
  arms: idleArms,
  legs: idleLegs,
};
const recoil: ExpectedPose = {
  left: "translate(80 100) scale(1 1) rotate(-15)",
  right: "translate(240 100) scale(-1 1) rotate(-15)",
  arms: idleArms,
  legs: idleLegs,
};
const poses = [
  {
    action: "approach",
    actor: {
      left: "translate(110 100) scale(1 1) rotate(0)",
      right: "translate(210 100) scale(-1 1) rotate(0)",
      arms: idleArms,
      legs: "M-12 40 L0 15 L14 38",
    },
    nonActor: neutral,
  },
  {
    action: "charge",
    actor: {
      left: "translate(135 100) scale(1 1) rotate(25)",
      right: "translate(185 100) scale(-1 1) rotate(25)",
      arms: "M0 -8 L20 -4 L30 -6",
      legs: "M-18 36 L0 15 L16 40",
    },
    nonActor: recoil,
  },
  {
    action: "bite",
    actor: {
      left: "translate(145 100) scale(1 1) rotate(15)",
      right: "translate(175 100) scale(-1 1) rotate(15)",
      arms: "M-12 4 L0 -8 L12 4",
      legs: idleLegs,
      mouth: true,
    },
    nonActor: recoil,
  },
  {
    action: "dodge",
    actor: {
      left: "translate(70 100) scale(1 1) rotate(-25)",
      right: "translate(250 100) scale(-1 1) rotate(-25)",
      arms: "M-18 -14 L0 -8 L10 4",
      legs: "M-14 40 L0 15 L4 40",
    },
    nonActor: neutral,
  },
  {
    action: "grapple",
    actor: {
      left: "translate(130 100) scale(1 1) rotate(10)",
      right: "translate(190 100) scale(-1 1) rotate(10)",
      arms: "M0 -8 L22 -14 L30 -6",
      legs: "M-14 40 L0 15 L12 40",
    },
    nonActor: {
      left: "translate(115 100) scale(1 1) rotate(0)",
      right: "translate(205 100) scale(-1 1) rotate(0)",
      arms: "M0 -8 L18 -12 L26 -4",
      legs: idleLegs,
    },
  },
  {
    action: "retreat",
    actor: {
      left: "translate(60 100) scale(1 1) rotate(-10)",
      right: "translate(260 100) scale(-1 1) rotate(-10)",
      arms: "M-16 6 L0 -8 L-4 8",
      legs: "M-16 38 L0 15 L6 40",
    },
    nonActor: neutral,
  },
] satisfies {
  action: Exclude<BeatAction, "finish">;
  actor: ExpectedPose;
  nonActor: ExpectedPose;
}[];

function figure(side: Side, action: BeatAction | null, isActor: boolean) {
  return (
    <svg>
      <StickFigure side={side} label="Fixture animal" action={action} isActor={isActor} />
    </svg>
  );
}

function expectFigure(side: Side, isActor: boolean, expected: ExpectedPose) {
  const group = screen.getByTestId(`figure-${side}`);
  const body = group.querySelector("g")!;
  expect(body).toHaveAttribute("transform", expected[side]);
  // Exact paths also catch a missing mouth, an extra mouth, or swapped limbs.
  expect(Array.from(body.querySelectorAll("path"), (path) => path.getAttribute("d"))).toEqual(
    expected.mouth
      ? [mouthPath, expected.arms, expected.legs]
      : [expected.arms, expected.legs],
  );
  expect(body.querySelectorAll("circle")).toHaveLength(1);
  expect(body.querySelector("circle")).toHaveAttribute("cx", "0");
  expect(body.querySelector("circle")).toHaveAttribute("cy", "-25");
  expect(body.querySelector("circle")).toHaveAttribute("r", "10");
  expect(body.querySelectorAll("line")).toHaveLength(1);
  const torso = body.querySelector("line");
  expect(torso).toHaveAttribute("x1", "0");
  expect(torso).toHaveAttribute("y1", "-15");
  expect(torso).toHaveAttribute("x2", "0");
  expect(torso).toHaveAttribute("y2", "15");

  // Labels stay outside the mirrored/moving body, at each side's fixed anchor.
  const label = group.querySelector(":scope > text");
  expect(label?.textContent).toBe("Fixture animal");
  expect(label).toHaveAttribute("x", side === "left" ? "90" : "230");
  expect(label).toHaveAttribute("y", "175");
  expect(label).toHaveAttribute("text-anchor", "middle");
  expect(label).toHaveAttribute("font-weight", isActor ? "700" : "400");
  expect(label).not.toHaveAttribute("transform");
}

describe.each(["left", "right"] as const)("StickFigure on the %s", (side) => {
  describe.each([
    { role: "actor", isActor: true },
    { role: "non-actor", isActor: false },
  ])("$role", ({ isActor }) => {
    it.each(poses)("renders $action geometry and label", ({ action, actor, nonActor }) => {
      render(figure(side, action, isActor));
      expectFigure(side, isActor, isActor ? actor : nonActor);
    });

    it("falls back to the upright neutral pose when action is null", () => {
      render(figure(side, null, isActor));
      expectFigure(side, isActor, neutral);
    });
  });

  it("removes the bite mouth when the actor changes, then resets to neutral", () => {
    const view = render(figure(side, "bite", true));
    view.rerender(figure(side, "bite", false));
    expectFigure(side, false, recoil);
    view.rerender(figure(side, null, true));
    expectFigure(side, true, neutral);
  });

  it("removes the bite mouth on the next non-bite action", () => {
    const view = render(figure(side, "bite", true));
    view.rerender(figure(side, "approach", true));
    expectFigure(side, true, poses[0].actor);
  });
});
