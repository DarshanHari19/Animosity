/**
 * pg 8.23+ treats sslmode=require|prefer|verify-ca as aliases for verify-full and prints a
 * SECURITY WARNING because pg 9 will switch to weaker libpq semantics. Neon serves publicly
 * trusted certificates, so verify-full works and is what pg already enforces today. Rewriting
 * the mode explicitly keeps the same strict TLS checks, silences the warning, and stays strict
 * after the pg 9 upgrade. Other parameters (channel_binding, options, ...) are left untouched.
 * Local Docker URLs without sslmode are returned unchanged (no TLS).
 * pg uses the LAST sslmode when it is repeated, so the decision is made on the last value.
 */
export function normalizeDatabaseUrl(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString; // let pg report the parse problem
  }
  const mode = url.searchParams.getAll("sslmode").at(-1);
  if (
    (mode === "require" || mode === "prefer" || mode === "verify-ca") &&
    url.searchParams.get("uselibpqcompat") !== "true"
  ) {
    url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  }
  return connectionString;
}

function hostnameOf(connectionString: string): string | null {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return null;
  }
}

/**
 * Which database a schema push should target. DATABASE_URL_UNPOOLED is used only when it is
 * the direct twin of DATABASE_URL (same host with "-pooler" removed from the first label).
 * Otherwise DATABASE_URL wins, so `DATABASE_URL=<other> pnpm db:migrate` never silently
 * pushes to the database named in .env.
 */
export function pickMigrationUrl(env: {
  DATABASE_URL?: string;
  DATABASE_URL_UNPOOLED?: string;
}): { url: string; hostname: string | null; usedUnpooled: boolean } | null {
  const pooled = env.DATABASE_URL;
  const direct = env.DATABASE_URL_UNPOOLED;
  if (!pooled) return null;
  if (direct) {
    const pooledHost = hostnameOf(pooled);
    const directHost = hostnameOf(direct);
    if (pooledHost && directHost) {
      const [first = "", ...rest] = pooledHost.split(".");
      const twin = [first.replace(/-pooler$/, ""), ...rest].join(".");
      if (twin === directHost) {
        return { url: direct, hostname: directHost, usedUnpooled: true };
      }
    }
  }
  return { url: pooled, hostname: hostnameOf(pooled), usedUnpooled: false };
}
