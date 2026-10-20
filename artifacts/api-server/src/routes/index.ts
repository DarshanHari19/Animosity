import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { createFightRouter } from "../../server/routes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(createFightRouter());

export default router;
