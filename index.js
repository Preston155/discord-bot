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
const SSU_ROLE_PING = "1468213717035384882";

const SERVER_INFO = {
  code: "ILCRPC",
  owner: "MiningMavenYT"
};

const SESSION_BANNER_URL =
  "https://media.discordapp.net/attachments/1452829338545160285/1466919030127591613/ILLEGAL_FIREARM_1.png?ex=6983c44e&is=698272ce&hm=9f87e357408634ca251753ff48dd05dd8639b0e0eea3b71d4ec6ea55d35b9a0a&=&format=webp&quality=lossless&width=1037&height=583";

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
for (const f of Object.values(FILES)) {
  if (!fs.existsSync(f)) fs.writeFileSync(f, "{}");
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

  // XP
  const lvl = addXp(message.author.id);
  if (lvl) {
    message.channel.send({
      embeds: [new EmbedBuilder().setColor("#f1c40f").setTitle("⬆️ Level Up!").setDescription(`🎉 ${message.author} reached **Level ${lvl}**!`)]
    });
  }

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).split(/ +/);
  const cmd = args.shift().toLowerCase();

  /* ---- !level ---- */
  if (cmd === "level") {
    const u = message.mentions.users.first() || message.author;
    if (!levels[u.id]) levels[u.id] = { xp: 0, level: 1, lastXp: 0 };
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#3498db")
          .setTitle("📈 Level Info")
          .setDescription(`**User:** ${u}\n**Level:** ${levels[u.id].level}\n**XP:** ${levels[u.id].xp}/${xpForLevel(levels[u.id].level)}`)
      ]
    });
  }

  /* ---- !sendpanel ---- */
  if (cmd === "sendpanel") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const embed = new EmbedBuilder()
      .setColor("#0ea5e9")
      .setTitle("🏛️ Lake County Roleplay | Support Center")
      .setDescription("Select a department below to open a ticket.\n\n• One issue per ticket\n• Be respectful\n• Do not ping staff");

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category")
      .setPlaceholder("Select a department…")
      .addOptions(
        { label: "General Support", value: "general_support", emoji: "👥" },
        { label: "Partnership", value: "partnership_support", emoji: "🤝" },
        { label: "Internal Affairs", value: "ia_support", emoji: "🛡️" },
        { label: "Management", value: "management_support", emoji: "👑" }
      );

    await message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    await message.delete().catch(() => {});
  }

  /* ---- !ssuvote ---- */
  if (cmd === "ssuvote") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const embed = new EmbedBuilder()
      .setColor("#16a34a")
      .setTitle("🚨 Server Startup Vote")
      .setDescription("Vote below to indicate availability.\n\n**Auto-starts at 5 attending.**")
      .setImage(SESSION_BANNER_URL);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("attend").setLabel("Attend (0/5)").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("cant").setLabel("Can’t Attend (0)").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("view").setLabel("👀 View Voters").setStyle(ButtonStyle.Secondary)
    );

    const msg = await message.channel.send({ embeds: [embed], components: [row] });
    polls[msg.id] = { attend: [], cant: [] };
    save(FILES.polls, polls);
  }

  /* ---- !ssu ---- */
  if (cmd === "ssu") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
    const lastPoll = Object.values(polls).reverse().find(p => p.attend.length);
    if (!lastPoll) return message.reply("❌ No SSU poll found.");

    const mentions = lastPoll.attend.map(id => `<@${id}>`).join(" ");
    const embed = new EmbedBuilder()
      .setColor("#22c55e")
      .setTitle("🚨 Server Startup!")
      .setDescription(`A game session has begun.\n\n**Server Information:**\nGame Code: **${SERVER_INFO.code}**\nServer Owner: **${SERVER_INFO.owner}**\n\n*Those who reacted must join.*`)
      .setImage(SESSION_BANNER_URL);

    await message.channel.send({ content: `<@&${SSU_ROLE_PING}>\n${mentions}`, embeds: [embed] });
  }

  /* ---- !ssd ---- */
  if (cmd === "ssd") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
    const embed = new EmbedBuilder()
      .setColor("#dc2626")
      .setTitle("🔕 Server Shutdown!")
      .setDescription(`LCRPC has shut down temporarily.\n\n**Server Information:**\nGame Code: **${SERVER_INFO.code}**\nServer Owner: **${SERVER_INFO.owner}**`);
    await message.channel.send({ embeds: [embed] });
  }
});

