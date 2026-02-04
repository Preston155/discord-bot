// ================================
// IMPORTS
// ================================
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

// ================================
// CLIENT
// ================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ================================
// CONFIG
// ================================
const PREFIX = "!";
const SUPPORT_ROLE_ID = "1282417060391161978";
const SSU_ROLE_PING = "1468213717035384882";
const MOD_LOG_CHANNEL_ID = "1461008751749234740";

const SERVER_INFO = { code: "ILCRPC", owner: "MiningMavenYT" };
const SESSION_BANNER_URL =
  "https://media.discordapp.net/attachments/1452829338545160285/1466919030127591613/ILLEGAL_FIREARM_1.png";

const CATEGORIES = {
  general_support: "1468276842942435338",
  partnership_support: "1461009005798359204",
  ia_support: "1468276930796327125",
  management_support: "1468277029865783489"
};

// ================================
// DATA FILES
// ================================
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const FILES = {
  polls: "polls.json",
  tickets: "tickets.json",
  levels: "levels.json",
  moderation: "moderation.json",
  cases: "cases.json"
};

for (const f of Object.values(FILES)) {
  const p = path.join(DATA_DIR, f);
  if (!fs.existsSync(p)) fs.writeFileSync(p, "{}");
}

const load = (f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf8"));
const save = (f, d) => fs.writeFileSync(path.join(DATA_DIR, f), JSON.stringify(d, null, 2));

let polls = load(FILES.polls);
let tickets = load(FILES.tickets);
let levels = load(FILES.levels);
let moderation = load(FILES.moderation);
let cases = load(FILES.cases);
if (!cases.lastCase) cases.lastCase = 0;

// ================================
// CASE HANDLER
// ================================
function createCase(action, target, moderator, reason) {
  cases.lastCase++;
  const id = cases.lastCase;

  cases[id] = {
    action,
    target,
    moderator,
    reason,
    time: Date.now()
  };

  save(FILES.cases, cases);

  const embed = new EmbedBuilder()
    .setColor("#dc2626")
    .setTitle(`📁 Moderation Case #${id}`)
    .addFields(
      { name: "Action", value: action, inline: true },
      { name: "User", value: `<@${target}>`, inline: true },
      { name: "Moderator", value: `<@${moderator}>`, inline: true },
      { name: "Reason", value: reason }
    )
    .setTimestamp();

  const channel = client.channels.cache.get(MOD_LOG_CHANNEL_ID);
  if (channel) channel.send({ embeds: [embed] });

  return id;
}

// ================================
// READY
// ================================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================================
// LEVEL SYSTEM
// ================================
const XP_MIN = 10;
const XP_MAX = 20;
const XP_COOLDOWN = 60_000;

function xpForLevel(lvl) {
  return Math.floor(100 * lvl * 1.5);
}

function addXP(id) {
  const now = Date.now();
  if (!levels[id]) levels[id] = { xp: 0, level: 1, last: 0 };
  if (now - levels[id].last < XP_COOLDOWN) return null;

  const gain = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
  levels[id].xp += gain;
  levels[id].last = now;

  let up = false;
  while (levels[id].xp >= xpForLevel(levels[id].level)) {
    levels[id].xp -= xpForLevel(levels[id].level);
    levels[id].level++;
    up = true;
  }

  save(FILES.levels, levels);
  return up ? levels[id].level : null;
}

// ================================
// MESSAGE CREATE
// ================================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // XP
  const lvl = addXP(message.author.id);
  if (lvl) {
    message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor("#facc15")
        .setTitle("⬆️ Level Up!")
        .setDescription(`${message.author} reached **Level ${lvl}**!`)]
    });
  }

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).split(/ +/);
  const cmd = args.shift().toLowerCase();

  // ================================
  // MODERATION COMMANDS
  // ================================
  if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return;

  const target = message.mentions.members.first();
  const reason = args.slice(1).join(" ") || "No reason provided";

  if (cmd === "warn" && target) {
    if (!moderation[target.id]) moderation[target.id] = [];
    moderation[target.id].push({ reason, mod: message.author.id, time: Date.now() });
    save(FILES.moderation, moderation);

    const id = createCase("Warning", target.id, message.author.id, reason);
    return message.reply(`⚠️ Warning issued (Case #${id})`);
  }

  if (cmd === "kick" && target) {
    await target.kick(reason);
    const id = createCase("Kick", target.id, message.author.id, reason);
    return message.reply(`👢 User kicked (Case #${id})`);
  }

  if (cmd === "ban" && target) {
    await target.ban({ reason });
    const id = createCase("Ban", target.id, message.author.id, reason);
    return message.reply(`🔨 User banned (Case #${id})`);
  }

  if (cmd === "timeout" && target) {
    const minutes = parseInt(args[1]);
    if (!minutes) return message.reply("❌ Provide minutes.");
    await target.timeout(minutes * 60_000, reason);
    const id = createCase("Timeout", target.id, message.author.id, reason);
    return message.reply(`⏳ Timeout applied (Case #${id})`);
  }

  if (cmd === "purge") {
    const amount = parseInt(args[0]);
    if (!amount || amount > 100) return message.reply("❌ Max 100 messages.");
    await message.channel.bulkDelete(amount, true);
    return message.channel.send(`🧹 Deleted ${amount} messages.`);
  }
});

// ================================
// LOGIN
// ================================
client.login(process.env.TOKEN);
