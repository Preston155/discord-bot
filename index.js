const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* =====================
   CONFIG
===================== */
const PREFIX = "!";
const SUPPORT_ROLE_ID = "1282417060391161978";
const SSU_PING_ROLE_ID = null; // null = @everyone

const SESSION_BANNER_URL =
  "https://media.discordapp.net/attachments/1452829338545160285/1466919030127591613/ILLEGAL_FIREARM_1.png";

const CATEGORIES = {
  general_support: "1468276842942435338",
  partnership_support: "1461009005798359204",
  ia_support: "1468276930796327125",
  management_support: "1468277029865783489"
};

/* =====================
   LEVEL CONFIG
===================== */
const LEVEL_XP_COOLDOWN = 60 * 1000;
const XP_MIN = 10;
const XP_MAX = 20;

/* =====================
   DATA FILES
===================== */
const DATA_DIR = path.join(__dirname, "data");
const FILES = {
  polls: path.join(DATA_DIR, "polls.json"),
  tickets: path.join(DATA_DIR, "tickets.json"),
  levels: path.join(DATA_DIR, "levels.json")
};

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
for (const file of Object.values(FILES)) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, "{}");
}

const load = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const save = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

let polls = load(FILES.polls);
let tickets = load(FILES.tickets);
let levels = load(FILES.levels);

/* =====================
   LEVEL FUNCTIONS
===================== */
function xpForLevel(level) {
  return Math.floor(100 * level * 1.5);
}

function addXp(userId) {
  const now = Date.now();
  if (!levels[userId]) levels[userId] = { xp: 0, level: 1, lastXp: 0 };
  if (now - levels[userId].lastXp < LEVEL_XP_COOLDOWN) return null;

  const gain = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
  levels[userId].xp += gain;
  levels[userId].lastXp = now;

  let leveled = false;
  while (levels[userId].xp >= xpForLevel(levels[userId].level)) {
    levels[userId].xp -= xpForLevel(levels[userId].level);
    levels[userId].level++;
    leveled = true;
  }

  save(FILES.levels, levels);
  return leveled ? levels[userId].level : null;
}

/* =====================
   READY
===================== */
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* =====================
   MESSAGE CREATE
===================== */
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  /* ---- XP SYSTEM ---- */
  const newLevel = addXp(message.author.id);
  if (newLevel) {
    message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#f1c40f")
          .setTitle("⬆️ Level Up!")
          .setDescription(
            `🎉 ${message.author} leveled up!\n\n` +
            `**New Level:** ${newLevel}`
          )
      ]
    });
  }

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* ---- !LEVEL ---- */
  if (cmd === "level") {
    const user = message.mentions.users.first() || message.author;
    if (!levels[user.id]) levels[user.id] = { xp: 0, level: 1, lastXp: 0 };

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#3498db")
          .setTitle("📈 Level Information")
          .setDescription(
            `**User:** ${user}\n` +
            `**Level:** ${levels[user.id].level}\n` +
            `**XP:** ${levels[user.id].xp} / ${xpForLevel(levels[user.id].level)}`
          )
      ]
    });
  }

  /* ---- SEND TICKET PANEL ---- */
  if (cmd === "sendpanel") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const embed = new EmbedBuilder()
      .setColor("#00b0f4")
      .setTitle("🏛️ Lake County Roleplay | Assistance Center")
      .setDescription(
        "Select a category below to contact staff.\n\n" +
        "• One issue per ticket\n• Be respectful\n• Do not ping staff"
      );

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category")
      .setPlaceholder("Select a category…")
      .addOptions(
        { label: "General Support", value: "general_support", emoji: "👥" },
        { label: "Partnership Support", value: "partnership_support", emoji: "🤝" },
        { label: "Internal Affairs", value: "ia_support", emoji: "🛡️" },
        { label: "Management Support", value: "management_support", emoji: "👑" }
      );

    await message.channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)]
    });

    await message.delete().catch(() => {});
  }
});

/* =====================
   INTERACTIONS
===================== */
client.on("interactionCreate", async (interaction) => {
  try {

    /* ---- TICKET CREATION ---- */
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category") {
      await interaction.deferReply({ ephemeral: true });

      const { guild, user } = interaction;
      const cat = interaction.values[0];
      const clean = user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
      const num = Math.floor(1000 + Math.random() * 9000);
      const role = await guild.roles.fetch(SUPPORT_ROLE_ID);

      const channel = await guild.channels.create({
        name: `${clean}-${num}`,
        parent: CATEGORIES[cat],
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: role.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      tickets[channel.id] = { owner: user.id, claimed: null, status: "open" };
      save(FILES.tickets, tickets);

      const embed = new EmbedBuilder()
        .setColor("#00b0f4")
        .setTitle("🎟️ Support Ticket")
        .setDescription(
          `**User:** <@${user.id}>\n` +
          "**Status:** 🟡 Open\n" +
          "**Claimed By:** ❌ Unclaimed"
        );

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
      );

      await channel.send(`<@&${role.id}> | <@${user.id}>`);
      await channel.send({ embeds: [embed], components: [buttons] });

      return interaction.editReply({ content: `✅ Ticket created: ${channel}` });
    }

  } catch (err) {
    console.error("INTERACTION ERROR:", err);
  }
});

/* =====================
   LOGIN
===================== */
client.login(process.env.TOKEN);
