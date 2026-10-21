import { Router, type IRouter } from "express";
import { HealthCheckResponse, GetBuildHealthResponse } from "@workspace/api-zod";
import { BUILD_ID } from "../build-id";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});
router.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(GetBuildHealthResponse.parse({ status: "ok", build_id: BUILD_ID }));
});

export default router;
