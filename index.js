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
const sqlite3 = require("sqlite3").verbose();

// =====================
// CLIENT
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// =====================
// CONFIG
// =====================
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

// =====================
// DATABASE
// =====================
const db = new sqlite3.Database("./bot.db");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS levels (
    userId TEXT PRIMARY KEY,
    xp INTEGER,
    level INTEGER,
    lastXp INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tickets (
    channelId TEXT PRIMARY KEY,
    ownerId TEXT,
    claimedBy TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS polls (
    messageId TEXT PRIMARY KEY,
    createdAt INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS poll_votes (
    messageId TEXT,
    userId TEXT,
    vote TEXT,
    PRIMARY KEY (messageId, userId)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT,
    target TEXT,
    moderator TEXT,
    reason TEXT,
    time INTEGER
  )`);
});

// =====================
// HELPERS
// =====================
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
  db.run(
    `INSERT INTO cases (action, target, moderator, reason, time)
     VALUES (?, ?, ?, ?, ?)`,
    [action, target, moderator, reason, Date.now()]
  );

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

// =====================
// LEVEL SYSTEM
// =====================
const XP_MIN = 10;
const XP_MAX = 20;
const XP_COOLDOWN = 60000;

function xpForLevel(lvl) {
  return Math.floor(100 * lvl * 1.5);
}

function addXP(message) {
  const now = Date.now();
  const userId = message.author.id;

  db.get(`SELECT * FROM levels WHERE userId = ?`, [userId], (e, row) => {
    if (!row) {
      db.run(`INSERT INTO levels VALUES (?, 0, 1, 0)`, [userId]);
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

    db.run(
      `UPDATE levels SET xp=?, level=?, lastXp=? WHERE userId=?`,
      [xp, level, now, userId]
    );
  });
}

// =====================
// READY
// =====================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// =====================
// MESSAGE CREATE
// =====================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  addXP(message);

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  // =====================
  // SEND TICKET PANEL
  // =====================
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

  // =====================
  // SSU VOTE
  // =====================
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
    db.run(`INSERT INTO polls VALUES (?, ?)`, [msg.id, Date.now()]);
  }

  // =====================
  // MODERATION
// =====================
if (["warn", "kick", "ban", "unban"].includes(cmd)) {
  if (!isStaff(message.member)) return;
}

if (cmd === "warn") {
  const target = await resolveTarget(message);
  if (!target) return message.reply("❌ User not found.");
  const reason = args.join(" ") || "No reason provided";
  logCase("Warn", target.id, message.author.id, reason);
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

// =====================
// INTERACTIONS
// =====================
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

    db.run(`INSERT INTO tickets VALUES (?, ?, NULL)`, [channel.id, user.id]);

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
      db.run(`UPDATE tickets SET claimedBy=? WHERE channelId=?`, [
        interaction.user.id,
        interaction.channelId
      ]);
      interaction.reply({ content: "✅ Ticket claimed.", ephemeral: true });
    }

    if (interaction.customId === "ticket_unclaim") {
      db.run(`UPDATE tickets SET claimedBy=NULL WHERE channelId=?`, [
        interaction.channelId
      ]);
      interaction.reply({ content: "ℹ️ Ticket unclaimed.", ephemeral: true });
    }

    if (interaction.customId === "ticket_close") {
      db.run(`DELETE FROM tickets WHERE channelId=?`, [
        interaction.channelId
      ]);
      interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
      setTimeout(() => interaction.channel.delete(), 3000);
    }
  }

  // SSU vote buttons
  if (interaction.isButton() && interaction.customId.startsWith("poll_")) {
    const vote =
      interaction.customId === "poll_attend"
        ? "attend"
        : interaction.customId === "poll_cant"
        ? "cant"
        : null;

    if (vote) {
      db.run(
        `INSERT OR REPLACE INTO poll_votes VALUES (?, ?, ?)`,
        [interaction.message.id, interaction.user.id, vote]
      );
      interaction.reply({ content: "✅ Vote updated.", ephemeral: true });
    }

    if (interaction.customId === "poll_view") {
      db.all(
        `SELECT * FROM poll_votes WHERE messageId=?`,
        [interaction.message.id],
        (e, rows) => {
          const attend = rows.filter(r => r.vote === "attend").map(r => `<@${r.userId}>`).join("\n") || "None";
          const cant = rows.filter(r => r.vote === "cant").map(r => `<@${r.userId}>`).join("\n") || "None";

          interaction.reply({
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
      );
    }
  }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);
