import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { createFightRouter } from "../../server/routes";
import { postgresNarrationCache } from "../../server/postgres-narration-cache";

const router: IRouter = Router();

router.use(healthRouter);
router.use(createFightRouter(undefined, undefined, undefined, undefined, { cache: postgresNarrationCache }));

export default router;
