import { execSync, spawn } from "child_process";

function run(cmd, env = {}) {
  execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });
}

console.log("==> Installing dependencies...");
run("pnpm install --frozen-lockfile");

console.log("==> Building frontend...");
run("pnpm --filter @workspace/apply-site run build", { BASE_PATH: "/dashboard" });

console.log("==> Building API server...");
run("pnpm --filter @workspace/api-server run build");

console.log("==> Starting server...");
const server = spawn(
  "node",
  ["--enable-source-maps", "artifacts/api-server/dist/index.mjs"],
  { stdio: "inherit", env: process.env }
);

server.on("exit", (code) => process.exit(code ?? 0));
