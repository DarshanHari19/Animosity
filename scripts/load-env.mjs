// Side-effect module: loads the repo-root .env into process.env.
// Variables already set in the shell win over .env. A missing .env is fine.
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
