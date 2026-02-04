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
const Database = require("better-sqlite3");

/* =====================
   CLIENT
===================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

/* =====================
   CONFIG
===================== */
const PREFIX = "!";
const STAFF_ROLE_ID = "1278100769626783837";
const SUPPORT_ROLE_ID = "1282417060391161978";
const SSU_ROLE_PING = "1468213717035384882";
const MOD_LOG_CHANNEL_ID = "1461008751749234740";

const SERVER_INFO = { code: "ILCRPC", owner: "MiningMavenYT" };
const SESSION_BANNER_URL =
  "https://media.discordapp.net/attachments/1452829338545160285/1466919030127591613/ILLEGAL_FIREARM_1.png";

const CATEGORIES = {
  general_support: "1468276842942435338",
  partnership_support: "1461009005798359204",
  ia_support: "1468276930796327125",
  management_support: "1468277029865783489"
};

/* =====================
   DATABASE
===================== */
const db = new Database("./bot.db");

// Levels
db.prepare(`
CREATE TABLE IF NOT EXISTS levels (
  userId TEXT PRIMARY KEY,
  xp INTEGER,
  level INTEGER,
  lastXp INTEGER
)`).run();

// Tickets
db.prepare(`
CREATE TABLE IF NOT EXISTS tickets (
  channelId TEXT PRIMARY KEY,
  ownerId TEXT,
  claimedBy TEXT
)`).run();

