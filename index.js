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

// CATEGORY IDS (YOUR IDS)
const CATEGORIES = {
  general_support: "1468276842942435338",
  partnership_support: "1461009005798359204",
  ia_support: "1468276930796327125",
  management_support: "1468277029865783489"
};

// =====================
// PANEL BUILDER
// =====================
function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor("#00b0f4")
    .setTitle("🏛️ Lake County Roleplay — Assistance")
    .setDescription(
      "**Request Assistance Below**\n\n" +
      "Select a category from the dropdown to open a ticket.\n\n" +
      "🚨 **Rules:**\n" +
      "• One ticket per issue\n" +
      "• No trolling or false reports\n" +
      "• Do not ping staff"
    )
    .setFooter({ text: "Lake County Roleplay | Ticket System" });

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_category")
    .setPlaceholder("Select a support category…")
    .addOptions(
      {
        label: "General Support",
        description: "General help & questions",
        value: "general_support",
        emoji: "👥"
      },
      {
        label: "Partnership Support",
        description: "Partnerships & affiliations",
        value: "partnership_support",
        emoji: "🤝"
      },
      {
        label: "Internal Affairs",
        description: "Reports & complaints",
        value: "ia_support",
        emoji: "🛡️"
      },
      {
        label: "Management Support",
        description: "High-level assistance",
        value: "management_support",
        emoji: "👑"
      }
    );

  const row = new ActionRowBuilder().addComponents(menu);

  return { embeds: [embed], components: [row] };
}

// =====================
// READY
// =====================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// =====================
// PREFIX COMMAND
// =====================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const command = message.content.slice(PREFIX.length).toLowerCase();

  // ADMIN ONLY
  if (command === "sendpanel") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ You do not have permission to do this.");
    }

    await message.channel.send(buildPanel());
    return message.reply("✅ Ticket panel sent.");
  }
});

// =====================
// INTERACTIONS
// =====================
client.on("interactionCreate", async (interaction) => {

  // =====================
  // CATEGORY SELECT
  // =====================
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId !== "ticket_category") return;

    const { guild, user } = interaction;
    const choice = interaction.values[0];

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
      parent: CATEGORIES[choice],
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: SUPPORT_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    const ticketEmbed = new EmbedBuilder()
      .setColor("#00b0f4")
      .setTitle("🎟️ Support Ticket")
      .setDescription(
        `**User:** <@${user.id}>\n` +
        `**Category:** ${choice.replace("_", " ").toUpperCase()}\n` +
        `**Claimed By:** ❌ Unclaimed\n\n` +
        "Please describe your issue in detail."
      );

    const controls = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim_ticket").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("unclaim_ticket").setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("close_ticket").setLabel("Close Ticket").setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [ticketEmbed], components: [controls] });

    return interaction.reply({
      content: `✅ Ticket created: ${channel}`,
      ephemeral: true
    });
  }

  // =====================
  // BUTTONS (STAFF)
  // =====================
  if (!interaction.isButton()) return;

  const isStaff =
    interaction.member.roles.cache.has(SUPPORT_ROLE_ID) ||
    interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

  if (!isStaff) {
    return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
  }

  const message = interaction.message;
  const embed = EmbedBuilder.from(message.embeds[0]);

  if (interaction.customId === "claim_ticket") {
    embed.setDescription(
      embed.data.description.replace(
        /\*\*Claimed By:\*\*.*\n/,
        `**Claimed By:** <@${interaction.user.id}>\n`
      )
    );
    await message.edit({ embeds: [embed] });
    return interaction.reply({ content: "✅ Ticket claimed.", ephemeral: true });
  }

  if (interaction.customId === "unclaim_ticket") {
    embed.setDescription(
      embed.data.description.replace(
        /\*\*Claimed By:\*\*.*\n/,
        "**Claimed By:** ❌ Unclaimed\n"
      )
    );
    await message.edit({ embeds: [embed] });
    return interaction.reply({ content: "🔓 Ticket unclaimed.", ephemeral: true });
  }

  if (interaction.customId === "close_ticket") {
    await interaction.reply("🔒 Closing ticket...");
    setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
  }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);

