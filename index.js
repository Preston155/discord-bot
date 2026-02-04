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
          .setTitle("📈 User Level")
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
      .setColor("#0ea5e9")
      .setTitle("🏛️ Lake County Roleplay | Support Center")
      .setDescription(
        "Use the menu below to open a support ticket.\n\n" +
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

  /* ---- SSU VOTE ---- */
  if (cmd === "ssuvote") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ Staff only.");
    }

    const embed = new EmbedBuilder()
      .setColor("#22c55e")
      .setTitle("📊 Session Attendance Poll")
      .setDescription(
        "**Server Startup (SSU) Interest Check**\n\n" +
        "Click below to indicate your availability.\n\n" +
        "**Auto-starts at 5 Attend votes.**"
      )
      .setImage(SESSION_BANNER_URL);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("attend").setLabel("✅ Attend (0/5)").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("cant").setLabel("❌ Can’t Attend (0)").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("view").setLabel("👀 View Voters").setStyle(ButtonStyle.Secondary)
    );

    const msg = await message.channel.send({ embeds: [embed], components: [row] });

    polls[msg.id] = {
      channelId: msg.channel.id,
      attend: [],
      cant: [],
      started: false
    };

    save(FILES.polls, polls);
    await message.delete().catch(() => {});
  }
});

/* =====================
   INTERACTIONS
===================== */
client.on("interactionCreate", async (interaction) => {
  try {

    /* ---- SESSION POLL BUTTONS ---- */
    if (interaction.isButton() && polls[interaction.message.id]) {
      await interaction.deferReply({ ephemeral: true });

      const poll = polls[interaction.message.id];
      const uid = interaction.user.id;

      if (interaction.customId === "view") {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("👀 Session Poll Voters")
              .addFields(
                { name: "✅ Attend", value: poll.attend.map(id => `<@${id}>`).join("\n") || "None" },
                { name: "❌ Can’t Attend", value: poll.cant.map(id => `<@${id}>`).join("\n") || "None" }
              )
          ]
        });
      }

      if (poll.started) {
        return interaction.editReply("🔒 Voting closed.");
      }

      if (interaction.customId === "attend") {
        poll.attend.includes(uid)
          ? poll.attend = poll.attend.filter(id => id !== uid)
          : (poll.cant = poll.cant.filter(id => id !== uid), poll.attend.push(uid));
      }

      if (interaction.customId === "cant") {
        poll.cant.includes(uid)
          ? poll.cant = poll.cant.filter(id => id !== uid)
          : (poll.attend = poll.attend.filter(id => id !== uid), poll.cant.push(uid));
      }

      if (poll.attend.length >= 5 && !poll.started) {
        poll.started = true;
        await interaction.channel.send(
          SSU_PING_ROLE_ID ? `<@&${SSU_PING_ROLE_ID}>` : "@everyone"
        );
      }

      save(FILES.polls, polls);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("attend").setLabel(`Attend (${poll.attend.length}/5)`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("cant").setLabel(`Can’t Attend (${poll.cant.length})`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("view").setLabel("👀 View Voters").setStyle(ButtonStyle.Secondary)
      );

      await interaction.message.edit({ components: [row] });
      return interaction.editReply("✅ Vote updated.");
    }

  } catch (err) {
    console.error("INTERACTION ERROR:", err);
  }
});

/* =====================
   LOGIN
===================== */
client.login(process.env.TOKEN);
