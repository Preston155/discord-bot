// =====================
// IMPORTS
// =====================
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
// DATA STORAGE (JSON)
// =====================
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const FILES = {
  polls: "polls.json",
  tickets: "tickets.json",
  levels: "levels.json",
  cases: "cases.json"
};

for (const f of Object.values(FILES)) {
  const p = path.join(DATA_DIR, f);
  if (!fs.existsSync(p)) fs.writeFileSync(p, "{}");
}

const load = (f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf8"));
const save = (f, d) =>
  fs.writeFileSync(path.join(DATA_DIR, f), JSON.stringify(d, null, 2));

let polls = load(FILES.polls);
let tickets = load(FILES.tickets);
let levels = load(FILES.levels);
let cases = load(FILES.cases);
if (!cases.lastCase) cases.lastCase = 0;

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

function createCase(action, target, moderator, reason) {
  cases.lastCase++;
  cases[cases.lastCase] = {
    action,
    target,
    moderator,
    reason,
    time: Date.now()
  };
  save(FILES.cases, cases);

  const log = client.channels.cache.get(MOD_LOG_CHANNEL_ID);
  if (log) {
    log.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#dc2626")
          .setTitle(`📁 Case #${cases.lastCase}`)
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

function addXP(id) {
  const now = Date.now();
  if (!levels[id]) levels[id] = { xp: 0, level: 1, last: 0 };
  if (now - levels[id].last < XP_COOLDOWN) return null;

  const gain =
    Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
  levels[id].xp += gain;
  levels[id].last = now;

  let leveled = false;
  while (levels[id].xp >= xpForLevel(levels[id].level)) {
    levels[id].xp -= xpForLevel(levels[id].level);
    levels[id].level++;
    leveled = true;
  }

  save(FILES.levels, levels);
  return leveled ? levels[id].level : null;
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

  const lvlUp = addXP(message.author.id);
  if (lvlUp) {
    message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#facc15")
          .setTitle("⬆️ Level Up!")
          .setDescription(
            `${message.author} reached **Level ${lvlUp}**!`
          )
      ]
    });
  }

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  // LEVEL
  if (cmd === "level") {
    const u = message.mentions.users.first() || message.author;
    const d = levels[u.id] || { level: 1, xp: 0 };
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#3b82f6")
          .setTitle("📈 Level")
          .setDescription(
            `User: ${u}\nLevel: **${d.level}**\nXP: **${d.xp}/${xpForLevel(d.level)}**`
          )
      ]
    });
  }

  // SEND PANEL
  if (cmd === "sendpanel" && isStaff(message.member)) {
const embed = new EmbedBuilder()
  .setColor("#2563eb")
  .setTitle("🎟️ Lake County Roleplay — Support Center")
  .setDescription(
    "**Welcome to the Lake County Roleplay Support Center.**\n\n" +

    "To ensure your request is handled as efficiently as possible, please select the **appropriate department** from the menu below.\n\n" +

    "📌 **Ticket Guidelines**\n" +
    "• Open **one ticket per issue**\n" +
    "• Provide **clear and detailed information**\n" +
    "• Remain **respectful and patient** while waiting for a response\n" +
    "• **Do not ping staff** — your ticket will be handled in order\n\n" +

    "⚠️ **Misuse of the ticket system may result in moderation action.**"
  )
  .setFooter({
    text: "Lake County Roleplay • Support & Staff Services"
  });

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category")
      .setPlaceholder("Select a category")
      .addOptions(
        { label: "General Support", value: "general_support", emoji: "🎫" },
        { label: "Partnerships", value: "partnership_support", emoji: "🤝" },
        { label: "Internal Affairs", value: "ia_support", emoji: "🛡️" },
        { label: "Management", value: "management_support", emoji: "👑" }
      );

    return message.channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  // SSU VOTE
  if (cmd === "ssuvote" && isStaff(message.member)) {
    const embed = new EmbedBuilder()
      .setColor("#16a34a")
      .setTitle("🚨 Server Startup Vote")
      .setDescription(
        "**A Server Startup (SSU) is being proposed.**\n\n" +

    "Please review the information below **before voting**:\n\n" +

    "🟢 **Attend** — You are able and willing to participate in this session\n" +
    "🔴 **Can’t Attend** — You are unavailable for this session\n\n" +

    "📋 **Voting Guidelines**\n" +
    "• Only vote **Attend** if you fully intend to join\n" +
    "• You may change or remove your vote at any time\n" +
    "• Do **not** vote as a joke or to inflate numbers\n\n" +

    "⚙️ **Session Rules**\n" +
    "• The server will **automatically start once 5 players vote Attend**\n" +
    "• Staff may manually start or cancel the session if needed\n\n" +

    "Thank you for helping us keep sessions organized and professional."
      )
      .setFooter({ text: "Lake County Roleplay • Session Management" })
      .setImage(SESSION_BANNER_URL);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("poll_attend").setLabel("Attend (0/5)").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("poll_cant").setLabel("Can’t Attend (0)").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("poll_view").setLabel("👀 View Voters").setStyle(ButtonStyle.Secondary)
    );

    const msg = await message.channel.send({ embeds: [embed], components: [row] });
    polls[msg.id] = { attend: [], cant: [], started: false };
    save(FILES.polls, polls);
  }

  // SSU / SSD
  if (cmd === "ssu" && isStaff(message.member)) {
    const poll = Object.values(polls).reverse()[0];
    if (!poll) return;

    message.channel.send({
      content: `<@&${SSU_ROLE_PING}>\n${poll.attend.map(i=>`<@${i}>`).join(" ")}`,
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

  // MODERATION
  if (["warn","kick","ban","unban"].includes(cmd) && !isStaff(message.member)) return;

  if (cmd === "warn") {
    const target = await resolveTarget(message);
    if (!target) return;
    createCase("Warn", target.id, message.author.id, args.join(" ") || "No reason");
    message.reply(`⚠️ Warned **${target.user.tag}**`);
  }

  if (cmd === "kick") {
    const target = await resolveTarget(message);
    if (!target || !target.kickable) return;
    await target.kick();
    createCase("Kick", target.id, message.author.id, "Kicked");
    message.reply(`👢 Kicked **${target.user.tag}**`);
  }

  if (cmd === "ban") {
    const target = await resolveTarget(message);
    if (!target || !target.bannable) return;
    await target.ban();
    createCase("Ban", target.id, message.author.id, "Banned");
    message.reply(`🔨 Banned **${target.user.tag}**`);
  }

  if (cmd === "unban") {
    const uid = args[0];
    if (!uid) return;
    await message.guild.members.unban(uid);
    createCase("Unban", uid, message.author.id, "Unbanned");
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

    tickets[channel.id] = { owner: user.id, claimedBy: null };
    save(FILES.tickets, tickets);

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_claim").setLabel("Claim").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ticket_unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ticket_close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `<@${user.id}> <@&${SUPPORT_ROLE_ID}>`,
embeds: [
  new EmbedBuilder()
    .setColor("#22c55e")
    .setTitle("🎫 Support Ticket Opened")
    .setDescription(
      "**Your ticket has been successfully created.**\n\n" +

      "A member of our staff team will be with you shortly. To help us assist you as efficiently as possible, please provide the following information:\n\n" +

      "📋 **What to Include**\n" +
      "• A **clear and detailed description** of your issue\n" +
      "• Any **relevant usernames, user IDs, or role names**\n" +
      "• Screenshots, clips, or evidence if applicable\n\n" +

      "⏳ **Important Notes**\n" +
      "• Please remain **patient and respectful** while waiting\n" +
      "• Do **not** ping staff — your ticket is already in the queue\n" +
      "• Opening multiple tickets for the same issue may result in action\n\n" +

      "Thank you for your cooperation."
    )
    .setFooter({
      text: "Lake County Roleplay • Support Ticket System"
    })
    .setImage(SESSION_BANNER_URL)
],
      components: [buttons]
    });

    return interaction.reply({ content: "✅ Ticket created.", ephemeral: true });
  }

  // Ticket buttons (STAFF ONLY)
if (interaction.isButton() && tickets[interaction.channelId]) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
  }

  const ticket = tickets[interaction.channelId];

  // CLAIM
  if (interaction.customId === "ticket_claim") {
    ticket.claimedBy = interaction.user.id;
    save(FILES.tickets, tickets);

    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#3b82f6")
          .setTitle("📌 Ticket Claimed")
          .setDescription(
            `This ticket has been claimed by ${interaction.user}.\n\n` +
            "They will be assisting with this request."
          )
          .setFooter({
            text: "Lake County Roleplay • Ticket System"
          })
      ]
    });

    return interaction.reply({ content: "✅ Ticket claimed.", ephemeral: true });
  }

  // UNCLAIM
  if (interaction.customId === "ticket_unclaim") {
    ticket.claimedBy = null;
    save(FILES.tickets, tickets);

    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#f59e0b")
          .setTitle("📍 Ticket Unclaimed")
          .setDescription(
            "This ticket is no longer claimed and is now available for staff."
          )
          .setFooter({
            text: "Lake County Roleplay • Ticket System"
          })
      ]
    });

    return interaction.reply({ content: "ℹ️ Ticket unclaimed.", ephemeral: true });
  }

  // CLOSE
  if (interaction.customId === "ticket_close") {
    delete tickets[interaction.channelId];
    save(FILES.tickets, tickets);

    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#dc2626")
          .setTitle("🔒 Ticket Closing")
          .setDescription(
            `This ticket has been closed by ${interaction.user}.\n\n` +
            "The channel will be deleted shortly."
          )
          .setFooter({
            text: "Lake County Roleplay • Ticket System"
          })
      ]
    });

    await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
    return setTimeout(() => interaction.channel.delete(), 3000);
  }
}

  // SSU voting (TOGGLE + AUTO)
  if (interaction.isButton() && polls[interaction.message.id]) {
    const poll = polls[interaction.message.id];
    const uid = interaction.user.id;

    if (interaction.customId === "poll_view") {
      return interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle("👀 Voters")
            .addFields(
              { name: "Attend", value: poll.attend.map(i=>`<@${i}>`).join("\n") || "None" },
              { name: "Can’t Attend", value: poll.cant.map(i=>`<@${i}>`).join("\n") || "None" }
            )
        ]
      });
    }

    if (interaction.customId === "poll_attend") {
      if (poll.attend.includes(uid)) {
        poll.attend = poll.attend.filter(i => i !== uid);
      } else {
        poll.cant = poll.cant.filter(i => i !== uid);
        poll.attend.push(uid);
      }
    }

    if (interaction.customId === "poll_cant") {
      if (poll.cant.includes(uid)) {
        poll.cant = poll.cant.filter(i => i !== uid);
      } else {
        poll.attend = poll.attend.filter(i => i !== uid);
        poll.cant.push(uid);
      }
    }

    if (poll.attend.length >= 5 && !poll.started) {
      poll.started = true;
      interaction.channel.send({
        content: `<@&${SSU_ROLE_PING}>\n${poll.attend.map(i=>`<@${i}>`).join(" ")}`,
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

    save(FILES.polls, polls);

    await interaction.message.edit({
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("poll_attend").setLabel(`Attend (${poll.attend.length}/5)`).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("poll_cant").setLabel(`Can’t Attend (${poll.cant.length})`).setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("poll_view").setLabel("👀 View Voters").setStyle(ButtonStyle.Secondary)
        )
      ]
    });

    return interaction.reply({ content: "✅ Vote updated.", ephemeral: true });
  }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);
