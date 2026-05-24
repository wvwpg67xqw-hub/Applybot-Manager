import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import pinoHttp from "pino-http";
import { join } from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { setupPassport } from "./lib/passport";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

const isProd = process.env["NODE_ENV"] === "production";

app.use(cors({ origin: true, credentials: true }));
app.set("trust proxy", 1);

app.use(
  session({
    secret: process.env["SESSION_SECRET"] ?? "changeme-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

setupPassport();

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

/* =========================================================
   Serve the built frontend under /dashboard (production only)
========================================================= */
if (isProd) {
  const frontendDist = join(__dirname, "../../apply-site/dist/public");
  app.use("/dashboard", express.static(frontendDist));
  app.get("/dashboard/*", (_req, res) => {
    res.sendFile(join(frontendDist, "index.html"));
  });
}

export default app;
