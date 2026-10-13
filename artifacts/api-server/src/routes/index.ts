import { Router, type IRouter } from "express";
import healthRouter from "./health";
import violinGoalsRouter from "./violin-goals";
import violinOverviewRouter from "./violin-overview";
import violinPlansRouter from "./violin-plans";
import violinRepertoireRouter from "./violin-repertoire";
import violinSessionsRouter from "./violin-sessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(violinSessionsRouter);
router.use(violinRepertoireRouter);
router.use(violinGoalsRouter);
router.use(violinPlansRouter);
router.use(violinOverviewRouter);

export default router;
