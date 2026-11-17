import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { mountFrontend } from "./static-site";
import { trustProxyHops } from "./trust-proxy";

const app: Express = express();
// Trust only the proxy hops in front of the app, not arbitrary client-supplied chains.
// Default 1 (one reverse proxy). Railway's docs do not state a hop count for
// X-Forwarded-For (they document X-Real-IP as the client IP), so TRUST_PROXY_HOPS lets the
// deployer correct it after checking a staging request, without a code change. A wrong count
// breaks per-IP rate limiting: too low keys on the proxy, too high lets clients spoof their IP.
app.set("trust proxy", trustProxyHops(process.env.TRUST_PROXY_HOPS));

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
// Unknown /api paths stay JSON, never the SPA fallback or an HTML error page.
app.use("/api", (_req, res) => { res.status(404).json({ error: "Not found.", code: "NOT_FOUND" }); });
// Production: serve the built frontend from this process. Skipped when it was not built.
mountFrontend(app);

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
