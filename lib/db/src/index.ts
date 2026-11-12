import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { normalizeDatabaseUrl } from "./connection-url";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// TLS comes from the URL (Neon: sslmode=require, enforced as verify-full; Docker: none).
// Pool sizing for a long-running server behind Neon's pooled (PgBouncer) endpoint:
// - max 10: PgBouncer multiplexes, and this app only does cache reads/writes.
// - idleTimeoutMillis 30s: drop idle sockets before Neon suspends the compute (scale to
//   zero) and leaves us holding dead connections.
// - connectionTimeoutMillis 10s: a cold compute can take several seconds to wake.
// - query_timeout 5s: see below.
export const pool = new Pool({
  connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Client-side cap so a stuck cache query cannot hang a fight; routes.ts treats cache
  // errors as warnings and falls back to the normal narration path.
  query_timeout: 5_000,
});

// An error on an idle client (e.g. Neon suspended the compute) is emitted on the pool.
// Without a listener it becomes an uncaught exception and kills the process. pg discards
// the broken client and the next query opens a fresh one. Log only the code/message:
// never the pool config, which contains the connection string.
pool.on("error", (err: NodeJS.ErrnoException) => {
  console.error(
    `[db] idle pool client error: ${err.code ?? "unknown"} ${err.message}`,
  );
});

export const db = drizzle(pool, { schema });

export * from "./schema";
