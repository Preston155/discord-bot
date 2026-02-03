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
const SUPPORT_ROLE_ID = "PASTE_SUPPORT_ROLE_ID"; // REQUIRED (REAL ROLE ID)

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
// messageId => { voters: Set() }

// =====================
// BUILD TICKET PANEL
// =====================
function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor("#00b0f4")
    .setTitle("🏛️ Lake County Roleplay | Assistance Center")
    .setDescription(
      "**Welcome to the official Assistance Center**\n\n" +
      "Use the dropdown below to open a support ticket.\n\n" +
      "**Rules:**\n" +
      "• One issue per ticket\n" +
      "• Be respectful at all times\n" +
      "• Do NOT ping staff manually\n\n" +
      "**Categories:**\n" +
      "👥 General Support\n" +
      "🤝 Partnership Support\n" +
      "🛡️ Internal Affairs\n" +
      "👑 Management Support"
    )
    .setFooter({ text: "Lake County Roleplay • Ticket System" });

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
// READY
// =====================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

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
    return;
  }

  // SESSION POLL
  if (message.content === "!ssuvote") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ Staff only.");
    }

    const embed = new EmbedBuilder()
      .setColor("#2ecc71")
      .setTitle("📊 Session Poll")
      .setDescription(
        "**Session Poll!**\n\n" +
        "Click below if you can attend.\n\n" +
        "🟢 **5× votes needed**"
      )
      .setFooter({ text: "Lake County Roleplay" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("session_attend")
        .setLabel("Attend (0/5)")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("session_view")
        .setLabel("View Votes")
        .setStyle(ButtonStyle.Secondary)
    );

    const pollMessage = await message.channel.send({
      embeds: [embed],
      components: [row]
    });

    sessionPolls.set(pollMessage.id, {
      voters: new Set()
    });

    await message.delete().catch(() => {});
  }
});

// =====================
// INTERACTIONS
// =====================
client.on("interactionCreate", async (interaction) => {
  try {

    // =====================
    // TICKET DROPDOWN
    // =====================
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId !== "ticket_category") return;

      const { guild, user } = interaction;
      const choice = interaction.values[0];

      const cleanName = user.username
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

      const ticketNumber = Math.floor(1000 + Math.random() * 9000);

      const supportRole = await guild.roles.fetch(SUPPORT_ROLE_ID);

      const channel = await guild.channels.create({
        name: `${cleanName}-${ticketNumber}`,
        parent: CATEGORIES[choice],
        topic: "CLAIMED:none",
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: supportRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      await channel.send(`<@&${supportRole.id}> | <@${user.id}>`);

      const ticketEmbed = new EmbedBuilder()
        .setColor("#00b0f4")
        .setTitle("🎟️ Support Ticket Created")
        .setDescription(
          `**User:** ${user.tag}\n` +
          `**Category:** ${choice.replace("_", " ").toUpperCase()}\n` +
          "**Status:** 🟡 Open\n" +
          "**Claimed By:** ❌ Unclaimed\n\n" +
          "Please describe your issue below."
        );

      const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
      );

      await channel.send({ embeds: [ticketEmbed], components: [controls] });

      return interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
    }

    // =====================
    // TICKET BUTTONS
    // =====================
    if (interaction.isButton() && ["claim", "unclaim", "close"].includes(interaction.customId)) {
      const channel = interaction.channel;
      const claimedId = (channel.topic || "CLAIMED:none").split(":")[1];

      if (
        !interaction.member.roles.cache.has(SUPPORT_ROLE_ID) &&
        !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      }

      // CLAIM
      if (interaction.customId === "claim") {
        if (claimedId !== "none") {
          return interaction.reply({ content: "❌ Already claimed.", ephemeral: true });
        }

        await channel.setTopic(`CLAIMED:${interaction.user.id}`);

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setDescription(
            interaction.message.embeds[0].description.replace(
              /\*\*Claimed By:\*\*.*$/,
              `**Claimed By:** <@${interaction.user.id}>`
            )
          );

        await interaction.message.edit({ embeds: [embed] });
        return interaction.reply({ content: "✅ Ticket claimed.", ephemeral: true });
      }

      // UNCLAIM
      if (interaction.customId === "unclaim") {
        if (claimedId !== interaction.user.id) {
          return interaction.reply({ content: "❌ You did not claim this.", ephemeral: true });
        }

        await channel.setTopic("CLAIMED:none");

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setDescription(
            interaction.message.embeds[0].description.replace(
              /\*\*Claimed By:\*\*.*$/,
              "**Claimed By:** ❌ Unclaimed"
            )
          );

        await interaction.message.edit({ embeds: [embed] });
        return interaction.reply({ content: "🔓 Ticket unclaimed.", ephemeral: true });
      }

      // CLOSE
      if (interaction.customId === "close") {
        await interaction.reply("🔒 Closing ticket...");
        setTimeout(() => channel.delete().catch(() => {}), 2000);
      }
    }

    // =====================
    // SESSION POLL BUTTONS
    // =====================
    if (interaction.isButton() && interaction.customId.startsWith("session_")) {
      const poll = sessionPolls.get(interaction.message.id);
      if (!poll) return;

      const userId = interaction.user.id;

      // VIEW VOTES
      if (interaction.customId === "session_view") {
        const list =
          poll.voters.size > 0
            ? [...poll.voters].map(id => `<@${id}>`).join("\n")
            : "No votes yet.";

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#2ecc71")
              .setTitle("👥 Session Votes")
              .setDescription(list)
          ],
          ephemeral: true
        });
      }

      // LOCK AT 5
      if (poll.voters.size >= 5) {
        return interaction.reply({
          content: "🔒 Voting is closed (5/5 reached).",
          ephemeral: true
        });
      }

      // PREVENT DOUBLE VOTE
      if (poll.voters.has(userId)) {
        return interaction.reply({
          content: "❌ You already voted.",
          ephemeral: true
        });
      }

      // ADD VOTE
      poll.voters.add(userId);

      const count = poll.voters.size;

      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("session_attend")
          .setLabel(`Attend (${count}/5)`)
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("session_view")
          .setLabel("View Votes")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.message.edit({ components: [updatedRow] });

      return interaction.reply({
        content: "✅ Your attendance has been recorded.",
        ephemeral: true
      });
    }

  } catch (err) {
    console.error("ERROR:", err);
  }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);