/* =====================
   INTERACTIONS
===================== */
client.on("interactionCreate", async (interaction) => {
  // Ticket creation
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category") {
    await interaction.deferReply({ ephemeral: true });

    const { guild, user } = interaction;
    const cat = interaction.values[0];
    const name = `${user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const role = await guild.roles.fetch(SUPPORT_ROLE_ID);

    const channel = await guild.channels.create({
      name,
      parent: CATEGORIES[cat],
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: role.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    tickets[channel.id] = { owner: user.id, claimed: null };
    save(FILES.tickets, tickets);

    const embed = new EmbedBuilder()
      .setColor("#22c55e")
      .setTitle("🎟️ Support Ticket Created")
      .setDescription(`**User:** <@${user.id}>\n**Status:** 🟡 Open\n**Claimed By:** ❌ Unclaimed`);

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await channel.send(`<@&${role.id}> <@${user.id}>`);
    await channel.send({ embeds: [embed], components: [buttons] });

    return interaction.editReply(`✅ Ticket created: ${channel}`);
  }

  // Ticket buttons
  if (interaction.isButton() && tickets[interaction.channelId]) {
    await interaction.deferReply({ ephemeral: true });
    const ticket = tickets[interaction.channelId];

    if (!interaction.member.roles.cache.has(SUPPORT_ROLE_ID))
      return interaction.editReply("❌ Staff only.");

    if (interaction.customId === "claim") ticket.claimed = interaction.user.id;
    if (interaction.customId === "unclaim") ticket.claimed = null;
    if (interaction.customId === "close") {
      delete tickets[interaction.channelId];
      save(FILES.tickets, tickets);
      await interaction.editReply("🔒 Closing ticket...");
      return setTimeout(() => interaction.channel.delete(), 2000);
    }

    save(FILES.tickets, tickets);

    await interaction.message.edit({
      embeds: [
        new EmbedBuilder()
          .setColor("#0ea5e9")
          .setTitle("🎟️ Support Ticket")
          .setDescription(`**User:** <@${ticket.owner}>\n**Claimed By:** ${ticket.claimed ? `<@${ticket.claimed}>` : "❌ Unclaimed"}`)
      ]
    });

    return interaction.editReply("✅ Ticket updated.");
  }

  // Poll buttons
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
              { name: "Attend", value: poll.attend.map(id => `<@${id}>`).join("\n") || "None" },
              { name: "Can’t Attend", value: poll.cant.map(id => `<@${id}>`).join("\n") || "None" }
            )
        ]
      });
    }

    if (interaction.customId === "attend") {
      poll.attend.includes(uid)
        ? poll.attend = poll.attend.filter(i => i !== uid)
        : (poll.cant = poll.cant.filter(i => i !== uid), poll.attend.push(uid));
    }

    if (interaction.customId === "cant") {
      poll.cant.includes(uid)
        ? poll.cant = poll.cant.filter(i => i !== uid)
        : (poll.attend = poll.attend.filter(i => i !== uid), poll.cant.push(uid));
    }

    save(FILES.polls, polls);

    await interaction.message.edit({
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("attend").setLabel(`Attend (${poll.attend.length}/5)`).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("cant").setLabel(`Can’t Attend (${poll.cant.length})`).setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("view").setLabel("👀 View Voters").setStyle(ButtonStyle.Secondary)
        )
      ]
    });

    return interaction.editReply("✅ Vote updated.");
  }
});

/* =====================
   LOGIN
===================== */
client.login(process.env.TOKEN);
