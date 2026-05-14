import { Router, type IRouter } from "express";
import healthRouter from "./health";
import applicationsRouter from "./applications";
import authRouter from "./auth";
import interactionsRouter from "./interactions";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(applicationsRouter);
router.use(interactionsRouter);

export default router;
