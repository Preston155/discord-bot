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

const LEVEL_UP_CHANNEL_ID = "1467677377319534662";

const WELCOME_CHANNEL_ID = "1461003360999047300";
const VERIFY_ROLE_ID = "PUT_VERIFY_ROLE_ID_HERE"; // role they get after verifying

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

const load = (f) => {
  const filePath = path.join(DATA_DIR, f);
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error(`⚠️ Failed to load ${f}, resetting file.`);
    return {};
  }
};
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

  if (!levels[id]) {
    levels[id] = { xp: 0, level: 1, last: 0 };
  }

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

  // 🔐 FORCE SAVE EVERY XP CHANGE
  try {
    save(FILES.levels, levels);
  } catch (e) {
    console.error("❌ Failed to save levels:", e);
  }

  return leveled ? levels[id].level : null;
}

// =====================
// READY
// =====================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  const count = member.guild.memberCount;

  const message =
    `👋🏽 \`\` - \`\` Welcome ${member} to **Lake County Roleplay!** ` +
    `You are our **${count}** member, we hope you enjoy your stay!\n` +
    `-# Ensure to verify to gain access to all of our channels and stop in-game Private Messages.`;

  const row = new ActionRowBuilder().addComponents(
    // VERIFY LINK BUTTON
    new ButtonBuilder()
      .setLabel("Verify")
      .setStyle(ButtonStyle.Link)
      .setURL("https://blox.link/"),

    // MEMBER COUNT (DISABLED)
    new ButtonBuilder()
      .setLabel(`👥 Members: ${count}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  channel.send({
    content: message,
    components: [row]
  });
});



// =====================
// MESSAGE CREATE
// =====================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

const lvlUp = addXP(message.author.id);
if (lvlUp) {
  const levelChannel = message.guild.channels.cache.get(LEVEL_UP_CHANNEL_ID);

  if (levelChannel) {
    levelChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#facc15")
          .setTitle("⬆️ Level Up!")
          .setDescription(
            `${message.author} has reached **Level ${lvlUp}**! 🎉`
          )
          .setFooter({
            text: "Lake County Roleplay • Level System"
          })
          .setTimestamp()
      ]
    });
  }
}
  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

// =====================
// STAFF DASHBOARD
// =====================
if (cmd === "staffdashboard" && isStaff(message.member)) {
  const openTickets = Object.keys(tickets).length;
  const activePolls = Object.keys(polls).length;

  const embed = new EmbedBuilder()
    .setColor("#1e40af")
    .setTitle("🧑‍💼 Staff Dashboard")
    .setDescription(
      "**Staff Control Panel**\n\n" +
      "Use the buttons below to view and manage server activity.\n\n" +

      "📊 **Current Overview**\n" +
      `• Open Tickets: **${openTickets}**\n` +
      `• Active SSU Votes: **${activePolls}**\n` +
      `• Server Members: **${message.guild.memberCount}**`
    )
    .setFooter({
      text: "Lake County Roleplay • Staff Dashboard"
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("dash_tickets")
      .setLabel("🎟️ View Tickets")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("dash_ssu")
      .setLabel("🚨 SSU Status")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("dash_close")
      .setLabel("Close")
      .setStyle(ButtonStyle.Danger)
  );

  return message.channel.send({
    embeds: [embed],
    components: [row]
  });
}

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
        "**Welcome to the Support Center.**\n\n" +
        "Select the appropriate department below.\n\n" +
        "• One ticket per issue\n" +
        "• Do not ping staff\n" +
        "• Be respectful"
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

  // SSU VOTE
  if (cmd === "ssuvote" && isStaff(message.member)) {
    const embed = new EmbedBuilder()
      .setColor("#16a34a")
      .setTitle("🚨 Server Startup Vote")
      .setDescription(
        "**A Server Startup is being proposed.**\n\n" +
        "🟢 Attend — You are available\n" +
        "🔴 Can’t Attend — You are unavailable\n\n" +
        "• You may change or remove your vote\n" +
        "• Auto-starts at **5 attending**"
      )
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
// INTERACTIONS (RESTART-PROOF)
// =====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.guild) return;

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

    channel.send({
      content: `<@${user.id}> <@&${SUPPORT_ROLE_ID}>`,
      embeds: [
        new EmbedBuilder()
          .setColor("#22c55e")
          .setTitle("🎫 Support Ticket Opened")
          .setDescription("Please describe your issue in detail.")
          .setImage(SESSION_BANNER_URL)
      ],
      components: [buttons]
    });

    return interaction.reply({ content: "✅ Ticket created.", ephemeral: true });
  }

  // =====================
// VERIFY BUTTON
// =====================
if (interaction.isButton() && interaction.customId === "verify_member") {
  const member = interaction.member;

  if (member.roles.cache.has(VERIFY_ROLE_ID)) {
    return interaction.reply({
      content: "✅ You are already verified!",
      ephemeral: true
    });
  }

  try {
    await member.roles.add(VERIFY_ROLE_ID);
    return interaction.reply({
      content: "🎉 You have been verified! Welcome to Lake County Roleplay.",
      ephemeral: true
    });
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: "❌ Verification failed. Please contact staff.",
      ephemeral: true
    });
  }
}

  // =====================
// STAFF DASHBOARD BUTTONS
// =====================
if (interaction.isButton() && interaction.customId.startsWith("dash_")) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({
      content: "❌ Staff only.",
      ephemeral: true
    });
  }

// VIEW OPEN TICKETS + JUMP BUTTONS
if (interaction.customId === "dash_tickets") {
  const entries = Object.entries(tickets);

  if (entries.length === 0) {
    return interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setColor("#2563eb")
          .setTitle("🎟️ Open Tickets")
          .setDescription("There are currently no open tickets.")
      ]
    });
  }

  const embed = new EmbedBuilder()
    .setColor("#2563eb")
    .setTitle("🎟️ Open Tickets")
    .setDescription(
      entries
        .slice(0, 5) // Discord button limit safety
        .map(([id, t], i) =>
          `**${i + 1}.** <#${id}>\nOpened by: <@${t.owner}>`
        )
        .join("\n\n")
    )
    .setFooter({
      text: "Click a button below to jump to the ticket"
    });

  const row = new ActionRowBuilder().addComponents(
    entries.slice(0, 5).map(([id], i) =>
      new ButtonBuilder()
        .setCustomId(`dash_jump_${id}`)
        .setLabel(`Jump ${i + 1}`)
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return interaction.reply({
    ephemeral: true,
    embeds: [embed],
    components: [row]
  });
}

// DASHBOARD → JUMP TO TICKET
if (interaction.isButton() && interaction.customId.startsWith("dash_jump_")) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({
      content: "❌ Staff only.",
      ephemeral: true
    });
  }

  const channelId = interaction.customId.replace("dash_jump_", "");
  const channel = interaction.guild.channels.cache.get(channelId);

  if (!channel) {
    return interaction.reply({
      content: "⚠️ That ticket channel no longer exists.",
      ephemeral: true
    });
  }

  return interaction.reply({
    ephemeral: true,
    content: `➡️ Jump to ticket: ${channel}`
  });
}

  // VIEW SSU STATUS
  if (interaction.customId === "dash_ssu") {
    const list = Object.entries(polls)
      .map(([id, p]) => 
        `• Message ID: \`${id}\`\n` +
        `  Attend: **${p.attend.length}** | Can’t: **${p.cant.length}**`
      )
      .join("\n\n") || "No active SSU votes.";

    return interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setColor("#16a34a")
          .setTitle("🚨 SSU Status")
          .setDescription(list)
      ]
    });
  }

  // CLOSE DASHBOARD
  if (interaction.customId === "dash_close") {
    return interaction.message.delete().catch(() => {});
  }
}

  // Buttons
  if (interaction.isButton()) {
    const ticket = tickets[interaction.channelId];
    const poll = polls[interaction.message.id];

    // Ticket buttons
    if (interaction.customId.startsWith("ticket_")) {
      if (!ticket)
        return interaction.reply({ content: "⚠️ Ticket inactive.", ephemeral: true });
      if (!isStaff(interaction.member))
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });

      if (interaction.customId === "ticket_claim") {
        ticket.claimedBy = interaction.user.id;
        save(FILES.tickets, tickets);
        interaction.channel.send({ embeds: [new EmbedBuilder().setColor("#3b82f6").setTitle("📌 Ticket Claimed").setDescription(`Claimed by ${interaction.user}`)] });
        return interaction.reply({ content: "✅ Ticket claimed.", ephemeral: true });
      }

      if (interaction.customId === "ticket_unclaim") {
        ticket.claimedBy = null;
        save(FILES.tickets, tickets);
        interaction.channel.send({ embeds: [new EmbedBuilder().setColor("#f59e0b").setTitle("📍 Ticket Unclaimed").setDescription("This ticket is now unclaimed.")] });
        return interaction.reply({ content: "ℹ️ Ticket unclaimed.", ephemeral: true });
      }

      if (interaction.customId === "ticket_close") {
        delete tickets[interaction.channelId];
        save(FILES.tickets, tickets);
        interaction.channel.send({ embeds: [new EmbedBuilder().setColor("#dc2626").setTitle("🔒 Ticket Closing").setDescription("This ticket will be deleted shortly.")] });
        await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
        return setTimeout(() => interaction.channel.delete(), 3000);
      }
    }

    // SSU buttons
    if (interaction.customId.startsWith("poll_")) {
      if (!poll)
        return interaction.reply({ content: "⚠️ Vote inactive.", ephemeral: true });

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
        poll.attend.includes(uid)
          ? poll.attend = poll.attend.filter(i=>i!==uid)
          : (poll.cant = poll.cant.filter(i=>i!==uid), poll.attend.push(uid));
      }

      if (interaction.customId === "poll_cant") {
        poll.cant.includes(uid)
          ? poll.cant = poll.cant.filter(i=>i!==uid)
          : (poll.attend = poll.attend.filter(i=>i!==uid), poll.cant.push(uid));
      }

      if (poll.attend.length >= 5 && !poll.started) {
        poll.started = true;
        interaction.channel.send({
          content: `<@&${SSU_ROLE_PING}>\n${poll.attend.map(i=>`<@${i}>`).join(" ")}`,
          embeds: [new EmbedBuilder().setColor("#22c55e").setTitle("🚨 Server Startup!").setDescription(`Game Code: **${SERVER_INFO.code}**`)]
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
  }
});

const gracefulShutdown = () => {
  console.log("🛑 Saving level data before shutdown...");
  try {
    save(FILES.levels, levels);
    console.log("✅ Levels saved.");
  } catch (e) {
    console.error("❌ Failed to save levels on shutdown:", e);
  }
  process.exit(0);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
process.on("exit", gracefulShutdown);

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);
