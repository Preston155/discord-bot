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
    // TICKET DROPDOWN
    // =====================
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category") {
      await interaction.deferReply({ ephemeral: true });

      const { guild, user } = interaction;
      const choice = interaction.values[0];

      if (!CATEGORIES[choice]) {
        return interaction.editReply({ content: "❌ Invalid category." });
      }

      const cleanName = user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
      const ticketNumber = Math.floor(1000 + Math.random() * 9000);

      const supportRole = await guild.roles.fetch(SUPPORT_ROLE_ID);

      const channel = await guild.channels.create({
        name: `${cleanName}-${ticketNumber}`,
        parent: CATEGORIES[choice],
        topic: "CLAIMED:none",
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          {
            id: user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          },
          {
            id: supportRole.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          }
        ]
      });

      await channel.send(`<@&${supportRole.id}> | <@${user.id}>`);

      const ticketEmbed = new EmbedBuilder()
        .setColor("#00b0f4")
        .setTitle("🎟️ Support Ticket Opened")
        .setDescription(
          "**Thank you for contacting Lake County Roleplay Staff.**\n\n" +
          `**User:** ${user.tag}\n` +
          `**Category:** ${choice.replace("_", " ").toUpperCase()}\n` +
          "**Status:** 🟡 Open\n" +
          "**Claimed By:** ❌ Unclaimed\n\n" +
          "Please provide a **clear and detailed explanation** of your issue."
        );

      const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("claim").setLabel("🟢 Claim Ticket").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("unclaim").setLabel("🔄 Unclaim").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("close").setLabel("🔒 Close Ticket").setStyle(ButtonStyle.Danger)
      );

      await channel.send({ embeds: [ticketEmbed], components: [controls] });

      return interaction.editReply({ content: `✅ Ticket created: ${channel}` });
    }

    // =====================
    // TICKET BUTTONS
    // =====================
    if (interaction.isButton() && ["claim", "unclaim", "close"].includes(interaction.customId)) {
      const channel = interaction.channel;

      if (
        !interaction.member.roles.cache.has(SUPPORT_ROLE_ID) &&
        !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      }

      const topic = channel.topic || "CLAIMED:none";
      const claimedId = topic.split(":")[1];

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
        return interaction.reply({ content: "🔄 Ticket unclaimed.", ephemeral: true });
      }

      // CLOSE
      if (interaction.customId === "close") {
        await interaction.reply({ content: "🔒 Closing ticket...", ephemeral: true });
        setTimeout(() => channel.delete().catch(() => {}), 2000);
      }
    }

  } catch (err) {
    console.error("INTERACTION ERROR:", err);
  }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);
