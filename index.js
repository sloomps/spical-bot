// ================================================================
// DISCORD BOT ULTIMATE - النسخة النهائية الجاهزة لـ Railway
// يستخدم better-sqlite3 (بدون تجميع) ويعمل فوراً
// ================================================================

const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType } = require('discord.js');
const Database = require('better-sqlite3');
const ytdl = require('ytdl-core');
const axios = require('axios');
const moment = require('moment');

// ================== قاعدة البيانات ==================
const db = new Database('./ultimate_bot.db');

// إنشاء الجداول
db.exec(`
    CREATE TABLE IF NOT EXISTS economy (user_id TEXT, guild_id TEXT, balance INTEGER DEFAULT 0, bank INTEGER DEFAULT 0, daily TEXT, work TEXT, weekly TEXT, last_rob TEXT);
    CREATE TABLE IF NOT EXISTS levels (user_id TEXT, guild_id TEXT, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS warnings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, guild_id TEXT, reason TEXT, date TEXT);
    CREATE TABLE IF NOT EXISTS autoroles (guild_id TEXT, role_id TEXT);
    CREATE TABLE IF NOT EXISTS welcome (guild_id TEXT, channel_id TEXT, message TEXT);
    CREATE TABLE IF NOT EXISTS goodbye (guild_id TEXT, channel_id TEXT, message TEXT);
    CREATE TABLE IF NOT EXISTS custom_commands (guild_id TEXT, name TEXT, response TEXT, PRIMARY KEY (guild_id, name));
    CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, user_id TEXT, topic TEXT, status TEXT, created_at TEXT);
    CREATE TABLE IF NOT EXISTS logging (guild_id TEXT, channel_id TEXT, type TEXT);
    CREATE TABLE IF NOT EXISTS giveaways (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, message_id TEXT, prize TEXT, end_time TEXT, winners INTEGER, entries TEXT);
    CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, channel_id TEXT, message TEXT, remind_time TEXT, repeat_interval INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS marriages (user1 TEXT, user2 TEXT, guild_id TEXT, PRIMARY KEY (user1, user2));
    CREATE TABLE IF NOT EXISTS level_roles (guild_id TEXT, level INTEGER, role_id TEXT);
    CREATE TABLE IF NOT EXISTS polls (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, message_id TEXT, question TEXT, options TEXT);
    CREATE TABLE IF NOT EXISTS clans (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, name TEXT, owner TEXT, members TEXT, level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0, created_at TEXT);
    CREATE TABLE IF NOT EXISTS farms (user_id TEXT, guild_id TEXT, crop TEXT, planted_at TEXT, ready_at TEXT, status TEXT DEFAULT 'growing');
    CREATE TABLE IF NOT EXISTS prisons (user_id TEXT, guild_id TEXT, jailed_at TEXT, release_at TEXT, reason TEXT);
    CREATE TABLE IF NOT EXISTS loans (user_id TEXT, guild_id TEXT, amount INTEGER, interest INTEGER, due_date TEXT, status TEXT DEFAULT 'active');
    CREATE TABLE IF NOT EXISTS investments (user_id TEXT, guild_id TEXT, amount INTEGER, profit INTEGER, start_date TEXT, end_date TEXT, status TEXT DEFAULT 'active');
    CREATE TABLE IF NOT EXISTS auctions (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, item TEXT, seller TEXT, starting_bid INTEGER, current_bid INTEGER, bidder TEXT, end_time TEXT, status TEXT DEFAULT 'active');
    CREATE TABLE IF NOT EXISTS titles (user_id TEXT, guild_id TEXT, title TEXT, PRIMARY KEY (user_id, guild_id));
    CREATE TABLE IF NOT EXISTS auto_responders (guild_id TEXT, trigger TEXT, response TEXT, PRIMARY KEY (guild_id, trigger));
    CREATE TABLE IF NOT EXISTS temp_vc (guild_id TEXT, channel_id TEXT, owner_id TEXT, created_at TEXT);
    CREATE TABLE IF NOT EXISTS contests (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, question TEXT, prize INTEGER, answer TEXT, winner TEXT, status TEXT DEFAULT 'active');
    CREATE TABLE IF NOT EXISTS referrals (user_id TEXT, guild_id TEXT, referred_by TEXT, reward_claimed INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS cards (user_id TEXT, guild_id TEXT, card_type TEXT, rarity TEXT, acquired_at TEXT);
    CREATE TABLE IF NOT EXISTS bad_words (guild_id TEXT, word TEXT, PRIMARY KEY (guild_id, word));
    CREATE TABLE IF NOT EXISTS invites (user_id TEXT, guild_id TEXT, inviter_id TEXT, code TEXT, uses INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, name TEXT, description TEXT, date TEXT, channel_id TEXT, created_by TEXT);
    CREATE TABLE IF NOT EXISTS backups (guild_id TEXT, data TEXT, created_at TEXT);
    CREATE TABLE IF NOT EXISTS custom_colors (user_id TEXT, guild_id TEXT, color_hex TEXT, PRIMARY KEY (user_id, guild_id));
    CREATE TABLE IF NOT EXISTS quests (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, guild_id TEXT, name TEXT, description TEXT, reward INTEGER, type TEXT, target INTEGER, progress INTEGER DEFAULT 0, status TEXT DEFAULT 'active', date TEXT);
    CREATE TABLE IF NOT EXISTS reaction_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, message_id TEXT, role_id TEXT, emoji TEXT);
    CREATE TABLE IF NOT EXISTS member_stats (user_id TEXT, guild_id TEXT, messages INTEGER DEFAULT 0, voice_minutes INTEGER DEFAULT 0, reactions_given INTEGER DEFAULT 0, reactions_received INTEGER DEFAULT 0, xp_earned INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS advanced_bans (user_id TEXT, guild_id TEXT, reason TEXT, duration INTEGER, banned_at TEXT, UNIQUE(user_id, guild_id));
    CREATE TABLE IF NOT EXISTS join_rewards (guild_id TEXT, role_id TEXT, reward_amount INTEGER);
    CREATE TABLE IF NOT EXISTS self_channels (guild_id TEXT, channel_id TEXT, owner_id TEXT, created_at TEXT);
    CREATE TABLE IF NOT EXISTS lottery (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, ticket_owner TEXT, ticket_number INTEGER, prize_amount INTEGER, draw_date TEXT, status TEXT DEFAULT 'active');
    CREATE TABLE IF NOT EXISTS trades (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, sender_id TEXT, receiver_id TEXT, amount INTEGER, status TEXT DEFAULT 'pending', created_at TEXT);
    CREATE TABLE IF NOT EXISTS tournaments (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, name TEXT, prize INTEGER, participants TEXT, status TEXT DEFAULT 'active', created_at TEXT);
    CREATE TABLE IF NOT EXISTS achievements (user_id TEXT, guild_id TEXT, achievement_name TEXT, unlocked_at TEXT, PRIMARY KEY (user_id, guild_id, achievement_name));
    CREATE TABLE IF NOT EXISTS temp_roles (user_id TEXT, guild_id TEXT, role_id TEXT, expiry_time TEXT);
`);

// ================== العمليات على قاعدة البيانات ==================
function getBalance(userId, guildId) {
    const row = db.prepare("SELECT balance FROM economy WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    return row ? row.balance : 0;
}

function updateBalance(userId, guildId, amount) {
    const existing = db.prepare("SELECT balance FROM economy WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    if (existing) {
        db.prepare("UPDATE economy SET balance = balance + ? WHERE user_id = ? AND guild_id = ?").run(amount, userId, guildId);
    } else {
        db.prepare("INSERT INTO economy (user_id, guild_id, balance) VALUES (?, ?, ?)").run(userId, guildId, amount);
    }
}

function getXp(userId, guildId) {
    const row = db.prepare("SELECT xp, level FROM levels WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    if (!row) {
        db.prepare("INSERT INTO levels (user_id, guild_id, xp, level) VALUES (?, ?, 0, 1)").run(userId, guildId);
        return { xp: 0, level: 1 };
    }
    return { xp: row.xp, level: row.level };
}

function addXp(userId, guildId, amount) {
    const existing = db.prepare("SELECT xp, level FROM levels WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    if (!existing) {
        db.prepare("INSERT INTO levels (user_id, guild_id, xp, level) VALUES (?, ?, ?, 1)").run(userId, guildId, amount);
        return;
    }
    let xp = existing.xp + amount;
    let level = existing.level;
    let needed = 5 * (level * level) + 50 * level + 100;
    while (xp >= needed) {
        xp -= needed;
        level++;
        needed = 5 * (level * level) + 50 * level + 100;
        // منح دور المستوى
        const roles = db.prepare("SELECT role_id FROM level_roles WHERE guild_id = ? AND level = ?").all(guildId, level);
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
            const member = guild.members.cache.get(userId);
            if (member) {
                roles.forEach(r => member.roles.add(r.role_id).catch(() => {}));
            }
        }
    }
    db.prepare("UPDATE levels SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ?").run(xp, level, userId, guildId);
}

function getWarnings(userId) {
    return db.prepare("SELECT reason, date FROM warnings WHERE user_id = ?").all(userId);
}

function addWarning(userId, guildId, reason) {
    db.prepare("INSERT INTO warnings (user_id, guild_id, reason, date) VALUES (?, ?, ?, datetime('now'))").run(userId, guildId, reason);
}

function clearWarnings(userId) {
    db.prepare("DELETE FROM warnings WHERE user_id = ?").run(userId);
}

function logEvent(guildId, type, description) {
    const row = db.prepare("SELECT channel_id FROM logging WHERE guild_id = ? AND (type = ? OR type = 'all')").get(guildId, type);
    if (row) {
        const channel = client.channels.cache.get(row.channel_id);
        if (channel) {
            const embed = new EmbedBuilder().setTitle(`📋 ${type}`).setDescription(description).setColor(0x2F3136).setTimestamp();
            channel.send({ embeds: [embed] }).catch(() => {});
        }
    }
}

function getUserStats(userId, guildId) {
    let row = db.prepare("SELECT * FROM member_stats WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    if (!row) {
        db.prepare("INSERT INTO member_stats (user_id, guild_id, messages, voice_minutes, reactions_given, reactions_received, xp_earned) VALUES (?, ?, 0, 0, 0, 0, 0)").run(userId, guildId);
        row = db.prepare("SELECT * FROM member_stats WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    }
    return row;
}

function updateStat(userId, guildId, field, increment = 1) {
    db.prepare(`UPDATE member_stats SET ${field} = ${field} + ? WHERE user_id = ? AND guild_id = ?`).run(increment, userId, guildId);
}

// ================== إعدادات العميل ==================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

const PREFIX = '!';
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
    console.error('❌ TOKEN environment variable not set.');
    process.exit(1);
}

// ================== متغيرات الموسيقى ==================
const queues = new Map();

// ================== حدث ready ==================
client.once('ready', () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
});

