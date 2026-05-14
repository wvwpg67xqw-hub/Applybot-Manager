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

const TOKEN = process.env.DISCORD_BOT_TOKEN!;
const MAIN_GUILD_ID = process.env.DISCORD_MAIN_GUILD_ID!;
const STAFF_CHANNEL_ID = process.env.DISCORD_STAFF_CHANNEL_ID!;
const STAFF_SERVER_INVITE = process.env.DISCORD_STAFF_SERVER_INVITE!;

const ROLE_COLORS: Record<string, number> = {
  Moderator: 0x5865f2,
  "Human Resources": 0x57f287,
  Partnership: 0xfee75c,
};

export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

/* =========================================================
   COMMAND REGISTRATION
========================================================= */
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("blacklist")
      .setDescription("Blacklist a user from applying")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to blacklist").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason").setRequired(false)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName("unblacklist")
      .setDescription("Remove a user from blacklist")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user").setRequired(true)
      )
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(discordClient.user!.id, MAIN_GUILD_ID),
      { body: commands }
    );
    logger.info("Slash commands registered");
  } catch (err) {
    logger.error({ err }, "Failed to register commands");
  }
}

/* =========================================================
   READY EVENT
========================================================= */
discordClient.once("ready", async () => {
  logger.info({ tag: discordClient.user?.tag }, "Bot ready");
  await registerCommands();
});

/* =========================================================
   INTERACTIONS
========================================================= */
discordClient.on("interactionCreate", async (interaction) => {
  /* ================= CHAT COMMANDS ================= */
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "blacklist") {
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") ?? "No reason";

      const existing = await db
        .select()
        .from(blacklistTable)
        .where(eq(blacklistTable.discordId, user.id))
        .limit(1);

      if (existing.length > 0) {
        await interaction.reply({ content: "Already blacklisted.", flags: 64 });
        return;
      }

      await db.insert(blacklistTable).values({
        discordId: user.id,
        discordUsername: user.username,
        reason,
      });

      await interaction.reply({
        content: `✅ Blacklisted **${user.username}**`,
      });

      return;
    }

    if (interaction.commandName === "unblacklist") {
      const user = interaction.options.getUser("user", true);

      await db
        .delete(blacklistTable)
        .where(eq(blacklistTable.discordId, user.id));

      await interaction.reply({
        content: `✅ Removed **${user.username}** from blacklist`,
      });

      return;
    }
  }

  /* ================= BUTTONS ================= */
  if (interaction.isButton()) {
    const [action, appIdStr] = interaction.customId.split("_");
    const appId = Number(appIdStr);

    if (isNaN(appId)) return;

    /* 🚨 IMPORTANT: instantly acknowledge interaction */
    await interaction.deferUpdate();

    try {
      const [application] = await db
        .select()
        .from(applicationsTable)
        .where(eq(applicationsTable.id, appId))
        .limit(1);

      if (!application) {
        await interaction.editReply({
          content: "❌ Application not found.",
        });
        return;
      }

      if (application.status !== "pending") {
        await interaction.editReply({
          content: `This application is already **${application.status}**.`,
        });
        return;
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

          const member = await guild.members.fetch(application.discordId).catch(() => null);

          if (member) {
            const role = guild.roles.cache.find(
              (r) => r.name.toLowerCase() === application.role.toLowerCase()
            );
            if (role) await member.roles.add(role);
          }
        } catch (err) {
          logger.warn({ err }, "Role assignment failed");
        }

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x57f287)
          .setFooter({ text: `Accepted by ${interaction.user.username}` });

        await interaction.editReply({
          embeds: [embed],
          components: [],
        });
      }

      /* ================= DENY ================= */
      else if (action === "deny") {
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

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0xed4245)
          .setFooter({ text: `Denied by ${interaction.user.username}` });

        await interaction.editReply({
          embeds: [embed],
          components: [],
        });
      }
    } catch (err) {
      logger.error({ err }, "Button interaction failed");

      try {
        await interaction.editReply({
          content: "❌ Something went wrong processing this action.",
        });
      } catch {}
    }
  }
});

/* =========================================================
   SEND APPLICATION TO DISCORD
========================================================= */
export async function sendApplicationToDiscord(application: Application) {
  const channel = (await discordClient.channels.fetch(
    STAFF_CHANNEL_ID
  )) as TextChannel;

  const embed = new EmbedBuilder()
    .setTitle(`New ${application.role} Application`)
    .setColor(ROLE_COLORS[application.role] ?? 0x5865f2)
    .addFields(
      { name: "Username", value: application.discordUsername, inline: true },
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
   INIT BOT
========================================================= */
export async function initDiscordBot() {
  if (!TOKEN) {
    logger.warn("No bot token provided");
    return;
  }

  await discordClient.login(TOKEN);
}