import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import defaultHtml from "../../index.html?raw";
import { fightTitle, shareFightUrl, SITE_DESCRIPTION, SITE_TITLE } from "./site-metadata";
import { renderSharePage } from "../../share-pages";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import NotFound from "@/pages/not-found";

afterEach(cleanup);
const selection = { a: "Hippopotamus", b: "Lion", environment: "land", mode: "forced_fight" } as const;

describe("launch metadata and navigation", () => {
  it("sets the requested defaults in HTML before JavaScript loads", () => {
    const html = defaultHtml;
    expect(html).toContain(`<title>${SITE_TITLE}</title>`);
    expect(html).toContain(`name="description" content="${SITE_DESCRIPTION}"`);
    expect(html).toContain('property="og:image" content="%BASE_URL%og-image.png"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(html).toContain('href="%BASE_URL%favicon.svg"');
  });

  it("shares base-aware, crawlable bout links while preserving selections and mode", () => {
    const url = new URL(shareFightUrl({ ...selection, mode: "realistic" }, "https://example.test", "/arena/"));
    expect(url.pathname).toBe("/arena/share/hippopotamus-vs-lion-land.html");
    expect(Object.fromEntries(url.searchParams)).toEqual({ ...selection, mode: "realistic" });
    const html = renderSharePage(selection, "/arena/");
    expect(html).toContain("<title>Hippopotamus vs Lion · Open Savannah · Animosity</title>");
    expect(html).toContain('property="og:title" content="Hippopotamus vs Lion · Open Savannah · Animosity"');
    expect(html).toContain('property="og:image" content="/arena/og-image.png"');
    expect(html).toContain("location.replace(u.href)");
    expect(html).toContain('get("mode")==="realistic"');
    expect(html).toContain("a=Hippopotamus&amp;b=Lion&amp;environment=land&amp;mode=forced_fight");
  });

  it("uses human arena names for all terrains, including mirror matches", () => {
    expect(fightTitle({ ...selection, environment: "shallow_water" })).toContain("Riverbank Shallows");
    expect(fightTitle({ ...selection, environment: "deep_water" })).toContain("Open Ocean");
    expect(fightTitle({ ...selection, a: "Lion" })).toBe("Lion vs Lion · Open Savannah · Animosity");
  });

  it("updates tab and social titles and restores prior metadata on unmount", () => {
    document.title = SITE_TITLE;
    function Probe({ title }: { title: string }) { usePageMetadata(title); return null; }
    const view = render(<Probe title={fightTitle(selection)} />);
    expect(document.title).toBe(fightTitle(selection));
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(fightTitle(selection));
    view.rerender(<Probe title={SITE_TITLE} />);
    expect(document.title).toBe(SITE_TITLE);
    view.unmount();
    expect(document.title).toBe(SITE_TITLE);
  });

  it("provides a friendly themed 404 with a base-aware route to the picker", () => {
    const { hook } = memoryLocation({ path: "/arena/missing" });
    render(<Router base="/arena" hook={hook}><NotFound /></Router>);
    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "This gate leads nowhere" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the arena" })).toHaveAttribute("href", "/arena/");
    expect(document.title).toBe("Page not found · Animosity");
  });
});
