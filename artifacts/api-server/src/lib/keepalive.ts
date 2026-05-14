import { logger } from "./logger";
import { discordClient } from "./discord";

const PING_INTERVAL_MS = 4 * 60 * 1000;

export function startKeepalive(port: number) {
  const domains = process.env["REPLIT_DOMAINS"];
  const primaryDomain = domains ? domains.split(",")[0]!.trim() : null;

  const healthUrl = primaryDomain
    ? `https://${primaryDomain}/api/healthz`
    : `http://localhost:${port}/api/healthz`;

  logger.info({ healthUrl }, "Keepalive started — pinging health endpoint every 4 minutes");

  const ping = async () => {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) {
        logger.debug({ status: res.status }, "Keepalive ping OK");
      } else {
        logger.warn({ status: res.status }, "Keepalive ping returned non-OK status");
      }
    } catch (err) {
      logger.warn({ err }, "Keepalive ping failed");
    }
  };

  setInterval(ping, PING_INTERVAL_MS);

  logger.info(
    { healthUrl },
    "Add this URL to UptimeRobot (https://uptimerobot.com) with a 5-minute interval to keep the bot online 24/7"
  );

  return healthUrl;
}

export function getBotStatus() {
  return {
    connected: discordClient.isReady(),
    tag: discordClient.user?.tag ?? null,
    uptime: discordClient.uptime ?? 0,
    guilds: discordClient.guilds.cache.size,
  };
}