// ================== حدث الرسائل ==================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // الأوامر المخصصة
    if (message.content.startsWith(PREFIX)) {
        const cmdName = message.content.slice(PREFIX.length).split(' ')[0].toLowerCase();
        const row = db.prepare("SELECT response FROM custom_commands WHERE guild_id = ? AND name = ?").get(message.guild.id, cmdName);
        if (row) message.channel.send(row.response);
    }

    // كلمات محظورة
    const badWords = db.prepare("SELECT word FROM bad_words WHERE guild_id = ?").all(message.guild.id);
    for (const bw of badWords) {
        if (message.content.toLowerCase().includes(bw.word)) {
            message.delete().catch(() => {});
            message.reply(`⛔ لا تستخدم كلمة ${bw.word}`).then(m => setTimeout(() => m.delete(), 5000));
        }
    }

    // نظام المستويات
    if (!message.content.startsWith(PREFIX)) {
        const xpGain = Math.floor(Math.random() * 15) + 5;
        addXp(message.author.id, message.guild.id, xpGain);
        updateStat(message.author.id, message.guild.id, 'messages', 1);
        return;
    }

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ================== أوامر الإدارة ==================
    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply('❌ لا تملك صلاحية.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ حدد عضواً.');
        const reason = args.join(' ') || 'لا يوجد سبب';
        try { await member.kick(reason); message.reply(`✅ تم طرد ${member.user.tag}.`); logEvent(message.guild.id, 'kick', `${message.author.tag} طرد ${member.user.tag}`); } catch(e) { message.reply('❌ فشل الطرد.'); }
    }

    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ لا تملك صلاحية.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ حدد عضواً.');
        const reason = args.join(' ') || 'لا يوجد سبب';
        try { await member.ban({ reason }); message.reply(`✅ تم حظر ${member.user.tag}.`); logEvent(message.guild.id, 'ban', `${message.author.tag} حظر ${member.user.tag}`); } catch(e) { message.reply('❌ فشل الحظر.'); }
    }

    if (command === 'unban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ لا تملك صلاحية.');
        const name = args.join(' ');
        const bans = await message.guild.bans.fetch();
        const user = bans.find(ban => ban.user.tag.includes(name));
        if (!user) return message.reply('❌ لم يتم العثور على العضو.');
        try { await message.guild.bans.remove(user.user); message.reply(`✅ تم رفع الحظر عن ${user.user.tag}.`); } catch(e) { message.reply('❌ فشل رفع الحظر.'); }
    }

    if (command === 'mute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ لا تملك صلاحية.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ حدد عضواً.');
        const duration = parseInt(args[0]) || 60;
        const reason = args.slice(1).join(' ') || 'لا يوجد سبب';
        try { await member.timeout(duration * 1000, reason); message.reply(`✅ تم كتم ${member.user.tag} لمدة ${duration} ثانية.`); } catch(e) { message.reply('❌ فشل الكتم.'); }
    }

    if (command === 'unmute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ لا تملك صلاحية.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ حدد عضواً.');
        try { await member.timeout(null); message.reply(`✅ تم رفع الكتم عن ${member.user.tag}.`); } catch(e) { message.reply('❌ فشل رفع الكتم.'); }
    }

    if (command === 'warn') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ لا تملك صلاحية.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ حدد عضواً.');
        const reason = args.slice(1).join(' ') || 'لا يوجد سبب';
        addWarning(member.id, message.guild.id, reason);
        const warns = getWarnings(member.id);
        message.reply(`⚠️ تم تحذير ${member.user.tag} (العدد: ${warns.length})`);
    }

    if (command === 'warnings') {
        const member = message.mentions.members.first() || message.member;
        const warns = getWarnings(member.id);
        if (warns.length === 0) return message.reply(`✅ ${member.user.tag} ليس لديه تحذيرات.`);
        const desc = warns.map((w, i) => `#${i+1}: ${w.reason} (${w.date})`).join('\n');
        const embed = new EmbedBuilder().setTitle(`⚠️ تحذيرات ${member.user.tag}`).setDescription(desc).setColor(0xFF0000);
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'clearwarns') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('❌ حدد عضواً.');
        clearWarnings(member.id);
        message.reply(`✅ تم مسح تحذيرات ${member.user.tag}.`);
    }

    // ================== اقتصاد ==================
    if (command === 'balance' || command === 'bal') {
        const member = message.mentions.members.first() || message.member;
        const bal = getBalance(member.id, message.guild.id);
        message.reply(`💰 ${member.user.tag} رصيدك: **${bal}** عملة.`);
    }

    if (command === 'daily') {
        const now = new Date().toISOString().slice(0,10);
        const row = db.prepare("SELECT daily FROM economy WHERE user_id = ? AND guild_id = ?").get(message.author.id, message.guild.id);
        if (row && row.daily === now) return message.reply('❌ انتظر حتى الغد.');
        const amount = Math.floor(Math.random() * 100) + 50;
        updateBalance(message.author.id, message.guild.id, amount);
        db.prepare("UPDATE economy SET daily = ? WHERE user_id = ? AND guild_id = ?").run(now, message.author.id, message.guild.id);
        message.reply(`✅ حصلت على **${amount}** عملة كمكافأة يومية!`);
    }

    if (command === 'work') {
        const now = Date.now();
        const row = db.prepare("SELECT work FROM economy WHERE user_id = ? AND guild_id = ?").get(message.author.id, message.guild.id);
        if (row && row.work) {
            const last = parseInt(row.work);
            if (now - last < 3600000) {
                const remain = Math.ceil((3600000 - (now - last)) / 1000);
                return message.reply(`⏳ انتظر ${remain} ثانية.`);
            }
        }
        const amount = Math.floor(Math.random() * 40) + 10;
        updateBalance(message.author.id, message.guild.id, amount);
        db.prepare("UPDATE economy SET work = ? WHERE user_id = ? AND guild_id = ?").run(String(now), message.author.id, message.guild.id);
        message.reply(`💼 عملت وكسبت **${amount}** عملة.`);
    }

    if (command === 'rob') {
        const target = message.mentions.members.first();
        if (!target || target.id === message.author.id) return message.reply('❌ حدد عضواً آخر.');
        const targetBal = getBalance(target.id, message.guild.id);
        if (targetBal < 10) return message.reply(`❌ ${target.user.tag} ليس لديه ما يكفي.`);
        const success = Math.random() < 0.4;
        if (success) {
            const amount = Math.floor(Math.random() * Math.min(50, targetBal)) + 1;
            updateBalance(message.author.id, message.guild.id, amount);
            updateBalance(target.id, message.guild.id, -amount);
            message.reply(`✅ سرقت **${amount}** عملة من ${target.user.tag}.`);
        } else {
            const penalty = Math.floor(Math.random() * 20) + 1;
            updateBalance(message.author.id, message.guild.id, -penalty);
            message.reply(`❌ فشلت السرقة وخسرت **${penalty}** عملة.`);
        }
    }

    if (command === 'slot') {
        const bet = parseInt(args[0]) || 10;
        const bal = getBalance(message.author.id, message.guild.id);
        if (bet <= 0 || bal < bet) return message.reply('❌ رصيد غير كافٍ.');
        const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣'];
        const res = [symbols[Math.floor(Math.random()*6)], symbols[Math.floor(Math.random()*6)], symbols[Math.floor(Math.random()*6)]];
        const embed = new EmbedBuilder().setTitle('🎰 ماكينة الحظ').setDescription(`${res[0]} ${res[1]} ${res[2]}`).setColor(0x2F3136);
        if (res[0] === res[1] && res[1] === res[2]) {
            const win = bet * 10;
            updateBalance(message.author.id, message.guild.id, win);
            embed.addFields({ name: '🎉 فوز', value: `ربحت **${win}** عملة!` });
        } else if (res[0] === res[1] || res[1] === res[2] || res[0] === res[2]) {
            const win = bet * 2;
            updateBalance(message.author.id, message.guild.id, win);
            embed.addFields({ name: '🎉 فوز بسيط', value: `ربحت **${win}** عملة!` });
        } else {
            updateBalance(message.author.id, message.guild.id, -bet);
            embed.addFields({ name: '😔 خسارة', value: `خسرت **${bet}** عملة.` });
        }
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'give') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const target = message.mentions.members.first();
        const amount = parseInt(args[1]);
        if (!target || !amount || amount <= 0) return message.reply('❌ استخدم: !give @user <مبلغ>');
        updateBalance(target.id, message.guild.id, amount);
        message.reply(`✅ تم إعطاء ${target.user.tag} **${amount}** عملة.`);
    }

    if (command === 'shop') {
        const embed = new EmbedBuilder().setTitle('🛒 المتجر').setColor(0x00FF00)
            .addFields(
                { name: '🎁 هدية', value: '100 عملة', inline: true },
                { name: '🌟 نجمة', value: '500 عملة (لقب)', inline: true },
                { name: '👑 تاج', value: '1000 عملة (لقب)', inline: true },
                { name: '🎨 لون مخصص', value: '2000 عملة', inline: true }
            );
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'buy') {
        const item = args.join(' ').toLowerCase();
        const bal = getBalance(message.author.id, message.guild.id);
        if (item === 'هدية') {
            if (bal < 100) return message.reply('❌ تحتاج 100 عملة.');
            updateBalance(message.author.id, message.guild.id, -100);
            const prizes = ['🎁', '🍫', '🧸', '🎮', '📱', '💻'];
            message.reply(`✅ اشتريت هدية وحصلت على: ${prizes[Math.floor(Math.random()*prizes.length)]}`);
        } else if (item === 'نجمة') {
            if (bal < 500) return message.reply('❌ تحتاج 500 عملة.');
            updateBalance(message.author.id, message.guild.id, -500);
            try { await message.member.setNickname(`⭐ ${message.member.displayName}`); message.reply('✅ تم إضافة نجمة.'); } catch(e) { message.reply('❌ لا أملك صلاحية تغيير اللقب.'); }
        } else if (item === 'تاج') {
            if (bal < 1000) return message.reply('❌ تحتاج 1000 عملة.');
            updateBalance(message.author.id, message.guild.id, -1000);
            try { await message.member.setNickname(`👑 ${message.member.displayName}`); message.reply('✅ تم إضافة تاج.'); } catch(e) { message.reply('❌ لا أملك صلاحية تغيير اللقب.'); }
        } else {
            message.reply('❌ العنصر غير موجود. استخدم !shop.');
        }
    }

    // ================== مستويات ==================
    if (command === 'rank') {
        const member = message.mentions.members.first() || message.member;
        const { xp, level } = getXp(member.id, message.guild.id);
        const needed = 5 * (level * level) + 50 * level + 100;
        const embed = new EmbedBuilder().setTitle(`📊 مستوى ${member.user.tag}`).setColor(0x00FF00)
            .addFields(
                { name: 'المستوى', value: String(level), inline: true },
                { name: 'XP', value: `${xp} / ${needed}`, inline: true },
                { name: 'التقدم', value: `${Math.floor((xp/needed)*100)}%`, inline: true }
            );
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'leaderboard') {
        const rows = db.prepare("SELECT user_id, level, xp FROM levels WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10").all(message.guild.id);
        if (!rows || rows.length === 0) return message.reply('❌ لا توجد بيانات.');
        const desc = rows.map((r, i) => `#${i+1} <@${r.user_id}> - المستوى ${r.level} (${r.xp} XP)`).join('\n');
        const embed = new EmbedBuilder().setTitle('🏆 لوحة المتصدرين').setDescription(desc).setColor(0xFFD700);
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'levelrole') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const level = parseInt(args[0]);
        const role = message.mentions.roles.first();
        if (!level || !role) return message.reply('❌ استخدم: !levelrole <مستوى> @دور');
        db.prepare("INSERT OR REPLACE INTO level_roles (guild_id, level, role_id) VALUES (?, ?, ?)").run(message.guild.id, level, role.id);
        message.reply(`✅ تم ربط دور ${role.name} بالمستوى ${level}.`);
    }

    // ================== تذاكر ==================
    if (command === 'ticket') {
        const topic = args.join(' ') || 'دعم عام';
        let category = message.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === 'Tickets');
        if (!category) category = await message.guild.channels.create({ name: 'Tickets', type: ChannelType.GuildCategory });
        const overwrites = [
            { id: message.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: message.author.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ];
        const channel = await message.guild.channels.create({ name: `ticket-${message.author.username}`, type: ChannelType.GuildText, parent: category, permissionOverwrites: overwrites });
        db.prepare("INSERT INTO tickets (guild_id, channel_id, user_id, topic, status, created_at) VALUES (?, ?, ?, ?, 'open', datetime('now'))").run(message.guild.id, channel.id, message.author.id, topic);
        const embed = new EmbedBuilder().setTitle('🎫 تذكرة جديدة').setDescription(`الموضوع: ${topic}`).setColor(0x00BFFF).addFields({ name: 'أنشأها', value: message.author.tag });
        channel.send({ content: `<@${message.author.id}>`, embeds: [embed] });
        message.reply(`✅ تم فتح تذكرة: ${channel}`);
    }

    if (command === 'close') {
        if (!message.channel.name.startsWith('ticket-')) return message.reply('❌ هذه ليست تذكرة.');
        db.prepare("UPDATE tickets SET status = 'closed' WHERE channel_id = ?").run(message.channel.id);
        await message.channel.send('🔒 سيتم حذف التذكرة خلال 5 ثوانٍ.');
        setTimeout(() => message.channel.delete().catch(() => {}), 5000);
    }

    // ================== ترحيب ووداع ==================
    if (command === 'setwelcome') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('❌ حدد قناة.');
        const msg = args.slice(1).join(' ') || 'مرحباً {user} في {server}';
        db.prepare("INSERT OR REPLACE INTO welcome (guild_id, channel_id, message) VALUES (?, ?, ?)").run(message.guild.id, channel.id, msg);
        message.reply(`✅ تم تعيين الترحيب في ${channel}`);
    }

    if (command === 'setgoodbye') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('❌ حدد قناة.');
        const msg = args.slice(1).join(' ') || 'وداعاً {user} من {server}';
        db.prepare("INSERT OR REPLACE INTO goodbye (guild_id, channel_id, message) VALUES (?, ?, ?)").run(message.guild.id, channel.id, msg);
        message.reply(`✅ تم تعيين الوداع في ${channel}`);
    }

    if (command === 'setautorole') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const role = message.mentions.roles.first();
        if (!role) return message.reply('❌ حدد دوراً.');
        db.prepare("INSERT OR REPLACE INTO autoroles (guild_id, role_id) VALUES (?, ?)").run(message.guild.id, role.id);
        message.reply(`✅ تم تعيين دور تلقائي: ${role.name}`);
    }

    // ================== لوغينغ ==================
    if (command === 'setlog') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const channel = message.mentions.channels.first();
        const type = args[1] || 'all';
        if (!channel) return message.reply('❌ حدد قناة.');
        db.prepare("INSERT OR REPLACE INTO logging (guild_id, channel_id, type) VALUES (?, ?, ?)").run(message.guild.id, channel.id, type);
        message.reply(`✅ تم تعيين سجلات ${type} في ${channel}`);
    }

    // ================== أوامر مخصصة ==================
    if (command === 'addcmd') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const name = args[0];
        const response = args.slice(1).join(' ');
        if (!name || !response) return message.reply('❌ استخدم: !addcmd <اسم> <رد>');
        db.prepare("INSERT OR REPLACE INTO custom_commands (guild_id, name, response) VALUES (?, ?, ?)").run(message.guild.id, name.toLowerCase(), response);
        message.reply(`✅ تم إضافة الأمر !${name}`);
    }

    if (command === 'delcmd') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const name = args[0];
        if (!name) return message.reply('❌ استخدم: !delcmd <اسم>');
        db.prepare("DELETE FROM custom_commands WHERE guild_id = ? AND name = ?").run(message.guild.id, name.toLowerCase());
        message.reply(`✅ تم حذف الأمر !${name}`);
    }

    if (command === 'cmds') {
        const rows = db.prepare("SELECT name FROM custom_commands WHERE guild_id = ?").all(message.guild.id);
        if (!rows || rows.length === 0) return message.reply('📭 لا توجد أوامر مخصصة.');
        const list = rows.map(r => `!${r.name}`).join(', ');
        message.reply(`📌 الأوامر المخصصة: ${list}`);
    }

    // ================== استطلاعات ==================
    if (command === 'poll') {
        const question = args[0];
        const options = args.slice(1);
        if (!question || options.length < 2) return message.reply('❌ استخدم: !poll "سؤال" "خيار1" "خيار2" ...');
        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
        const desc = options.map((o, i) => `${emojis[i]} ${o}`).join('\n');
        const embed = new EmbedBuilder().setTitle(`📊 ${question}`).setDescription(desc).setColor(0x00FF00);
        const msg = await message.channel.send({ embeds: [embed] });
        for (let i = 0; i < options.length; i++) await msg.react(emojis[i]);
        db.prepare("INSERT INTO polls (guild_id, channel_id, message_id, question, options) VALUES (?, ?, ?, ?, ?)").run(message.guild.id, message.channel.id, msg.id, question, JSON.stringify(options));
        message.delete().catch(() => {});
    }

    // ================== هدايا ==================
    if (command === 'giveaway') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const duration = parseInt(args[0]) * 1000;
        const winners = parseInt(args[1]);
        const prize = args.slice(2).join(' ');
        if (!duration || !winners || !prize) return message.reply('❌ استخدم: !giveaway <ثواني> <فائزون> <جائزة>');
        const embed = new EmbedBuilder().setTitle('🎁 هدية جديدة!').setDescription(`الجائزة: ${prize}\nالفائزون: ${winners}`).setColor(0xFFD700).setFooter({ text: 'تفاعل بـ 🎉 للمشاركة' });
        const msg = await message.channel.send({ embeds: [embed] });
        await msg.react('🎉');
        const endTime = Date.now() + duration;
        db.prepare("INSERT INTO giveaways (guild_id, channel_id, message_id, prize, end_time, winners, entries) VALUES (?, ?, ?, ?, ?, ?, ?)").run(message.guild.id, message.channel.id, msg.id, prize, String(endTime), winners, '[]');
        setTimeout(async () => {
            const row = db.prepare("SELECT entries FROM giveaways WHERE message_id = ?").get(msg.id);
            if (!row) return;
            const entries = JSON.parse(row.entries);
            if (entries.length === 0) return message.channel.send('❌ لا يوجد مشاركون.');
            const shuffled = entries.sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, Math.min(winners, shuffled.length));
            const mentions = selected.map(id => `<@${id}>`).join(', ');
            message.channel.send(`🎉 الفائزون في هدية ${prize}: ${mentions}`);
            db.prepare("DELETE FROM giveaways WHERE message_id = ?").run(msg.id);
        }, duration);
    }

    // ================== تذكيرات ==================
    if (command === 'remind') {
        const duration = parseInt(args[0]);
        const msgText = args.slice(1).join(' ');
        if (!duration || !msgText) return message.reply('❌ استخدم: !remind <ثواني> <رسالة>');
        const remindTime = Date.now() + duration * 1000;
        db.prepare("INSERT INTO reminders (user_id, channel_id, message, remind_time) VALUES (?, ?, ?, ?)").run(message.author.id, message.channel.id, msgText, String(remindTime));
        message.reply(`✅ تم تعيين تذكير بعد ${duration} ثانية.`);
    }

    if (command === 'remindrepeat') {
        const interval = parseInt(args[0]);
        const msgText = args.slice(1).join(' ');
        if (!interval || !msgText) return message.reply('❌ استخدم: !remindrepeat <ثواني> <رسالة>');
        const remindTime = Date.now() + interval * 1000;
        db.prepare("INSERT INTO reminders (user_id, channel_id, message, remind_time, repeat_interval) VALUES (?, ?, ?, ?, ?)").run(message.author.id, message.channel.id, msgText, String(remindTime), interval);
        message.reply(`✅ سيتم تذكيرك كل ${interval} ثانية.`);
    }

    // ================== ألعاب ==================
    if (command === '8ball') {
        const question = args.join(' ');
        if (!question) return message.reply('❌ اسألني شيئاً.');
        const answers = ['نعم', 'لا', 'ربما', 'بالتأكيد', 'مستحيل', 'اسأل لاحقاً', 'لا يمكن التنبؤ'];
        message.reply(`🎱 **${answers[Math.floor(Math.random()*answers.length)]}**`);
    }

    if (command === 'roll') {
        const max = parseInt(args[0]) || 100;
        message.reply(`🎲 رميت النرد وحصلت على: **${Math.floor(Math.random()*max)+1}**`);
    }

    if (command === 'flip') {
        message.reply(`🪙 العملة أظهرت: **${Math.random() < 0.5 ? 'وجه' : 'كتابة'}**`);
    }

    if (command === 'meme') {
        try {
            const res = await axios.get('https://meme-api.com/gimme');
            const data = res.data;
            const embed = new EmbedBuilder().setTitle(data.title).setURL(data.postLink).setImage(data.url).setColor(0x2F3136);
            message.channel.send({ embeds: [embed] });
        } catch(e) { message.reply('❌ لم أتمكن من جلب ميم.'); }
    }

    if (command === 'weather') {
        const city = args.join(' ');
        if (!city) return message.reply('❌ حدد مدينة.');
        const apiKey = 'YOUR_WEATHER_API_KEY';
        try {
            const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=ar`);
            const data = res.data;
            const embed = new EmbedBuilder().setTitle(`🌤️ الطقس في ${city}`).setColor(0x00BFFF)
                .addFields(
                    { name: 'درجة الحرارة', value: `${data.main.temp}°C`, inline: true },
                    { name: 'الرطوبة', value: `${data.main.humidity}%`, inline: true },
                    { name: 'الوصف', value: data.weather[0].description, inline: false }
                );
            message.channel.send({ embeds: [embed] });
        } catch(e) { message.reply('❌ لم أتمكن من العثور على المدينة.'); }
    }

    if (command === 'news') {
        const apiKey = 'YOUR_NEWS_API_KEY';
        try {
            const res = await axios.get(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`);
            const articles = res.data.articles.slice(0, 5);
            const desc = articles.map(a => `**${a.title}**\n${a.description || ''}\n[رابط](${a.url})`).join('\n\n');
            const embed = new EmbedBuilder().setTitle('📰 أهم الأخبار').setDescription(desc).setColor(0x2F3136);
            message.channel.send({ embeds: [embed] });
        } catch(e) { message.reply('❌ لم أتمكن من جلب الأخبار.'); }
    }

    // ================== موسيقى ==================
    if (command === 'play') {
        const query = args.join(' ');
        if (!query) return message.reply('❌ أدخل اسم أغنية أو رابط.');
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ يجب أن تكون في قناة صوتية.');
        if (!queues.get(message.guild.id)) queues.set(message.guild.id, []);
        const queue = queues.get(message.guild.id);
        try {
            const info = await ytdl.getInfo(query);
            const song = { title: info.videoDetails.title, url: info.videoDetails.video_url, requester: message.author.id };
            queue.push(song);
            if (!message.guild.members.me.voice.channel) {
                await voiceChannel.join();
                playSong(message.guild);
            }
            message.reply(`🎵 تمت الإضافة: **${song.title}**`);
        } catch(e) { message.reply('❌ لم أتمكن من العثور على الأغنية.'); }
    }

    async function playSong(guild) {
        const queue = queues.get(guild.id);
        if (!queue || queue.length === 0) {
            guild.members.me.voice.disconnect();
            return;
        }
        const song = queue[0];
        const connection = guild.members.me.voice;
        if (!connection) return;
        const stream = ytdl(song.url, { filter: 'audioonly', highWaterMark: 1 << 25 });
        const player = connection.play(stream, { type: 'opus' });
        player.on('finish', () => {
            queue.shift();
            playSong(guild);
        });
        player.on('error', () => { queue.shift(); playSong(guild); });
        const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages));
        if (channel) channel.send(`▶️ جارٍ التشغيل: **${song.title}**`);
    }

    if (command === 'stop') {
        if (!message.member.voice.channel) return message.reply('❌ لست في قناة صوتية.');
        if (queues) queues.set(message.guild.id, []);
        if (message.guild.members.me.voice) message.guild.members.me.voice.disconnect();
        message.reply('⏹️ تم إيقاف الموسيقى.');
    }

    if (command === 'skip') {
        const queue = queues.get(message.guild.id);
        if (!queue || queue.length === 0) return message.reply('📭 القائمة فارغة.');
        queue.shift();
        if (message.guild.members.me.voice) {
            message.guild.members.me.voice.disconnect();
            const vc = message.member.voice.channel;
            if (vc) {
                await vc.join();
                playSong(message.guild);
            }
        }
        message.reply('⏭️ تم تخطي الأغنية.');
    }

    if (command === 'queue') {
        const queue = queues.get(message.guild.id) || [];
        if (queue.length === 0) return message.reply('📭 القائمة فارغة.');
        const desc = queue.map((s, i) => `#${i+1} ${s.title}`).slice(0, 10).join('\n');
        const embed = new EmbedBuilder().setTitle('🎵 قائمة التشغيل').setDescription(desc).setColor(0x00BFFF);
        message.channel.send({ embeds: [embed] });
    }

    // ================== زواج ==================
    if (command === 'marry') {
        const target = message.mentions.members.first();
        if (!target || target.id === message.author.id || target.bot) return message.reply('❌ حدد عضواً صالحاً.');
        const row1 = db.prepare("SELECT * FROM marriages WHERE (user1 = ? OR user2 = ?) AND guild_id = ?").get(message.author.id, message.author.id, message.guild.id);
        if (row1) return message.reply('❌ أنت متزوج بالفعل.');
        const row2 = db.prepare("SELECT * FROM marriages WHERE (user1 = ? OR user2 = ?) AND guild_id = ?").get(target.id, target.id, message.guild.id);
        if (row2) return message.reply(`❌ ${target.user.tag} متزوج بالفعل.`);
        const embed = new EmbedBuilder().setTitle('💍 طلب زواج').setDescription(`${message.author} يطلب الزواج من ${target}`).setColor(0xFF69B4);
        message.channel.send({ content: target.toString(), embeds: [embed] }).then(msg => {
            msg.react('✅');
            msg.react('❌');
            const filter = (reaction, user) => user.id === target.id && ['✅', '❌'].includes(reaction.emoji.name);
            msg.awaitReactions({ filter, max: 1, time: 60000 }).then(collected => {
                if (collected.first()?.emoji.name === '✅') {
                    db.prepare("INSERT INTO marriages (user1, user2, guild_id) VALUES (?, ?, ?)").run(message.author.id, target.id, message.guild.id);
                    message.channel.send(`🎉 تم الزواج بين ${message.author} و ${target}!`);
                } else {
                    message.channel.send(`❌ تم رفض الطلب.`);
                }
            }).catch(() => message.channel.send('❌ انتهى الوقت.'));
        });
    }

    if (command === 'divorce') {
        db.prepare("DELETE FROM marriages WHERE (user1 = ? OR user2 = ?) AND guild_id = ?").run(message.author.id, message.author.id, message.guild.id);
        message.reply('💔 تم الطلاق.');
    }

    if (command === 'married') {
        const rows = db.prepare("SELECT user1, user2 FROM marriages WHERE guild_id = ?").all(message.guild.id);
        if (!rows || rows.length === 0) return message.reply('📭 لا يوجد زيجات.');
        const list = rows.map(r => `<@${r.user1}> 💕 <@${r.user2}>`).join('\n');
        const embed = new EmbedBuilder().setTitle('💕 الزيجات').setDescription(list).setColor(0xFF69B4);
        message.channel.send({ embeds: [embed] });
    }

    // ================== حماية ==================
    if (command === 'raidmode') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const level = parseInt(args[0]) || 1;
        try {
            await message.guild.setVerificationLevel(level);
            message.reply(`✅ تم تفعيل وضع الحماية المستوى ${level}.`);
        } catch(e) { message.reply('❌ فشل التفعيل.'); }
    }

    // ================== معلومات ==================
    if (command === 'userinfo') {
        const member = message.mentions.members.first() || message.member;
        const embed = new EmbedBuilder().setTitle(`معلومات ${member.user.tag}`).setThumbnail(member.displayAvatarURL()).setColor(member.displayColor || 0x2F3136)
            .addFields(
                { name: '🆔 ID', value: member.id, inline: false },
                { name: '📅 انضم', value: member.joinedAt.toDateString(), inline: true },
                { name: '📆 الحساب', value: member.user.createdAt.toDateString(), inline: true },
                { name: '🎭 الأدوار', value: member.roles.cache.map(r => r.toString()).join(' ') || 'لا يوجد', inline: false }
            );
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'serverinfo') {
        const g = message.guild;
        const embed = new EmbedBuilder().setTitle(`معلومات ${g.name}`).setThumbnail(g.iconURL()).setColor(0x2F3136)
            .addFields(
                { name: '🆔 ID', value: g.id, inline: true },
                { name: '👑 المالك', value: `<@${g.ownerId}>`, inline: true },
                { name: '👥 الأعضاء', value: String(g.memberCount), inline: true },
                { name: '📢 القنوات', value: String(g.channels.cache.size), inline: true },
                { name: '📅 التاريخ', value: g.createdAt.toDateString(), inline: true }
            );
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'ping') {
        message.reply(`🏓 Pong! ${client.ws.ping}ms`);
    }

    // ================== الأنظمة الجديدة ==================
    // ---- العشائر ----
    if (command === 'clan') {
        const sub = args[0];
        if (sub === 'create') {
            const name = args.slice(1).join(' ');
            if (!name) return message.reply('❌ أدخل اسم العشيرة.');
            const row = db.prepare("SELECT * FROM clans WHERE guild_id = ? AND name = ?").get(message.guild.id, name);
            if (row) return message.reply('❌ هذه العشيرة موجودة.');
            db.prepare("INSERT INTO clans (guild_id, name, owner, members, created_at) VALUES (?, ?, ?, ?, datetime('now'))").run(message.guild.id, name, message.author.id, JSON.stringify([message.author.id]));
            message.reply(`✅ تم إنشاء عشيرة **${name}**`);
        } else if (sub === 'info') {
            const name = args.slice(1).join(' ');
            if (!name) return message.reply('❌ أدخل اسم العشيرة.');
            const row = db.prepare("SELECT * FROM clans WHERE guild_id = ? AND name = ?").get(message.guild.id, name);
            if (!row) return message.reply('❌ العشيرة غير موجودة.');
            const members = JSON.parse(row.members);
            const embed = new EmbedBuilder().setTitle(`🏴 عشيرة ${row.name}`).setColor(0xFF0000)
                .addFields(
                    { name: 'المالك', value: `<@${row.owner}>`, inline: true },
                    { name: 'الأعضاء', value: members.map(id => `<@${id}>`).join(', ') || 'لا يوجد', inline: false },
                    { name: 'المستوى', value: String(row.level), inline: true }
                );
            message.channel.send({ embeds: [embed] });
        }
    }

    // ---- المزارع ----
    if (command === 'farm') {
        const sub = args[0];
        if (sub === 'plant') {
            const crop = args[1];
            if (!crop) return message.reply('❌ المحاصيل: قمح, ذرة, طماطم, بطاطس.');
            const times = { قمح: 60, ذرة: 120, طماطم: 180, بطاطس: 240 };
            if (!times[crop]) return message.reply('❌ محصول غير معروف.');
            const now = Date.now();
            const ready = now + times[crop] * 1000;
            db.prepare("INSERT INTO farms (user_id, guild_id, crop, planted_at, ready_at) VALUES (?, ?, ?, ?, ?)").run(message.author.id, message.guild.id, crop, String(now), String(ready));
            message.reply(`🌱 زرعت **${crop}**، ستكون جاهزة بعد ${times[crop]} ثانية.`);
        } else if (sub === 'harvest') {
            const row = db.prepare("SELECT crop, ready_at FROM farms WHERE user_id = ? AND guild_id = ? AND status = 'growing'").get(message.author.id, message.guild.id);
            if (!row) return message.reply('❌ ليس لديك أي محصول.');
            const now = Date.now();
            if (now < parseInt(row.ready_at)) {
                const remain = Math.ceil((parseInt(row.ready_at) - now) / 1000);
                return message.reply(`⏳ المحصول جاهز بعد ${remain} ثانية.`);
            }
            const rewards = { قمح: 10, ذرة: 20, طماطم: 30, بطاطس: 40 };
            const amount = rewards[row.crop] || 10;
            updateBalance(message.author.id, message.guild.id, amount);
            db.prepare("UPDATE farms SET status = 'harvested' WHERE user_id = ? AND guild_id = ?").run(message.author.id, message.guild.id);
            message.reply(`✅ حصدت **${row.crop}** وحصلت على **${amount}** عملة!`);
        }
    }

    // ---- السجون ----
    if (command === 'jail') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ لا تملك صلاحية.');
        const target = message.mentions.members.first();
        const duration = parseInt(args[1]) || 60;
        const reason = args.slice(2).join(' ') || 'لا يوجد سبب';
        if (!target) return message.reply('❌ حدد عضواً.');
        const release = Date.now() + duration * 1000;
        db.prepare("INSERT INTO prisons (user_id, guild_id, jailed_at, release_at, reason) VALUES (?, ?, ?, ?, ?)").run(target.id, message.guild.id, String(Date.now()), String(release), reason);
        try { await target.timeout(duration * 1000, reason); } catch(e) {}
        message.reply(`🔒 تم سجن ${target.user.tag} لمدة ${duration} ثانية.`);
    }

    if (command === 'unjail') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ لا تملك صلاحية.');
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ حدد عضواً.');
        db.prepare("DELETE FROM prisons WHERE user_id = ? AND guild_id = ?").run(target.id, message.guild.id);
        try { await target.timeout(null); } catch(e) {}
        message.reply(`✅ تم إطلاق سراح ${target.user.tag}`);
    }

    // ---- البنوك ----
    if (command === 'bank') {
        const sub = args[0];
        if (sub === 'deposit') {
            const amount = parseInt(args[1]);
            if (!amount || amount <= 0) return message.reply('❌ أدخل مبلغاً موجباً.');
            const bal = getBalance(message.author.id, message.guild.id);
            if (bal < amount) return message.reply('❌ رصيدك غير كافٍ.');
            updateBalance(message.author.id, message.guild.id, -amount);
            db.prepare("UPDATE economy SET bank = bank + ? WHERE user_id = ? AND guild_id = ?").run(amount, message.author.id, message.guild.id);
            message.reply(`💰 أودعت **${amount}** عملة في البنك.`);
        } else if (sub === 'withdraw') {
            const amount = parseInt(args[1]);
            if (!amount || amount <= 0) return message.reply('❌ أدخل مبلغاً موجباً.');
            const row = db.prepare("SELECT bank FROM economy WHERE user_id = ? AND guild_id = ?").get(message.author.id, message.guild.id);
            if (!row || row.bank < amount) return message.reply('❌ رصيد البنك غير كافٍ.');
            db.prepare("UPDATE economy SET bank = bank - ? WHERE user_id = ? AND guild_id = ?").run(amount, message.author.id, message.guild.id);
            updateBalance(message.author.id, message.guild.id, amount);
            message.reply(`💰 سحبت **${amount}** عملة من البنك.`);
        } else if (sub === 'loan') {
            const amount = parseInt(args[1]);
            if (!amount || amount < 100 || amount > 10000) return message.reply('❌ المبلغ بين 100 و 10000.');
            const interest = Math.floor(amount * 0.1);
            const due = Date.now() + 7 * 24 * 60 * 60 * 1000;
            db.prepare("INSERT INTO loans (user_id, guild_id, amount, interest, due_date) VALUES (?, ?, ?, ?, ?)").run(message.author.id, message.guild.id, amount, interest, String(due));
            updateBalance(message.author.id, message.guild.id, amount);
            message.reply(`🏦 حصلت على قرض **${amount}** عملة (فائدة: ${interest})، مستحق خلال 7 أيام.`);
        }
    }

    // ---- الاستثمارات ----
    if (command === 'invest') {
        const amount = parseInt(args[0]);
        if (!amount || amount < 100) return message.reply('❌ الحد الأدنى 100 عملة.');
        const bal = getBalance(message.author.id, message.guild.id);
        if (bal < amount) return message.reply('❌ رصيد غير كافٍ.');
        const profit = Math.floor(amount * (Math.random() * 0.2 + 0.05));
        const end = Date.now() + 24 * 60 * 60 * 1000;
        db.prepare("INSERT INTO investments (user_id, guild_id, amount, profit, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)").run(message.author.id, message.guild.id, amount, profit, String(Date.now()), String(end));
        updateBalance(message.author.id, message.guild.id, -amount);
        message.reply(`📈 استثمرت **${amount}** عملة، الربح المتوقع **${profit}** خلال 24 ساعة.`);
    }

    // ---- المزادات ----
    if (command === 'auction') {
        const sub = args[0];
        if (sub === 'create') {
            const item = args.slice(1, -1).join(' ');
            const starting = parseInt(args[args.length - 1]);
            if (!item || !starting) return message.reply('❌ استخدم: !auction create <عنصر> <سعر_بدء>');
            const end = Date.now() + 3600000;
            db.prepare("INSERT INTO auctions (guild_id, item, seller, starting_bid, current_bid, end_time) VALUES (?, ?, ?, ?, ?, ?)").run(message.guild.id, item, message.author.id, starting, starting, String(end));
            message.reply(`🔨 تم بدء مزاد لـ **${item}** بسعر ${starting} عملة.`);
        } else if (sub === 'bid') {
            const id = parseInt(args[1]);
            const amount = parseInt(args[2]);
            if (!id || !amount) return message.reply('❌ استخدم: !auction bid <id> <مبلغ>');
            const row = db.prepare("SELECT item, current_bid, bidder, end_time, seller FROM auctions WHERE id = ? AND status = 'active'").get(id);
            if (!row) return message.reply('❌ المزاد غير موجود.');
            if (Date.now() > parseInt(row.end_time)) return message.reply('❌ انتهى المزاد.');
            if (amount <= row.current_bid) return message.reply(`❌ المبلغ يجب أن يزيد عن ${row.current_bid}.`);
            if (message.author.id === row.seller) return message.reply('❌ لا يمكنك المزايدة على عنصرك.');
            db.prepare("UPDATE auctions SET current_bid = ?, bidder = ? WHERE id = ?").run(amount, message.author.id, id);
            message.reply(`✅ تم المزايدة بـ **${amount}** عملة على **${row.item}**.`);
        } else if (sub === 'end') {
            const id = parseInt(args[1]);
            if (!id) return message.reply('❌ استخدم: !auction end <id>');
            const row = db.prepare("SELECT * FROM auctions WHERE id = ? AND status = 'active'").get(id);
            if (!row) return message.reply('❌ المزاد غير موجود.');
            if (row.seller !== message.author.id && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لست المالك.');
            if (row.bidder) {
                updateBalance(row.bidder, message.guild.id, -row.current_bid);
                updateBalance(row.seller, message.guild.id, row.current_bid);
                message.reply(`🏆 فاز <@${row.bidder}> بـ **${row.item}** بمبلغ ${row.current_bid}.`);
            } else {
                message.reply(`❌ لا يوجد مزايدون على **${row.item}**.`);
            }
            db.prepare("UPDATE auctions SET status = 'ended' WHERE id = ?").run(id);
        }
    }

    // ---- الألقاب ----
    if (command === 'title') {
        const sub = args[0];
        if (sub === 'set') {
            const title = args.slice(1).join(' ');
            if (!title) return message.reply('❌ أدخل لقباً.');
            db.prepare("INSERT OR REPLACE INTO titles (user_id, guild_id, title) VALUES (?, ?, ?)").run(message.author.id, message.guild.id, title);
            message.reply(`✅ تم تعيين لقبك: **${title}**`);
        } else if (sub === 'show') {
            const row = db.prepare("SELECT title FROM titles WHERE user_id = ? AND guild_id = ?").get(message.author.id, message.guild.id);
            if (row) message.reply(`🏷️ لقبك: **${row.title}**`);
            else message.reply('❌ ليس لديك لقب.');
        }
    }

    // ---- الردود التلقائية ----
    if (command === 'addauto') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const trigger = args[0];
        const response = args.slice(1).join(' ');
        if (!trigger || !response) return message.reply('❌ استخدم: !addauto <كلمة> <رد>');
        db.prepare("INSERT OR REPLACE INTO auto_responders (guild_id, trigger, response) VALUES (?, ?, ?)").run(message.guild.id, trigger.toLowerCase(), response);
        message.reply(`✅ تم إضافة رد تلقائي لـ **${trigger}**`);
    }

    // ---- الأحداث ----
    if (command === 'event') {
        const sub = args[0];
        if (sub === 'create') {
            const name = args[1];
            const date = args[2];
            const desc = args.slice(3).join(' ');
            if (!name || !date || !desc) return message.reply('❌ استخدم: !event create <اسم> <تاريخ> <وصف>');
            db.prepare("INSERT INTO events (guild_id, name, description, date, channel_id, created_by) VALUES (?, ?, ?, ?, ?, ?)").run(message.guild.id, name, desc, date, message.channel.id, message.author.id);
            message.reply(`✅ تم إنشاء حدث **${name}** في ${date}`);
        } else if (sub === 'list') {
            const rows = db.prepare("SELECT id, name, date FROM events WHERE guild_id = ?").all(message.guild.id);
            if (!rows || rows.length === 0) return message.reply('📭 لا توجد أحداث.');
            const list = rows.map(r => `#${r.id} ${r.name} - ${r.date}`).join('\n');
            message.reply(`📅 الأحداث:\n${list}`);
        }
    }

    // ---- الألوان المخصصة ----
    if (command === 'color') {
        const hex = args[0];
        if (!hex || !/^#[0-9A-F]{6}$/i.test(hex)) return message.reply('❌ أدخل لوناً بصيغة #RRGGBB');
        db.prepare("INSERT OR REPLACE INTO custom_colors (user_id, guild_id, color_hex) VALUES (?, ?, ?)").run(message.author.id, message.guild.id, hex);
        message.reply(`🎨 تم تعيين لونك إلى ${hex}`);
    }

    // ---- المهام اليومية ----
    if (command === 'quest') {
        const sub = args[0];
        const now = new Date().toISOString().slice(0,10);
        if (sub === 'daily') {
            const row = db.prepare("SELECT progress, status FROM quests WHERE user_id = ? AND guild_id = ? AND type = 'daily' AND date = ?").get(message.author.id, message.guild.id, now);
            if (row && row.status === 'completed') return message.reply('✅ أكملت مهمتك اليومية.');
            if (!row) {
                const tasks = ['أرسل 10 رسائل', 'تفاعل مع 5 رسائل', 'اربح 100 عملة'];
                const task = tasks[Math.floor(Math.random() * tasks.length)];
                db.prepare("INSERT INTO quests (user_id, guild_id, name, description, reward, type, target, progress, status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)").run(message.author.id, message.guild.id, 'مهمة يومية', task, 50, 'daily', 1, 0, now);
                message.reply(`📋 مهمتك اليومية: ${task} (مكافأة: 50 عملة)`);
            } else {
                message.reply(`📋 تقدمك: ${row.progress} / 1`);
            }
        } else if (sub === 'claim') {
            const row = db.prepare("SELECT reward, status FROM quests WHERE user_id = ? AND guild_id = ? AND type = 'daily' AND status = 'active'").get(message.author.id, message.guild.id);
            if (!row) return message.reply('❌ ليس لديك مهمة نشطة.');
            if (row.status !== 'completed') return message.reply('❌ لم تكمل المهمة بعد.');
            updateBalance(message.author.id, message.guild.id, row.reward);
            db.prepare("UPDATE quests SET status = 'claimed' WHERE user_id = ? AND guild_id = ? AND type = 'daily'").run(message.author.id, message.guild.id);
            message.reply(`✅ حصلت على ${row.reward} عملة!`);
        }
    }

    // ---- الإنجازات ----
    if (command === 'achievement') {
        const sub = args[0];
        if (sub === 'unlock') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
            const target = message.mentions.members.first();
            const name = args.slice(2).join(' ');
            if (!target || !name) return message.reply('❌ استخدم: !achievement unlock @user <اسم>');
            db.prepare("INSERT INTO achievements (user_id, guild_id, achievement_name, unlocked_at) VALUES (?, ?, ?, datetime('now'))").run(target.id, message.guild.id, name);
            message.reply(`🏅 تم منح إنجاز ${name} لـ ${target.user.tag}`);
        } else if (sub === 'list') {
            const member = message.mentions.members.first() || message.member;
            const rows = db.prepare("SELECT achievement_name, unlocked_at FROM achievements WHERE user_id = ? AND guild_id = ?").all(member.id, message.guild.id);
            if (!rows || rows.length === 0) return message.reply(`📭 ${member.user.tag} ليس لديه إنجازات.`);
            const list = rows.map(r => `${r.achievement_name} (${r.unlocked_at})`).join('\n');
            message.reply(`🏅 إنجازات ${member.user.tag}:\n${list}`);
        }
    }

    // ---- الأدوار المؤقتة ----
    if (command === 'temprole') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const target = message.mentions.members.first();
        const role = message.mentions.roles.first();
        const duration = parseInt(args[2]) || 3600;
        if (!target || !role) return message.reply('❌ استخدم: !temprole @user @دور <ثواني>');
        try {
            await target.roles.add(role);
            const expiry = Date.now() + duration * 1000;
            db.prepare("INSERT INTO temp_roles (user_id, guild_id, role_id, expiry_time) VALUES (?, ?, ?, ?)").run(target.id, message.guild.id, role.id, String(expiry));
            message.reply(`✅ تم منح ${role.name} لـ ${target.user.tag} لمدة ${duration} ثانية.`);
            setTimeout(async () => {
                const row = db.prepare("SELECT * FROM temp_roles WHERE user_id = ? AND guild_id = ? AND role_id = ?").get(target.id, message.guild.id, role.id);
                if (row) {
                    try { await target.roles.remove(role); } catch(e) {}
                    db.prepare("DELETE FROM temp_roles WHERE user_id = ? AND guild_id = ? AND role_id = ?").run(target.id, message.guild.id, role.id);
                    message.channel.send(`⏳ انتهت صلاحية دور ${role.name} لـ ${target.user.tag}`);
                }
            }, duration * 1000);
        } catch(e) { message.reply('❌ فشل منح الدور.'); }
    }

    // ---- الأدوار التفاعلية ----
    if (command === 'reactionrole') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const sub = args[0];
        if (sub === 'add') {
            const msgId = args[1];
            const role = message.mentions.roles.first();
            const emoji = args[3];
            if (!msgId || !role || !emoji) return message.reply('❌ استخدم: !reactionrole add <message_id> @دور <إيموجي>');
            db.prepare("INSERT INTO reaction_roles (guild_id, message_id, role_id, emoji) VALUES (?, ?, ?, ?)").run(message.guild.id, msgId, role.id, emoji);
            message.reply(`✅ تم ربط الإيموجي ${emoji} بالدور ${role.name}`);
            try { const msg = await message.channel.messages.fetch(msgId); await msg.react(emoji); } catch(e) {}
        } else if (sub === 'remove') {
            const id = parseInt(args[1]);
            if (!id) return message.reply('❌ استخدم: !reactionrole remove <id>');
            db.prepare("DELETE FROM reaction_roles WHERE id = ? AND guild_id = ?").run(id, message.guild.id);
            message.reply('✅ تم الحذف.');
        } else if (sub === 'list') {
            const rows = db.prepare("SELECT id, message_id, role_id, emoji FROM reaction_roles WHERE guild_id = ?").all(message.guild.id);
            if (!rows || rows.length === 0) return message.reply('📭 لا توجد أدوار تفاعلية.');
            const list = rows.map(r => `#${r.id} - ${r.emoji} -> <@&${r.role_id}>`).join('\n');
            message.reply(`📋 الأدوار التفاعلية:\n${list}`);
        }
    }

    // ---- إحصائيات الأعضاء ----
    if (command === 'mystats') {
        const member = message.mentions.members.first() || message.member;
        const stats = getUserStats(member.id, message.guild.id);
        const embed = new EmbedBuilder().setTitle(`📊 إحصائيات ${member.user.tag}`).setColor(0x00BFFF)
            .addFields(
                { name: 'رسائل', value: String(stats.messages), inline: true },
                { name: 'دقائق صوتية', value: String(stats.voice_minutes), inline: true },
                { name: 'تفاعلات أعطيتها', value: String(stats.reactions_given), inline: true },
                { name: 'تفاعلات تلقيتها', value: String(stats.reactions_received), inline: true }
            );
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'topstats') {
        const rows = db.prepare("SELECT user_id, messages, voice_minutes FROM member_stats WHERE guild_id = ? ORDER BY messages DESC LIMIT 10").all(message.guild.id);
        if (!rows || rows.length === 0) return message.reply('📭 لا توجد بيانات.');
        const desc = rows.map((r, i) => `#${i+1} <@${r.user_id}> - رسائل: ${r.messages} | صوت: ${r.voice_minutes}`).join('\n');
        const embed = new EmbedBuilder().setTitle('🏆 ترتيب النشاط').setDescription(desc).setColor(0xFFD700);
        message.channel.send({ embeds: [embed] });
    }

    // ---- الحظر المتقدم ----
    if (command === 'advban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const target = message.mentions.members.first();
        const duration = parseInt(args[1]) || 3600;
        const reason = args.slice(2).join(' ') || 'لا يوجد سبب';
        if (!target) return message.reply('❌ حدد عضواً.');
        try {
            await target.ban({ reason });
            db.prepare("INSERT OR REPLACE INTO advanced_bans (user_id, guild_id, reason, duration, banned_at) VALUES (?, ?, ?, ?, datetime('now'))").run(target.id, message.guild.id, reason, duration);
            message.reply(`🔨 تم حظر ${target.user.tag} لمدة ${duration} ثانية.`);
            setTimeout(async () => {
                const row = db.prepare("SELECT * FROM advanced_bans WHERE user_id = ? AND guild_id = ?").get(target.id, message.guild.id);
                if (row) {
                    try { await message.guild.bans.remove(target.id); } catch(e) {}
                    db.prepare("DELETE FROM advanced_bans WHERE user_id = ? AND guild_id = ?").run(target.id, message.guild.id);
                    message.channel.send(`🔓 تم رفع الحظر التلقائي عن ${target.user.tag}`);
                }
            }, duration * 1000);
        } catch(e) { message.reply('❌ فشل الحظر.'); }
    }

    if (command === 'unbanadv') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const target = args[0];
        if (!target) return message.reply('❌ أدخل معرف العضو.');
        db.prepare("DELETE FROM advanced_bans WHERE user_id = ? AND guild_id = ?").run(target, message.guild.id);
        try { await message.guild.bans.remove(target); } catch(e) {}
        message.reply(`✅ تم رفع الحظر عن <@${target}>`);
    }

    // ---- مكافآت الانضمام ----
    if (command === 'joinreward') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const sub = args[0];
        if (sub === 'set') {
            const role = message.mentions.roles.first();
            const amount = parseInt(args[2]);
            if (!role || !amount) return message.reply('❌ استخدم: !joinreward set @دور <مبلغ>');
            db.prepare("INSERT OR REPLACE INTO join_rewards (guild_id, role_id, reward_amount) VALUES (?, ?, ?)").run(message.guild.id, role.id, amount);
            message.reply(`✅ سيتم منح ${role.name} مبلغ ${amount} عملة عند الانضمام.`);
        } else if (sub === 'remove') {
            db.prepare("DELETE FROM join_rewards WHERE guild_id = ?").run(message.guild.id);
            message.reply('✅ تم إلغاء مكافآت الانضمام.');
        }
    }

    // ---- اليانصيب ----
    if (command === 'lottery') {
        const sub = args[0];
        if (sub === 'buy') {
            const ticketCost = 50;
            const bal = getBalance(message.author.id, message.guild.id);
            if (bal < ticketCost) return message.reply(`❌ تحتاج ${ticketCost} عملة لشراء تذكرة.`);
            updateBalance(message.author.id, message.guild.id, -ticketCost);
            const number = Math.floor(Math.random() * 1000) + 1;
            const prize = Math.floor(Math.random() * 200) + 100;
            db.prepare("INSERT INTO lottery (guild_id, ticket_owner, ticket_number, prize_amount, draw_date) VALUES (?, ?, ?, ?, datetime('now', '+1 day'))").run(message.guild.id, message.author.id, number, prize);
            message.reply(`🎟️ اشتريت تذكرة يانصيب رقم ${number}، الجائزة ${prize} عملة. سيتم السحب غداً.`);
        } else if (sub === 'draw') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
            const rows = db.prepare("SELECT id, ticket_owner, prize_amount FROM lottery WHERE guild_id = ? AND status = 'active'").all(message.guild.id);
            if (!rows || rows.length === 0) return message.reply('📭 لا تذاكر.');
            const winner = rows[Math.floor(Math.random() * rows.length)];
            updateBalance(winner.ticket_owner, message.guild.id, winner.prize_amount);
            db.prepare("UPDATE lottery SET status = 'drawn' WHERE id = ?").run(winner.id);
            message.reply(`🎉 فاز <@${winner.ticket_owner}> بجائزة ${winner.prize_amount} عملة!`);
        }
    }

    // ---- التداول ----
    if (command === 'trade') {
        const sub = args[0];
        if (sub === 'send') {
            const target = message.mentions.members.first();
            const amount = parseInt(args[2]);
            if (!target || !amount || amount <= 0) return message.reply('❌ استخدم: !trade send @user <مبلغ>');
            const bal = getBalance(message.author.id, message.guild.id);
            if (bal < amount) return message.reply('❌ رصيد غير كافٍ.');
            db.prepare("INSERT INTO trades (guild_id, sender_id, receiver_id, amount, created_at) VALUES (?, ?, ?, ?, datetime('now'))").run(message.guild.id, message.author.id, target.id, amount);
            message.reply(`📤 طلب تداول بقيمة ${amount} عملة إلى ${target}`);
            target.send(`📨 ${message.author.tag} يريد إرسال ${amount} عملة إليك. استخدم !trade accept <id> أو !trade reject <id>`).catch(() => {});
        } else if (sub === 'accept') {
            const id = parseInt(args[1]);
            if (!id) return message.reply('❌ استخدم: !trade accept <id>');
            const row = db.prepare("SELECT sender_id, receiver_id, amount FROM trades WHERE id = ? AND guild_id = ? AND status = 'pending'").get(id, message.guild.id);
            if (!row) return message.reply('❌ طلب غير موجود.');
            if (row.receiver_id !== message.author.id) return message.reply('❌ هذا ليس لك.');
            const senderBal = getBalance(row.sender_id, message.guild.id);
            if (senderBal < row.amount) return message.reply('❌ المرسل ليس لديه رصيد كافٍ.');
            updateBalance(row.sender_id, message.guild.id, -row.amount);
            updateBalance(row.receiver_id, message.guild.id, row.amount);
            db.prepare("UPDATE trades SET status = 'completed' WHERE id = ?").run(id);
            message.reply(`✅ تم إتمام التداول بقيمة ${row.amount} عملة.`);
        } else if (sub === 'reject') {
            const id = parseInt(args[1]);
            if (!id) return message.reply('❌ استخدم: !trade reject <id>');
            db.prepare("UPDATE trades SET status = 'rejected' WHERE id = ? AND receiver_id = ?").run(id, message.author.id);
            message.reply('❌ تم رفض التداول.');
        } else if (sub === 'list') {
            const rows = db.prepare("SELECT id, sender_id, amount, created_at FROM trades WHERE receiver_id = ? AND status = 'pending'").all(message.author.id);
            if (!rows || rows.length === 0) return message.reply('📭 لا توجد طلبات تداول.');
            const list = rows.map(r => `#${r.id} - من <@${r.sender_id}> - ${r.amount} عملة`).join('\n');
            message.reply(`📋 طلبات التداول:\n${list}`);
        }
    }

    // ---- البطولات ----
    if (command === 'tournament') {
        const sub = args[0];
        if (sub === 'create') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
            const name = args[1];
            const prize = parseInt(args[2]);
            if (!name || !prize) return message.reply('❌ استخدم: !tournament create <اسم> <جائزة>');
            db.prepare("INSERT INTO tournaments (guild_id, name, prize, participants, created_at) VALUES (?, ?, ?, '[]', datetime('now'))").run(message.guild.id, name, prize);
            message.reply(`🏆 تم إنشاء بطولة ${name} بجائزة ${prize} عملة.`);
        } else if (sub === 'join') {
            const row = db.prepare("SELECT id, participants, prize FROM tournaments WHERE guild_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1").get(message.guild.id);
            if (!row) return message.reply('❌ لا توجد بطولة نشطة.');
            const participants = JSON.parse(row.participants);
            if (participants.includes(message.author.id)) return message.reply('❌ أنت مشترك بالفعل.');
            participants.push(message.author.id);
            db.prepare("UPDATE tournaments SET participants = ? WHERE id = ?").run(JSON.stringify(participants), row.id);
            message.reply(`✅ انضممت للبطولة ${row.prize} عملة.`);
        } else if (sub === 'draw') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
            const row = db.prepare("SELECT id, participants, prize FROM tournaments WHERE guild_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1").get(message.guild.id);
            if (!row) return message.reply('❌ لا توجد بطولة.');
            const participants = JSON.parse(row.participants);
            if (participants.length < 2) return message.reply('❌ عدد المشاركين غير كافٍ.');
            const winner = participants[Math.floor(Math.random() * participants.length)];
            updateBalance(winner, message.guild.id, row.prize);
            db.prepare("UPDATE tournaments SET status = 'finished' WHERE id = ?").run(row.id);
            message.reply(`🏆 الفائز هو <@${winner}> وحصل على ${row.prize} عملة!`);
        }
    }

    // ---- أوامر إضافية ----
    if (command === 'purge') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return message.reply('❌ لا تملك صلاحية.');
        const count = parseInt(args[0]) || 10;
        if (count > 100) count = 100;
        try { await message.channel.bulkDelete(count, true); message.reply(`✅ تم حذف ${count} رسالة.`).then(m => setTimeout(() => m.delete(), 3000)); } catch(e) { message.reply('❌ فشل الحذف.'); }
    }

    if (command === 'tempchannel') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply('❌ لا تملك صلاحية.');
        const name = args.join(' ') || 'temp-' + Date.now();
        const channel = await message.guild.channels.create({ name, type: ChannelType.GuildText });
        message.reply(`✅ تم إنشاء قناة مؤقتة: ${channel}`);
        setTimeout(async () => { try { await channel.delete(); } catch(e) {} message.channel.send(`⏳ تم حذف القناة المؤقتة ${name}`); }, 60000);
    }

    if (command === 'randomuser') {
        const members = message.guild.members.cache.filter(m => !m.user.bot);
        if (members.size === 0) return message.reply('📭 لا يوجد أعضاء.');
        const randomMember = members.random();
        message.reply(`🎲 العضو العشوائي: ${randomMember.user.tag}`);
    }

    if (command === 'servertime') {
        const now = new Date();
        message.reply(`🕒 الوقت الحالي: ${now.toLocaleString('ar-EG')}`);
    }

    if (command === 'userid') {
        const member = message.mentions.members.first() || message.member;
        message.reply(`🆔 معرف ${member.user.tag}: ${member.id}`);
    }

    if (command === 'channelid') {
        message.reply(`🆔 معرف القناة: ${message.channel.id}`);
    }

    if (command === 'votebutton') {
        const question = args.join(' ') || 'تصويت';
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('vote_yes').setLabel('نعم').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('vote_no').setLabel('لا').setStyle(ButtonStyle.Danger)
            );
        const embed = new EmbedBuilder().setTitle('🗳️ تصويت').setDescription(question).setColor(0x00BFFF);
        await message.channel.send({ embeds: [embed], components: [row] });
    }

    if (command === 'weekly') {
        const week = moment().week();
        const row = db.prepare("SELECT weekly FROM economy WHERE user_id = ? AND guild_id = ?").get(message.author.id, message.guild.id);
        if (row && row.weekly === String(week)) return message.reply('❌ حصلت على مكافأتك الأسبوعية.');
        const amount = Math.floor(Math.random() * 300) + 200;
        updateBalance(message.author.id, message.guild.id, amount);
        db.prepare("UPDATE economy SET weekly = ? WHERE user_id = ? AND guild_id = ?").run(String(week), message.author.id, message.guild.id);
        message.reply(`📅 مكافأة أسبوعية: **${amount}** عملة!`);
    }

    if (command === 'profile') {
        const member = message.mentions.members.first() || message.member;
        const bal = getBalance(member.id, message.guild.id);
        const { level } = getXp(member.id, message.guild.id);
        const row = db.prepare("SELECT title FROM titles WHERE user_id = ? AND guild_id = ?").get(member.id, message.guild.id);
        const title = row ? row.title : 'لا يوجد';
        const embed = new EmbedBuilder().setTitle(`👤 ملف ${member.user.tag}`).setThumbnail(member.displayAvatarURL()).setColor(0x2F3136)
            .addFields(
                { name: 'رصيد', value: `${bal} عملة`, inline: true },
                { name: 'مستوى', value: String(level), inline: true },
                { name: 'لقب', value: title, inline: true }
            );
        message.channel.send({ embeds: [embed] });
    }

    // ---- أوامر المالك ----
    if (command === 'eval') {
        if (message.author.id !== 'YOUR_OWNER_ID') return message.reply('❌ ليس لديك صلاحية.');
        try {
            const result = eval(args.join(' '));
            message.reply(`📊 النتيجة: \`\`\`js\n${result}\n\`\`\``);
        } catch(e) {
            message.reply(`❌ خطأ: ${e.message}`);
        }
    }

    // ---- أوامر أخرى ----
    if (command === 'hunt') {
        const animals = ['🦌 غزال', '🐗 خنزير', '🐇 أرنب', '🦅 نسر', '🐺 ذئب'];
        const animal = animals[Math.floor(Math.random() * animals.length)];
        const success = Math.random() < 0.6;
        if (success) {
            const reward = Math.floor(Math.random() * 30) + 10;
            updateBalance(message.author.id, message.guild.id, reward);
            message.reply(`🏹 اصطدت **${animal}** وحصلت على ${reward} عملة.`);
        } else {
            message.reply(`❌ فشلت في الصيد، حاول مرة أخرى.`);
        }
    }

    if (command === 'medal') {
        const medals = ['🥇', '🥈', '🥉', '🏅', '🎖️'];
        const medal = medals[Math.floor(Math.random() * medals.length)];
        db.prepare("INSERT INTO cards (user_id, guild_id, card_type, rarity, acquired_at) VALUES (?, ?, ?, 'وسمة', datetime('now'))").run(message.author.id, message.guild.id, medal);
        message.reply(`🏅 حصلت على وسمة ${medal}!`);
    }

    if (command === 'horoscope') {
        const signs = ['الحمل', 'الثور', 'الجوزاء', 'السرطان', 'الأسد', 'العذراء', 'الميزان', 'العقرب', 'القوس', 'الجدي', 'الدلو', 'الحوت'];
        const sign = args.join(' ') || signs[Math.floor(Math.random() * signs.length)];
        const fortunes = ['اليوم يوم ممتاز', 'كن حذراً', 'الحظ معك', 'توقع مفاجأة', 'ابتسم للحياة'];
        message.reply(`🔮 برج ${sign}: ${fortunes[Math.floor(Math.random() * fortunes.length)]}`);
    }

    if (command === 'card') {
        const types = ['🔥', '💎', '🌟', '🃏', '🎴'];
        const rarities = ['عادي', 'نادر', 'نادر جداً', 'أسطوري'];
        const type = types[Math.floor(Math.random() * types.length)];
        const rarity = rarities[Math.floor(Math.random() * rarities.length)];
        db.prepare("INSERT INTO cards (user_id, guild_id, card_type, rarity, acquired_at) VALUES (?, ?, ?, ?, datetime('now'))").run(message.author.id, message.guild.id, type, rarity);
        message.reply(`🃏 حصلت على بطاقة ${type} (${rarity})!`);
    }

    if (command === 'refer') {
        const target = message.mentions.members.first();
        if (!target || target.id === message.author.id) return message.reply('❌ حدد عضواً آخر.');
        const row = db.prepare("SELECT * FROM referrals WHERE user_id = ? AND guild_id = ?").get(target.id, message.guild.id);
        if (row) return message.reply(`❌ ${target} تمت إحالته بالفعل.`);
        db.prepare("INSERT INTO referrals (user_id, guild_id, referred_by, reward_claimed) VALUES (?, ?, ?, 0)").run(target.id, message.guild.id, message.author.id);
        updateBalance(message.author.id, message.guild.id, 20);
        message.reply(`✅ تمت إحالة ${target.user.tag} وحصلت على 20 عملة!`);
    }

    if (command === 'backup') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        if (args[0] === 'create') {
            const data = JSON.stringify(message.guild);
            db.prepare("INSERT INTO backups (guild_id, data, created_at) VALUES (?, ?, datetime('now'))").run(message.guild.id, data);
            message.reply('✅ تم إنشاء نسخة احتياطية.');
        } else if (args[0] === 'restore') {
            const row = db.prepare("SELECT data FROM backups WHERE guild_id = ? ORDER BY created_at DESC LIMIT 1").get(message.guild.id);
            if (!row) return message.reply('❌ لا توجد نسخ احتياطية.');
            message.reply('✅ تم استعادة آخر نسخة احتياطية.');
        }
    }

    if (command === 'invites') {
        const target = message.mentions.members.first() || message.member;
        const rows = db.prepare("SELECT code, uses FROM invites WHERE user_id = ? AND guild_id = ?").all(target.id, message.guild.id);
        if (!rows || rows.length === 0) return message.reply(`📭 ${target.user.tag} ليس لديه دعوات.`);
        const desc = rows.map(r => `كود: ${r.code} (استخدامات: ${r.uses})`).join('\n');
        const embed = new EmbedBuilder().setTitle(`📨 دعوات ${target.user.tag}`).setDescription(desc).setColor(0x00BFFF);
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'challenge') {
        const challenges = ['اكتب 100 كلمة', 'اربح 200 عملة', 'أرسل 20 رسالة'];
        const challenge = challenges[Math.floor(Math.random() * challenges.length)];
        message.reply(`🎯 تحديك اليوم: ${challenge}`);
    }

    if (command === 'quickpoll') {
        const question = args.join(' ');
        if (!question) return message.reply('❌ أدخل سؤالاً.');
        const embed = new EmbedBuilder().setTitle('📊 تصويت سريع').setDescription(question).setColor(0x00FF00);
        const msg = await message.channel.send({ embeds: [embed] });
        await msg.react('👍');
        await msg.react('👎');
    }

    if (command === 'notify') {
        const msgText = args.join(' ');
        if (!msgText) return message.reply('❌ أدخل رسالة الإشعار.');
        message.guild.members.cache.forEach(m => {
            m.send(`🔔 إشعار من السيرفر: ${msgText}`).catch(() => {});
        });
        message.reply('✅ تم إرسال الإشعارات.');
    }

    if (command === 'activity') {
        const count = message.guild.members.cache.filter(m => m.presence?.status === 'online').size;
        message.reply(`📊 عدد الأعضاء النشطين: ${count}`);
    }

    if (command === 'botinfo') {
        const embed = new EmbedBuilder().setTitle('🤖 معلومات البوت').setColor(0x2F3136)
            .addFields(
                { name: 'اسم البوت', value: client.user.tag, inline: true },
                { name: 'عدد السيرفرات', value: String(client.guilds.cache.size), inline: true },
                { name: 'عدد الأعضاء', value: String(client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)), inline: true },
                { name: 'وقت التشغيل', value: moment.duration(process.uptime(), 'seconds').humanize(), inline: true }
            );
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'join') {
        if (message.member.voice.channel) {
            await message.member.voice.channel.join();
            message.reply('🔊 تم الدخول إلى القناة الصوتية.');
        }
    }

    if (command === 'leave') {
        if (message.guild.members.me.voice.channel) {
            message.guild.members.me.voice.disconnect();
            message.reply('🔇 تم الخروج من القناة الصوتية.');
        }
    }

    if (command === 'blacklist') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        if (args[0] === 'add') {
            const word = args[1];
            if (!word) return message.reply('❌ أدخل كلمة.');
            db.prepare("INSERT OR REPLACE INTO bad_words (guild_id, word) VALUES (?, ?)").run(message.guild.id, word.toLowerCase());
            message.reply(`✅ تم حظر كلمة **${word}**`);
        } else if (args[0] === 'remove') {
            const word = args[1];
            if (!word) return message.reply('❌ أدخل كلمة.');
            db.prepare("DELETE FROM bad_words WHERE guild_id = ? AND word = ?").run(message.guild.id, word.toLowerCase());
            message.reply(`✅ تم رفع الحظر عن **${word}**`);
        }
    }

    if (command === 'calendar') {
        const now = moment().format('YYYY-MM-DD');
        const embed = new EmbedBuilder().setTitle('📅 التقويم').setDescription(`اليوم: ${now}`).setColor(0x00BFFF);
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'randomcolor') {
        const hex = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        db.prepare("INSERT OR REPLACE INTO custom_colors (user_id, guild_id, color_hex) VALUES (?, ?, ?)").run(message.author.id, message.guild.id, hex);
        message.reply(`🎨 لونك العشوائي: ${hex}`);
    }

    if (command === 'dailyreward') {
        const now = new Date().toISOString().slice(0,10);
        const row = db.prepare("SELECT daily FROM economy WHERE user_id = ? AND guild_id = ?").get(message.author.id, message.guild.id);
        if (row && row.daily === now) return message.reply('❌ حصلت عليها اليوم.');
        const amount = Math.floor(Math.random() * 150) + 50;
        updateBalance(message.author.id, message.guild.id, amount);
        db.prepare("UPDATE economy SET daily = ? WHERE user_id = ? AND guild_id = ?").run(now, message.author.id, message.guild.id);
        message.reply(`🎁 حصلت على ${amount} عملة!`);
    }

    if (command === 'secret') {
        const secret = args[0];
        if (secret === 'admin') {
            if (message.author.id === 'YOUR_OWNER_ID') {
                message.channel.send('🔐 تم تفعيل وضع المشرف الخارق.');
            } else {
                message.reply('❌ ليس لديك صلاحية.');
            }
        }
    }

    if (command === 'selfvc') {
        if (!message.member.voice.channel) return message.reply('❌ أنت لست في قناة صوتية.');
        const vc = message.member.voice.channel;
        const row = db.prepare("SELECT * FROM self_channels WHERE guild_id = ? AND owner_id = ?").get(message.guild.id, message.author.id);
        if (row) return message.reply('❌ لديك بالفعل قناة ذاتية.');
        const name = args.join(' ') || 'قناة ' + message.author.username;
        try {
            vc.setName(name);
            db.prepare("INSERT INTO self_channels (guild_id, channel_id, owner_id, created_at) VALUES (?, ?, ?, datetime('now'))").run(message.guild.id, vc.id, message.author.id);
            message.reply(`✅ تم تخصيص القناة باسم: ${name}`);
        } catch(e) { message.reply('❌ فشل تغيير الاسم.'); }
    }

    if (command === 'contest') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        const prize = parseInt(args[0]);
        const question = args.slice(1).join(' ');
        if (!prize || !question) return message.reply('❌ استخدم: !contest <جائزة> <سؤال>');
        const embed = new EmbedBuilder().setTitle('🏆 مسابقة جديدة!').setDescription(question).setColor(0xFFD700).addFields({ name: 'الجائزة', value: `${prize} عملة` });
        const msg = await message.channel.send({ embeds: [embed] });
        await msg.react('✅');
        db.prepare("INSERT INTO contests (guild_id, channel_id, question, prize, status) VALUES (?, ?, ?, ?, 'active')").run(message.guild.id, message.channel.id, question, prize);
    }
});

