const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ====================== المتغيرات البيئية ======================
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN غير موجود');
  process.exit(1);
}
const PREFIX = process.env.PREFIX || '!';
const OWNER_ID = process.env.OWNER_ID || null;

// ====================== قاعدة البيانات ======================
const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

// إنشاء الجداول
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
`);

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
    row = { guild_id: guildId, log_channel: null, welcome_channel: null, welcome_message: null, welcome_image_url: null, mute_role_id: null, warn_mute_threshold: 3, warn_kick_threshold: 5, join_role_id: null };
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
  let row = db.prepare('SELECT xp, level, messages FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  if (!row) {
    db.prepare('INSERT INTO users (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
    row = { xp: 0, level: 0, messages: 0 };
  }
  return row;
}

function updateUserLevel(userId, guildId, xp, level, messages) {
  db.prepare('UPDATE users SET xp = ?, level = ?, messages = ? WHERE user_id = ? AND guild_id = ?')
    .run(xp, level, messages, userId, guildId);
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

// نظام المستويات
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const guildId = message.guild.id;
  const userId = message.author.id;

  let data = getUserLevel(userId, guildId);
  let xp = data.xp;
  let level = data.level;
  let msgs = data.messages + 1;
  const gain = Math.floor(Math.random() * 15) + 10;
  xp += gain;
  const required = getLevelXP(level);
  if (xp >= required) {
    level++;
    xp = 0;
    // مكافأة
    if (level % 5 === 0) {
      let eco = getEconomy(userId, guildId);
      eco.balance += 300;
      saveEconomy(userId, guildId, eco);
      message.author.send(`🎉 مبروك مستوى ${level}! حصلت على 300 دولار إضافية.`).catch(() => {});
    }
    // دور مستوى
    const levelRole = db.prepare('SELECT role_id FROM level_roles WHERE guild_id = ? AND level = ?').get(guildId, level);
    if (levelRole) {
      const role = message.guild.roles.cache.get(levelRole.role_id);
      if (role) message.member.roles.add(role).catch(() => {});
    }
  }
  updateUserLevel(userId, guildId, xp, level, msgs);
});

// سجلات
client.on('messageDelete', async (message) => {
  if (!message.guild || message.author?.bot) return;
  const config = getGuildConfig(message.guild.id);
  if (!config.log_channel) return;
  const logChannel = client.channels.cache.get(config.log_channel);
  if (!logChannel) return;
  const embed = new EmbedBuilder()
    .setTitle('🗑️ حذف رسالة')
    .setColor(0xff0000)
    .setTimestamp(message.createdAt)
    .addFields(
      { name: 'المستخدم', value: message.author ? message.author.tag : 'غير معروف', inline: true },
      { name: 'المحتوى', value: message.content || 'غير مرئي', inline: false },
      { name: 'القناة', value: message.channel.name, inline: true }
    );
  logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('guildMemberAdd', async (member) => {
  const config = getGuildConfig(member.guild.id);
  if (config.welcome_channel) {
    const channel = member.guild.channels.cache.get(config.welcome_channel);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('👋 مرحباً!')
        .setDescription(config.welcome_message || `أهلاً ${member} في السيرفر!`)
        .setColor(0x00ff00)
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
        .setColor(0x00ff00)
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
    .setColor(0xffaa00)
    .setTimestamp()
    .setThumbnail(member.user.displayAvatarURL())
    .addFields({ name: 'الاسم', value: member.user.tag, inline: true });
  logChannel.send({ embeds: [embed] }).catch(() => {});
});

// الأدوار التفاعلية
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

// ====================== الأوامر ======================
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // ========== إدارة ==========
  if (cmd === 'حظر') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ لا تملك صلاحية.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن العضو.');
    const reason = args.join(' ') || 'لا يوجد سبب';
    await member.ban({ reason });
    const embed = new EmbedBuilder().setTitle('✅ تم الحظر').setColor(0xff0000).setDescription(`${member.user.tag} تم حظره بسبب: ${reason}`);
    message.channel.send({ embeds: [embed] });
  }

  else if (cmd === 'طرد') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply('❌ لا تملك صلاحية.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن العضو.');
    const reason = args.join(' ') || 'لا يوجد سبب';
    await member.kick(reason);
    const embed = new EmbedBuilder().setTitle('✅ تم الطرد').setColor(0xff8800).setDescription(`${member.user.tag} تم طرده بسبب: ${reason}`);
    message.channel.send({ embeds: [embed] });
  }

  else if (cmd === 'كتم') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) return message.reply('❌ لا تملك صلاحية.');
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
    const embed = new EmbedBuilder().setTitle('🔇 تم الكتم').setColor(0xffaa00).setDescription(`${member.user.tag} كتم لمدة ${duration} بسبب: ${reason}`);
    message.channel.send({ embeds: [embed] });
    setTimeout(async () => {
      await member.roles.remove(muteRole);
      message.channel.send(`🔊 ${member} تم فك الكتم تلقائياً.`).catch(() => {});
    }, secs * 1000);
  }

  else if (cmd === 'تحذير') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply('❌ لا تملك صلاحية.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ منشن العضو.');
    const reason = args.join(' ') || 'لا يوجد سبب';
    db.prepare('INSERT INTO warns (user_id, guild_id, reason, moderator_id, date) VALUES (?, ?, ?, ?, ?)')
      .run(member.id, message.guild.id, reason, message.author.id, new Date().toISOString());
    const row = db.prepare('SELECT COUNT(*) as count FROM warns WHERE user_id = ? AND guild_id = ?').get(member.id, message.guild.id);
    const count = row ? row.count : 0;
    const embed = new EmbedBuilder().setTitle('⚠️ تحذير').setColor(0xffdd00).setDescription(`${member.user.tag} تم تحذيره بسبب: ${reason}\nإجمالي التحذيرات: ${count}`);
    message.channel.send({ embeds: [embed] });
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
  }

  else if (cmd === 'مسح') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return message.reply('❌ لا تملك صلاحية.');
    let amount = parseInt(args[0]) || 5;
    if (amount > 100) amount = 100;
    const deleted = await message.channel.bulkDelete(amount, true).catch(() => {});
    const count = deleted ? deleted.size : 0;
    const msg = await message.channel.send(`🗑️ تم مسح ${count} رسالة.`);
    setTimeout(() => msg.delete().catch(() => {}), 5000);
  }

  else if (cmd === 'قفل') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply('❌ لا تملك صلاحية.');
    await message.channel.permissionOverwrites.create(message.guild.id, { SendMessages: false });
    message.channel.send('🔒 تم قفل القناة.');
  }

  else if (cmd === 'فتح') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply('❌ لا تملك صلاحية.');
    await message.channel.permissionOverwrites.delete(message.guild.id);
    message.channel.send('🔓 تم فتح القناة.');
  }

  // ========== اقتصاد ==========
  else if (cmd === 'رصيد') {
    const member = message.mentions.members.first() || message.member;
    const eco = getEconomy(member.id, message.guild.id);
    const embed = new EmbedBuilder().setTitle(`💰 رصيد ${member.user.username}`).setColor(0xffd700)
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
    const embed = new EmbedBuilder().setTitle('🛒 المتجر').setColor(0x00ffaa)
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
    const embed = new EmbedBuilder().setTitle(`📊 مستوى ${member.user.username}`).setColor(0x9b59b6)
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
    const embed = new EmbedBuilder().setTitle('🏆 ترتيب المستويات').setColor(0xffaa00).setDescription(desc);
    message.channel.send({ embeds: [embed] });
  }

  // ========== تذاكر ==========
  else if (cmd === 'تذكرة') {
    const reason = args.join(' ') || 'طلب دعم';
    const channel = await message.guild.channels.create({
      name: `تذكرة-${message.author.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: message.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: message.author.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });
    await channel.send(`${message.author} مرحباً! تم إنشاء تذكرتك. السبب: ${reason}\nاستخدم \`!إغلاق\` لإغلاقها.`);
    db.prepare('INSERT INTO tickets (channel_id, guild_id, user_id, status, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(channel.id, message.guild.id, message.author.id, 'مفتوحة', new Date().toISOString());
    message.reply(`✅ تم إنشاء تذكرتك في ${channel}`);
  }

  else if (cmd === 'إغلاق') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply('❌ لا تملك صلاحية.');
    const channel = message.channel;
    if (!channel.name.startsWith('تذكرة-')) return message.reply('⚠️ هذه ليست قناة تذكرة.');
    await channel.delete();
    db.prepare('UPDATE tickets SET status = ? WHERE channel_id = ?').run('مغلقة', channel.id);
  }

  // ========== هدايا ==========
  else if (cmd === 'هدية') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
    const duration = args[0];
    const winners = parseInt(args[1]);
    const prize = args.slice(2).join(' ');
    if (!duration || !winners || !prize) return message.reply('⚠️ الصيغة: `!هدية 1d2h 3 جائزة`');
    const secs = parseDuration(duration);
    if (!secs) return message.reply('⚠️ صيغة الوقت غير صحيحة.');
    const embed = new EmbedBuilder().setTitle(`🎁 هدية: ${prize}`).setColor(0xff69b4)
      .setDescription(`الرابحون: ${winners}`)
      .setFooter({ text: `تنتهي بعد ${duration}` })
      .setTimestamp(new Date(Date.now() + secs * 1000));
    const msg = await message.channel.send({ embeds: [embed] });
    await msg.react('🎉');
    const endTime = new Date(Date.now() + secs * 1000).toISOString();
    db.prepare('INSERT INTO giveaways (message_id, guild_id, channel_id, prize, winner_count, end_time, participants, ended) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(msg.id, message.guild.id, message.channel.id, prize, winners, endTime, '', 0);
    message.reply('✅ تم إنشاء الهدية.');
  }

  // ========== ردود ==========
  else if (cmd === 'ردود') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
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
    } catch (e) {
      message.reply('❌ فشل. تأكد من وجود الرسالة والإيموجي.');
    }
  }

  // ========== إعدادات ==========
  else if (cmd === 'تعيين') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
    const sub = args[0]?.toLowerCase();
    const value = args.slice(1).join(' ');
    if (!sub) {
      const embed = new EmbedBuilder().setTitle('⚙️ أوامر الإعدادات').setColor(0x00ccff)
        .addFields(
          { name: 'سجلات', value: '`!تعيين سجلات #قناة`' },
          { name: 'ترحيب', value: '`!تعيين ترحيب #قناة`' },
          { name: 'رسالة_ترحيب', value: '`!تعيين رسالة_ترحيب النص`' },
          { name: 'صورة_ترحيب', value: '`!تعيين صورة_ترحيب رابط`' },
          { name: 'دور_كتم', value: '`!تعيين دور_كتم @دور`' },
          { name: 'دور_دخول', value: '`!تعيين دور_دخول @دور`' },
          { name: 'حد_كتم', value: '`!تعيين حد_كتم عدد`' },
          { name: 'حد_طرد', value: '`!تعيين حد_طرد عدد`' },
          { name: 'رتبة_مستوى', value: '`!تعيين رتبة_مستوى المستوى @دور`' },
          { name: 'حذف_رتبة_مستوى', value: '`!تعيين حذف_رتبة_مستوى المستوى`' }
        );
      return message.channel.send({ embeds: [embed] });
    }

    if (sub === 'سجلات') {
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
    } else {
      message.reply('⚠️ أمر غير معروف. استخدم `!تعيين` لعرض القائمة.');
    }
  }

  // ========== مالك ==========
  else if (cmd === 'إيقاف') {
    if (OWNER_ID && message.author.id !== OWNER_ID) return message.reply('❌ هذا الأمر للمالك فقط.');
    await message.reply('🛑 جاري الإيقاف...');
    process.exit(0);
  }

  // ========== مساعدة ==========
  else if (cmd === 'مساعدة') {
    const embed = new EmbedBuilder().setTitle('📖 قائمة الأوامر الرئيسية').setColor(0x00ff00)
      .addFields(
        { name: '🛡️ إدارة', value: '`حظر` `طرد` `كتم` `تحذير` `مسح` `قفل` `فتح`', inline: false },
        { name: '💰 اقتصاد', value: '`رصيد` `يومية` `تحويل` `سرقة` `مصرف` `سحب` `متجر` `شراء`', inline: false },
        { name: '📊 مستويات', value: '`مستوى` `ترتيب`', inline: false },
        { name: '🎫 تذاكر', value: '`تذكرة` `إغلاق`', inline: false },
        { name: '🎁 هدايا', value: '`هدية` (للمشرفين)', inline: false },
        { name: '🎭 أدوار تفاعلية', value: '`ردود` (للمشرفين)', inline: false },
        { name: '⚙️ إعدادات السيرفر', value: '`تعيين` (للمشرفين)', inline: false },
        { name: '🎮 ترفيه', value: '`بينق` `سيرفر` `صورة` `اقتباس` `رمية`', inline: false }
      )
      .setFooter({ text: `البادئة: ${PREFIX}` });
    message.channel.send({ embeds: [embed] });
  }

  // ========== ترفيه ==========
  else if (cmd === 'بينق') {
    message.reply(`🏓 البينق: ${client.ws.ping}ms`);
  }

  else if (cmd === 'سيرفر') {
    const embed = new EmbedBuilder().setTitle(message.guild.name).setColor(0x2ecc71)
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
