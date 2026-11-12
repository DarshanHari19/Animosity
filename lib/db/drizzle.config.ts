import { defineConfig } from "drizzle-kit";
import path from "path";
import { normalizeDatabaseUrl } from "./src/connection-url";

// Schema pushes use a direct (unpooled) connection when DATABASE_URL_UNPOOLED is set:
// PgBouncer is a poor fit for DDL. Otherwise fall back to DATABASE_URL (Docker, CI).
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: normalizeDatabaseUrl(url),
  },
});
