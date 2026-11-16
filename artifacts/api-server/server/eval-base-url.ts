export interface EvalBaseUrlInputs {
  flag?: string | undefined;
  env: Readonly<Record<string, string | undefined>>;
}

// Precedence: --base-url flag, EVAL_BASE_URL, then the local API server on PORT
// (default 8080).
// Blank values count as unset.
export function resolveEvalBaseUrl({ flag, env }: EvalBaseUrlInputs): string {
  if (flag) return flag;
  if (env.EVAL_BASE_URL) return env.EVAL_BASE_URL;
  return `http://localhost:${env.PORT || 8080}`;
}

/** Localhost targets share this workspace (build manifest and diagnostics journal). */
export const isLocalTarget = (url: URL): boolean => ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

/**
 * The eval token goes out in a request header, so only https (or a local http server) may
 * receive it. Credentials in the URL are never allowed.
 */
export function assertSafeEvalTarget(url: URL): void {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("Invalid base URL.");
  if (!isLocalTarget(url) && url.protocol !== "https:") {
    throw Error("A remote eval target must use https so EVAL_TOKEN is never sent in cleartext.");
  }
}
