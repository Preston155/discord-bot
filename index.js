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

// =====================
// CONFIG
// =====================
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

// =====================
// DATA FILE SETUP
// =====================
const DATA_DIR = path.join(__dirname, "data");
const POLLS_FILE = path.join(DATA_DIR, "polls.json");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(POLLS_FILE)) fs.writeFileSync(POLLS_FILE, "{}");
if (!fs.existsSync(TICKETS_FILE)) fs.writeFileSync(TICKETS_FILE, "{}");

const loadJSON = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const saveJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

let polls = loadJSON(POLLS_FILE);
let tickets = loadJSON(TICKETS_FILE);

// =====================
// READY
// =====================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// =====================
// TICKET PANEL
// =====================
function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor("#00b0f4")
    .setTitle("🏛️ Lake County Roleplay | Assistance Center")
    .setDescription(
      "**Official Support System**\n\n" +
      "Use the dropdown below to contact staff.\n\n" +
      "**Rules:**\n" +
      "• One issue per ticket\n" +
      "• Be respectful\n" +
      "• Do NOT ping staff\n\n" +
      "**Categories:**\n" +
      "👥 General Support\n" +
      "🤝 Partnership Support\n" +
      "🛡️ Internal Affairs\n" +
      "👑 Management Support"
    );

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_category")
    .setPlaceholder("Select a support category…")
    .addOptions(
      { label: "General Support", value: "general_support", emoji: "👥" },
      { label: "Partnership Support", value: "partnership_support", emoji: "🤝" },
      { label: "Internal Affairs", value: "ia_support", emoji: "🛡️" },
      { label: "Management Support", value: "management_support", emoji: "👑" }
    );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)]
  };
}

// =====================
// MESSAGE COMMANDS
// =====================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  if (message.content === "!sendpanel") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
    await message.delete().catch(() => {});
    await message.channel.send(buildPanel());
  }

  if (message.content === "!ssuvote") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const embed = new EmbedBuilder()
      .setColor("#2ecc71")
      .setTitle("📊 Session Attendance Poll")
      .setDescription(
        "**Server Startup (SSU) Interest Check**\n\n" +
        "Click below to indicate availability.\n\n" +
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

    saveJSON(POLLS_FILE, polls);
    await message.delete().catch(() => {});
  }
});

// =====================
// INTERACTIONS
// =====================
client.on("interactionCreate", async (interaction) => {
  try {

    // =====================
    // CREATE TICKET
    // =====================
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category") {
      await interaction.deferReply({ ephemeral: true });

      const { guild, user } = interaction;
      const category = interaction.values[0];

      const clean = user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
      const num = Math.floor(1000 + Math.random() * 9000);

      const role = await guild.roles.fetch(SUPPORT_ROLE_ID);

      const channel = await guild.channels.create({
        name: `${clean}-${num}`,
        parent: CATEGORIES[category],
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: role.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      tickets[channel.id] = {
        owner: user.id,
        claimed: null,
        status: "open"
      };
      saveJSON(TICKETS_FILE, tickets);

      const embed = new EmbedBuilder()
        .setColor("#00b0f4")
        .setTitle("🎟️ Support Ticket Opened")
        .setDescription(
          `**User:** <@${user.id}>\n` +
          `**Status:** 🟡 Open\n` +
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

    // =====================
    // TICKET BUTTONS (PERSISTENT)
    // =====================
    if (interaction.isButton() && ["claim", "unclaim", "close"].includes(interaction.customId)) {
      const ticket = tickets[interaction.channel.id];
      if (!ticket) return interaction.reply({ content: "❌ Ticket data missing.", ephemeral: true });

      if (
        !interaction.member.roles.cache.has(SUPPORT_ROLE_ID) &&
        !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      }

      if (interaction.customId === "claim") {
        if (ticket.claimed) return interaction.reply({ content: "Already claimed.", ephemeral: true });
        ticket.claimed = interaction.user.id;
        ticket.status = "claimed";
      }

      if (interaction.customId === "unclaim") {
        if (ticket.claimed !== interaction.user.id)
          return interaction.reply({ content: "You didn't claim this.", ephemeral: true });
        ticket.claimed = null;
        ticket.status = "open";
      }

      if (interaction.customId === "close") {
        delete tickets[interaction.channel.id];
        saveJSON(TICKETS_FILE, tickets);
        await interaction.reply("Closing ticket...");
        return setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
      }

      saveJSON(TICKETS_FILE, tickets);

      const embed = new EmbedBuilder()
        .setColor("#00b0f4")
        .setTitle("🎟️ Support Ticket")
        .setDescription(
          `**User:** <@${ticket.owner}>\n` +
          `**Status:** ${ticket.status === "claimed" ? "🟢 Claimed" : "🟡 Open"}\n` +
          `**Claimed By:** ${ticket.claimed ? `<@${ticket.claimed}>` : "❌ Unclaimed"}`
        );

      await interaction.message.edit({ embeds: [embed] });
      return interaction.reply({ content: "✅ Ticket updated.", ephemeral: true });
    }

    // =====================
    // SESSION POLL BUTTONS (PERSISTENT)
    // =====================
    if (interaction.isButton() && polls[interaction.message.id]) {
      const poll = polls[interaction.message.id];
      const uid = interaction.user.id;

      if (interaction.customId === "view") {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("👀 Session Poll Voters")
              .addFields(
                { name: "Attend", value: poll.attend.map(id => `<@${id}>`).join("\n") || "None" },
                { name: "Can't Attend", value: poll.cant.map(id => `<@${id}>`).join("\n") || "None" }
              )
          ],
          ephemeral: true
        });
      }

      if (poll.started) return interaction.reply({ content: "Voting closed.", ephemeral: true });

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
        await interaction.channel.send({
          content: SSU_PING_ROLE_ID ? `<@&${SSU_PING_ROLE_ID}>` : "@everyone",
          embeds: [new EmbedBuilder().setTitle("🚨 SERVER STARTUP (SSU)").setImage(SESSION_BANNER_URL)]
        });
      }

      saveJSON(POLLS_FILE, polls);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("attend").setLabel(`Attend (${poll.attend.length}/5)`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("cant").setLabel(`Can't Attend (${poll.cant.length})`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("view").setLabel("View Voters").setStyle(ButtonStyle.Secondary)
      );

      await interaction.message.edit({ components: [row] });
      return interaction.reply({ content: "Vote updated.", ephemeral: true });
    }

  } catch (err) {
    console.error("ERROR:", err);
  }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);
