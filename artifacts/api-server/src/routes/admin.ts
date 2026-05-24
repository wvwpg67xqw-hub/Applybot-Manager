import { Router } from "express";
import { db } from "@workspace/db";
import { applicationsTable, blacklistTable, adminsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin, requireOwner, isOwner, isAdmin } from "../lib/roles";
import { sendLog, discordClient } from "../lib/discord";
import { logger } from "../lib/logger";

const router = Router();
const GUILD_ID = process.env.DISCORD_MAIN_GUILD_ID!;

/* =========================================================
   GET /admin/me — returns caller's role
========================================================= */
router.get("/admin/me", async (req, res): Promise<void> => {
  if (!req.isAuthenticated?.()) {
    res.json({ role: "none" });
    return;
  }
  try {
    const owner = await isOwner(req.user!.id);
    if (owner) { res.json({ role: "owner" }); return; }
    const admin = await isAdmin(req.user!.id);
    res.json({ role: admin ? "admin" : "none" });
  } catch (err) {
    logger.error({ err }, "Failed to determine admin role");
    res.json({ role: "none" });
  }
});

/* =========================================================
   APPLICATIONS
========================================================= */
router.get("/admin/applications", requireAdmin, async (req, res): Promise<void> => {
  try {
    const status = typeof req.query["status"] === "string" ? req.query["status"] : undefined;
    const rows = await db
      .select()
      .from(applicationsTable)
      .where(status ? eq(applicationsTable.status, status) : undefined)
      .orderBy(desc(applicationsTable.createdAt));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to list applications");
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

router.post("/admin/applications/:id/accept", requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params["id"]);
    const [app] = await db
      .update(applicationsTable)
      .set({ status: "accepted" })
      .where(eq(applicationsTable.id, id))
      .returning();
    if (!app) { res.status(404).json({ error: "Application not found" }); return; }

    await sendLog(
      `✅ Application #${id} (**${app.discordUsername}**) accepted via web panel by **${req.user!.username}**`
    ).catch(() => {});

    try {
      const staffInvite = process.env["DISCORD_STAFF_SERVER_INVITE"] ?? "";
      const user = await discordClient.users.fetch(app.discordId);
      await user.send(
        `🎉 Congratulations **${app.discordUsername}**! Your application for **${app.role}** has been **accepted**!\n\n` +
        `Join the staff server here: ${staffInvite}`
      );
    } catch { /* DMs may be disabled */ }

    res.json({ ok: true, application: app });
  } catch (err) {
    logger.error({ err }, "Failed to accept application");
    res.status(500).json({ error: "Failed to accept application" });
  }
});

router.post("/admin/applications/:id/deny", requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params["id"]);
    const [app] = await db
      .update(applicationsTable)
      .set({ status: "denied" })
      .where(eq(applicationsTable.id, id))
      .returning();
    if (!app) { res.status(404).json({ error: "Application not found" }); return; }
    await sendLog(
      `❌ Application #${id} (**${app.discordUsername}**) denied via web panel by **${req.user!.username}**`
    ).catch(() => {});
    res.json({ ok: true, application: app });
  } catch (err) {
    logger.error({ err }, "Failed to deny application");
    res.status(500).json({ error: "Failed to deny application" });
  }
});

/* =========================================================
   BLACKLIST
========================================================= */
router.get("/admin/blacklist", requireAdmin, async (req, res): Promise<void> => {
  try {
    const list = await db.select().from(blacklistTable).orderBy(desc(blacklistTable.addedAt));
    res.json(list);
  } catch (err) {
    logger.error({ err }, "Failed to list blacklist");
    res.status(500).json({ error: "Failed to fetch blacklist" });
  }
});

router.post("/admin/blacklist", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { discordId, discordUsername, reason } = req.body as {
      discordId?: string;
      discordUsername?: string;
      reason?: string;
    };
    if (!discordId || !discordUsername) {
      res.status(400).json({ error: "discordId and discordUsername are required" });
      return;
    }
    const [row] = await db
      .insert(blacklistTable)
      .values({ discordId, discordUsername, reason: reason ?? null })
      .returning();
    res.status(201).json(row);
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === "23505") {
      res.status(409).json({ error: "User is already blacklisted" });
      return;
    }
    logger.error({ err }, "Failed to add to blacklist");
    res.status(500).json({ error: "Failed to add to blacklist" });
  }
});

router.delete("/admin/blacklist/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params["id"]);
    await db.delete(blacklistTable).where(eq(blacklistTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to remove from blacklist");
    res.status(500).json({ error: "Failed to remove from blacklist" });
  }
});

/* =========================================================
   ADMINS (owner only)
========================================================= */
router.get("/admin/admins", requireOwner, async (req, res): Promise<void> => {
  try {
    const list = await db.select().from(adminsTable).orderBy(desc(adminsTable.addedAt));
    res.json(list);
  } catch (err) {
    logger.error({ err }, "Failed to list admins");
    res.status(500).json({ error: "Failed to fetch admins" });
  }
});

router.post("/admin/admins", requireOwner, async (req, res): Promise<void> => {
  try {
    const { discordId } = req.body as { discordId?: string };
    if (!discordId) { res.status(400).json({ error: "discordId is required" }); return; }

    let discordUsername = discordId;
    try {
      const guild = await discordClient.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(discordId);
      discordUsername = member.user.username;
    } catch {
      /* member not in guild — use ID as fallback username */
    }

    const [row] = await db
      .insert(adminsTable)
      .values({ discordId, discordUsername, addedBy: req.user!.id })
      .returning();
    res.status(201).json(row);
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === "23505") {
      res.status(409).json({ error: "User is already an admin" });
      return;
    }
    logger.error({ err }, "Failed to add admin");
    res.status(500).json({ error: "Failed to add admin" });
  }
});

router.delete("/admin/admins/:discordId", requireOwner, async (req, res): Promise<void> => {
  try {
    const { discordId } = req.params;
    await db.delete(adminsTable).where(eq(adminsTable.discordId, discordId!));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to remove admin");
    res.status(500).json({ error: "Failed to remove admin" });
  }
});

export default router;
