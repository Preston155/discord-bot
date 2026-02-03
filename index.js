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
const SUPPORT_ROLE_ID = "PASTE_SUPPORT_ROLE_ID"; // REQUIRED
const SSU_PING_ROLE_ID = null; // null = @everyone
const SESSION_BANNER_URL =
  "https://media.discordapp.net/attachments/1452829338545160285/1466919030127591613/ILLEGAL_FIREARM_1.png";

// Ticket Categories
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
      "**Guidelines:**\n" +
      "• One issue per ticket\n" +
      "• Be respectful and detailed\n" +
      "• Do NOT ping staff manually\n\n" +
      "**Support Categories:**\n" +
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

  // SEND TICKET PANEL
  if (message.content === "!sendpanel") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
    await message.delete().catch(() => {});
    await message.channel.send(buildPanel());
  }

  // =====================
  // SESSION POLL
  // =====================
  if (message.content === "!ssuvote") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ Staff only.");
    }

    const embed = new EmbedBuilder()
      .setColor("#2ecc71")
      .setTitle("📊 Session Attendance Poll")
      .setDescription(
        "**Server Startup (SSU) Interest Check**\n\n" +
        "This poll is used to determine whether enough members are available to begin a **Server Startup (SSU)**.\n\n" +
        "**🗳️ How to Participate:**\n" +
        "• Click **Attend** if you are available\n" +
        "• Click **Can’t Attend** if you are unavailable\n" +
        "• You may change or remove your vote at any time\n\n" +
        "**🚨 Automatic Startup:**\n" +
        "• When **5 members** select **Attend**, the SSU will automatically begin\n\n" +
        "🟢 **Required Votes:** 5 Attend"
      )
      .setImage(SESSION_BANNER_URL)
      .setFooter({ text: "Lake County Roleplay • Session Management" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("attend")
        .setLabel("✅ Attend (0/5)")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("cant")
        .setLabel("❌ Can’t Attend (0)")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("view")
        .setLabel("👀 View Voters")
        .setStyle(ButtonStyle.Secondary)
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

    // =====================
    // SESSION POLL BUTTONS
    // =====================
    if (interaction.isButton() && ["attend", "cant", "view"].includes(interaction.customId)) {
      const poll = sessionPolls.get(interaction.message.id);
      if (!poll) return;

      const uid = interaction.user.id;

      // VIEW VOTERS
      if (interaction.customId === "view") {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#2ecc71")
              .setTitle("👀 Session Poll Voters")
              .addFields(
                {
                  name: "✅ Attend",
                  value: [...poll.attend].map(id => `<@${id}>`).join("\n") || "None"
                },
                {
                  name: "❌ Can’t Attend",
                  value: [...poll.cant].map(id => `<@${id}>`).join("\n") || "None"
                }
              )
          ],
          ephemeral: true
        });
      }

      // LOCK AFTER START
      if (poll.started) {
        return interaction.reply({
          content: "🔒 Voting is locked. SSU has already started.",
          ephemeral: true
        });
      }

      // TOGGLE LOGIC
      if (interaction.customId === "attend") {
        if (poll.attend.has(uid)) {
          poll.attend.delete(uid);
        } else {
          poll.cant.delete(uid);
          poll.attend.add(uid);
        }
      }

      if (interaction.customId === "cant") {
        if (poll.cant.has(uid)) {
          poll.cant.delete(uid);
        } else {
          poll.attend.delete(uid);
          poll.cant.add(uid);
        }
      }

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
                "**The Server Startup has officially begun!**\n\n" +
                "Thank you to everyone who participated in the attendance poll.\n\n" +
                "Please join the server and follow all rules and staff instructions."
              )
              .setImage(SESSION_BANNER_URL)
              .setTimestamp()
          ]
        });
      }

      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("attend")
          .setLabel(`✅ Attend (${attendCount}/5)`)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("cant")
          .setLabel(`❌ Can’t Attend (${poll.cant.size})`)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("view")
          .setLabel("👀 View Voters")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.message.edit({ components: [updatedRow] });
      return interaction.reply({ content: "✅ Your response has been updated.", ephemeral: true });
    }

  } catch (err) {
    console.error("ERROR:", err);
  }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);
