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
        opt.setName("reason").setDescription("Reason for blacklisting").setRequired(false)
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName("unblacklist")
      .setDescription("Remove a user from the blacklist")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to unblacklist").setRequired(true)
      )
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(discordClient.user!.id, MAIN_GUILD_ID), {
      body: commands,
    });
    logger.info("Registered slash commands in main guild");
  } catch (err) {
    logger.error({ err }, "Failed to register slash commands");
  }
}

discordClient.once("ready", async () => {
  logger.info({ tag: discordClient.user?.tag }, "Discord bot ready");
  await registerCommands();
});

discordClient.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "blacklist") {
      const targetUser = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") ?? "No reason provided";

      const existing = await db
        .select()
        .from(blacklistTable)
        .where(eq(blacklistTable.discordId, targetUser.id))
        .limit(1);

      if (existing.length > 0) {
        await interaction.reply({
          content: `**${targetUser.username}** is already blacklisted.`,
          flags: 64,
        });
        return;
      }

      await db.insert(blacklistTable).values({
        discordId: targetUser.id,
        discordUsername: targetUser.username,
        reason,
      });

      await interaction.reply({
        content: `✅ **${targetUser.username}** (\`${targetUser.id}\`) has been blacklisted.\nReason: ${reason}`,
      });
      return;
    }

    if (interaction.commandName === "unblacklist") {
      const targetUser = interaction.options.getUser("user", true);

      const existing = await db
        .select()
        .from(blacklistTable)
        .where(eq(blacklistTable.discordId, targetUser.id))
        .limit(1);

      if (existing.length === 0) {
        await interaction.reply({
          content: `**${targetUser.username}** is not blacklisted.`,
          flags: 64,
        });
        return;
      }

      await db.delete(blacklistTable).where(eq(blacklistTable.discordId, targetUser.id));

      await interaction.reply({
        content: `✅ **${targetUser.username}** (\`${targetUser.id}\`) has been removed from the blacklist.`,
      });
      return;
    }
  }

  if (interaction.isButton()) {
    const [action, appIdStr] = interaction.customId.split("_");
    const appId = parseInt(appIdStr, 10);
    if (isNaN(appId)) return;

    const [application] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, appId))
      .limit(1);

    if (!application) {
      await interaction.reply({ content: "Application not found.", flags: 64 });
      return;
    }

    if (application.status !== "pending") {
      await interaction.reply({
        content: `This application has already been **${application.status}**.`,
        flags: 64,
      });
      return;
    }

    if (action === "accept") {
      await db
        .update(applicationsTable)
        .set({ status: "accepted" })
        .where(eq(applicationsTable.id, appId));

      try {
        const user = await discordClient.users.fetch(application.discordId);
        await user.send(
          `🎉 **Congratulations!** Your application for **${application.role}** has been **accepted**!\n\nJoin the staff server here: ${STAFF_SERVER_INVITE}`
        );
      } catch {
        logger.warn({ appId }, "Could not DM accepted applicant");
      }

      try {
        const guild = await discordClient.guilds.fetch(MAIN_GUILD_ID);
        const member = await guild.members.fetch(application.discordId).catch(() => null);
        if (member) {
          const roleName = application.role;
          const guildRole = guild.roles.cache.find(
            (r) => r.name.toLowerCase() === roleName.toLowerCase()
          );
          if (guildRole) {
            await member.roles.add(guildRole);
            logger.info({ role: roleName }, "Assigned role to accepted applicant");
          }
        }
      } catch (err) {
        logger.warn({ err }, "Could not assign role");
      }

      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0x57f287)
        .setFooter({ text: `✅ Accepted by ${interaction.user.username}` });

      await interaction.update({ embeds: [updatedEmbed], components: [] });
    } else if (action === "deny") {
      await db
        .update(applicationsTable)
        .set({ status: "denied" })
        .where(eq(applicationsTable.id, appId));

      try {
        const user = await discordClient.users.fetch(application.discordId);
        await user.send(
          `❌ Your application for **${application.role}** has been **denied**.\n\nThank you for your interest. You may apply again in the future.`
        );
      } catch {
        logger.warn({ appId }, "Could not DM denied applicant");
      }

      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0xed4245)
        .setFooter({ text: `❌ Denied by ${interaction.user.username}` });

      await interaction.update({ embeds: [updatedEmbed], components: [] });
    }
  }
});

export async function sendApplicationToDiscord(application: Application) {
  const channel = (await discordClient.channels.fetch(STAFF_CHANNEL_ID)) as TextChannel;
  if (!channel) throw new Error("Staff channel not found");

  const embed = new EmbedBuilder()
    .setTitle(`New ${application.role} Application`)
    .setColor(ROLE_COLORS[application.role] ?? 0x5865f2)
    .addFields(
      { name: "Discord Username", value: application.discordUsername, inline: true },
      { name: "Discord ID", value: application.discordId, inline: true },
      { name: "Role", value: application.role, inline: true },
      { name: "Age", value: String(application.age), inline: true },
      { name: "Timezone", value: application.timezone, inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
      { name: "Experience", value: application.experience },
      { name: "Why do you want to join?", value: application.whyJoin },
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

export async function initDiscordBot() {
  if (!TOKEN) {
    logger.warn("DISCORD_BOT_TOKEN not set — bot will not start");
    return;
  }
  await discordClient.login(TOKEN);
}
