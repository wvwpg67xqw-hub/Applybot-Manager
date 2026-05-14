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
   ENV
========================================================= */
const TOKEN = process.env.DISCORD_BOT_TOKEN!;
const MAIN_GUILD_ID = process.env.DISCORD_MAIN_GUILD_ID!;
const STAFF_CHANNEL_ID = process.env.DISCORD_STAFF_CHANNEL_ID!;
const STAFF_SERVER_INVITE = process.env.DISCORD_STAFF_SERVER_INVITE!;

/* =========================================================
   CLIENT
========================================================= */
export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

/* =========================================================
   COMMANDS
========================================================= */
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("blacklist")
      .setDescription("Blacklist a user")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((o) =>
        o.setName("user").setDescription("User").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("reason").setDescription("Reason")
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName("unblacklist")
      .setDescription("Remove blacklist")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((o) =>
        o.setName("user").setDescription("User").setRequired(true)
      )
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(discordClient.user!.id, MAIN_GUILD_ID),
    { body: commands }
  );

  logger.info("Commands registered");
}

/* =========================================================
   READY
========================================================= */
discordClient.once("ready", async () => {
  logger.info({ tag: discordClient.user?.tag }, "Bot ready");
  await registerCommands();
});

/* =========================================================
   INTERACTIONS (FIXED CORE)
========================================================= */
discordClient.on("interactionCreate", async (interaction) => {
  try {
    /* ================= SLASH COMMANDS ================= */
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "blacklist") {
        const user = interaction.options.getUser("user", true);
        const reason =
          interaction.options.getString("reason") ?? "No reason";

        const existing = await db
          .select()
          .from(blacklistTable)
          .where(eq(blacklistTable.discordId, user.id))
          .limit(1);

        if (existing.length) {
          return interaction.reply({
            content: "❌ Already blacklisted",
            flags: 64,
          });
        }

        await db.insert(blacklistTable).values({
          discordId: user.id,
          discordUsername: user.username,
          reason,
        });

        return interaction.reply({
          content: `✅ Blacklisted ${user.username}`,
        });
      }

      if (interaction.commandName === "unblacklist") {
        const user = interaction.options.getUser("user", true);

        await db
          .delete(blacklistTable)
          .where(eq(blacklistTable.discordId, user.id));

        return interaction.reply({
          content: `✅ Removed ${user.username}`,
        });
      }
    }

    /* ================= BUTTONS ================= */
    if (interaction.isButton()) {
      const [action, idStr] = interaction.customId.split("_");
      const appId = Number(idStr);

      if (isNaN(appId)) {
        return interaction.reply({
          content: "❌ Invalid application ID",
          flags: 64,
        });
      }

      /* 🚨 MUST ACK IMMEDIATELY */
      await interaction.deferUpdate();

      const [application] = await db
        .select()
        .from(applicationsTable)
        .where(eq(applicationsTable.id, appId))
        .limit(1);

      if (!application) {
        return interaction.message.edit({
          content: "❌ Application not found",
          components: [],
          embeds: [],
        });
      }

      if (application.status !== "pending") {
        return interaction.message.edit({
          content: `⚠️ Already ${application.status}`,
          components: [],
          embeds: [],
        });
      }

      /* ================= ACCEPT ================= */
      if (action === "accept") {
        await db
          .update(applicationsTable)
          .set({ status: "accepted" })
          .where(eq(applicationsTable.id, appId));

        try {
          const user = await discordClient.users.fetch(application.discordId);
          await user.send(
            `🎉 Accepted for **${application.role}**!\nJoin: ${STAFF_SERVER_INVITE}`
          );
        } catch {}

        try {
          const guild = await discordClient.guilds.fetch(MAIN_GUILD_ID);
          await guild.roles.fetch();

          const member = await guild.members
            .fetch(application.discordId)
            .catch(() => null);

          const role = guild.roles.cache.find(
            (r) => r.name.toLowerCase() === application.role.toLowerCase()
          );

          if (member && role) {
            await member.roles.add(role);
          }
        } catch (err) {
          logger.warn({ err }, "Role error");
        }

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

        try {
          const user = await discordClient.users.fetch(application.discordId);
          await user.send(
            `❌ Your application for **${application.role}** was denied.`
          );
        } catch {}

        const embed = EmbedBuilder.from(
          interaction.message.embeds[0]
        ).setColor(0xed4245);

        return interaction.message.edit({
          embeds: [embed],
          components: [],
        });
      }

      /* ================= UNKNOWN ================= */
      return interaction.message.edit({
        content: `❌ Unknown action: ${action}`,
        components: [],
      });
    }
  } catch (err: any) {
    logger.error({ err }, "Interaction error");

    try {
      if (interaction.isRepliable()) {
        return interaction.reply({
          content: `❌ Error: ${err?.message || "Unknown error"}`,
          flags: 64,
        });
      }
    } catch {
      // fallback ignored
    }
  }
});

/* =========================================================
   SEND APPLICATION
========================================================= */
export async function sendApplicationToDiscord(application: Application) {
  const channel = (await discordClient.channels.fetch(
    STAFF_CHANNEL_ID
  )) as TextChannel;

  const embed = new EmbedBuilder()
    .setTitle(`New ${application.role} Application`)
    .setColor(0x5865f2)
    .addFields(
      { name: "User", value: application.discordUsername, inline: true },
      { name: "ID", value: application.discordId, inline: true },
      { name: "Role", value: application.role, inline: true },
      { name: "Age", value: String(application.age), inline: true },
      { name: "Timezone", value: application.timezone, inline: true },
      { name: "Experience", value: application.experience },
      { name: "Why Join", value: application.whyJoin },
      { name: "Availability", value: application.availability }
    )
    .setFooter({ text: `Application #${application.id}` })
    .setTimestamp(application.createdAt);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`accept_${application.id}`)
      .setLabel("Accept")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`deny_${application.id}`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

/* =========================================================
   INIT
========================================================= */
export async function initDiscordBot() {
  if (!TOKEN) {
    logger.warn("Missing bot token");
    return;
  }

  await discordClient.login(TOKEN);
}