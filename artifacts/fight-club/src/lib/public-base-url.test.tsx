import { describe, expect, it } from "vitest";
import { absoluteUrl, parsePublicBaseUrl } from "./public-base-url";
import { renderSharePage, rewriteIndexHtml } from "../../share-pages";

describe("parsePublicBaseUrl", () => {
  it("treats unset and blank as relative mode", () => {
    expect(parsePublicBaseUrl(undefined)).toBeUndefined();
    expect(parsePublicBaseUrl("  ")).toBeUndefined();
  });
  it("accepts https origins and http loopback, dropping a trailing slash", () => {
    expect(parsePublicBaseUrl("https://staging.example.com")).toBe("https://staging.example.com");
    expect(parsePublicBaseUrl("https://staging.example.com/")).toBe("https://staging.example.com");
    expect(parsePublicBaseUrl("http://localhost:8080")).toBe("http://localhost:8080");
    expect(parsePublicBaseUrl("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
  });
  it.each([
    "http://example.com", "ftp://example.com", "example.com", "https://user:pw@example.com",
    "https://example.com/app", "https://example.com?x=1", "https://example.com/?", "https://example.com#top",
  ])("rejects %s", (value) => {
    expect(() => parsePublicBaseUrl(value)).toThrow(/PUBLIC_BASE_URL/);
  });
  it("joins origin and path", () => {
    expect(absoluteUrl("https://a.example", "/og-image.png")).toBe("https://a.example/og-image.png");
    expect(absoluteUrl(undefined, "/og-image.png")).toBe("/og-image.png");
  });
});

describe("renderSharePage URLs", () => {
  const selection = { a: "Lion", b: "Hippopotamus", environment: "land", mode: "forced_fight" } as const;
  it("stays relative without an origin and adds no og:url", () => {
    const html = renderSharePage(selection, "/");
    expect(html).toContain('property="og:image" content="/og-image.png"');
    expect(html).not.toContain("og:url");
    expect(html).not.toContain("canonical");
  });
  it("is absolute with an origin and adds og:url and canonical", () => {
    const html = renderSharePage(selection, "/", "https://staging.example.com");
    expect(html).toContain('property="og:image" content="https://staging.example.com/og-image.png"');
    expect(html).toContain('name="twitter:image" content="https://staging.example.com/og-image.png"');
    expect(html).toContain('property="og:url" content="https://staging.example.com/share/lion-vs-hippopotamus-land.html"');
    expect(html).toContain('rel="canonical" href="https://staging.example.com/share/lion-vs-hippopotamus-land.html"');
  });
});

describe("index.html transform", () => {
  const index = '<meta property="og:image" content="/og-image.png" /><meta name="twitter:image" content="/og-image.png" />';
  const run = (origin?: string) => rewriteIndexHtml(index, "/", origin);
  it("makes only the image URLs absolute, with no og:url or canonical (it serves every route)", () => {
    const html = run("https://staging.example.com");
    expect(html).toContain('content="https://staging.example.com/og-image.png"');
    expect(html).not.toContain("og:url");
    expect(html).not.toContain("canonical");
  });
  it("leaves index.html untouched without an origin", () => {
    expect(run()).toBe(index);
  });
});
