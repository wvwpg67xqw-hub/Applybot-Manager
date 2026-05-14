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
import OpenAI from "openai";

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

/* LOG CHANNELS */
const APP_LOG_CHANNEL_ID = "1504481311539204246";
const ERROR_LOG_CHANNEL_ID = "1504477352514682922";

/* =========================================================
   ROLES
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
   LOG HELPERS
========================================================= */
async function sendLog(content: string) {
  try {
    const channel = await discordClient.channels.fetch(APP_LOG_CHANNEL_ID);
    if (channel && channel.isTextBased()) {
      await channel.send({ content });
    }
  } catch (err) {
    console.error("App log failed:", err);
  }
}

async function sendErrorLog(title: string, payload: any) {
  try {
    const channel = await discordClient.channels.fetch(ERROR_LOG_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;

    const safe =
      typeof payload === "string"
        ? payload
        : JSON.stringify(
            payload,
            Object.getOwnPropertyNames(payload),
            2
          );

    await channel.send({
      content:
        `🚨 **${title}**\n\`\`\`js\n${safe.slice(0, 1900)}\n\`\`\``,
    });
  } catch (err) {
    console.error("Error log failed:", err);
  }
}

/* =========================================================
   GLOBAL CRASH HANDLERS
========================================================= */
process.on("uncaughtException", async (err) => {
  console.error("Uncaught Exception:", err);
  await sendErrorLog("UNCAUGHT EXCEPTION", err);
});

process.on("unhandledRejection", async (reason) => {
  console.error("Unhandled Rejection:", reason);
  await sendErrorLog("UNHANDLED REJECTION", reason);
});

/* =========================================================
   COMMANDS
========================================================= */
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("blacklist")
      .setDescription("Blacklist a user from applying")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((o) =>
        o.setName("user").setDescription("The user to blacklist").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("reason").setDescription("Reason for blacklisting").setRequired(false)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName("unblacklist")
      .setDescription("Remove a user from the blacklist")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addUserOption((o) =>
        o.setName("user").setDescription("The user to unblacklist").setRequired(true)
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
   INTERACTIONS
========================================================= */
discordClient.on("interactionCreate", async (interaction) => {
  try {
    /* ================= SLASH COMMANDS ================= */
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "blacklist") {
        const user = interaction.options.getUser("user", true);
        const reason =
          interaction.options.getString("reason") ?? "No reason";

        const exists = await db
          .select()
          .from(blacklistTable)
          .where(eq(blacklistTable.discordId, user.id))
          .limit(1);

        if (exists.length) {
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

        await sendLog(
          `🚫 BLACKLISTED\n${user.username} (${user.id})\nBy: ${interaction.user.username}`
        );

        return interaction.reply({ content: "✅ Blacklisted" });
      }

      if (interaction.commandName === "unblacklist") {
        const user = interaction.options.getUser("user", true);

        await db
          .delete(blacklistTable)
          .where(eq(blacklistTable.discordId, user.id));

        await sendLog(
          `🟢 UNBLACKLISTED\n${user.username} (${user.id})\nBy: ${interaction.user.username}`
        );

        return interaction.reply({ content: "✅ Removed blacklist" });
      }
    }

    /* ================= BUTTONS ================= */
    if (interaction.isButton()) {
      const [action, rawId] = interaction.customId.split("_");
      const appId = Number(rawId);

      if (Number.isNaN(appId)) {
        return interaction.reply({
          content: "❌ Invalid application ID",
          flags: 64,
        });
      }

      await interaction.deferUpdate();

      const [application] = await db
        .select()
        .from(applicationsTable)
        .where(eq(applicationsTable.id, appId))
        .limit(1);

      if (!application) {
        await sendErrorLog("APPLICATION NOT FOUND", { appId });

        return interaction.message.edit({
          content: `❌ Application not found (${appId})`,
          components: [],
          embeds: [],
        });
      }

      const guild = await discordClient.guilds.fetch(MAIN_GUILD_ID);
      const member = await guild.members.fetch(application.discordId).catch(() => null);

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
          await sendErrorLog("ROLE ASSIGN FAILED", err);
        }

        await sendLog(
          `✅ ACCEPTED\n${application.discordUsername}\n${application.role}\nID: ${appId}`
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
          `❌ DENIED\n${application.discordUsername}\n${application.role}\nID: ${appId}`
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
    await sendErrorLog("INTERACTION ERROR", err);

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
   OPENAI CLIENT
========================================================= */
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL!,
});

/* =========================================================
   AI APPLICATION CHECKER
========================================================= */
async function runAICheck(application: Application): Promise<string> {
  const prompt = `You are a staff reviewer for a Discord community. Analyze this staff application and give a short, honest assessment for the review team.

Application:
- Role applying for: ${application.role}
- Age: ${application.age}
- Timezone: ${application.timezone}
- Availability: ${application.availability}
- Past experience: ${application.experience}
- Why they want to join: ${application.whyJoin}

Respond in this exact format (be concise, max 3 lines each):
**Overall Score:** X/10
**Strengths:** [1–3 bullet points]
**Concerns:** [1–3 bullet points or "None"]
**Recommendation:** Accept / Lean Accept / Neutral / Lean Deny / Deny — [one sentence reason]`;

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
  });

  return response.choices[0]?.message?.content ?? "AI check unavailable.";
}

/* =========================================================
   APPLICATION SENDER
========================================================= */
export async function sendApplicationToDiscord(application: Application) {
  const channel = (await discordClient.channels.fetch(
    STAFF_CHANNEL_ID
  )) as TextChannel;

  /* ---------- SHORT SUMMARY EMBED (main channel message) ---------- */
  const roleColors: Record<string, number> = {
    Moderator: 0x5865f2,
    "Human Resources": 0x57f287,
    Partnership: 0xfee75c,
  };

  const summaryEmbed = new EmbedBuilder()
    .setTitle(`📋 New ${application.role} Application`)
    .setColor(roleColors[application.role] ?? 0x5865f2)
    .addFields(
      { name: "👤 Applicant", value: `${application.discordUsername} (\`${application.discordId}\`)`, inline: true },
      { name: "🎯 Role", value: application.role, inline: true },
      { name: "🎂 Age", value: String(application.age), inline: true },
      { name: "🕐 Timezone", value: application.timezone, inline: true },
      { name: "📅 Availability", value: application.availability, inline: true },
    )
    .setFooter({ text: `Application ID: ${application.id} • ${new Date(application.createdAt).toUTCString()}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`accept_${String(application.id)}`)
      .setLabel("✅ Accept")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`deny_${String(application.id)}`)
      .setLabel("❌ Deny")
      .setStyle(ButtonStyle.Danger),
  );

  const mainMessage = await channel.send({ embeds: [summaryEmbed], components: [row] });

  /* ---------- THREAD: FULL APPLICATION ---------- */
  const thread = await mainMessage.startThread({
    name: `${application.role} — ${application.discordUsername} (#${application.id})`,
    autoArchiveDuration: 10080, // 7 days
  });

  const fullEmbed = new EmbedBuilder()
    .setTitle(`Full Application — ${application.discordUsername}`)
    .setColor(0x2b2d31)
    .addFields(
      { name: "🎯 Role", value: application.role },
      { name: "👤 Discord", value: `${application.discordUsername} (\`${application.discordId}\`)` },
      { name: "🎂 Age", value: String(application.age) },
      { name: "🕐 Timezone", value: application.timezone },
      { name: "📅 Availability", value: application.availability },
      { name: "📖 Past Experience", value: application.experience },
      { name: "💬 Why They Want to Join", value: application.whyJoin },
    )
    .setFooter({ text: `Submitted • Application #${application.id}` })
    .setTimestamp(application.createdAt);

  await thread.send({ embeds: [fullEmbed] });

  /* ---------- THREAD: AI CHECKER ---------- */
  await thread.send({ content: "🤖 **Running AI check…**" });

  try {
    const aiResult = await runAICheck(application);
    const aiEmbed = new EmbedBuilder()
      .setTitle("🤖 AI Staff Checker")
      .setDescription(aiResult)
      .setColor(0x9b59b6)
      .setFooter({ text: "AI analysis — use your own judgment" });

    await thread.send({ embeds: [aiEmbed] });
  } catch (err) {
    logger.error({ err }, "AI check failed");
    await thread.send({ content: "⚠️ AI check failed. Please review manually." });
  }
}

/* =========================================================
   INIT
========================================================= */
export async function initDiscordBot() {
  if (!TOKEN) return;
  await discordClient.login(TOKEN);
}