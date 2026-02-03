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

// CATEGORY IDS
const CATEGORIES = {
  general_support: "1468276842942435338",
  partnership_support: "1461009005798359204",
  ia_support: "1468276930796327125",
  management_support: "1468277029865783489"
};

// =====================
// BUILD PANEL
// =====================
function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor("#00b0f4")
    .setTitle("🏛️ Lake County Roleplay | Assistance Center")
    .setDescription(
      "**Welcome to the Lake County Roleplay Assistance Center**\n\n" +
      "This system allows you to request official support from our staff team.\n\n" +
      "**📌 Before Opening a Ticket:**\n" +
      "• Only open tickets for legitimate reasons\n" +
      "• One issue per ticket\n" +
      "• Be clear and respectful at all times\n" +
      "• Do **NOT** ping staff manually\n\n" +
      "**📂 Available Support Categories:**\n" +
      "👥 **General Support** — Questions, reports, concerns\n" +
      "🤝 **Partnership Support** — Partnership & affiliation requests\n" +
      "🛡️ **Internal Affairs** — Staff reports & appeals\n" +
      "👑 **Management Support** — High-level or administrative matters\n\n" +
      "Select a category from the dropdown below to begin."
    )
    .setFooter({
      text: "Lake County Roleplay • Official Support System"
    });

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
// SEND PANEL COMMAND
// =====================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  if (message.content === "!sendpanel") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    await message.delete().catch(() => {});
    await message.channel.send(buildPanel());
  }
});

// =====================
// INTERACTIONS
// =====================
client.on("interactionCreate", async (interaction) => {
  try {

    // =====================
    // DROPDOWN → CREATE TICKET
    // =====================
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId !== "ticket_category") return;

      const { guild, user } = interaction;
      const choice = interaction.values[0];

      const existing = guild.channels.cache.find(c => c.name === `ticket-${user.id}`);
      if (existing) {
        return interaction.reply({
          content: "❌ You already have an open ticket.",
          ephemeral: true
        });
      }

      const channel = await guild.channels.create({
        name: `ticket-${user.id}`,
        parent: CATEGORIES[choice],
        topic: "CLAIMED:none",
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: SUPPORT_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      // 🔔 Ping staff + user
      await channel.send(`<@&${SUPPORT_ROLE_ID}> | <@${user.id}>`);

      const ticketEmbed = new EmbedBuilder()
        .setColor("#00b0f4")
        .setTitle("🎟️ Support Ticket Opened")
        .setDescription(
          "**Thank you for contacting Lake County Roleplay Support.**\n\n" +
          "Please provide **clear and detailed information** regarding your issue so staff can assist you efficiently.\n\n" +
          "**📄 Ticket Information:**\n" +
          `• **User:** <@${user.id}>\n` +
          `• **Category:** ${choice.replace("_", " ").toUpperCase()}\n` +
          "• **Status:** 🟡 Open\n" +
          "• **Claimed By:** ❌ Unclaimed\n\n" +
          "**⏳ What Happens Next:**\n" +
          "A staff member will review and respond as soon as possible."
        )
        .setFooter({
          text: "Lake County Roleplay • Ticket Management"
        });

      const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("claim").setLabel("Claim Ticket").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("unclaim").setLabel("Unclaim Ticket").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("close").setLabel("Close Ticket").setStyle(ButtonStyle.Danger)
      );

      await channel.send({ embeds: [ticketEmbed], components: [controls] });

      return interaction.reply({
        content: `✅ Your ticket has been created: ${channel}`,
        ephemeral: true
      });
    }

    // =====================
    // BUTTONS
    // =====================
    if (!interaction.isButton()) return;

    const channel = interaction.channel;
    const topic = channel.topic || "CLAIMED:none";
    const claimedId = topic.split(":")[1];

    const isStaff =
      interaction.member.roles.cache.has(SUPPORT_ROLE_ID) ||
      interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

    if (!isStaff) {
      return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
    }

    // CLAIM
    if (interaction.customId === "claim") {
      if (claimedId !== "none") {
        return interaction.reply({ content: "❌ This ticket is already claimed.", ephemeral: true });
      }

      await channel.setTopic(`CLAIMED:${interaction.user.id}`);

      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setDescription(
          interaction.message.embeds[0].description.replace(
            "**Claimed By:** ❌ Unclaimed",
            `**Claimed By:** <@${interaction.user.id}>`
          )
        );

      await interaction.message.edit({ embeds: [embed] });
      return interaction.reply({ content: "✅ Ticket claimed.", ephemeral: true });
    }

    // UNCLAIM
    if (interaction.customId === "unclaim") {
      if (claimedId !== interaction.user.id) {
        return interaction.reply({ content: "❌ You did not claim this ticket.", ephemeral: true });
      }

      await channel.setTopic("CLAIMED:none");

      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setDescription(
          interaction.message.embeds[0].description.replace(
            /\*\*Claimed By:\*\* <@.*?>/,
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

} catch (err) {
  console.error("🔥 TICKET ERROR 🔥", err);

  if (!interaction.replied && !interaction.deferred) {
    interaction.reply({
      content: `❌ Ticket creation failed.\n**Reason:** \`${err.message}\``,
      ephemeral: true
    }).catch(() => {});
  }
}
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);
