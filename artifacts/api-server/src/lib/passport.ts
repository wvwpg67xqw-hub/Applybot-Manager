import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
import { logger } from "./logger";

const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

declare global {
  namespace Express {
    interface User extends DiscordUser {}
  }
}

export function getCallbackUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  const primary = domains ? domains.split(",")[0]!.trim() : null;
  return primary
    ? `https://${primary}/api/auth/callback`
    : `http://localhost:${process.env["PORT"] ?? 8080}/api/auth/callback`;
}

export function setupPassport() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    logger.warn("DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET not set — Discord auth disabled");
    return;
  }

  passport.use(
    new DiscordStrategy(
      {
        clientID: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        callbackURL: getCallbackUrl(),
        scope: ["identify"],
      },
      (_accessToken, _refreshToken, profile, done) => {
        const user: DiscordUser = {
          id: profile.id,
          username: profile.username,
          discriminator: profile.discriminator ?? "0",
          avatar: profile.avatar ?? null,
        };
        done(null, user);
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user as DiscordUser));

  logger.info("Discord OAuth2 strategy registered");
}
