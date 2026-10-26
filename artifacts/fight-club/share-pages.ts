import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { ARENA_NAMES, fightTitle, sharePageName, SITE_DESCRIPTION, type ShareSelection } from "./src/lib/site-metadata";

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]!));

/** Static share landing pages let social crawlers read a bout title without running React. */
export function renderSharePage(selection: ShareSelection, base: string): string {
  const title = escapeHtml(fightTitle(selection));
  const destination = `${base}?${new URLSearchParams({
    a: selection.a, b: selection.b, environment: selection.environment, mode: selection.mode,
  })}`;
  // Only the mode is taken from the visitor's query; animals/terrain come from the static page.
  const script = `const u=new URL(${JSON.stringify(destination)},location.origin);if(new URLSearchParams(location.search).get("mode")==="realistic")u.searchParams.set("mode","realistic");location.replace(u.href);`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><meta name="description" content="${SITE_DESCRIPTION}">
<meta property="og:title" content="${title}"><meta property="og:description" content="${SITE_DESCRIPTION}">
<meta property="og:type" content="website"><meta property="og:image" content="${base}og-image.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="ANIMOSITY — Every number shows its source">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${SITE_DESCRIPTION}"><meta name="twitter:image" content="${base}og-image.png">
<link rel="icon" type="image/svg+xml" href="${base}favicon.svg">
<style>body{background:#16110d;color:#f1e6d3;font:20px Georgia,serif;padding:8vw}a{color:#c99a4e}</style>
</head><body><h1>${title}</h1><p><a href="${escapeHtml(destination)}">Open this bout</a></p><script>${script}</script></body></html>`;
}

export function sharePages(): Plugin {
  const catalog = JSON.parse(readFileSync(new URL("../api-server/server/traits.json", import.meta.url), "utf8")) as { name: string }[];
  const pages = new Map<string, ShareSelection>();
  for (const a of catalog) for (const b of catalog) {
    for (const environment of Object.keys(ARENA_NAMES) as ShareSelection["environment"][]) {
      pages.set(sharePageName(a.name, b.name, environment), {
        a: a.name, b: b.name, environment, mode: "forced_fight",
      });
    }
  }
  let base = "/";
  return {
    name: "animosity-share-pages",
    configResolved(config) { base = config.base; },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? "/", "http://local.invalid").pathname;
        const prefix = `${base}share/`;
        const page = pathname.startsWith(prefix) ? pages.get(pathname.slice(prefix.length)) : undefined;
        if (!page) return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(renderSharePage(page, base));
      });
    },
    generateBundle() {
      for (const [name, selection] of pages) {
        this.emitFile({ type: "asset", fileName: `share/${name}`, source: renderSharePage(selection, base) });
      }
    },
  };
}
