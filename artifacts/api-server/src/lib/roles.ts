import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { discordClient } from "./discord";

export const OWNER_ROLE_ID = "1502041120849395775";
const GUILD_ID = process.env.DISCORD_MAIN_GUILD_ID!;

export async function getMemberRoles(discordId: string): Promise<string[]> {
  try {
    const guild = await discordClient.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(discordId);
    return [...member.roles.cache.keys()];
  } catch {
    return [];
  }
}

export async function isOwner(discordId: string): Promise<boolean> {
  const roles = await getMemberRoles(discordId);
  return roles.includes(OWNER_ROLE_ID);
}

export async function isAdmin(discordId: string): Promise<boolean> {
  if (await isOwner(discordId)) return true;
  const row = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.discordId, discordId))
    .limit(1);
  return row.length > 0;
}

export const requireOwner = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.isAuthenticated?.()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const ok = await isOwner(req.user!.id);
  if (!ok) {
    res.status(403).json({ error: "Owner only" });
    return;
  }
  next();
};

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.isAuthenticated?.()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const ok = await isAdmin(req.user!.id);
  if (!ok) {
    res.status(403).json({ error: "Admin or Owner only" });
    return;
  }
  next();
};
