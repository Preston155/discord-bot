const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// =====================
// CONFIG (EDIT THESE 2)
// =====================
const SUPPORT_ROLE_ID = "1282417060391161978";
const PANEL_CHANNEL_ID = "1466626678296940819";

// =====================
// CATEGORY IDS (SET)
// =====================
const CATEGORIES = {
  general_support: "1468276842942435338",
  partnership_support: "1461009005798359204",
  ia_support: "1468276930796327125",
  management_support: "1468277029865783489"
};

// =====================
// READY – SEND PANEL
// =====================
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(PANEL_CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setColor("#00b0f4")
    .setTitle("🏛️ Lake County Roleplay — Assistance")
    .setDescription(
      "**Welcome to the Assistance Dashboard**\n\n" +
      "Select a category below to open a ticket.\n\n" +
      "🚨 **Rules:**\n" +
      "• One ticket per issue\n" +
      "• No trolling or false reports\n" +
      "• Do not ping staff\n\n" +
      "**Categories:**\n" +
      "👥 General Support\n" +
      "🤝 Partnership Support\n" +
      "🛡️ Internal Affairs\n" +
      "👑 Management Support"
    )
    .setFooter({ text: "Lake County Roleplay | Ticket System" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("general_support")
      .setLabel("General Support")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("partnership_support")
      .setLabel("Partnership Support")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("ia_support")
      .setLabel("Internal Affairs")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("management_support")
      .setLabel("Management Support")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.bulkDelete(5).catch(() => {});
  await channel.send({ embeds: [embed], components: [row] });
});

// =====================
// BUTTON HANDLER
// =====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const { guild, user, customId } = interaction;

  // =====================
  // CREATE TICKET
  // =====================
  if (CATEGORIES[customId]) {
    const existing = guild.channels.cache.find(
      c => c.name === `ticket-${user.id}`
    );

    if (existing) {
      return interaction.reply({
        content: "❌ You already have an open ticket.",
        ephemeral: true
      });
    }

    const channel = await guild.channels.create({
      name: `ticket-${user.id}`,
      parent: CATEGORIES[customId],
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages
          ],
        },
        {
          id: SUPPORT_ROLE_ID,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages
          ],
        },
      ],
    });

    const ticketEmbed = new EmbedBuilder()
      .setColor("#00b0f4")
      .setTitle("🎟️ Support Ticket")
      .setDescription(
        `**User:** <@${user.id}>\n` +
        `**Category:** ${customId.replace("_", " ").toUpperCase()}\n` +
        `**Claimed By:** ❌ Unclaimed\n\n` +
        "Please describe your issue in detail."
      );

    const controls = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_ticket")
        .setLabel("Claim")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("unclaim_ticket")
        .setLabel("Unclaim")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [ticketEmbed], components: [controls] });

    return interaction.reply({
      content: `✅ Ticket created: ${channel}`,
      ephemeral: true
    });
  }

  // =====================
  // STAFF CHECK
  // =====================
  const isStaff =
    interaction.member.roles.cache.has(SUPPORT_ROLE_ID) ||
    interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

  if (!isStaff) {
    return interaction.reply({
      content: "❌ Staff only.",
      ephemeral: true
    });
  }

  const message = interaction.message;
  const embed = EmbedBuilder.from(message.embeds[0]);

  // =====================
  // CLAIM
  // =====================
  if (customId === "claim_ticket") {
    embed.setDescription(
      embed.data.description.replace(
        /\*\*Claimed By:\*\*.*\n/,
        `**Claimed By:** <@${interaction.user.id}>\n`
      )
    );

    await message.edit({ embeds: [embed] });
    return interaction.reply({ content: "✅ Ticket claimed.", ephemeral: true });
  }

  // =====================
  // UNCLAIM
  // =====================
  if (customId === "unclaim_ticket") {
    embed.setDescription(
      embed.data.description.replace(
        /\*\*Claimed By:\*\*.*\n/,
        "**Claimed By:** ❌ Unclaimed\n"
      )
    );

    await message.edit({ embeds: [embed] });
    return interaction.reply({ content: "🔓 Ticket unclaimed.", ephemeral: true });
  }

  // =====================
  // CLOSE
  // =====================
  if (customId === "close_ticket") {
    await interaction.reply("🔒 Closing ticket...");
    setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
  }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);
