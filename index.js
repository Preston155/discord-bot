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
const SSU_PING_ROLE_ID = 1468213717035384882; // null = @everyone

const CATEGORIES = {
  general_support: "1468276842942435338",
  partnership_support: "1461009005798359204",
  ia_support: "1468276930796327125",
  management_support: "1468277029865783489"
};

// =====================
// SESSION POLL STORAGE
// =====================
const sessionPolls = new Map();
// messageId => { attend:Set(), cant:Set(), started:boolean }

// =====================
// READY
// =====================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// =====================
// BUILD TICKET PANEL
// =====================
function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor("#00b0f4")
    .setTitle("🏛️ Lake County Roleplay | Assistance Center")
    .setDescription(
      "**Official Support System**\n\n" +
      "Use this panel to contact staff for legitimate concerns.\n\n" +
      "**Rules:**\n" +
      "• One issue per ticket\n" +
      "• Be respectful and detailed\n" +
      "• Do NOT ping staff manually\n\n" +
      "**Categories:**\n" +
      "👥 General Support\n" +
      "🤝 Partnership Support\n" +
      "🛡️ Internal Affairs\n" +
      "👑 Management Support"
    )
    .setFooter({ text: "Lake County Roleplay" });

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
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ Staff only.");
    }

    const embed = new EmbedBuilder()
      .setColor("#2ecc71")
      .setTitle("📊 Session Poll")
      .setDescription(
        "**Server Startup Attendance Check**\n\n" +
        "Click the appropriate option below.\n\n" +
        "🟢 **5 Attend votes required to start SSU**"
      )
      .setFooter({ text: "Lake County Roleplay • Session Management" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("attend").setLabel("✅ Attend (0/5)").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("cant").setLabel("❌ Can't Attend (0)").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("view").setLabel("👀 View Voters").setStyle(ButtonStyle.Secondary)
    );

    const msg = await message.channel.send({ embeds: [embed], components: [row] });

    sessionPolls.set(msg.id, { attend: new Set(), cant: new Set(), started: false });
    await message.delete().catch(() => {});
  }
});

// =====================
// INTERACTIONS
// =====================
client.on("interactionCreate", async (interaction) => {
  try {

    // ---------- TICKET DROPDOWN ----------
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category") {
      const { guild, user } = interaction;
      const choice = interaction.values[0];

      const clean = user.username.toLowerCase().replace(/[^a-z0-9]/g, "");
      const num = Math.floor(1000 + Math.random() * 9000);
      const role = await guild.roles.fetch(SUPPORT_ROLE_ID);

      const channel = await guild.channels.create({
        name: `${clean}-${num}`,
        parent: CATEGORIES[choice],
        topic: "CLAIMED:none",
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: role.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      await channel.send(`<@&${role.id}> | <@${user.id}>`);

      const embed = new EmbedBuilder()
        .setColor("#00b0f4")
        .setTitle("🎟️ Support Ticket Opened")
        .setDescription(
          `**User:** ${user.tag}\n` +
          `**Category:** ${choice.replace("_", " ").toUpperCase()}\n` +
          "**Status:** 🟡 Open\n" +
          "**Claimed By:** ❌ Unclaimed\n\n" +
          "Please describe your issue below."
        );

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("claim").setLabel("🟢 Claim").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("unclaim").setLabel("🔄 Unclaim").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("close").setLabel("🔒 Close").setStyle(ButtonStyle.Danger)
      );

      await channel.send({ embeds: [embed], components: [buttons] });
      return interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
    }

    // ---------- SESSION POLL BUTTONS ----------
    if (interaction.isButton() && ["attend", "cant", "view"].includes(interaction.customId)) {
      const poll = sessionPolls.get(interaction.message.id);
      if (!poll) return;

      const uid = interaction.user.id;

      if (interaction.customId === "view") {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#2ecc71")
              .setTitle("👀 Session Votes")
              .addFields(
                { name: "✅ Attend", value: [...poll.attend].map(id => `<@${id}>`).join("\n") || "None" },
                { name: "❌ Can't Attend", value: [...poll.cant].map(id => `<@${id}>`).join("\n") || "None" }
              )
          ],
          ephemeral: true
        });
      }

      if (poll.attend.has(uid) || poll.cant.has(uid)) {
        return interaction.reply({ content: "❌ You already voted.", ephemeral: true });
      }

      if (interaction.customId === "attend") poll.attend.add(uid);
      if (interaction.customId === "cant") poll.cant.add(uid);

      const attendCount = poll.attend.size;

      // AUTO START SSU
      if (attendCount >= 5 && !poll.started) {
        poll.started = true;

        const ping = SSU_PING_ROLE_ID ? `<@&${SSU_PING_ROLE_ID}>` : "@everyone";

        await interaction.channel.send({
          content: ping,
          embeds: [
            new EmbedBuilder()
              .setColor("#00ff99")
              .setTitle("🚨 SERVER STARTUP (SSU)")
              .setDescription(
                "**Server Startup has officially begun!**\n\n" +
                "Please join and follow all server rules."
              )
              .setTimestamp()
          ]
        });
      }

      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("attend").setLabel(`✅ Attend (${attendCount}/5)`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("cant").setLabel(`❌ Can't Attend (${poll.cant.size})`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("view").setLabel("👀 View Voters").setStyle(ButtonStyle.Secondary)
      );

      await interaction.message.edit({ components: [updatedRow] });
      return interaction.reply({ content: "✅ Response recorded.", ephemeral: true });
    }

  } catch (err) {
    console.error("ERROR:", err);
  }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);
