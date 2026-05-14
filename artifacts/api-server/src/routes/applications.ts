import { Router } from "express";
import { db } from "@workspace/db";
import { applicationsTable, blacklistTable } from "@workspace/db";
import { SubmitApplicationBody } from "@workspace/api-zod";
import { eq, count, sql } from "drizzle-orm";
import { sendApplicationToDiscord } from "../lib/discord";

const router = Router();

router.post("/applications", async (req, res) => {
  const parsed = SubmitApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid application data" });
  }

  const data = parsed.data;

  const blacklisted = await db
    .select()
    .from(blacklistTable)
    .where(eq(blacklistTable.discordId, data.discordId))
    .limit(1);

  if (blacklisted.length > 0) {
    return res.status(403).json({ error: "You are blacklisted from applying." });
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

  return res.status(201).json({
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