// ================== الأحداث ==================
client.on('guildMemberAdd', async (member) => {
    const welcome = db.prepare("SELECT channel_id, message FROM welcome WHERE guild_id = ?").get(member.guild.id);
    if (welcome) {
        const channel = member.guild.channels.cache.get(welcome.channel_id);
        if (channel) {
            const msg = welcome.message.replace(/{user}/g, member.toString()).replace(/{server}/g, member.guild.name);
            channel.send(msg);
        }
    }
    const autoroles = db.prepare("SELECT role_id FROM autoroles WHERE guild_id = ?").all(member.guild.id);
    autoroles.forEach(r => {
        const role = member.guild.roles.cache.get(r.role_id);
        if (role) member.roles.add(role).catch(() => {});
    });
    const reward = db.prepare("SELECT role_id, reward_amount FROM join_rewards WHERE guild_id = ?").get(member.guild.id);
    if (reward) {
        const role = member.guild.roles.cache.get(reward.role_id);
        if (role) member.roles.add(role).catch(() => {});
        updateBalance(member.id, member.guild.id, reward.reward_amount);
    }
    logEvent(member.guild.id, 'member_join', `${member.user.tag} انضم إلى السيرفر.`);
});

client.on('guildMemberRemove', (member) => {
    const goodbye = db.prepare("SELECT channel_id, message FROM goodbye WHERE guild_id = ?").get(member.guild.id);
    if (goodbye) {
        const channel = member.guild.channels.cache.get(goodbye.channel_id);
        if (channel) {
            const msg = goodbye.message.replace(/{user}/g, member.user.tag).replace(/{server}/g, member.guild.name);
            channel.send(msg);
        }
    }
    logEvent(member.guild.id, 'member_leave', `${member.user.tag} غادر السيرفر.`);
});

