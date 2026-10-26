import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import HowItWorks, { HOW_DESCRIPTION, HOW_TITLE } from "./how-it-works";
import { PickerStage } from "@/components/arena/picker-stage";

describe("How it works page", () => {
  it("renders key content and sets then restores metadata", () => {
    document.title = "Before";
    render(<HowItWorks />);
    expect(document.title).toBe(HOW_TITLE);
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(HOW_DESCRIPTION);
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(HOW_TITLE);
    expect(screen.getByTestId("text-example-formula").textContent).toContain("1354 / 188");
    expect(screen.getByTestId("text-example-result").textContent).toBe("Hippo favored");
    expect(screen.getByTestId("row-run-1").textContent).toContain("23.3%");
    expect(screen.getByTestId("row-run-7").textContent).toContain("0.0%");
    cleanup();
    expect(document.title).toBe("Before");
    expect(document.head.querySelector('meta[property="og:title"]')).toBeNull();
  });

  it("picker links to the page with base-aware hrefs", () => {
    const { hook } = memoryLocation({ path: "/" });
    render(
      <Router hook={hook} base="/app">
        <PickerStage list={[]} loading={false} error={null} onRetry={() => {}}
          sel={{ a: "", b: "", environment: "land", mode: "realistic" } as never} setSel={() => {}} onStart={() => {}} />
      </Router>,
    );
    expect(screen.getByTestId("link-how-it-works-page").getAttribute("href")).toBe("/app/how-it-works");
    expect(screen.getByTestId("link-how-it-works-details").getAttribute("href")).toBe("/app/how-it-works");
  });
});