// SSU polls
db.prepare(`
CREATE TABLE IF NOT EXISTS polls (
  messageId TEXT PRIMARY KEY,
  createdAt INTEGER
)`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS poll_votes (
  messageId TEXT,
  userId TEXT,
  vote TEXT,
  PRIMARY KEY (messageId, userId)
)`).run();

// Moderation cases
db.prepare(`
CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT,
  target TEXT,
  moderator TEXT,
  reason TEXT,
  time INTEGER
)`).run();

/* =====================
   HELPERS
===================== */
const isStaff = (m) => m.roles.cache.has(STAFF_ROLE_ID);

async function resolveTarget(message) {
  if (message.mentions.members.first())
    return message.mentions.members.first();

  const id = message.content.split(/\s+/)[1];
  if (!id) return null;

  try {
    return await message.guild.members.fetch(id);
  } catch {
    return null;
  }
}

function logCase(action, target, moderator, reason) {
  db.prepare(`
    INSERT INTO cases (action, target, moderator, reason, time)
    VALUES (?, ?, ?, ?, ?)
  `).run(action, target, moderator, reason, Date.now());

  const log = client.channels.cache.get(MOD_LOG_CHANNEL_ID);
  if (log) {
    log.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#dc2626")
          .setTitle("📁 Moderation Case")
          .addFields(
            { name: "Action", value: action, inline: true },
            { name: "User", value: `<@${target}>`, inline: true },
            { name: "Moderator", value: `<@${moderator}>`, inline: true },
            { name: "Reason", value: reason }
          )
          .setTimestamp()
      ]
    });
  }
}

/* =====================
   LEVEL SYSTEM
===================== */
const XP_MIN = 10;
const XP_MAX = 20;
const XP_COOLDOWN = 60000;

function xpForLevel(lvl) {
  return Math.floor(100 * lvl * 1.5);
}

function addXP(message) {
  const now = Date.now();
  const userId = message.author.id;

  let row = db.prepare(`SELECT * FROM levels WHERE userId=?`).get(userId);

  if (!row) {
    db.prepare(`INSERT INTO levels VALUES (?,0,1,0)`).run(userId);
    return;
  }

  if (now - row.lastXp < XP_COOLDOWN) return;

  let xp =
    row.xp + Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
  let level = row.level;

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
    message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#facc15")
          .setTitle("⬆️ Level Up!")
          .setDescription(`${message.author} reached **Level ${level}**!`)
      ]
    });
  }

  db.prepare(`
    UPDATE levels SET xp=?, level=?, lastXp=? WHERE userId=?
  `).run(xp, level, now, userId);
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

  addXP(message);

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  /* ----- TICKET PANEL ----- */
  if (cmd === "sendpanel" && isStaff(message.member)) {
    const embed = new EmbedBuilder()
      .setColor("#2563eb")
      .setTitle("🎟️ Support Tickets — Lake County Roleplay")
      .setDescription(
        "**Select a department below**\n\n• One issue per ticket\n• Do not ping staff\n• Be respectful"
      );

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category")
      .setPlaceholder("Select a category")
      .addOptions(
        { label: "General Support", value: "general_support", emoji: "🎫" },
        { label: "Partnerships", value: "partnership_support", emoji: "🤝" },
        { label: "Internal Affairs", value: "ia_support", emoji: "🛡️" },
        { label: "Management", value: "management_support", emoji: "👑" }
      );

    message.channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  /* ----- SSU VOTE ----- */
  if (cmd === "ssuvote" && isStaff(message.member)) {
    const embed = new EmbedBuilder()
      .setColor("#16a34a")
      .setTitle("🚨 Server Startup Vote")
      .setDescription("Vote below.\n\nAuto-starts at **5 attending**.")
      .setImage(SESSION_BANNER_URL);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("poll_attend").setLabel("Attend").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("poll_cant").setLabel("Can’t Attend").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("poll_view").setLabel("👀 View Voters").setStyle(ButtonStyle.Secondary)
    );

    const msg = await message.channel.send({ embeds: [embed], components: [row] });
    db.prepare(`INSERT INTO polls VALUES (?,?)`).run(msg.id, Date.now());
  }

  /* ----- SSU / SSD ----- */
  if (cmd === "ssu" && isStaff(message.member)) {
    const poll = db.prepare(
      `SELECT messageId FROM polls ORDER BY createdAt DESC LIMIT 1`
    ).get();
    if (!poll) return message.reply("❌ No SSU poll found.");

    const voters = db.prepare(
      `SELECT userId FROM poll_votes WHERE messageId=? AND vote='attend'`
    ).all(poll.messageId).map(v => `<@${v.userId}>`).join(" ");

    message.channel.send({
      content: `<@&${SSU_ROLE_PING}>\n${voters}`,
      embeds: [
        new EmbedBuilder()
          .setColor("#22c55e")
          .setTitle("🚨 Server Startup!")
          .setDescription(
            `Game Code: **${SERVER_INFO.code}**\nServer Owner: **${SERVER_INFO.owner}**`
          )
      ]
    });
  }

  if (cmd === "ssd" && isStaff(message.member)) {
    message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#dc2626")
          .setTitle("🔕 Server Shutdown")
          .setDescription("The server has shut down temporarily.")
      ]
    });
  }

  /* ----- MODERATION ----- */
  if (["warn","kick","ban","unban"].includes(cmd) && !isStaff(message.member)) return;

  if (cmd === "warn") {
    const target = await resolveTarget(message);
    if (!target) return message.reply("❌ User not found.");
    logCase("Warn", target.id, message.author.id, args.join(" ") || "No reason");
    message.reply(`⚠️ Warned **${target.user.tag}**`);
  }

  if (cmd === "kick") {
    const target = await resolveTarget(message);
    if (!target || !target.kickable) return message.reply("❌ Cannot kick user.");
    await target.kick();
    logCase("Kick", target.id, message.author.id, "Kicked");
    message.reply(`👢 Kicked **${target.user.tag}**`);
  }

  if (cmd === "ban") {
    const target = await resolveTarget(message);
    if (!target || !target.bannable) return message.reply("❌ Cannot ban user.");
    await target.ban();
    logCase("Ban", target.id, message.author.id, "Banned");
    message.reply(`🔨 Banned **${target.user.tag}**`);
  }

  if (cmd === "unban") {
    const uid = args[0];
    if (!uid) return message.reply("❌ Provide user ID.");
    await message.guild.members.unban(uid);
    logCase("Unban", uid, message.author.id, "Unbanned");
    message.reply(`✅ Unbanned <@${uid}>`);
  }
});

/* =====================
   INTERACTIONS
===================== */
client.on("interactionCreate", async (interaction) => {
  // Ticket creation
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category") {
    const user = interaction.user;
    const key = interaction.values[0];

    const channel = await interaction.guild.channels.create({
      name: `${user.username}-ticket`,
      parent: CATEGORIES[key],
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: SUPPORT_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    db.prepare(`INSERT INTO tickets VALUES (?, ?, NULL)`).run(channel.id, user.id);

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_claim").setLabel("Claim").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ticket_unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ticket_close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    channel.send({
      content: `<@${user.id}> <@&${SUPPORT_ROLE_ID}>`,
      embeds: [
        new EmbedBuilder()
          .setColor("#22c55e")
          .setTitle("🎫 Ticket Created")
          .setDescription("A staff member will assist you shortly.")
      ],
      components: [buttons]
    });

    interaction.reply({ content: "✅ Ticket created.", ephemeral: true });
  }

  // Ticket buttons
  if (interaction.isButton()) {
    if (interaction.customId === "ticket_claim") {
      db.prepare(`UPDATE tickets SET claimedBy=? WHERE channelId=?`)
        .run(interaction.user.id, interaction.channelId);
      interaction.reply({ content: "✅ Ticket claimed.", ephemeral: true });
    }

    if (interaction.customId === "ticket_unclaim") {
      db.prepare(`UPDATE tickets SET claimedBy=NULL WHERE channelId=?`)
        .run(interaction.channelId);
      interaction.reply({ content: "ℹ️ Ticket unclaimed.", ephemeral: true });
    }

    if (interaction.customId === "ticket_close") {
      db.prepare(`DELETE FROM tickets WHERE channelId=?`)
        .run(interaction.channelId);
      interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
      setTimeout(() => interaction.channel.delete(), 3000);
    }
  }

  // SSU voting
  if (interaction.isButton() && interaction.customId.startsWith("poll_")) {
    if (interaction.customId === "poll_view") {
      const rows = db.prepare(
        `SELECT * FROM poll_votes WHERE messageId=?`
      ).all(interaction.message.id);

      const attend = rows.filter(r => r.vote==="attend").map(r=>`<@${r.userId}>`).join("\n") || "None";
      const cant = rows.filter(r => r.vote==="cant").map(r=>`<@${r.userId}>`).join("\n") || "None";

      return interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle("👀 Voters")
            .addFields(
              { name: "Attend", value: attend },
              { name: "Can’t Attend", value: cant }
            )
        ]
      });
    }

    const vote =
      interaction.customId === "poll_attend" ? "attend" :
      interaction.customId === "poll_cant" ? "cant" : null;

    if (!vote) return;

    db.prepare(
      `INSERT OR REPLACE INTO poll_votes VALUES (?,?,?)`
    ).run(interaction.message.id, interaction.user.id, vote);

    interaction.reply({ content: "✅ Vote updated.", ephemeral: true });
  }
});

/* =====================
   LOGIN
===================== */
client.login(process.env.TOKEN);
