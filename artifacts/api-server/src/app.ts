import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true }));

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
