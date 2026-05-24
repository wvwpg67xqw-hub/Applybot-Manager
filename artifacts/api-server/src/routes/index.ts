import { Router, type IRouter } from "express";
import healthRouter from "./health";
import applicationsRouter from "./applications";
import authRouter from "./auth";
import interactionsRouter from "./interactions";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(applicationsRouter);
router.use(interactionsRouter);
router.use(adminRouter);

export default router;
