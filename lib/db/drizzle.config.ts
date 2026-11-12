import { defineConfig } from "drizzle-kit";
import path from "path";
import { normalizeDatabaseUrl, pickMigrationUrl } from "./src/connection-url";

// Schema pushes use the direct (unpooled) twin of DATABASE_URL when DATABASE_URL_UNPOOLED
// matches it: PgBouncer is a poor fit for DDL. Otherwise DATABASE_URL (Docker, CI, overrides).
const target = pickMigrationUrl(process.env);
if (!target) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}
console.log(
  `[db] schema push target host: ${target.hostname ?? "(unparseable URL)"}${target.usedUnpooled ? " (direct)" : ""}`,
);

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: normalizeDatabaseUrl(target.url),
  },
});
