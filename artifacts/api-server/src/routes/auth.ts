import { Router } from "express";
import passport from "passport";
import { getCallbackUrl, getAppBaseUrl } from "../lib/passport";
import { logger } from "../lib/logger";

const router = Router();

router.get("/auth/discord", (req, res, next) => {
  const state = (req.query["redirect"] as string) ?? "/";
  passport.authenticate("discord", { state })(req, res, next);
});

router.get(
  "/auth/callback",
  passport.authenticate("discord", { failureRedirect: "/api/auth/failed" }),
  (req, res): void => {
    const raw = Array.isArray(req.query["state"]) ? req.query["state"][0] : req.query["state"];
    const redirect = typeof raw === "string" && raw.startsWith("/") ? raw : "/";
    const base = getAppBaseUrl();
    res.redirect(`${base}${redirect}`);
  }
);

router.get("/auth/failed", (_req, res): void => {
  res.status(401).json({ error: "Discord authentication failed" });
});

router.get("/auth/me", (req, res): void => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(req.user);
});

router.post("/auth/logout", (req, res): void => {
  req.logout((err) => {
    if (err) {
      logger.warn({ err }, "Logout error");
    }
    res.json({ ok: true });
  });
});

router.get("/auth/url", (req, res): void => {
  const redirect = typeof req.query["redirect"] === "string" ? req.query["redirect"] : "/";
  const base = getAppBaseUrl();
  const url = `${base}/api/auth/discord?redirect=${encodeURIComponent(redirect)}`;
  res.json({ url, callbackUrl: getCallbackUrl() });
});

export default router;
