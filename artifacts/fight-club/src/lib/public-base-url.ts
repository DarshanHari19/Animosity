const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Validates PUBLIC_BASE_URL (build time). Returns the origin without a trailing slash, or
 * undefined when unset/blank (links then stay relative, as in local dev and tests).
 * Accepts https, or http on a loopback host; rejects credentials, paths, queries and fragments.
 */
export function parsePublicBaseUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  const fail = (why: string): never => {
    throw new Error(`Invalid PUBLIC_BASE_URL: ${why}. Use an origin such as https://staging.example.com (https only, or http on localhost; no path, query or credentials).`);
  };
  let url: URL;
  try { url = new URL(value); } catch { return fail("not a valid URL"); }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname))) {
    return fail("the scheme must be https (http is allowed only for localhost)");
  }
  if (url.username || url.password) return fail("credentials are not allowed");
  if (url.pathname !== "/" || /[?#]/.test(value)) return fail("path, query and fragment are not allowed");
  return url.origin;
}

/** Joins an origin and a root-relative path (base already starts with "/"). */
export const absoluteUrl = (origin: string | undefined, path: string): string => origin ? `${origin}${path}` : path;
