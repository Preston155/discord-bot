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
// DATA STORAGE
// =====================
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const FILES = {
  polls: "polls.json",
  tickets: "tickets.json",
  levels: "levels.json",
  moderation: "moderation.json",
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
let moderation = load(FILES.moderation);
let cases = load(FILES.cases);
if (!cases.lastCase) cases.lastCase = 0;

// =====================
// HELPERS
// =====================
async function getTargetMember(message) {
  const mention = message.mentions.members.first();
  if (mention) return mention;

  const id = message.content.split(/ +/)[1];
  if (!id) return null;

  try {
    return await message.guild.members.fetch(id);
  } catch {
    return null;
  }
}

function createCase(action, target, moderator, reason) {
  cases.lastCase++;
  const id = cases.lastCase;

  cases[id] = { action, target, moderator, reason, time: Date.now() };
  save(FILES.cases, cases);

  const embed = new EmbedBuilder()
    .setColor("#dc2626")
    .setTitle(`📁 Case #${id}`)
    .addFields(
      { name: "Action", value: action, inline: true },
      { name: "User", value: `<@${target}>`, inline: true },
      { name: "Moderator", value: `<@${moderator}>`, inline: true },
      { name: "Reason", value: reason }
    )
    .setTimestamp();

  const ch = client.channels.cache.get(MOD_LOG_CHANNEL_ID);
  if (ch) ch.send({ embeds: [embed] });

  return id;
}

// =====================
// LEVEL SYSTEM
// =====================
const XP_MIN = 10;
const XP_MAX = 20;
const XP_COOLDOWN = 60_000;

function xpForLevel(lvl) {
  return Math.floor(100 * lvl * 1.5);
}

function addXP(id) {
  const now = Date.now();
  if (!levels[id]) levels[id] = { xp: 0, level: 1, last: 0 };
  if (now - levels[id].last < XP_COOLDOWN) return null;

  const gain = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
  levels[id].xp += gain;
  levels[id].last = now;

  let up = false;
  while (levels[id].xp >= xpForLevel(levels[id].level)) {
    levels[id].xp -= xpForLevel(levels[id].level);
    levels[id].level++;
    up = true;
  }

  save(FILES.levels, levels);
  return up ? levels[id].level : null;
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

  // XP
  const lvl = addXP(message.author.id);
  if (lvl) {
    message.channel.send({
      embeds: [new EmbedBuilder().setColor("#facc15").setTitle("⬆️ Level Up!").setDescription(`${message.author} reached **Level ${lvl}**!`)]
    });
  }

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).split(/ +/);
  const cmd = args.shift().toLowerCase();

  // =====================
  // TICKET PANEL
  // =====================
  if (cmd === "sendpanel") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const embed = new EmbedBuilder()
      .setColor("#2563eb")
      .setTitle("🎟️ Support Tickets — Lake County Roleplay")
      .setDescription(
        "Select the correct department below.\n\n" +
        "• One issue per ticket\n" +
        "• Do not ping staff\n" +
        "• Be respectful"
      );

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category")
      .setPlaceholder("Select a category")
      .addOptions(
        { label: "General Support", value: "general_support", emoji: "🎫" },
        { label: "Partnership", value: "partnership_support", emoji: "🤝" },
        { label: "Internal Affairs", value: "ia_support", emoji: "🛡️" },
        { label: "Management", value: "management_support", emoji: "👑" }
      );

    return message.channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  // =====================
  // SSU VOTE
  // =====================
  if (cmd === "ssuvote") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const embed = new EmbedBuilder()
      .setColor("#16a34a")
      .setTitle("🚨 Server Startup Vote")
      .setDescription("Vote below.\n\nAuto-starts at **5 attending**.")
      .setImage(SESSION_BANNER_URL);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("poll_attend").setLabel("Attend (0/5)").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("poll_cant").setLabel("Can’t Attend (0)").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("poll_view").setLabel("👀 View Voters").setStyle(ButtonStyle.Secondary)
    );

    const msg = await message.channel.send({ embeds: [embed], components: [row] });
    polls[msg.id] = { attend: [], cant: [] };
    save(FILES.polls, polls);
  }

  // =====================
  // SSU / SSD
  // =====================
  if (cmd === "ssu") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const poll = Object.values(polls).reverse().find(p => p.attend.length);
    if (!poll) return message.reply("❌ No SSU poll found.");

    const mentions = poll.attend.map(id => `<@${id}>`).join(" ");

    message.channel.send({
      content: `<@&${SSU_ROLE_PING}>\n${mentions}`,
      embeds: [
        new EmbedBuilder()
          .setColor("#22c55e")
          .setTitle("🚨 Server Startup!")
          .setDescription(`Game Code: **${SERVER_INFO.code}**\nServer Owner: **${SERVER_INFO.owner}**`)
      ]
    });
  }

  if (cmd === "ssd") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
    message.channel.send({
      embeds: [new EmbedBuilder().setColor("#dc2626").setTitle("🔕 Server Shutdown").setDescription("Server has shut down.")]
    });
  }

  // =====================
  // LEVEL CHECK
  // =====================
  if (cmd === "level") {
    const u = message.mentions.users.first() || message.author;
    const data = levels[u.id] || { level: 1, xp: 0 };
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#3b82f6")
          .setTitle("📈 Level")
          .setDescription(`User: ${u}\nLevel: **${data.level}**\nXP: **${data.xp}/${xpForLevel(data.level)}**`)
      ]
    });
  }

  // =====================
  // MODERATION
  // =====================
  if (cmd === "warn") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;
    const target = await getTargetMember(message);
    if (!target) return;
    const reason = args.slice(1).join(" ") || "No reason";

    if (!moderation[target.id]) moderation[target.id] = [];
    moderation[target.id].push({ reason, mod: message.author.id, time: Date.now() });
    save(FILES.moderation, moderation);

    const id = createCase("Warn", target.id, message.author.id, reason);
    message.reply(`⚠️ Warned. Case #${id}`);
  }

  if (cmd === "kick") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return;
    const target = await getTargetMember(message);
    if (!target) return;
    await target.kick();
    const id = createCase("Kick", target.id, message.author.id, "Kicked");
    message.reply(`👢 Kicked. Case #${id}`);
  }

  if (cmd === "ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return;
    const target = await getTargetMember(message);
    if (!target) return;
    await target.ban();
    const id = createCase("Ban", target.id, message.author.id, "Banned");
    message.reply(`🔨 Banned. Case #${id}`);
  }

  if (cmd === "unban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return;
    const uid = args[0];
    await message.guild.members.unban(uid);
    const id = createCase("Unban", uid, message.author.id, "Unbanned");
    message.reply(`✅ Unbanned. Case #${id}`);
  }
});

