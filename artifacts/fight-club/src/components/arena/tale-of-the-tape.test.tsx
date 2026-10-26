import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { expect, it } from "vitest";
import { TaleOfTheTape } from "./tale-of-the-tape";
import { animals, resultFixture } from "@/test/fixtures";

it("shows the Komodo slashing and venom caveat without changing the result", () => {
  const red = { ...animals[0]!, name: "Komodo dragon", mass_kg: 66, bite_force_n: 149,
    bite_point: "front_teeth" as const };
  const blue = { ...animals[1]!, name: "Gorilla", mass_kg: 168 };
  const result = { ...resultFixture({ kind: "favored", animal: "Gorilla" }),
    advantage_score: -1, factors: [{ name: "Bite force", value: 0, reason: "Not compared: different teeth." }] };
  render(<TaleOfTheTape red={red} blue={blue} result={result}
    sel={{ a: red.name, b: blue.name, environment: "land", mode: "forced_fight" }} onShowMath={() => {}} />);
  fireEvent.click(screen.getByTestId("button-expand-bite"));
  expect(screen.getByTestId("text-komodo-bite")).toHaveTextContent(
    "A weak bite; Komodo dragons kill by slashing and venom, which the engine doesn't model.");
  expect(screen.getByTestId("label-tape-bite")).toHaveTextContent("Not compared");
});
