import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReadableFact } from "./readable-fact";

describe("ReadableFact", () => {
  it("renders a scored comparison as readable text", () => {
    const fact = "Size: Hippopotamus 1500 kg vs Lion 190 kg; Hippo outweighs Lion.";
    const { container } = render(<ReadableFact fact={fact} />);
    expect(container.textContent).toBe(fact);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("renders a source URL as a safe link instead of a raw tier wrapper", () => {
    const { container } = render(<ReadableFact fact="Lion.mass_kg = 190 [tier 3; https://en.wikipedia.org/wiki/Lion]" />);
    expect(screen.getByRole("link", { name: "Source (en.wikipedia.org)" })).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Lion");
    expect(screen.getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
    expect(container.textContent).not.toContain("[tier");
    expect(container.textContent).not.toContain("https://");
  });
  it.each(["javascript:alert(1)", "A printed scientific reference"])("never invents a link for %s", (reference) => {
    render(<ReadableFact fact={`Lion.mass_kg = 190 [tier 3; ${reference}]`} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(`Source: ${reference}`)).toBeInTheDocument();
  });
});