// =====================
// INTERACTIONS
// =====================
client.on("interactionCreate", async (interaction) => {
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category") {
    const categoryKey = interaction.values[0];
    const user = interaction.user;

    const channel = await interaction.guild.channels.create({
      name: `${user.username}-${Object.keys(tickets).length + 1}`,
      parent: CATEGORIES[categoryKey],
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: SUPPORT_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    tickets[channel.id] = { owner: user.id, claimedBy: null };
    save(FILES.tickets, tickets);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_claim").setLabel("Claim").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ticket_unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ticket_close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `<@${user.id}> <@&${SUPPORT_ROLE_ID}>`,
      embeds: [new EmbedBuilder().setColor("#22c55e").setTitle("🎫 Ticket Created").setDescription("A staff member will assist you shortly.")],
      components: [row]
    });

    return interaction.reply({ content: "✅ Ticket created.", ephemeral: true });
  }

  if (interaction.isButton() && tickets[interaction.channelId]) {
    const ticket = tickets[interaction.channelId];

    if (interaction.customId === "ticket_claim") {
      ticket.claimedBy = interaction.user.id;
      save(FILES.tickets, tickets);
      return interaction.reply({ content: "✅ Ticket claimed.", ephemeral: true });
    }

    if (interaction.customId === "ticket_unclaim") {
      ticket.claimedBy = null;
      save(FILES.tickets, tickets);
      return interaction.reply({ content: "ℹ️ Ticket unclaimed.", ephemeral: true });
    }

    if (interaction.customId === "ticket_close") {
      delete tickets[interaction.channelId];
      save(FILES.tickets, tickets);
      await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
      setTimeout(() => interaction.channel.delete(), 3000);
    }
  }

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
              { name: "Attend", value: poll.attend.map(id => `<@${id}>`).join("\n") || "None" },
              { name: "Can’t Attend", value: poll.cant.map(id => `<@${id}>`).join("\n") || "None" }
            )
        ]
      });
    }

    if (interaction.customId === "poll_attend") {
      poll.attend.includes(uid)
        ? poll.attend = poll.attend.filter(i => i !== uid)
        : (poll.cant = poll.cant.filter(i => i !== uid), poll.attend.push(uid));
    }

    if (interaction.customId === "poll_cant") {
      poll.cant.includes(uid)
        ? poll.cant = poll.cant.filter(i => i !== uid)
        : (poll.attend = poll.attend.filter(i => i !== uid), poll.cant.push(uid));
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