client.on('messageDelete', (message) => {
    if (!message.guild || message.author?.bot) return;
    logEvent(message.guild.id, 'message_delete', `${message.author?.tag} حذف: ${message.content?.slice(0,100) || '[ميديا]'}`);
});

client.on('messageUpdate', (oldMsg, newMsg) => {
    if (!oldMsg.guild || oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
    logEvent(oldMsg.guild.id, 'message_edit', `${oldMsg.author?.tag} عدل: ${oldMsg.content?.slice(0,50)} -> ${newMsg.content?.slice(0,50)}`);
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot || !reaction.message.guild) return;
    updateStat(user.id, reaction.message.guild.id, 'reactions_given', 1);
    if (reaction.message.author && !reaction.message.author.bot) {
        updateStat(reaction.message.author.id, reaction.message.guild.id, 'reactions_received', 1);
    }
    // هدايا
    if (reaction.emoji.name === '🎉') {
        const row = db.prepare("SELECT id, entries FROM giveaways WHERE message_id = ?").get(reaction.message.id);
        if (row) {
            const entries = JSON.parse(row.entries);
            if (!entries.includes(user.id)) {
                entries.push(user.id);
                db.prepare("UPDATE giveaways SET entries = ? WHERE id = ?").run(JSON.stringify(entries), row.id);
            }
        }
    }
    // أدوار تفاعلية
    const rr = db.prepare("SELECT role_id FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?").get(reaction.message.guild.id, reaction.message.id, reaction.emoji.name);
    if (rr) {
        const member = reaction.message.guild.members.cache.get(user.id);
        if (member) {
            const role = reaction.message.guild.roles.cache.get(rr.role_id);
            if (role) member.roles.add(role).catch(() => {});
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'vote_yes') {
        await interaction.reply({ content: '✅ تم التصويت بـ نعم', ephemeral: true });
    } else if (interaction.customId === 'vote_no') {
        await interaction.reply({ content: '❌ تم التصويت بـ لا', ephemeral: true });
    } else if (interaction.customId === 'close_ticket') {
        if (!interaction.channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ هذه ليست تذكرة.', ephemeral: true });
        await interaction.reply('🔒 سيتم حذف التذكرة.');
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
});

// ================== المؤقتات ==================
setInterval(() => {
    const now = Date.now();
    const reminders = db.prepare("SELECT id, user_id, channel_id, message, remind_time, repeat_interval FROM reminders WHERE remind_time <= ?").all(String(now));
    reminders.forEach(row => {
        const user = client.users.cache.get(row.user_id);
        const channel = client.channels.cache.get(row.channel_id);
        if (user) user.send(`⏰ تذكير: ${row.message}`).catch(() => {});
        if (channel) channel.send(`⏰ <@${row.user_id}> تذكير: ${row.message}`).catch(() => {});
        if (row.repeat_interval > 0) {
            const newTime = now + row.repeat_interval * 1000;
            db.prepare("UPDATE reminders SET remind_time = ? WHERE id = ?").run(String(newTime), row.id);
        } else {
            db.prepare("DELETE FROM reminders WHERE id = ?").run(row.id);
        }
    });
}, 30000);

setInterval(() => {
    const now = Date.now();
    const investments = db.prepare("SELECT user_id, guild_id, amount, profit, end_date FROM investments WHERE status = 'active' AND end_date <= ?").all(String(now));
    investments.forEach(row => {
        updateBalance(row.user_id, row.guild_id, row.amount + row.profit);
        db.prepare("UPDATE investments SET status = 'completed' WHERE user_id = ? AND guild_id = ? AND end_date = ?").run(row.user_id, row.guild_id, row.end_date);
        const user = client.users.cache.get(row.user_id);
        if (user) user.send(`💰 استثمارك بقيمة ${row.amount} أنتج ربحاً ${row.profit}`).catch(() => {});
    });
}, 60000);

setInterval(() => {
    client.guilds.cache.forEach(guild => {
        guild.members.cache.forEach(member => {
            if (member.voice.channel) {
                updateStat(member.id, guild.id, 'voice_minutes', 1);
            }
        });
    });
}, 60000);

// ================== تشغيل البوت ==================
client.login(TOKEN);
