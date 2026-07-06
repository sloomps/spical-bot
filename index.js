const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');

// ====================== المتغيرات البيئية ======================
const TOKEN = process.env.DISCORD_TOKEN || process.env.توكن;
if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN غير موجود');
  process.exit(1);
}
const PREFIX = process.env.PREFIX || '!';
const OWNER_ID = process.env.OWNER_ID || null;

// ====================== أقسام التذاكر ======================
const TICKET_SECTIONS = {
  'support': { label: '💻 دعم فني', description: 'مشاكل تقنية أو أعطال', emoji: '🛠️', color: 0x3498db },
  'suggestion': { label: '💡 اقتراح', description: 'اقتراح لتطوير السيرفر', emoji: '📝', color: 0x2ecc71 },
  'complaint': { label: '📢 شكوى', description: 'شكوى ضد عضو أو إداري', emoji: '⚖️', color: 0xe74c3c },
  'partnership': { label: '🤝 تعاون', description: 'عرض تعاون أو شراكة', emoji: '📩', color: 0xf1c40f },
  'other': { label: '📌 أخرى', description: 'أي طلب آخر', emoji: '📂', color: 0x95a5a6 }
};

// ====================== قاعدة البيانات ======================
const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

function ensureColumns() {
  const tableInfo = db.prepare("PRAGMA table_info(guild_config)").all();
  const existingColumns = tableInfo.map(row => row.name);
  const cols = [
    'ticket_panel_image', 'ticket_welcome_image', 'welcome_panel_text',
    'level_channel_id', 'auto_line_channel_id', 'auto_line_text',
    'auto_line_enabled', 'auto_line_image'
  ];
  for (const col of cols) {
    if (!existingColumns.includes(col)) {
      db.exec(`ALTER TABLE guild_config ADD COLUMN ${col} TEXT`);
    }
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    log_channel TEXT,
    welcome_channel TEXT,
    welcome_message TEXT,
    welcome_image_url TEXT,
    mute_role_id TEXT,
    warn_mute_threshold INTEGER DEFAULT 3,
    warn_kick_threshold INTEGER DEFAULT 5,
    join_role_id TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT,
    guild_id TEXT,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    messages INTEGER DEFAULT 0,
    voice_time INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS economy (
    user_id TEXT,
    guild_id TEXT,
    balance INTEGER DEFAULT 0,
    bank INTEGER DEFAULT 0,
    daily_last TEXT,
    daily_streak INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS warns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    guild_id TEXT,
    reason TEXT,
    moderator_id TEXT,
    date TEXT
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT,
    guild_id TEXT,
    user_id TEXT,
    status TEXT,
    claimed_by TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS reaction_roles (
    message_id TEXT,
    guild_id TEXT,
    role_id TEXT,
    emoji TEXT,
    PRIMARY KEY (message_id, emoji)
  );

  CREATE TABLE IF NOT EXISTS giveaways (
    message_id TEXT PRIMARY KEY,
    guild_id TEXT,
    channel_id TEXT,
    prize TEXT,
    winner_count INTEGER,
    end_time TEXT,
    participants TEXT,
    ended INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS level_roles (
    guild_id TEXT,
    level INTEGER,
    role_id TEXT,
    PRIMARY KEY (guild_id, level)
  );

  CREATE TABLE IF NOT EXISTS ticket_section_roles (
    guild_id TEXT,
    section_key TEXT,
    role_id TEXT,
    PRIMARY KEY (guild_id, section_key)
  );

  CREATE TABLE IF NOT EXISTS controllers (
    guild_id TEXT,
    user_id TEXT,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS user_ex (
    user_id TEXT,
    guild_id TEXT,
    ex_points INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS clans (
    clan_id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    name TEXT,
    leader_id TEXT,
    deputy_id TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS clan_members (
    clan_id INTEGER,
    user_id TEXT,
    joined_at TEXT,
    PRIMARY KEY (clan_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS user_notes (
    user_id TEXT,
    guild_id TEXT,
    note TEXT,
    PRIMARY KEY (user_id, guild_id)
  );
`);

ensureColumns();

// ====================== دوال الصلاحيات ======================
function isController(userId, guildId) {
  if (OWNER_ID && userId === OWNER_ID) return true;
  const row = db.prepare('SELECT user_id FROM controllers WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  return !!row;
}

function hasPermission(member, guildId) {
  if (!member) return false;
  if (OWNER_ID && member.id === OWNER_ID) return true;
  return isController(member.id, guildId);
}

// ====================== دوال مساعدة ======================
function getLevelXP(level) {
  return (level + 1) * 100;
}

function parseDuration(text) {
  const pattern = /(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/;
  const match = text.match(pattern);
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match.map(x => parseInt(x) || 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function getGuildConfig(guildId) {
  let row = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
  if (!row) {
    db.prepare('INSERT INTO guild_config (guild_id) VALUES (?)').run(guildId);
    row = { guild_id: guildId, log_channel: null, welcome_channel: null, welcome_message: null, welcome_image_url: null, mute_role_id: null, warn_mute_threshold: 3, warn_kick_threshold: 5, join_role_id: null, ticket_panel_image: null, ticket_welcome_image: null, welcome_panel_text: null, level_channel_id: null, auto_line_channel_id: null, auto_line_text: null, auto_line_enabled: null, auto_line_image: null };
  }
  const defaults = { ticket_panel_image: null, ticket_welcome_image: null, welcome_panel_text: null, level_channel_id: null, auto_line_channel_id: null, auto_line_text: null, auto_line_enabled: null, auto_line_image: null };
  for (const key in defaults) {
    if (row[key] === undefined) row[key] = defaults[key];
  }
  return row;
}

function updateGuildConfig(guildId, data) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = Object.values(data);
  values.push(guildId);
  db.prepare(`UPDATE guild_config SET ${fields} WHERE guild_id = ?`).run(...values);
}

function getEconomy(userId, guildId) {
  let row = db.prepare('SELECT balance, bank, daily_last, daily_streak FROM economy WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  if (!row) {
    db.prepare('INSERT INTO economy (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
    row = { balance: 0, bank: 0, daily_last: null, daily_streak: 0 };
  }
  return row;
}

function saveEconomy(userId, guildId, data) {
  db.prepare('UPDATE economy SET balance = ?, bank = ?, daily_last = ?, daily_streak = ? WHERE user_id = ? AND guild_id = ?')
    .run(data.balance, data.bank, data.daily_last, data.daily_streak, userId, guildId);
}

function getUserLevel(userId, guildId) {
  let row = db.prepare('SELECT xp, level, messages, voice_time FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  if (!row) {
    db.prepare('INSERT INTO users (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
    row = { xp: 0, level: 0, messages: 0, voice_time: 0 };
  }
  return row;
}

function updateUserLevel(userId, guildId, xp, level, messages, voice_time) {
  db.prepare('UPDATE users SET xp = ?, level = ?, messages = ?, voice_time = ? WHERE user_id = ? AND guild_id = ?')
    .run(xp, level, messages, voice_time, userId, guildId);
}

function getSectionRole(guildId, sectionKey) {
  const row = db.prepare('SELECT role_id FROM ticket_section_roles WHERE guild_id = ? AND section_key = ?').get(guildId, sectionKey);
  return row ? row.role_id : null;
}

// ====================== دوال EX والكلانات ======================
function getEx(userId, guildId) {
  let row = db.prepare('SELECT ex_points FROM user_ex WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  if (!row) {
    db.prepare('INSERT INTO user_ex (user_id, guild_id, ex_points) VALUES (?, ?, 0)').run(userId, guildId);
    return 0;
  }
  return row.ex_points;
}

function setEx(userId, guildId, amount) {
  db.prepare('UPDATE user_ex SET ex_points = ? WHERE user_id = ? AND guild_id = ?').run(amount, userId, guildId);
}

function addEx(userId, guildId, amount) {
  let current = getEx(userId, guildId);
  current += amount;
  setEx(userId, guildId, current);
  return current;
}

function getClanByUser(userId, guildId) {
  return db.prepare(`
    SELECT c.* FROM clans c
    JOIN clan_members cm ON c.clan_id = cm.clan_id
    WHERE cm.user_id = ? AND c.guild_id = ?
  `).get(userId, guildId);
}

function getClanById(clanId) {
  return db.prepare('SELECT * FROM clans WHERE clan_id = ?').get(clanId);
}

function getClanMembers(clanId) {
  return db.prepare('SELECT user_id FROM clan_members WHERE clan_id = ?').all(clanId);
}

function getClanTotalEx(clanId, guildId) {
  const members = getClanMembers(clanId);
  let total = 0;
  for (const m of members) {
    total += getEx(m.user_id, guildId);
  }
  return total;
}

// ====================== دوال النوت ======================
function getNote(userId, guildId) {
  const row = db.prepare('SELECT note FROM user_notes WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  return row ? row.note : null;
}

function setNote(userId, guildId, note) {
  db.prepare('INSERT OR REPLACE INTO user_notes (user_id, guild_id, note) VALUES (?, ?, ?)')
    .run(userId, guildId, note);
}

// ====================== دوال اللوق ======================
async function logToChannel(guildId, embedData) {
  const config = getGuildConfig(guildId);
  if (!config.log_channel) return;
  const channel = client.channels.cache.get(config.log_channel);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setColor(embedData.color || 0x2b2d31)
    .setTitle(embedData.title || '📋 سجل')
    .setDescription(embedData.description || '')
    .setTimestamp()
    .setFooter({ text: embedData.footer || '' });
  if (embedData.fields) {
    for (const field of embedData.fields) {
      embed.addFields(field);
    }
  }
  await channel.send({ embeds: [embed] }).catch(() => {});
}

// ====================== إنشاء العميل ======================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions
  ]
});

// ====================== أحداث البوت ======================
client.once('ready', () => {
  console.log(`✅ البوت جاهز باسم ${client.user.tag}`);
  client.user.setActivity(`${PREFIX}مساعدة`, { type: 'WATCHING' });
});

// ====================== نظام المستويات والأوتو لاين وEX ======================
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const guildId = message.guild.id;
  const userId = message.author.id;
  const config = getGuildConfig(guildId);

  if (config.auto_line_enabled === 'true' && config.auto_line_channel_id && config.auto_line_text) {
    if (message.channel.id === config.auto_line_channel_id) {
      const words = config.auto_line_text.split(',').map(w => w.trim());
      const content = message.content.toLowerCase();
      for (const word of words) {
        if (content.includes(word.toLowerCase())) {
          let replyContent = `🔁 أوتو لاين: ${config.auto_line_text}`;
          if (config.auto_line_image) {
            const embed = new EmbedBuilder()
              .setDescription(replyContent)
              .setImage(config.auto_line_image)
              .setColor(0x2b2d31);
            await message.reply({ embeds: [embed] });
          } else {
            await message.reply(replyContent);
          }
          break;
        }
      }
    }
  }

  let data = getUserLevel(userId, guildId);
  let xp = data.xp;
  let level = data.level;
  let msgs = data.messages + 1;
  let voice_time = data.voice_time;
  const gain = Math.floor(Math.random() * 15) + 10;
  xp += gain;
  const required = getLevelXP(level);
  if (xp >= required) {
    level++;
    xp = 0;
    if (level % 5 === 0) {
      let eco = getEconomy(userId, guildId);
      eco.balance += 300;
      saveEconomy(userId, guildId, eco);
      if (config.level_channel_id) {
        const levelChannel = message.guild.channels.cache.get(config.level_channel_id);
        if (levelChannel) {
          levelChannel.send(`🎉 مبروك ${message.author} وصلت للمستوى ${level}!`);
        }
      } else {
        message.author.send(`🎉 مبروك مستوى ${level}! حصلت على 300 دولار إضافية.`).catch(() => {});
      }
    }
    const levelRole = db.prepare('SELECT role_id FROM level_roles WHERE guild_id = ? AND level = ?').get(guildId, level);
    if (levelRole) {
      const role = message.guild.roles.cache.get(levelRole.role_id);
      if (role) message.member.roles.add(role).catch(() => {});
    }
  }
  updateUserLevel(userId, guildId, xp, level, msgs, voice_time);

  if (msgs % 30 === 0) {
    const newEx = addEx(userId, guildId, 15);
    try {
      await message.author.send(`🌟 حصلت على 15 نقطة EX! إجمالي نقاطك الآن: ${newEx} EX.`);
    } catch (e) {}
  }
});

// ====================== نظام EX للصوت ======================
const voiceTimers = new Map();

client.on('voiceStateUpdate', async (oldState, newState) => {
  const guildId = newState.guild.id;
  const userId = newState.member.id;
  const key = `${guildId}-${userId}`;

  if (!oldState.channelId && newState.channelId) {
    const interval = setInterval(async () => {
      const currentEx = addEx(userId, guildId, 10);
      try {
        const member = newState.guild.members.cache.get(userId);
        if (member) await member.send(`🔊 حصلت على 10 نقاط EX من التواجد الصوتي! إجمالي نقاطك: ${currentEx} EX.`);
      } catch (e) {}
    }, 600000);
    voiceTimers.set(key, { interval });
  } else if (oldState.channelId && !newState.channelId) {
    if (voiceTimers.has(key)) {
      clearInterval(voiceTimers.get(key).interval);
      voiceTimers.delete(key);
    }
  }
});

// ====================== سجلات الحذف ======================
client.on('messageDelete', async (message) => {
  if (!message.guild || message.author?.bot) return;
  const config = getGuildConfig(message.guild.id);
  if (!config.log_channel) return;
  const logChannel = client.channels.cache.get(config.log_channel);
  if (!logChannel) return;
  const embed = new EmbedBuilder()
    .setTitle('🗑️ حذف رسالة')
    .setColor(0x2b2d31)
    .setTimestamp(message.createdAt)
    .addFields(
      { name: 'المستخدم', value: message.author ? message.author.tag : 'غير معروف', inline: true },
      { name: 'المحتوى', value: message.content || 'غير مرئي', inline: false },
      { name: 'القناة', value: message.channel.name, inline: true }
    );
  logChannel.send({ embeds: [embed] }).catch(() => {});
});

// ====================== دخول وخروج الأعضاء ======================
client.on('guildMemberAdd', async (member) => {
  const config = getGuildConfig(member.guild.id);
  if (config.welcome_channel) {
    const channel = member.guild.channels.cache.get(config.welcome_channel);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('👋 مرحباً!')
        .setDescription(config.welcome_message || `أهلاً ${member} في السيرفر!`)
        .setColor(0x2b2d31)
        .setTimestamp(member.joinedAt)
        .setThumbnail(member.user.displayAvatarURL());
      if (config.welcome_image_url) embed.setImage(config.welcome_image_url);
      channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
  if (config.join_role_id) {
    const role = member.guild.roles.cache.get(config.join_role_id);
    if (role) member.roles.add(role).catch(() => {});
  }
  if (config.log_channel) {
    const logChannel = member.guild.channels.cache.get(config.log_channel);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('👤 عضو جديد')
        .setColor(0x2b2d31)
        .setTimestamp(member.joinedAt)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: 'الاسم', value: member.user.tag, inline: true },
          { name: 'العضويات', value: `${member.guild.memberCount}`, inline: true }
        );
      logChannel.send({ embeds: [embed] }).catch(() => {});
    }
  }
});

client.on('guildMemberRemove', async (member) => {
  const config = getGuildConfig(member.guild.id);
  if (!config.log_channel) return;
  const logChannel = member.guild.channels.cache.get(config.log_channel);
  if (!logChannel) return;
  const embed = new EmbedBuilder()
    .setTitle('🚫 عضو غادر')
    .setColor(0x2b2d31)
    .setTimestamp()
    .setThumbnail(member.user.displayAvatarURL())
    .addFields({ name: 'الاسم', value: member.user.tag, inline: true });
  logChannel.send({ embeds: [embed] }).catch(() => {});
});

// ====================== الأدوار التفاعلية ======================
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  const msg = reaction.message;
  if (!msg.guild) return;
  const emoji = reaction.emoji.name;
  const row = db.prepare('SELECT role_id FROM reaction_roles WHERE message_id = ? AND emoji = ?').get(msg.id, emoji);
  if (row) {
    const role = msg.guild.roles.cache.get(row.role_id);
    if (role) {
      const member = msg.guild.members.cache.get(user.id);
      if (member) member.roles.add(role).catch(() => {});
    }
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  const msg = reaction.message;
  if (!msg.guild) return;
  const emoji = reaction.emoji.name;
  const row = db.prepare('SELECT role_id FROM reaction_roles WHERE message_id = ? AND emoji = ?').get(msg.id, emoji);
  if (row) {
    const role = msg.guild.roles.cache.get(row.role_id);
    if (role) {
      const member = msg.guild.members.cache.get(user.id);
      if (member) member.roles.remove(role).catch(() => {});
    }
  }
});

// ====================== معالج الأزرار والقوائم المنسدلة ======================
client.on('interactionCreate', async (interaction) => {
  // زر فتح القائمة المنسدلة (من بانل بسيط)
  if (interaction.isButton() && interaction.customId === 'open_ticket_select') {
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ticket_panel')
          .setPlaceholder('📌 اختر قسم التذكرة...')
          .addOptions(
            Object.entries(TICKET_SECTIONS).map(([value, data]) => ({
              label: data.label,
              description: data.description,
              value: value,
              emoji: data.emoji
            }))
          )
      );
    await interaction.reply({ 
      content: 'اختر القسم المناسب:', 
      components: [row],
      ephemeral: true 
    });
    return;
  }

  // زر إغلاق التذكرة
  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    const channel = interaction.channel;
    if (!channel.name.startsWith('تذكرة-')) {
      return interaction.reply({ content: '⚠️ هذه ليست قناة تذكرة.', ephemeral: true });
    }
    const ticket = db.prepare('SELECT user_id FROM tickets WHERE channel_id = ? AND status = ?').get(channel.id, 'مفتوحة');
    if (!ticket) return interaction.reply({ content: '❌ هذه التذكرة غير موجودة.', ephemeral: true });
    const isOwner = interaction.user.id === ticket.user_id;
    const isAdmin = hasPermission(interaction.member, interaction.guild.id);
    if (!isOwner && !isAdmin) {
      return interaction.reply({ content: '❌ فقط صاحب التذكرة أو متحكم يمكنه إغلاقها.', ephemeral: true });
    }
    await interaction.reply({ content: '🔒 جاري إغلاق التذكرة خلال 5 ثوانٍ...', ephemeral: true });
    setTimeout(async () => {
      await channel.delete();
      db.prepare('UPDATE tickets SET status = ? WHERE channel_id = ?').run('مغلقة', channel.id);
    }, 5000);
    return;
  }

  // زر استلام التذكرة
  if (interaction.isButton() && interaction.customId === 'claim_ticket') {
    const channel = interaction.channel;
    if (!channel.name.startsWith('تذكرة-')) {
      return interaction.reply({ content: '⚠️ هذه ليست قناة تذكرة.', ephemeral: true });
    }
    const ticket = db.prepare('SELECT user_id, claimed_by FROM tickets WHERE channel_id = ? AND status = ?').get(channel.id, 'مفتوحة');
    if (!ticket) return interaction.reply({ content: '❌ هذه التذكرة غير موجودة.', ephemeral: true });
    if (ticket.claimed_by) {
      return interaction.reply({ content: `❌ هذه التذكرة مستلمة بالفعل بواسطة <@${ticket.claimed_by}>`, ephemeral: true });
    }
    db.prepare('UPDATE tickets SET claimed_by = ? WHERE channel_id = ?').run(interaction.user.id, channel.id);
    await channel.send(`✅ تم استلام التذكرة بواسطة ${interaction.user}`);
    await interaction.reply({ content: '✅ تم استلام التذكرة بنجاح.', ephemeral: true });
    return;
  }

  // القائمة المنسدلة للتذاكر (من بانل عادي أو من بانل بسيط)
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_panel') {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const member = interaction.member;
    const selectedSection = interaction.values[0];
    const sectionData = TICKET_SECTIONS[selectedSection];

    if (!sectionData) {
      return interaction.editReply({ content: '❌ قسم غير صالح.', ephemeral: true });
    }

    const existingTicket = db.prepare('SELECT channel_id FROM tickets WHERE user_id = ? AND guild_id = ? AND status = ?')
      .get(member.id, guild.id, 'مفتوحة');
    if (existingTicket) {
      const channel = guild.channels.cache.get(existingTicket.channel_id);
      return interaction.editReply({
        content: `⚠️ لديك تذكرة مفتوحة بالفعل: ${channel ? channel : 'تم حذفها'}`,
        ephemeral: true
      });
    }

    const ticketName = `تذكرة-${member.user.username}-${selectedSection}`.slice(0, 32);
    
    try {
      const channel = await guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: null,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
          { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
        ]
      });

      db.prepare('INSERT INTO tickets (channel_id, guild_id, user_id, status, claimed_by, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(channel.id, guild.id, member.id, 'مفتوحة', null, new Date().toISOString());

      const config = getGuildConfig(guild.id);
      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`🎫 تذكرة جديدة - ${sectionData.label}`)
        .setDescription(`مرحباً ${member}! تم إنشاء تذكرتك بنجاح.\nالقسم: **${sectionData.label}**\nالرجاء شرح مشكلتك بالتفصيل، وسيرد عليك فريق الدعم قريباً.`)
        .setColor(0x2b2d31)
        .setTimestamp()
        .setFooter({ text: `🆔 معرف التذكرة: ${channel.id}` });

      if (config.ticket_welcome_image) {
        welcomeEmbed.setImage(config.ticket_welcome_image);
      }

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('claim_ticket')
            .setLabel('📥 استلام التذكرة')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('🔒 إغلاق التذكرة')
            .setStyle(ButtonStyle.Secondary)
        );

      let sectionMention = '';
      const sectionRoleId = getSectionRole(guild.id, selectedSection);
      if (sectionRoleId) {
        const role = guild.roles.cache.get(sectionRoleId);
        if (role) sectionMention = `${role}`;
      }

      await channel.send({ 
        content: `${member} ${sectionMention}`.trim(),
        embeds: [welcomeEmbed],
        components: [row]
      });

      const dmEmbed = new EmbedBuilder()
        .setTitle('✅ تم إنشاء تذكرتك')
        .setDescription(`تم إنشاء تذكرتك في سيرفر **${guild.name}**`)
        .addFields(
          { name: '📌 القسم', value: sectionData.label, inline: true },
          { name: '🆔 القناة', value: `#${channel.name}`, inline: true },
          { name: '🔗 الرابط', value: `[اضغط هنا للذهاب إلى التذكرة](${channel.url})`, inline: false }
        )
        .setColor(0x2b2d31)
        .setTimestamp();

      await member.send({ embeds: [dmEmbed] }).catch(() => {});

      await interaction.editReply({ 
        content: `✅ تم إنشاء تذكرتك بنجاح: ${channel}`,
        ephemeral: true 
      });

    } catch (error) {
      console.error('خطأ في إنشاء التذكرة:', error);
      await interaction.editReply({ 
        content: '❌ حدث خطأ أثناء إنشاء التذكرة. تأكد من صلاحيات البوت.',
        ephemeral: true 
      });
    }
    return;
  }
});

// ====================== الأوامر ======================
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // ========== إدارة المتحكمين ==========
  if (cmd === 'متحكم') {
    if (!hasPermission(message.member, message.guild.id)) {
      return message.reply('❌ ليس لديك صلاحية لتعيين متحكمين.');
    }
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن العضو الذي تريد جعله متحكماً.');
    if (member.id === client.user.id) return message.reply('❌ لا يمكنني جعل نفسي متحكماً.');
    if (OWNER_ID && member.id === OWNER_ID) return message.reply('❌ هذا هو مالك البوت، يملك صلاحية مطلقة مسبقاً.');
    if (isController(member.id, message.guild.id)) {
      return message.reply(`⚠️ ${member} متحكم بالفعل.`);
    }
    db.prepare('INSERT INTO controllers (guild_id, user_id) VALUES (?, ?)').run(message.guild.id, member.id);
    message.reply(`✅ تم جعل ${member} متحكماً على البوت في هذا السيرفر.`);
    logToChannel(message.guild.id, {
      title: '🛡️ تعيين متحكم',
      description: `${message.author} جعل ${member} متحكماً.`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'الغاء_متحكم') {
    if (!hasPermission(message.member, message.guild.id)) {
      return message.reply('❌ ليس لديك صلاحية لإزالة متحكمين.');
    }
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن العضو الذي تريد إزالة صلاحيته.');
    if (OWNER_ID && member.id === OWNER_ID) return message.reply('❌ لا يمكنك إزالة صلاحية مالك البوت.');
    if (!isController(member.id, message.guild.id)) {
      return message.reply(`⚠️ ${member} ليس متحكماً.`);
    }
    db.prepare('DELETE FROM controllers WHERE guild_id = ? AND user_id = ?').run(message.guild.id, member.id);
    message.reply(`✅ تم إلغاء صلاحية التحكم عن ${member}.`);
    logToChannel(message.guild.id, {
      title: '🛡️ إلغاء متحكم',
      description: `${message.author} ألغى صلاحية ${member}.`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'قائمة_المتحكمين') {
    const rows = db.prepare('SELECT user_id FROM controllers WHERE guild_id = ?').all(message.guild.id);
    if (!rows.length) {
      return message.reply('📋 لا يوجد متحكمون في هذا السيرفر.');
    }
    const list = rows.map(row => `<@${row.user_id}>`).join('\n');
    const embed = new EmbedBuilder()
      .setTitle('🛡️ قائمة المتحكمين')
      .setDescription(list)
      .setColor(0x2b2d31)
      .setTimestamp();
    message.channel.send({ embeds: [embed] });
  }

  // ========== إدارة ==========
  else if (cmd === 'حظر') {
    if (!hasPermission(message.member, message.guild.id)) return message.reply('❌ تحتاج صلاحية متحكم.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن العضو.');
    const reason = args.join(' ') || 'لا يوجد سبب';
    await member.ban({ reason });
    const embed = new EmbedBuilder().setTitle('✅ تم الحظر').setColor(0x2b2d31).setDescription(`${member.user.tag} تم حظره بسبب: ${reason}`);
    message.channel.send({ embeds: [embed] });
    logToChannel(message.guild.id, {
      title: '🔨 حظر',
      description: `**المنفذ:** ${message.author}\n**المستهدف:** ${member.user.tag}\n**السبب:** ${reason}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'طرد') {
    if (!hasPermission(message.member, message.guild.id)) return message.reply('❌ تحتاج صلاحية متحكم.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن العضو.');
    const reason = args.join(' ') || 'لا يوجد سبب';
    await member.kick(reason);
    const embed = new EmbedBuilder().setTitle('✅ تم الطرد').setColor(0x2b2d31).setDescription(`${member.user.tag} تم طرده بسبب: ${reason}`);
    message.channel.send({ embeds: [embed] });
    logToChannel(message.guild.id, {
      title: '🚪 طرد',
      description: `**المنفذ:** ${message.author}\n**المستهدف:** ${member.user.tag}\n**السبب:** ${reason}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'كتم') {
    if (!hasPermission(message.member, message.guild.id)) return message.reply('❌ تحتاج صلاحية متحكم.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن العضو.');
    let duration = args[0] || '10m';
    const reason = args.slice(1).join(' ') || 'لا يوجد سبب';
    const secs = parseDuration(duration);
    if (!secs) return message.reply('⚠️ صيغة الوقت غير صحيحة. مثال: 1d2h30m');

    let config = getGuildConfig(message.guild.id);
    let muteRole = null;
    if (config.mute_role_id) muteRole = message.guild.roles.cache.get(config.mute_role_id);
    if (!muteRole) {
      muteRole = message.guild.roles.cache.find(r => r.name === 'Muted');
      if (!muteRole) {
        muteRole = await message.guild.roles.create({ name: 'Muted', permissions: [] });
        message.guild.channels.cache.forEach(ch => {
          ch.permissionOverwrites.create(muteRole, { SendMessages: false }).catch(() => {});
        });
      }
      updateGuildConfig(message.guild.id, { mute_role_id: muteRole.id });
    }
    await member.roles.add(muteRole, reason);
    const embed = new EmbedBuilder().setTitle('🔇 تم الكتم').setColor(0x2b2d31).setDescription(`${member.user.tag} كتم لمدة ${duration} بسبب: ${reason}`);
    message.channel.send({ embeds: [embed] });
    setTimeout(async () => {
      await member.roles.remove(muteRole);
      message.channel.send(`🔊 ${member} تم فك الكتم تلقائياً.`).catch(() => {});
    }, secs * 1000);
    logToChannel(message.guild.id, {
      title: '🔇 كتم',
      description: `**المنفذ:** ${message.author}\n**المستهدف:** ${member.user.tag}\n**المدة:** ${duration}\n**السبب:** ${reason}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'تحذير') {
    if (!hasPermission(message.member, message.guild.id)) return message.reply('❌ تحتاج صلاحية متحكم.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن العضو.');
    const reason = args.join(' ') || 'لا يوجد سبب';
    db.prepare('INSERT INTO warns (user_id, guild_id, reason, moderator_id, date) VALUES (?, ?, ?, ?, ?)')
      .run(member.id, message.guild.id, reason, message.author.id, new Date().toISOString());
    const row = db.prepare('SELECT COUNT(*) as count FROM warns WHERE user_id = ? AND guild_id = ?').get(member.id, message.guild.id);
    const count = row ? row.count : 0;
    const embed = new EmbedBuilder().setTitle('⚠️ تحذير').setColor(0x2b2d31).setDescription(`${member.user.tag} تم تحذيره بسبب: ${reason}\nإجمالي التحذيرات: ${count}`);
    message.channel.send({ embeds: [embed] });
    try {
      await member.send(`⚠️ تم تحذيرك في سيرفر **${message.guild.name}**\nالسبب: ${reason}\nإجمالي تحذيراتك: ${count}`);
    } catch (e) {}
    let config = getGuildConfig(message.guild.id);
    if (count >= config.warn_kick_threshold) {
      member.kick('تجاوز عدد التحذيرات المسموح').then(() => {
        message.channel.send(`🚫 ${member.user.tag} تم طرده تلقائياً.`);
      }).catch(() => {});
    } else if (count >= config.warn_mute_threshold) {
      const muteRole = message.guild.roles.cache.get(config.mute_role_id);
      if (muteRole) {
        member.roles.add(muteRole, 'تجاوز حد التحذيرات').then(() => {
          message.channel.send(`🔇 ${member.user.tag} تم كتمه تلقائياً.`);
        }).catch(() => {});
      }
    }
    logToChannel(message.guild.id, {
      title: '⚠️ تحذير',
      description: `**المنفذ:** ${message.author}\n**المستهدف:** ${member.user.tag}\n**السبب:** ${reason}\n**إجمالي التحذيرات:** ${count}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'مسح') {
    if (!hasPermission(message.member, message.guild.id)) return message.reply('❌ تحتاج صلاحية متحكم.');
    let amount = parseInt(args[0]) || 5;
    if (amount > 100) amount = 100;
    const deleted = await message.channel.bulkDelete(amount, true).catch(() => {});
    const count = deleted ? deleted.size : 0;
    const msg = await message.channel.send(`🗑️ تم مسح ${count} رسالة.`);
    setTimeout(() => msg.delete().catch(() => {}), 5000);
    logToChannel(message.guild.id, {
      title: '🗑️ مسح',
      description: `**المنفذ:** ${message.author}\n**القناة:** ${message.channel.name}\n**عدد الرسائل:** ${count}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'قفل') {
    if (!hasPermission(message.member, message.guild.id)) return message.reply('❌ تحتاج صلاحية متحكم.');
    await message.channel.permissionOverwrites.create(message.guild.id, { SendMessages: false });
    message.channel.send('🔒 تم قفل القناة.');
    logToChannel(message.guild.id, {
      title: '🔒 قفل قناة',
      description: `**المنفذ:** ${message.author}\n**القناة:** ${message.channel.name}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'فتح') {
    if (!hasPermission(message.member, message.guild.id)) return message.reply('❌ تحتاج صلاحية متحكم.');
    await message.channel.permissionOverwrites.delete(message.guild.id);
    message.channel.send('🔓 تم فتح القناة.');
    logToChannel(message.guild.id, {
      title: '🔓 فتح قناة',
      description: `**المنفذ:** ${message.author}\n**القناة:** ${message.channel.name}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  // ========== اقتصاد ==========
  else if (cmd === 'رصيد') {
    const member = message.mentions.members.first() || message.member;
    const eco = getEconomy(member.id, message.guild.id);
    const embed = new EmbedBuilder().setTitle(`💰 رصيد ${member.user.username}`).setColor(0x2b2d31)
      .setDescription(`الرصيد: ${eco.balance}\nالمصرف: ${eco.bank}`);
    message.channel.send({ embeds: [embed] });
  }

  else if (cmd === 'يومية') {
    let eco = getEconomy(message.author.id, message.guild.id);
    if (eco.daily_last) {
      const last = new Date(eco.daily_last);
      const now = new Date();
      const diff = now - last;
      if (diff < 86400000) {
        const remaining = 86400000 - diff;
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        return message.reply(`⏳ متبقي: ${hours} ساعة و ${minutes} دقيقة.`);
      }
    }
    const reward = Math.floor(Math.random() * 600) + 200;
    eco.balance += reward;
    eco.daily_streak = (eco.daily_streak || 0) + 1;
    if (eco.daily_streak % 7 === 0) eco.balance += 300;
    eco.daily_last = new Date().toISOString();
    saveEconomy(message.author.id, message.guild.id, eco);
    message.reply(`🎁 حصلت على ${reward} دولار! (تتابع: ${eco.daily_streak} يوم)`);
  }

  else if (cmd === 'تحويل') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن المستلم.');
    const amount = parseInt(args[1]);
    if (!amount || amount <= 0) return message.reply('⚠️ أدخل مبلغاً موجباً.');
    let sender = getEconomy(message.author.id, message.guild.id);
    if (sender.balance < amount) return message.reply('❌ رصيدك غير كاف.');
    let receiver = getEconomy(member.id, message.guild.id);
    sender.balance -= amount;
    receiver.balance += amount;
    saveEconomy(message.author.id, message.guild.id, sender);
    saveEconomy(member.id, message.guild.id, receiver);
    message.reply(`✅ تم تحويل ${amount} دولار إلى ${member.user.tag}.`);
  }

  else if (cmd === 'سرقة') {
    const member = message.mentions.members.first();
    if (!member || member.id === message.author.id) return message.reply('⚠️ منشن شخصاً آخر.');
    let robber = getEconomy(message.author.id, message.guild.id);
    let victim = getEconomy(member.id, message.guild.id);
    if (victim.balance < 50) return message.reply('👎 الضحية فقير.');
    if (Math.random() < 0.35) {
      const stolen = Math.floor(Math.random() * (victim.balance * 0.3)) + 50;
      robber.balance += stolen;
      victim.balance -= stolen;
      saveEconomy(message.author.id, message.guild.id, robber);
      saveEconomy(member.id, message.guild.id, victim);
      message.reply(`😈 سرقت ${stolen} دولار من ${member.user.tag}!`);
    } else {
      const fine = Math.floor(Math.random() * 80) + 20;
      robber.balance -= fine;
      saveEconomy(message.author.id, message.guild.id, robber);
      message.reply(`😠 فشلت السرقة وغرّمك ${fine} دولار.`);
    }
  }

  else if (cmd === 'مصرف') {
    const amount = parseInt(args[0]);
    if (!amount || amount <= 0) return message.reply('⚠️ أدخل مبلغاً موجباً.');
    let eco = getEconomy(message.author.id, message.guild.id);
    if (eco.balance < amount) return message.reply('❌ رصيدك غير كاف.');
    eco.balance -= amount;
    eco.bank += amount;
    saveEconomy(message.author.id, message.guild.id, eco);
    message.reply(`🏦 أودعت ${amount} دولار في المصرف.`);
  }

  else if (cmd === 'سحب') {
    const amount = parseInt(args[0]);
    if (!amount || amount <= 0) return message.reply('⚠️ أدخل مبلغاً موجباً.');
    let eco = getEconomy(message.author.id, message.guild.id);
    if (eco.bank < amount) return message.reply('❌ رصيد مصرفي غير كاف.');
    eco.balance += amount;
    eco.bank -= amount;
    saveEconomy(message.author.id, message.guild.id, eco);
    message.reply(`🏦 سحبت ${amount} دولار من المصرف.`);
  }

  else if (cmd === 'متجر') {
    const embed = new EmbedBuilder().setTitle('🛒 المتجر').setColor(0x2b2d31)
      .addFields(
        { name: '🎖️ دور VIP', value: '1000 دولار - `!شراء vip`' },
        { name: '🎨 لون مخصص', value: '500 دولار - `!شراء لون #FF00FF`' }
      );
    message.channel.send({ embeds: [embed] });
  }

  else if (cmd === 'شراء') {
    const item = args[0]?.toLowerCase();
    const extra = args.slice(1).join(' ');
    let eco = getEconomy(message.author.id, message.guild.id);
    if (item === 'vip') {
      if (eco.balance < 1000) return message.reply('⚠️ رصيدك غير كاف.');
      let role = message.guild.roles.cache.find(r => r.name === 'VIP');
      if (!role) role = await message.guild.roles.create({ name: 'VIP', color: 0xffd700 });
      await message.member.roles.add(role);
      eco.balance -= 1000;
      saveEconomy(message.author.id, message.guild.id, eco);
      message.reply('✅ تم شراء دور VIP!');
    } else if (item === 'لون' && extra) {
      if (eco.balance < 500) return message.reply('⚠️ رصيدك غير كاف.');
      const color = parseInt(extra.replace('#', ''), 16);
      if (isNaN(color)) return message.reply('⚠️ صيغة لون غير صحيحة.');
      await message.member.setColor(color);
      eco.balance -= 500;
      saveEconomy(message.author.id, message.guild.id, eco);
      message.reply('✅ تم تغيير اللون!');
    } else {
      message.reply('⚠️ هذا المنتج غير موجود. استخدم `!متجر` للمعرفة.');
    }
  }

  // ========== مستويات ==========
  else if (cmd === 'مستوى') {
    const member = message.mentions.members.first() || message.member;
    const data = getUserLevel(member.id, message.guild.id);
    const nextXP = getLevelXP(data.level);
    const embed = new EmbedBuilder().setTitle(`📊 مستوى ${member.user.username}`).setColor(0x2b2d31)
      .addFields(
        { name: 'المستوى', value: `${data.level}`, inline: true },
        { name: 'XP', value: `${data.xp}/${nextXP}`, inline: true },
        { name: 'الرسائل', value: `${data.messages}`, inline: true }
      );
    message.channel.send({ embeds: [embed] });
  }

  else if (cmd === 'ترتيب') {
    const rows = db.prepare('SELECT user_id, level, xp FROM users WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10').all(message.guild.id);
    if (!rows.length) return message.reply('لا توجد بيانات.');
    let desc = '';
    rows.forEach((row, i) => {
      const member = message.guild.members.cache.get(row.user_id);
      const name = member ? member.user.username : `مستخدم ${row.user_id}`;
      desc += `#${i+1} ${name} - المستوى ${row.level} (XP: ${row.xp})\n`;
    });
    const embed = new EmbedBuilder().setTitle('🏆 ترتيب المستويات').setColor(0x2b2d31).setDescription(desc);
    message.channel.send({ embeds: [embed] });
  }

  // ========== نظام التذاكر ==========
  else if (cmd === 'بانل') {
    if (!hasPermission(message.member, message.guild.id)) {
      return message.reply('❌ تحتاج صلاحية متحكم.');
    }

    const config = getGuildConfig(message.guild.id);
    const embed = new EmbedBuilder()
      .setTitle('🎫 نظام التذاكر')
      .setDescription(config.welcome_panel_text || 'اختر القسم المناسب من القائمة المنسدلة أدناه لإنشاء تذكرة.\nسيتم إنشاء قناة خاصة بك وسيرد عليك الفريق قريباً.')
      .setColor(0x2b2d31)
      .setFooter({ text: 'سيتم إرسال رابط التذكرة إليك في الخاص' });

    if (config.ticket_panel_image) {
      embed.setImage(config.ticket_panel_image);
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ticket_panel')
          .setPlaceholder('📌 اختر قسم التذكرة...')
          .addOptions(
            Object.entries(TICKET_SECTIONS).map(([value, data]) => ({
              label: data.label,
              description: data.description,
              value: value,
              emoji: data.emoji
            }))
          )
      );

    await message.channel.send({ embeds: [embed], components: [row] });
    message.reply('✅ تم إنشاء لوحة التذاكر.');
    logToChannel(message.guild.id, {
      title: '🎫 إنشاء لوحة تذاكر',
      description: `**المنفذ:** ${message.author}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'بانل_بسيط') {
    if (!hasPermission(message.member, message.guild.id)) {
      return message.reply('❌ تحتاج صلاحية متحكم.');
    }

    const config = getGuildConfig(message.guild.id);
    const embed = new EmbedBuilder()
      .setTitle('🎫 # tickets >')
      .setDescription(
        '**Welcome to #tickets!**\n' +
        'This is the start of the #tickets channel.\n\n' +
        'قم بكتابة مشكلتك'
      )
      .setColor(0x2b2d31)
      .setFooter({ text: 'Tickets' })
      .setTimestamp();

    // إضافة الصورة إذا كانت محددة
    if (config.ticket_panel_image) {
      embed.setImage(config.ticket_panel_image);
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('open_ticket_select')
          .setLabel('📩 فتح تذكرة')
          .setStyle(ButtonStyle.Secondary)
      );

    await message.channel.send({ embeds: [embed], components: [row] });
    message.reply('✅ تم إنشاء لوحة التذاكر البسيطة.');
  }

  else if (cmd === 'إغلاق') {
    if (!hasPermission(message.member, message.guild.id)) return message.reply('❌ تحتاج صلاحية متحكم.');
    const channel = message.channel;
    if (!channel.name.startsWith('تذكرة-')) return message.reply('⚠️ هذه ليست قناة تذكرة.');
    await channel.delete();
    db.prepare('UPDATE tickets SET status = ? WHERE channel_id = ?').run('مغلقة', channel.id);
    logToChannel(message.guild.id, {
      title: '🔒 إغلاق تذكرة',
      description: `**المنفذ:** ${message.author}\n**القناة:** ${channel.name}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  // ========== هدايا ==========
  else if (cmd === 'هدية') {
    if (!hasPermission(message.member, message.guild.id)) return message.reply('❌ تحتاج صلاحية متحكم.');
    const duration = args[0];
    const winners = parseInt(args[1]);
    const prize = args.slice(2).join(' ');
    if (!duration || !winners || !prize) return message.reply('⚠️ الصيغة: `!هدية 1d2h 3 جائزة`');
    const secs = parseDuration(duration);
    if (!secs) return message.reply('⚠️ صيغة الوقت غير صحيحة.');
    const embed = new EmbedBuilder().setTitle(`🎁 هدية: ${prize}`).setColor(0x2b2d31)
      .setDescription(`الرابحون: ${winners}`)
      .setFooter({ text: `تنتهي بعد ${duration}` })
      .setTimestamp(new Date(Date.now() + secs * 1000));
    const msg = await message.channel.send({ embeds: [embed] });
    await msg.react('🎉');
    const endTime = new Date(Date.now() + secs * 1000).toISOString();
    db.prepare('INSERT INTO giveaways (message_id, guild_id, channel_id, prize, winner_count, end_time, participants, ended) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(msg.id, message.guild.id, message.channel.id, prize, winners, endTime, '', 0);
    message.reply('✅ تم إنشاء الهدية.');
    logToChannel(message.guild.id, {
      title: '🎁 إنشاء هدية',
      description: `**المنفذ:** ${message.author}\n**الجائزة:** ${prize}\n**الرابحون:** ${winners}\n**المدة:** ${duration}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  // ========== أدوار تفاعلية ==========
  else if (cmd === 'ردود') {
    if (!hasPermission(message.member, message.guild.id)) return message.reply('❌ تحتاج صلاحية متحكم.');
    const msgId = args[0];
    const role = message.mentions.roles.first();
    const emoji = args[args.length - 1];
    if (!msgId || !role || !emoji) return message.reply('⚠️ الصيغة: `!ردود معرف_الرسالة @دور إيموجي`');
    try {
      const msg = await message.channel.messages.fetch(msgId);
      await msg.react(emoji);
      db.prepare('INSERT OR REPLACE INTO reaction_roles (message_id, guild_id, role_id, emoji) VALUES (?, ?, ?, ?)')
        .run(msgId, message.guild.id, role.id, emoji);
      message.reply(`✅ تم إضافة الدور ${role.name} على الإيموجي ${emoji}.`);
      logToChannel(message.guild.id, {
        title: '🎭 إضافة رد فعل',
        description: `**المنفذ:** ${message.author}\n**الدور:** ${role.name}\n**الإيموجي:** ${emoji}`,
        color: 0x2b2d31,
        footer: `بواسطة ${message.author.tag}`
      });
    } catch (e) {
      message.reply('❌ فشل. تأكد من وجود الرسالة والإيموجي.');
    }
  }

  // ========== أوامر البوت ==========
  else if (cmd === 'قول') {
    const text = args.join(' ');
    if (!text) return message.reply('⚠️ اكتب النص الذي تريد أن يقوله البوت.');
    await message.channel.send(text);
    await message.delete().catch(() => {});
  }

  else if (cmd === 'ايمبد') {
    const fullText = args.join(' ');
    if (!fullText) return message.reply('⚠️ اكتب: `!ايمبد العنوان ، الوصف`');
    const parts = fullText.split(/[،,]\s*/).map(s => s.trim());
    let title = 'بدون عنوان';
    let description = fullText;
    if (parts.length >= 2) {
      title = parts[0];
      description = parts.slice(1).join(' ، ');
    }
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0x2b2d31)
      .setTimestamp();
    const imageMatch = description.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp))/i);
    if (imageMatch) {
      embed.setImage(imageMatch[1]);
      embed.setDescription(description.replace(imageMatch[1], '').trim() || 'بدون وصف');
    }
    await message.channel.send({ embeds: [embed] });
    await message.delete().catch(() => {});
  }

  else if (cmd === 'اعلان') {
    if (!hasPermission(message.member, message.guild.id)) {
      return message.reply('❌ تحتاج صلاحية متحكم.');
    }
    const fullText = args.join(' ');
    if (!fullText) return message.reply('⚠️ اكتب: `!اعلان [everyone|here] ، العنوان ، الوصف`');
    const parts = fullText.split(/[،,]\s*/).map(s => s.trim());
    let mentionType = null;
    let title = '📢 إعلان';
    let description = fullText;
    const firstPart = parts[0]?.toLowerCase();
    if (firstPart === 'everyone' || firstPart === 'here') {
      mentionType = firstPart;
      parts.shift();
    }
    if (parts.length >= 2) {
      title = parts[0] || '📢 إعلان';
      description = parts.slice(1).join(' ، ') || 'بدون وصف';
    } else if (parts.length === 1) {
      description = parts[0] || 'بدون وصف';
    }
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0x2b2d31)
      .setTimestamp()
      .setFooter({ text: `بواسطة ${message.author.tag}` });
    let mention = '';
    if (mentionType === 'everyone') mention = '@everyone';
    else if (mentionType === 'here') mention = '@here';
    await message.channel.send({ content: mention, embeds: [embed] });
    await message.delete().catch(() => {});
    logToChannel(message.guild.id, {
      title: '📢 إعلان',
      description: `**المنفذ:** ${message.author}\n**العنوان:** ${title}\n**الوصف:** ${description}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  // ========== النوت والبروفايل ==========
  else if (cmd === 'نوت') {
    if (!hasPermission(message.member, message.guild.id)) {
      return message.reply('❌ تحتاج صلاحية متحكم.');
    }
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن العضو الذي تريد كتابة ملاحظة له.');
    const note = args.slice(1).join(' ');
    if (!note) return message.reply('⚠️ اكتب نص الملاحظة.');
    setNote(member.id, message.guild.id, note);
    message.reply(`✅ تم كتابة الملاحظة لـ ${member.user.tag}: "${note}"`);
    logToChannel(message.guild.id, {
      title: '📝 كتابة نوت',
      description: `**المنفذ:** ${message.author}\n**المستهدف:** ${member.user.tag}\n**النوت:** ${note}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'بروفايل') {
    const member = message.mentions.members.first() || message.member;
    const note = getNote(member.id, message.guild.id);
    const embed = new EmbedBuilder()
      .setTitle(`👤 بروفايل ${member.user.username}`)
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: '🆔 المعرف', value: member.id, inline: true },
        { name: '📅 تاريخ الانضمام', value: member.joinedAt.toDateString(), inline: true },
        { name: '📝 النوت', value: note || 'لا توجد ملاحظة', inline: false }
      )
      .setColor(0x2b2d31)
      .setTimestamp();
    message.channel.send({ embeds: [embed] });
  }

  // ========== نظام EX والكلانات ==========
  else if (cmd === 'انشاء_كلان') {
    const name = args.join(' ');
    if (!name) return message.reply('⚠️ اكتب اسم الكلان.');
    if (getClanByUser(message.author.id, message.guild.id)) {
      return message.reply('⚠️ أنت بالفعل عضو في كلان. اترك الكلان أولاً.');
    }
    db.prepare('INSERT INTO clans (guild_id, name, leader_id, deputy_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(message.guild.id, name, message.author.id, null, new Date().toISOString());
    const clan = db.prepare('SELECT clan_id FROM clans WHERE guild_id = ? AND name = ? ORDER BY clan_id DESC LIMIT 1').get(message.guild.id, name);
    db.prepare('INSERT INTO clan_members (clan_id, user_id, joined_at) VALUES (?, ?, ?)')
      .run(clan.clan_id, message.author.id, new Date().toISOString());
    message.reply(`✅ تم إنشاء كلان **${name}** وأنت القائد.`);
    logToChannel(message.guild.id, {
      title: '🏰 إنشاء كلان',
      description: `**القائد:** ${message.author}\n**اسم الكلان:** ${name}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'اضافة_عضو') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن العضو.');
    const clan = getClanByUser(message.author.id, message.guild.id);
    if (!clan) return message.reply('⚠️ أنت لست في كلان.');
    if (clan.leader_id !== message.author.id && clan.deputy_id !== message.author.id) {
      return message.reply('⚠️ فقط القائد أو النائب يمكنه إضافة أعضاء.');
    }
    if (getClanByUser(member.id, message.guild.id)) {
      return message.reply(`⚠️ ${member} بالفعل في كلان.`);
    }
    db.prepare('INSERT INTO clan_members (clan_id, user_id, joined_at) VALUES (?, ?, ?)')
      .run(clan.clan_id, member.id, new Date().toISOString());
    message.reply(`✅ تم إضافة ${member} إلى الكلان **${clan.name}**.`);
    logToChannel(message.guild.id, {
      title: '➕ إضافة عضو للكلان',
      description: `**المنفذ:** ${message.author}\n**العضو:** ${member.user.tag}\n**الكلان:** ${clan.name}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'طرد_عضو') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن العضو.');
    const clan = getClanByUser(message.author.id, message.guild.id);
    if (!clan) return message.reply('⚠️ أنت لست في كلان.');
    if (clan.leader_id !== message.author.id && clan.deputy_id !== message.author.id) {
      return message.reply('⚠️ فقط القائد أو النائب يمكنه طرد أعضاء.');
    }
    if (member.id === clan.leader_id) return message.reply('⚠️ لا يمكن طرد القائد.');
    const result = db.prepare('DELETE FROM clan_members WHERE clan_id = ? AND user_id = ?').run(clan.clan_id, member.id);
    if (result.changes === 0) return message.reply(`⚠️ ${member} ليس في هذا الكلان.`);
    message.reply(`✅ تم طرد ${member} من الكلان **${clan.name}**.`);
    logToChannel(message.guild.id, {
      title: '➖ طرد عضو من الكلان',
      description: `**المنفذ:** ${message.author}\n**العضو:** ${member.user.tag}\n**الكلان:** ${clan.name}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'تعيين_نائب') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن العضو.');
    const clan = getClanByUser(message.author.id, message.guild.id);
    if (!clan) return message.reply('⚠️ أنت لست في كلان.');
    if (clan.leader_id !== message.author.id) return message.reply('⚠️ فقط القائد يمكنه تعيين نائب.');
    if (!db.prepare('SELECT user_id FROM clan_members WHERE clan_id = ? AND user_id = ?').get(clan.clan_id, member.id)) {
      return message.reply(`⚠️ ${member} ليس عضو في الكلان.`);
    }
    db.prepare('UPDATE clans SET deputy_id = ? WHERE clan_id = ?').run(member.id, clan.clan_id);
    message.reply(`✅ تم تعيين ${member} نائباً للكلان **${clan.name}**.`);
    logToChannel(message.guild.id, {
      title: '👑 تعيين نائب',
      description: `**المنفذ:** ${message.author}\n**النائب:** ${member.user.tag}\n**الكلان:** ${clan.name}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'معلومات_كلان') {
    const clan = getClanByUser(message.author.id, message.guild.id);
    if (!clan) return message.reply('⚠️ أنت لست في كلان.');
    const members = getClanMembers(clan.clan_id);
    const totalEx = getClanTotalEx(clan.clan_id, message.guild.id);
    const leader = message.guild.members.cache.get(clan.leader_id);
    const deputy = clan.deputy_id ? message.guild.members.cache.get(clan.deputy_id) : null;
    const embed = new EmbedBuilder()
      .setTitle(`🏰 ${clan.name}`)
      .setDescription(`**القائد:** ${leader ? leader.user.tag : 'غير موجود'}\n**النائب:** ${deputy ? deputy.user.tag : 'لا يوجد'}\n**عدد الأعضاء:** ${members.length}\n**إجمالي EX:** ${totalEx}`)
      .setColor(0x2b2d31)
      .setTimestamp();
    message.channel.send({ embeds: [embed] });
  }

  else if (cmd === 'ترك_كلان') {
    const clan = getClanByUser(message.author.id, message.guild.id);
    if (!clan) return message.reply('⚠️ أنت لست في كلان.');
    if (clan.leader_id === message.author.id) {
      return message.reply('⚠️ القائد لا يمكنه ترك الكلان. قم بنقل القيادة أولاً (عن طريق تعيين نائب ثم تعديل الكود) أو حذف الكلان يدوياً.');
    }
    db.prepare('DELETE FROM clan_members WHERE clan_id = ? AND user_id = ?').run(clan.clan_id, message.author.id);
    message.reply(`✅ تركت الكلان **${clan.name}**.`);
    logToChannel(message.guild.id, {
      title: '🚪 ترك كلان',
      description: `**العضو:** ${message.author}\n**الكلان:** ${clan.name}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'اعطاء_ex') {
    if (!hasPermission(message.member, message.guild.id)) return message.reply('❌ تحتاج صلاحية متحكم.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن العضو.');
    const amount = parseInt(args[1]);
    if (!amount || amount <= 0) return message.reply('⚠️ أدخل عدداً موجباً.');
    const newEx = addEx(member.id, message.guild.id, amount);
    message.reply(`✅ تم إعطاء ${member.user.tag} ${amount} نقطة EX. إجمالي نقاطه الآن: ${newEx}.`);
    try {
      await member.send(`🌟 تم إضافة ${amount} نقطة EX إلى رصيدك بواسطة ${message.author.tag}. إجمالي نقاطك: ${newEx} EX.`);
    } catch (e) {}
    logToChannel(message.guild.id, {
      title: '⭐ إعطاء EX',
      description: `**المنفذ:** ${message.author}\n**المستهدف:** ${member.user.tag}\n**المقدار:** +${amount}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'خصم_ex') {
    if (!hasPermission(message.member, message.guild.id)) return message.reply('❌ تحتاج صلاحية متحكم.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن العضو.');
    const amount = parseInt(args[1]);
    if (!amount || amount <= 0) return message.reply('⚠️ أدخل عدداً موجباً.');
    let current = getEx(member.id, message.guild.id);
    if (current < amount) return message.reply(`⚠️ رصيد ${member.user.tag} لا يكفي (لديه ${current} EX).`);
    const newEx = current - amount;
    setEx(member.id, message.guild.id, newEx);
    message.reply(`✅ تم خصم ${amount} نقطة EX من ${member.user.tag}. رصيده الآن: ${newEx}.`);
    try {
      await member.send(`🔻 تم خصم ${amount} نقطة EX من رصيدك بواسطة ${message.author.tag}. رصيدك الآن: ${newEx} EX.`);
    } catch (e) {}
    logToChannel(message.guild.id, {
      title: '⭐ خصم EX',
      description: `**المنفذ:** ${message.author}\n**المستهدف:** ${member.user.tag}\n**المقدار:** -${amount}`,
      color: 0x2b2d31,
      footer: `بواسطة ${message.author.tag}`
    });
  }

  else if (cmd === 'ترتيب_ex') {
    const rows = db.prepare('SELECT user_id, ex_points FROM user_ex WHERE guild_id = ? ORDER BY ex_points DESC LIMIT 10').all(message.guild.id);
    if (!rows.length) return message.reply('لا توجد بيانات EX.');
    let desc = '';
    rows.forEach((row, i) => {
      const member = message.guild.members.cache.get(row.user_id);
      const name = member ? member.user.username : `مستخدم ${row.user_id}`;
      desc += `#${i+1} ${name} - ${row.ex_points} EX\n`;
    });
    const embed = new EmbedBuilder().setTitle('🏆 ترتيب نقاط EX').setColor(0x2b2d31).setDescription(desc);
    message.channel.send({ embeds: [embed] });
  }

  // ========== إعدادات السيرفر ==========
  else if (cmd === 'تعيين') {
    if (!hasPermission(message.member, message.guild.id)) return message.reply('❌ تحتاج صلاحية متحكم.');
    const sub = args[0]?.toLowerCase();
    const value = args.slice(1).join(' ');
    if (!sub) {
      const embed = new EmbedBuilder().setTitle('⚙️ أوامر الإعدادات').setColor(0x2b2d31)
        .addFields(
          { name: '🎫 أدوار الأقسام', value: '`دور_قسم الدعم @دور` `دور_قسم اقتراح @دور` `دور_قسم شكوى @دور` `دور_قسم تعاون @دور` `دور_قسم أخرى @دور`', inline: false },
          { name: '📋 أخرى', value: '`سجلات` `ترحيب` `رسالة_ترحيب` `صورة_ترحيب` `نص_بانل` `روم_ليفل` `أوتو_لاين` `صورة_اوتولاين` `دور_كتم` `دور_دخول` `حد_كتم` `حد_طرد` `رتبة_مستوى` `حذف_رتبة_مستوى` `صورة_بانل` `صورة_تذكرة` `إيقاف_أوتو_لاين`', inline: false },
          { name: '📖 الصيغة', value: '`!تعيين [الخيار] [القيمة]`', inline: false }
        );
      return message.channel.send({ embeds: [embed] });
    }

    if (sub === 'دور_قسم') {
      const sectionKey = args[1]?.toLowerCase();
      const role = message.mentions.roles.first();
      if (!sectionKey || !role) return message.reply('⚠️ الصيغة: `!تعيين دور_قسم [الدعم|اقتراح|شكوى|تعاون|أخرى] @دور`');
      const validKeys = Object.keys(TICKET_SECTIONS);
      const mapping = { 'الدعم': 'support', 'اقتراح': 'suggestion', 'شكوى': 'complaint', 'تعاون': 'partnership', 'أخرى': 'other' };
      const mappedKey = mapping[sectionKey] || sectionKey;
      if (!validKeys.includes(mappedKey)) return message.reply(`⚠️ أقسام صالحة: ${validKeys.join(', ')}`);
      db.prepare('INSERT OR REPLACE INTO ticket_section_roles (guild_id, section_key, role_id) VALUES (?, ?, ?)')
        .run(message.guild.id, mappedKey, role.id);
      message.reply(`✅ تم تعيين دور القسم ${TICKET_SECTIONS[mappedKey].label} إلى ${role}`);
      logToChannel(message.guild.id, {
        title: '🎫 تعيين دور قسم',
        description: `**المنفذ:** ${message.author}\n**القسم:** ${TICKET_SECTIONS[mappedKey].label}\n**الدور:** ${role.name}`,
        color: 0x2b2d31,
        footer: `بواسطة ${message.author.tag}`
      });
    } else if (sub === 'سجلات') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('⚠️ منشن القناة.');
      updateGuildConfig(message.guild.id, { log_channel: channel.id });
      message.reply(`✅ تم تعيين قناة السجلات إلى ${channel}`);
    } else if (sub === 'ترحيب') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('⚠️ منشن القناة.');
      updateGuildConfig(message.guild.id, { welcome_channel: channel.id });
      message.reply(`✅ تم تعيين قناة الترحيب إلى ${channel}`);
    } else if (sub === 'رسالة_ترحيب') {
      if (!value) return message.reply('⚠️ أدخل النص.');
      updateGuildConfig(message.guild.id, { welcome_message: value });
      message.reply(`✅ تم تعيين رسالة الترحيب: ${value}`);
    } else if (sub === 'صورة_ترحيب') {
      if (!value) return message.reply('⚠️ أدخل رابط الصورة.');
      updateGuildConfig(message.guild.id, { welcome_image_url: value });
      message.reply(`✅ تم تعيين صورة الترحيب: ${value}`);
    } else if (sub === 'نص_بانل') {
      if (!value) return message.reply('⚠️ أدخل النص.');
      updateGuildConfig(message.guild.id, { welcome_panel_text: value });
      message.reply(`✅ تم تعيين نص بانل التذاكر: ${value}`);
    } else if (sub === 'روم_ليفل') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('⚠️ منشن القناة.');
      updateGuildConfig(message.guild.id, { level_channel_id: channel.id });
      message.reply(`✅ تم تعيين روم الليفل إلى ${channel}`);
    } else if (sub === 'أوتو_لاين') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('⚠️ منشن القناة.');
      const words = args.slice(2).join(' ');
      if (!words) return message.reply('⚠️ أدخل الكلمات المفتاحية مفصولة بفواصل (مثال: مرحبا,سلام,اهلا)');
      updateGuildConfig(message.guild.id, { auto_line_channel_id: channel.id, auto_line_text: words, auto_line_enabled: 'true' });
      message.reply(`✅ تم تعيين أوتو لاين في ${channel} مع الكلمات: ${words}`);
    } else if (sub === 'صورة_اوتولاين') {
      if (!value) return message.reply('⚠️ أدخل رابط الصورة.');
      updateGuildConfig(message.guild.id, { auto_line_image: value });
      message.reply(`✅ تم تعيين صورة الأوتو لاين: ${value}`);
    } else if (sub === 'إيقاف_أوتو_لاين') {
      updateGuildConfig(message.guild.id, { auto_line_enabled: 'false' });
      message.reply('✅ تم إيقاف نظام أوتو لاين.');
    } else if (sub === 'دور_كتم') {
      const role = message.mentions.roles.first();
      if (!role) return message.reply('⚠️ منشن الدور.');
      updateGuildConfig(message.guild.id, { mute_role_id: role.id });
      message.reply(`✅ تم تعيين دور الكتم إلى ${role}`);
    } else if (sub === 'دور_دخول') {
      const role = message.mentions.roles.first();
      if (!role) return message.reply('⚠️ منشن الدور.');
      updateGuildConfig(message.guild.id, { join_role_id: role.id });
      message.reply(`✅ تم تعيين دور الدخول إلى ${role}`);
    } else if (sub === 'حد_كتم') {
      const num = parseInt(value);
      if (isNaN(num) || num < 1) return message.reply('⚠️ أدخل عدداً صحيحاً أكبر من 0.');
      updateGuildConfig(message.guild.id, { warn_mute_threshold: num });
      message.reply(`✅ تم تعيين حد الكتم إلى ${num} تحذيرات.`);
    } else if (sub === 'حد_طرد') {
      const num = parseInt(value);
      if (isNaN(num) || num < 1) return message.reply('⚠️ أدخل عدداً صحيحاً أكبر من 0.');
      updateGuildConfig(message.guild.id, { warn_kick_threshold: num });
      message.reply(`✅ تم تعيين حد الطرد إلى ${num} تحذيرات.`);
    } else if (sub === 'رتبة_مستوى') {
      const level = parseInt(args[1]);
      const role = message.mentions.roles.first();
      if (isNaN(level) || !role) return message.reply('⚠️ الصيغة: `!تعيين رتبة_مستوى المستوى @دور`');
      db.prepare('INSERT OR REPLACE INTO level_roles (guild_id, level, role_id) VALUES (?, ?, ?)')
        .run(message.guild.id, level, role.id);
      message.reply(`✅ تم تعيين دور ${role} عند المستوى ${level}`);
    } else if (sub === 'حذف_رتبة_مستوى') {
      const level = parseInt(args[1]);
      if (isNaN(level)) return message.reply('⚠️ الصيغة: `!تعيين حذف_رتبة_مستوى المستوى`');
      db.prepare('DELETE FROM level_roles WHERE guild_id = ? AND level = ?').run(message.guild.id, level);
      message.reply(`✅ تم حذف رتبة المستوى ${level}`);
    } else if (sub === 'صورة_بانل') {
      if (!value) return message.reply('⚠️ أدخل رابط الصورة.');
      updateGuildConfig(message.guild.id, { ticket_panel_image: value });
      message.reply(`✅ تم تعيين صورة لوحة التذاكر: ${value}`);
    } else if (sub === 'صورة_تذكرة') {
      if (!value) return message.reply('⚠️ أدخل رابط الصورة.');
      updateGuildConfig(message.guild.id, { ticket_welcome_image: value });
      message.reply(`✅ تم تعيين صورة التذكرة: ${value}`);
    } else {
      message.reply('⚠️ أمر غير معروف. استخدم `!تعيين` لعرض القائمة.');
    }
  }

  // ========== المالك ==========
  else if (cmd === 'إيقاف') {
    if (OWNER_ID && message.author.id !== OWNER_ID) return message.reply('❌ هذا الأمر لصاحب البوت فقط.');
    await message.reply('🛑 جاري الإيقاف...');
    process.exit(0);
  }

  // ========== مساعدة ==========
  else if (cmd === 'مساعدة') {
    const embed = new EmbedBuilder().setTitle('📖 قائمة الأوامر الرئيسية').setColor(0x2b2d31)
      .addFields(
        { name: '👑 نظام التحكم', value: '`متحكم @شخص`  `الغاء_متحكم @شخص`  `قائمة_المتحكمين`', inline: false },
        { name: '🏰 الكلانات وEX', value: '`انشاء_كلان` `اضافة_عضو` `طرد_عضو` `تعيين_نائب` `معلومات_كلان` `ترك_كلان`  `اعطاء_ex` `خصم_ex` `ترتيب_ex`', inline: false },
        { name: '📝 النوت والبروفايل', value: '`نوت @مستخدم النص` (للمتحكمين)  `بروفايل @مستخدم`', inline: false },
        { name: '🎫 التذاكر', value: '`بانل` (قوائم منسدلة)  `بانل_بسيط` (مع صورة وزر)  `إغلاق`  `دور_قسم`', inline: false },
        { name: '🛡️ إدارة', value: '`حظر` `طرد` `كتم` `تحذير` `مسح` `قفل` `فتح`', inline: false },
        { name: '💰 اقتصاد', value: '`رصيد` `يومية` `تحويل` `سرقة` `مصرف` `سحب` `متجر` `شراء`', inline: false },
        { name: '📊 مستويات', value: '`مستوى` `ترتيب`', inline: false },
        { name: '🎁 هدايا وردود', value: '`هدية` `ردود`', inline: false },
        { name: '📢 أوامر البوت', value: '`قول` `ايمبد` `اعلان`', inline: false },
        { name: '⚙️ إعدادات السيرفر', value: '`تعيين` (للمتحكمين)', inline: false },
        { name: '🎮 ترفيه', value: '`بينق` `سيرفر` `صورة` `اقتباس` `رمية`', inline: false }
      )
      .setFooter({ text: `البادئة: ${PREFIX} | صاحب البوت: ${OWNER_ID ? `<@${OWNER_ID}>` : 'غير محدد'}` });
    message.channel.send({ embeds: [embed] });
  }

  // ========== ترفيه ==========
  else if (cmd === 'بينق') {
    message.reply(`🏓 البينق: ${client.ws.ping}ms`);
  }

  else if (cmd === 'سيرفر') {
    const embed = new EmbedBuilder().setTitle(message.guild.name).setColor(0x2b2d31)
      .addFields(
        { name: '👥 الأعضاء', value: `${message.guild.memberCount}`, inline: true },
        { name: '💬 القنوات', value: `${message.guild.channels.cache.size}`, inline: true },
        { name: '👑 المالك', value: `<@${message.guild.ownerId}>`, inline: true },
        { name: '📅 أنشئ', value: message.guild.createdAt.toDateString(), inline: true }
      )
      .setThumbnail(message.guild.iconURL());
    message.channel.send({ embeds: [embed] });
  }

  else if (cmd === 'صورة') {
    const images = [
      'https://picsum.photos/seed/1/400/300',
      'https://picsum.photos/seed/2/400/300',
      'https://picsum.photos/seed/3/400/300'
    ];
    message.reply(images[Math.floor(Math.random() * images.length)]);
  }

  else if (cmd === 'اقتباس') {
    const quotes = [
      'النجاح ليس نهائياً، الفشل ليس قاتلاً، الشجاعة للاستمرار هي التي تهم.',
      'كن أنت التغيير الذي تريد رؤيته في العالم.',
      'المستقبل ملك لأولئك الذين يؤمنون بجمال أحلامهم.'
    ];
    message.reply(quotes[Math.floor(Math.random() * quotes.length)]);
  }

  else if (cmd === 'رمية') {
    message.reply(`🎲 النتيجة: ${Math.floor(Math.random() * 6) + 1}`);
  }
});

// ====================== تشغيل البوت ======================
client.login(TOKEN).catch(err => {
  console.error('❌ فشل تسجيل الدخول:', err);
  process.exit(1);
});
