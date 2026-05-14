import { Router } from "express";
import { db } from "@workspace/db";
import { applicationsTable, blacklistTable } from "@workspace/db";
import { SubmitApplicationBody as applicationInputSchema } from "@workspace/api-zod";
import { eq, count, desc, and } from "drizzle-orm";
import { sendApplicationToDiscord } from "../lib/discord";

const router = Router();
const COOLDOWN_DAYS = 30;

/* =========================================================
   CREATE APPLICATION
========================================================= */
router.post("/applications", async (req, res): Promise<void> => {
  try {
    console.log("REQ BODY:", req.body);

    // 🔥 SAFE VALIDATION (NO CRASHES)
    const parsed = applicationInputSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid application data",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    /* =========================================================
       BLACKLIST CHECK
    ========================================================= */
    const blacklisted = await db
      .select()
      .from(blacklistTable)
      .where(eq(blacklistTable.discordId, data.discordId))
      .limit(1);

    if (blacklisted.length > 0) {
      return res.status(403).json({
        error: "You are blacklisted from applying.",
      });
    }

    /* =========================================================
       COOLDOWN CHECK
    ========================================================= */
    const cutoff = new Date(Date.now() - COOLDOWN_DAYS * 86400000);

    const [recentDenial] = await db
      .select()
      .from(applicationsTable)
      .where(
        and(
          eq(applicationsTable.discordId, data.discordId),
          eq(applicationsTable.status, "denied")
        )
      )
      .orderBy(desc(applicationsTable.createdAt))
      .limit(1);

    if (recentDenial && recentDenial.createdAt > cutoff) {
      const retryDate = new Date(
        recentDenial.createdAt.getTime() + COOLDOWN_DAYS * 86400000
      );

      return res.status(403).json({
        error: `You were recently denied. You may reapply on ${retryDate.toDateString()}.`,
        retryAfter: retryDate.toISOString(),
      });
    }

    /* =========================================================
       INSERT APPLICATION
    ========================================================= */
    const [application] = await db
      .insert(applicationsTable)
      .values({
        discordUsername: data.discordUsername,
        discordId: data.discordId,
        role: data.role,
        age: data.age,
        timezone: data.timezone,
        experience: data.experience,
        whyJoin: data.whyJoin,
        availability: data.availability,
      })
      .returning();

    if (!application) {
      return res.status(500).json({
        error: "Failed to create application",
      });
    }

    /* =========================================================
       SEND TO DISCORD (SAFE)
    ========================================================= */
    try {
      await sendApplicationToDiscord(application);
    } catch (err) {
      console.error("Discord send failed:", err);
    }

    /* =========================================================
       RESPONSE
    ========================================================= */
    return res.status(201).json({
      ...application,
      createdAt: application.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("APPLICATION ROUTE CRASH:", err);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

/* =========================================================
   STATS ROUTE
========================================================= */
router.get("/applications/stats", async (req, res) => {
  try {
    const rows = await db
      .select({
        status: applicationsTable.status,
        count: count(),
      })
      .from(applicationsTable)
      .groupBy(applicationsTable.status);

    const stats = {
      total: 0,
      pending: 0,
      accepted: 0,
      denied: 0,
    };

    for (const row of rows) {
      const n = Number(row.count);
      stats.total += n;

      if (row.status === "pending") stats.pending = n;
      else if (row.status === "accepted") stats.accepted = n;
      else if (row.status === "denied") stats.denied = n;
    }

    return res.json(stats);
  } catch (err) {
    console.error("STATS ROUTE ERROR:", err);

    return res.status(500).json({
      error: "Failed to fetch stats",
    });
  }
});

export default router;