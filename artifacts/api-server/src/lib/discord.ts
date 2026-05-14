import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";

import { db } from "@workspace/db";
import { applicationsTable, blacklistTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Application } from "@workspace/db";
import { logger } from "./logger";

/* =========================================================
   CONFIG
========================================================= */
const TOKEN = process.env.DISCORD_BOT_TOKEN!;
const MAIN_GUILD_ID = process.env.DISCORD_MAIN_GUILD_ID!;
const STAFF_CHANNEL_ID = process.env.DISCORD_STAFF_CHANNEL_ID!;
const STAFF_SERVER_INVITE = process.env.DISCORD_STAFF_SERVER_INVITE!;
const LOG_CHANNEL_ID = "1503421476487827668";

/* =========================================================
   ROLE IDS
========================================================= */
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

/* =========================================================
   CLIENT
========================================================= */
export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

/* =========================================================
   LOG HELPER
========================================================= */
async function sendLog(content: string) {
  try {
    const channel = await discordClient.channels.fetch(LOG_CHANNEL_ID);
    if (channel && channel.isTextBased()) {
      await channel.send({ content });
    }
  } catch (err) {
    logger.error({ err }, "Log failed");
  }
}

/* =========================================================
   READY
========================================================= */
discordClient.once("ready", async () => {
  logger.info({ tag: discordClient.user?.tag }, "Bot ready");
});

/* =========================================================
   INTERACTIONS
========================================================= */
discordClient.on("interactionCreate", async (interaction) => {
  try {
    /* ================= BUTTONS ================= */
    if (interaction.isButton()) {
      const parts = interaction.customId.split("_");

      const action = parts[0];
      const rawId = parts.slice(1).join("_"); // 🔥 FIX: prevents broken split issues

      if (!rawId) {
        return interaction.reply({
          content: "❌ Missing application ID",
          flags: 64,
        });
      }

      await interaction.deferUpdate();

      // 🔥 FIX: ALWAYS treat ID as NUMBER safely
      const appId = Number(rawId);

      if (Number.isNaN(appId)) {
        logger.warn({ rawId }, "Invalid appId parsed from button");
        return interaction.message.edit({
          content: "❌ Invalid application ID (parse error)",
          embeds: [],
          components: [],
        });
      }

      // 🔥 DEBUG: confirm what we are searching
      logger.info({ appId }, "Looking up application");

      const [application] = await db
        .select()
        .from(applicationsTable)
        .where(eq(applicationsTable.id, appId))
        .limit(1);

      // 🔥 FIXED ERROR INFO (NOT BLIND FAIL)
      if (!application) {
        logger.warn({ appId }, "Application not found in DB");

        return interaction.message.edit({
          content: `❌ Application not found in database (ID: ${appId})`,
          embeds: [],
          components: [],
        });
      }

      const guild = await discordClient.guilds.fetch(MAIN_GUILD_ID);
      const member = await guild.members
        .fetch(application.discordId)
        .catch(() => null);

      /* ================= ACCEPT ================= */
      if (action === "accept") {
        await db
          .update(applicationsTable)
          .set({ status: "accepted" })
          .where(eq(applicationsTable.id, appId));

        try {
          await member?.roles.add(STAFF_ROLE_ID);

          const roleId = ROLE_IDS[application.role];
          if (roleId) await member?.roles.add(roleId);

          const teamRoleId = TEAM_ROLE_IDS[application.role];
          if (teamRoleId) await member?.roles.add(teamRoleId);
        } catch (err) {
          logger.error({ err }, "Role assign failed");
        }

        await sendLog(
          `✅ ACCEPTED\nUser: ${application.discordUsername}\nRole: ${application.role}\nID: ${appId}`
        );

        try {
          const user = await discordClient.users.fetch(application.discordId);
          await user.send(`🎉 Accepted for **${application.role}**`);
        } catch {}

        const embed = EmbedBuilder.from(
          interaction.message.embeds[0]
        ).setColor(0x57f287);

        return interaction.message.edit({
          embeds: [embed],
          components: [],
        });
      }

      /* ================= DENY ================= */
      if (action === "deny") {
        await db
          .update(applicationsTable)
          .set({ status: "denied" })
          .where(eq(applicationsTable.id, appId));

        await sendLog(
          `❌ DENIED\nUser: ${application.discordUsername}\nRole: ${application.role}\nID: ${appId}`
        );

        try {
          const user = await discordClient.users.fetch(application.discordId);
          await user.send(`❌ Your application was denied.`);
        } catch {}

        const embed = EmbedBuilder.from(
          interaction.message.embeds[0]
        ).setColor(0xed4245);

        return interaction.message.edit({
          embeds: [embed],
          components: [],
        });
      }
    }
  } catch (err: any) {
    logger.error({ err }, "Interaction crash");

    try {
      if (interaction.isRepliable()) {
        return interaction.reply({
          content: `❌ Error: ${err?.message || "Unknown error"}`,
          flags: 64,
        });
      }
    } catch {}
  }
});

/* =========================================================
   APPLICATION SENDER (IMPORTANT FIX HERE)
========================================================= */
export async function sendApplicationToDiscord(application: Application) {
  const channel = (await discordClient.channels.fetch(
    STAFF_CHANNEL_ID
  )) as TextChannel;

  const embed = new EmbedBuilder()
    .setTitle(`New ${application.role} Application`)
    .setColor(0x5865f2)
    .addFields(
      { name: "User", value: application.discordUsername },
      { name: "ID", value: application.discordId },
      { name: "Role", value: application.role }
    )
    .setFooter({ text: `App ID: ${application.id}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`accept_${String(application.id)}`) // 🔥 FIX: force string safety
      .setLabel("Accept")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`deny_${String(application.id)}`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

/* =========================================================
   INIT
========================================================= */
export async function initDiscordBot() {
  if (!TOKEN) return;
  await discordClient.login(TOKEN);
}