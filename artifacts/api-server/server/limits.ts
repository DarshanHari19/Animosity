import type { RequestHandler } from "express";
import { FightError } from "./errors";

const MINUTE_MS = 60_000;

/** Fixed one-minute window per Express-resolved IP; only mounted on POST /fight. */
export function createFightRateLimiter(now: () => number = Date.now): RequestHandler {
  const clients = new Map<string, { count: number; expires: number }>();
  let lastSweep = now();
  return (req, res, next) => {
    const time = now();
    if (time - lastSweep >= MINUTE_MS) {
      for (const [ip, window] of clients) if (window.expires <= time) clients.delete(ip);
      lastSweep = time;
    }
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    let window = clients.get(ip);
    if (!window || window.expires <= time) {
      window = { count: 0, expires: time + MINUTE_MS };
      clients.set(ip, window);
    }
    if (window.count >= 10) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((window.expires - time) / 1000)));
      res.status(429).json({
        code: "FIGHT_RATE_LIMITED",
        error: "Too many fight requests from this IP. Limit: 10 per minute. Try again after the Retry-After interval.",
      });
      return;
    }
    window.count++;
    next();
  };
}

export function parseNarrationDailyCap(raw: string | undefined): number {
  const value = raw ?? "200";
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new FightError("NARRATION_CAP_CONFIGURATION",
      "NARRATION_DAILY_CAP must be a non-negative safe integer.", 503);
  }
  return Number(value);
}

/** Synchronous admission prevents concurrent requests from overspending slots. */
export function createNarrationDailyCap(
  limit?: number, now: () => number = Date.now,
): () => void {
  let day = "";
  let calls = 0;
  return () => {
    const cap = limit ?? parseNarrationDailyCap(process.env.NARRATION_DAILY_CAP);
    const today = new Date(now()).toISOString().slice(0, 10);
    if (today !== day) { day = today; calls = 0; }
    if (calls >= cap) {
      throw new FightError("NARRATION_DAILY_CAP_REACHED",
        "Daily narration provider-call cap reached. All attempts, including retries, count. Try again after midnight UTC.", 429);
    }
    calls++;
  };
}

// Shared by every production fight, including environmental-favored narration.
export const reserveNarrationCall = createNarrationDailyCap();
