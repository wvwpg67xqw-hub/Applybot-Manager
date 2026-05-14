import { Router, type Request, type Response } from "express";
import { verifyKey } from "discord-interactions";
import { InteractionType, InteractionResponseType } from "discord-interactions";
import { db } from "@workspace/db";
import { applicationsTable, blacklistTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { discordClient } from "../lib/discord";
import { sendLog, sendErrorLog } from "../lib/discord";
import { EmbedBuilder } from "discord.js";
import { logger } from "../lib/logger";

const router = Router();

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY!;

const STAFF_ROLE_ID = "1501682950331301908";
const ROLE_IDS: Record<string, string> = {
  Moderator: "1495222811755806740",
  "Human Resources": "1495222820400009246",
  Partnership: "1495222796517773335",
};
const TEAM_ROLE_IDS: Record<string, string> = {
  Moderator: "1501681813398093955",
  "Human Resources": "1501681511324451028",
  Partnership: "1501681321343193160",
};
const MAIN_GUILD_ID = process.env.DISCORD_MAIN_GUILD_ID!;

router.post(
  "/interactions",
  (req: Request, res: Response): void => {
    if (!PUBLIC_KEY) {
      res.status(500).json({ error: "DISCORD_PUBLIC_KEY not configured" });
      return;
    }

    const signature = req.headers["x-signature-ed25519"] as string;
    const timestamp = req.headers["x-signature-timestamp"] as string;
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!signature || !timestamp || !rawBody) {
      res.status(401).json({ error: "Invalid request signature" });
      return;
    }

    const isValid = verifyKey(rawBody, signature, timestamp, PUBLIC_KEY);
    if (!isValid) {
      res.status(401).json({ error: "Bad request signature" });
      return;
    }

    const interaction = req.body;

    /* =================== PING =================== */
    if (interaction.type === InteractionType.PING) {
      res.json({ type: InteractionResponseType.PONG });
      return;
    }

    /* =================== SLASH COMMANDS =================== */
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      const { name, options } = interaction.data;

      if (name === "blacklist") {
        const user = options?.find((o: any) => o.name === "user")?.value;
        const username = interaction.data.resolved?.users?.[user]?.username ?? user;
        const reason = options?.find((o: any) => o.name === "reason")?.value ?? "No reason";
        const actorName = interaction.member?.user?.username ?? "unknown";

        res.json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: 64 } });

        setImmediate(async () => {
          try {
            const exists = await db.select().from(blacklistTable).where(eq(blacklistTable.discordId, user)).limit(1);
            if (exists.length) {
              await editFollowup(interaction, "❌ Already blacklisted");
              return;
            }
            await db.insert(blacklistTable).values({ discordId: user, discordUsername: username, reason });
            await sendLog(`🚫 BLACKLISTED\n${username} (${user})\nBy: ${actorName}\nReason: ${reason}`);
            await editFollowup(interaction, "✅ Blacklisted");
          } catch (err) {
            logger.error({ err }, "Blacklist command failed");
            await editFollowup(interaction, "❌ An error occurred");
          }
        });
        return;
      }

      if (name === "unblacklist") {
        const user = options?.find((o: any) => o.name === "user")?.value;
        const username = interaction.data.resolved?.users?.[user]?.username ?? user;
        const actorName = interaction.member?.user?.username ?? "unknown";

        res.json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: 64 } });

        setImmediate(async () => {
          try {
            await db.delete(blacklistTable).where(eq(blacklistTable.discordId, user));
            await sendLog(`🟢 UNBLACKLISTED\n${username} (${user})\nBy: ${actorName}`);
            await editFollowup(interaction, "✅ Removed from blacklist");
          } catch (err) {
            logger.error({ err }, "Unblacklist command failed");
            await editFollowup(interaction, "❌ An error occurred");
          }
        });
        return;
      }
    }

    /* =================== BUTTONS =================== */
    if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
      const [action, rawId] = interaction.data.custom_id.split("_");
      const appId = Number(rawId);

      if (Number.isNaN(appId)) {
        res.json({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "❌ Invalid application ID", flags: 64 } });
        return;
      }

      res.json({ type: InteractionResponseType.DEFERRED_MESSAGE_UPDATE });

      setImmediate(async () => {
        try {
          const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, appId)).limit(1);

          if (!application) {
            await sendErrorLog("APPLICATION NOT FOUND", { appId });
            return;
          }

          const guild = await discordClient.guilds.fetch(MAIN_GUILD_ID);
          const member = await guild.members.fetch(application.discordId).catch(() => null);

          if (action === "accept") {
            await db.update(applicationsTable).set({ status: "accepted" }).where(eq(applicationsTable.id, appId));

            try {
              await member?.roles.add(STAFF_ROLE_ID);
              const roleId = ROLE_IDS[application.role];
              if (roleId) await member?.roles.add(roleId);
              const teamRoleId = TEAM_ROLE_IDS[application.role];
              if (teamRoleId) await member?.roles.add(teamRoleId);
            } catch (err) {
              await sendErrorLog("ROLE ASSIGN FAILED", err);
            }

            await sendLog(`✅ ACCEPTED\n${application.discordUsername}\n${application.role}\nID: ${appId}`);

            try {
              const user = await discordClient.users.fetch(application.discordId);
              await user.send(`🎉 Accepted for **${application.role}**`);
            } catch {}

            const oldEmbed = interaction.message?.embeds?.[0];
            const updatedEmbed = oldEmbed
              ? new EmbedBuilder(oldEmbed).setColor(0x57f287).toJSON()
              : undefined;

            await patchMessage(interaction, updatedEmbed ? [updatedEmbed] : [], []);
          }

          if (action === "deny") {
            await db.update(applicationsTable).set({ status: "denied" }).where(eq(applicationsTable.id, appId));
            await sendLog(`❌ DENIED\n${application.discordUsername}\n${application.role}\nID: ${appId}`);

            try {
              const user = await discordClient.users.fetch(application.discordId);
              await user.send(`❌ Your application was denied.`);
            } catch {}

            const oldEmbed = interaction.message?.embeds?.[0];
            const updatedEmbed = oldEmbed
              ? new EmbedBuilder(oldEmbed).setColor(0xed4245).toJSON()
              : undefined;

            await patchMessage(interaction, updatedEmbed ? [updatedEmbed] : [], []);
          }
        } catch (err) {
          await sendErrorLog("INTERACTION ERROR (HTTP)", err);
        }
      });
      return;
    }

    res.status(400).json({ error: "Unknown interaction type" });
  }
);

/* =========================================================
   HELPERS — Discord REST followup/patch via fetch
========================================================= */
async function editFollowup(interaction: any, content: string) {
  const appId = interaction.application_id;
  const token = interaction.token;
  await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

async function patchMessage(interaction: any, embeds: any[], components: any[]) {
  const appId = interaction.application_id;
  const token = interaction.token;
  await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds, components }),
  });
}

export default router;
