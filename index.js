const { 
  Client, 
  GatewayIntentBits, 
  PermissionsBitField 
} = require("discord.js");
const fs = require("fs");

// =====================
// CONFIG
// =====================
const PREFIX = "!";
const DATA_FILE = "./data.json";

// =====================
// CLIENT
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

// =====================
// DATA (PERSISTENT)
// =====================
let data = {
  pingUses: 0,
};

if (fs.existsSync(DATA_FILE)) {
  data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// =====================
// READY
// =====================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// =====================
// MESSAGE HANDLER
// =====================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ---------------------
  // !ping
  // ---------------------
  if (command === "ping") {
    data.pingUses++;
    saveData();

    return message.reply(
      `🏓 Pong!\nPing used **${data.pingUses}** times.`
    );
  }

  // ---------------------
  // !say (ADMIN ONLY)
  // ---------------------
  if (command === "say") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ You do not have permission to use this command.");
    }

    const text = args.join(" ");
    if (!text) return message.reply("❌ Please provide a message.");

    await message.delete().catch(() => {});
    return message.channel.send(text);
  }

  // ---------------------
  // !lock (ADMIN ONLY)
  // ---------------------
  if (command === "lock") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ You do not have permission to lock channels.");
    }

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      { SendMessages: false }
    );

    return message.channel.send("🔒 Channel locked.");
  }

  // ---------------------
  // !unlock (ADMIN ONLY)
  // ---------------------
  if (command === "unlock") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ You do not have permission to unlock channels.");
    }

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      { SendMessages: true }
    );

    return message.channel.send("🔓 Channel unlocked.");
  }
});

// =====================
// LOGIN (RAILWAY)
// =====================
client.login(process.env.TOKEN);
