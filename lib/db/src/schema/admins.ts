import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const adminsTable = pgTable("admins", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  discordUsername: text("discord_username").notNull(),
  addedBy: text("added_by").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export type Admin = typeof adminsTable.$inferSelect;
export type NewAdmin = typeof adminsTable.$inferInsert;
