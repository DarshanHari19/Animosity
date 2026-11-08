import app from "./app";
import { logger } from "./lib/logger";
import { narrationStartupSummary, startupConfigWarnings } from "../server/provider-config";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

logger.info(narrationStartupSummary(process.env), "Narration provider configured");
for (const warning of startupConfigWarnings(process.env)) logger.warn(warning);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
