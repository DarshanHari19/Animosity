/**
 * pg 8.23+ treats sslmode=require|prefer|verify-ca as aliases for verify-full and prints a
 * SECURITY WARNING because pg 9 will switch to weaker libpq semantics. Neon serves publicly
 * trusted certificates, so verify-full works and is what pg already enforces today. Rewriting
 * the mode explicitly keeps the same strict TLS checks, silences the warning, and stays strict
 * after the pg 9 upgrade. Other parameters (channel_binding, options, ...) are left untouched.
 * Local Docker URLs without sslmode are returned unchanged (no TLS).
 */
export function normalizeDatabaseUrl(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString; // let pg report the parse problem
  }
  const mode = url.searchParams.get("sslmode");
  if (
    (mode === "require" || mode === "prefer" || mode === "verify-ca") &&
    url.searchParams.get("uselibpqcompat") !== "true"
  ) {
    url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  }
  return connectionString;
}
