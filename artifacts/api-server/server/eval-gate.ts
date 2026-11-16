import { createHash, timingSafeEqual } from "node:crypto";

export type EvalGateInputs = {
  /** Value of the X-Animosity-Eval-Bypass-Cache request header, if any. */
  header: string | undefined;
  /** EVAL_TOKEN, blank counts as unset. */
  token: string | undefined;
  /** True only for NODE_ENV=development (or a test override). */
  development: boolean;
};

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

/**
 * Decides whether a request may bypass the narration cache and receive eval telemetry.
 *
 * - EVAL_TOKEN set (any environment): the header must equal it, compared in constant time.
 *   The legacy value "1" is NOT accepted, so a configured token can never be sidestepped.
 * - EVAL_TOKEN unset: only development honors the legacy "1" value, which keeps local
 *   `pnpm dev` + `pnpm eval` working with no setup. Production never honors the header.
 *
 * Never log the header or the token.
 */
export function evalBypassGranted({ header, token, development }: EvalGateInputs): boolean {
  if (header === undefined || header === "") return false;
  if (token) {
    // Hash both sides so lengths are equal and timingSafeEqual never throws or leaks length.
    return timingSafeEqual(digest(header), digest(token));
  }
  return development && header === "1";
}
