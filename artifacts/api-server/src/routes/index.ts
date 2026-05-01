import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import alertRouter from "./alert";
import profitRouter from "./profit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(alertRouter);
router.use("/profit", profitRouter);

export default router;
