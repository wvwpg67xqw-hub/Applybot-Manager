import { Router } from "express";
import { db } from "@workspace/db";
import { applicationsTable, blacklistTable } from "@workspace/db";
import { SubmitApplicationBody } from "@workspace/api-zod";
import { eq, count, desc, and } from "drizzle-orm";
import { sendApplicationToDiscord } from "../lib/discord";

const COOLDOWN_DAYS = 30;

const router = Router();

router.post("/applications", async (req, res): Promise<void> => {
  const parsed = SubmitApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid application data" });
    return;
  }

  const data = parsed.data;

  const blacklisted = await db
    .select()
    .from(blacklistTable)
    .where(eq(blacklistTable.discordId, data.discordId))
    .limit(1);

  if (blacklisted.length > 0) {
    res.status(403).json({ error: "You are blacklisted from applying." });
    return;
  }

  const cutoff = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
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
    const retryDate = new Date(recentDenial.createdAt.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    res.status(403).json({
      error: `You were recently denied. You may reapply on ${retryDate.toDateString()}.`,
      retryAfter: retryDate.toISOString(),
    });
    return;
  }

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

  try {
    await sendApplicationToDiscord(application);
  } catch (err) {
    req.log.warn({ err }, "Failed to send application to Discord");
  }

  res.status(201).json({
    ...application,
    createdAt: application.createdAt.toISOString(),
  });
});

router.get("/applications/stats", async (req, res) => {
  const rows = await db
    .select({
      status: applicationsTable.status,
      count: count(),
    })
    .from(applicationsTable)
    .groupBy(applicationsTable.status);

  const stats = { total: 0, pending: 0, accepted: 0, denied: 0 };
  for (const row of rows) {
    const n = Number(row.count);
    stats.total += n;
    if (row.status === "pending") stats.pending = n;
    else if (row.status === "accepted") stats.accepted = n;
    else if (row.status === "denied") stats.denied = n;
  }

  return res.json(stats);
});

export default router;
