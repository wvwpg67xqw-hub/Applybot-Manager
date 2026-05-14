import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const applicationsTable = pgTable("applications", {
  id: serial("id").primaryKey(),
  discordUsername: text("discord_username").notNull(),
  discordId: text("discord_id").notNull(),
  role: text("role").notNull(),
  age: integer("age").notNull(),
  timezone: text("timezone").notNull(),
  experience: text("experience").notNull(),
  whyJoin: text("why_join").notNull(),
  availability: text("availability").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({
  id: true,
  status: true,
  createdAt: true,
});

export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applicationsTable.$inferSelect;

export const blacklistTable = pgTable("blacklist", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  discordUsername: text("discord_username").notNull(),
  reason: text("reason"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const insertBlacklistSchema = createInsertSchema(blacklistTable).omit({
  id: true,
  addedAt: true,
});

export type InsertBlacklist = z.infer<typeof insertBlacklistSchema>;
export type Blacklist = typeof blacklistTable.$inferSelect;
