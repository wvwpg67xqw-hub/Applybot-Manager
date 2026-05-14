import app from "./app";
import { logger } from "./lib/logger";
import { initDiscordBot } from "./lib/discord";
import { startKeepalive } from "./lib/keepalive";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  logger.info({ port }, "Server listening");
  startKeepalive(port);
});

initDiscordBot().catch((err) => {
  logger.error({ err }, "Discord bot failed to start");
});
