import express, { type Express, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from this file (the bundle at artifacts/api-server/dist/index.mjs, or src/ under
// tsx), never from the working directory. Both sit two levels below artifacts/.
export const defaultFrontendDir = fileURLToPath(new URL("../../fight-club/dist/public", import.meta.url));

const NO_CACHE = "no-cache";
// Vite emits content-hashed files under assets/, so they can be cached for a year.
const IMMUTABLE = "public, max-age=31536000, immutable";
// Unhashed static files (og-image.png, favicon.svg, robots.txt): short, revalidated.
const SHORT = "public, max-age=3600";

function cacheControlFor(filePath: string, root: string): string {
  if (filePath.endsWith(".html")) return NO_CACHE; // index.html and share/*.html
  return path.relative(root, filePath).split(path.sep)[0] === "assets" ? IMMUTABLE : SHORT;
}

const isApiPath = (requestPath: string) => requestPath === "/api" || requestPath.startsWith("/api/");

/**
 * Serves the built frontend (including share/*.html) with an SPA fallback. A no-op when the
 * build output is absent, so tests and development (Vite serves the frontend) are unaffected.
 * Must be mounted after the /api router. Returns whether it was enabled.
 */
export function mountFrontend(app: Express, dir: string = defaultFrontendDir): boolean {
  const indexFile = path.join(dir, "index.html");
  if (!existsSync(indexFile)) return false;
  app.use(express.static(dir, {
    cacheControl: false,
    setHeaders: (res: Response, filePath: string) => { res.setHeader("Cache-Control", cacheControlFor(filePath, dir)); },
  }));
  app.use((req: Request, res: Response, next) => {
    // Only page navigations fall back to the app shell; a missing file or API path stays a 404.
    if ((req.method !== "GET" && req.method !== "HEAD") || isApiPath(req.path) || path.extname(req.path)) return next();
    res.setHeader("Cache-Control", NO_CACHE);
    res.sendFile(indexFile, (error) => { if (error) next(error); });
  });
  return true;
}
