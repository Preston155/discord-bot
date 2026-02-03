const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  // !ping command
  if (message.content === "!ping") {
    message.reply("🏓 Pong!");
  }

  // !test command
  if (message.content === "!test") {
    message.reply("hey nerd");
  }
});

// Railway reads variables from process.env
client.login(process.env.TOKEN);
