// Side-effect module: loads the repo-root .env into process.env.
// Variables already set in the shell win over .env. A missing .env is fine.
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "./env-file.mjs";

loadDotEnv(fileURLToPath(new URL("../.env", import.meta.url)));
