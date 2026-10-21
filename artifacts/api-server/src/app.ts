import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
// Trust only the immediate reverse proxy, not arbitrary client-supplied chains.
// Revisit this hop count if the deployment's proxy topology changes.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body must be valid JSON.", code: "INVALID_JSON" });
  } else if (error?.type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large.", code: "REQUEST_TOO_LARGE" });
  } else {
    res.status(500).json({ error: "Unexpected server error.", code: "INTERNAL_ERROR" });
  }
};
app.use(errorHandler);

export default app;
