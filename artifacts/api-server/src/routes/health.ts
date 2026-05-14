import { Router, type IRouter } from "express";
import { getBotStatus } from "../lib/keepalive";

const router: IRouter = Router();

router.get("/healthz", (_req, res): void => {
  res.json({ status: "ok", bot: getBotStatus() });
});

export default router;
