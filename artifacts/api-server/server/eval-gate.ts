import { createHash, timingSafeEqual } from "node:crypto";

/** Shorter tokens are guessable, so they disable the bypass instead of weakening it. */
export const MIN_EVAL_TOKEN_LENGTH = 32;

/** "unset" (blank), "weak" (set but shorter than the minimum, bypass disabled) or the usable token. */
export function normalizeEvalToken(raw: string | undefined): { kind: "unset" } | { kind: "weak" } | { kind: "token"; value: string } {
  const value = raw?.trim();
  if (!value) return { kind: "unset" };
  return value.length < MIN_EVAL_TOKEN_LENGTH ? { kind: "weak" } : { kind: "token", value };
}

/** Startup warning text naming the variable only (never its value), or null. */
export function evalTokenWarning(raw: string | undefined): string | null {
  return normalizeEvalToken(raw).kind === "weak"
    ? `EVAL_TOKEN is shorter than ${MIN_EVAL_TOKEN_LENGTH} characters, so the eval bypass is disabled. Generate one with: openssl rand -hex 32`
    : null;
}

export type EvalGateInputs = {
  /** Value of the X-Animosity-Eval-Bypass-Cache request header, if any. */
  header: string | undefined;
  /** Raw EVAL_TOKEN; trimmed here. Blank counts as unset, shorter than 32 characters disables the bypass. */
  token: string | undefined;
  /** True only for NODE_ENV=development (or a test override). */
  development: boolean;
};

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

/**
 * Decides whether a request may bypass the narration cache and receive eval telemetry.
 *
 * - EVAL_TOKEN set (trimmed, at least 32 characters; shorter disables the bypass everywhere): the header must equal it, compared in constant time.
 *   The legacy value "1" is NOT accepted, so a configured token can never be sidestepped.
 * - EVAL_TOKEN unset: only development honors the legacy "1" value, which keeps local
 *   `pnpm dev` + `pnpm eval` working with no setup. Production never honors the header.
 *
 * Never log the header or the token.
 */
export function evalBypassGranted({ header, token, development }: EvalGateInputs): boolean {
  if (header === undefined || header === "") return false;
  const normalized = normalizeEvalToken(token);
  if (normalized.kind === "weak") return false;
  if (normalized.kind === "token") {
    // Hash both sides so lengths are equal and timingSafeEqual never throws or leaks length.
    return timingSafeEqual(digest(header), digest(normalized.value));
  }
  return development && header === "1";
}
