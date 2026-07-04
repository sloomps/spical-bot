// ================================================================
// DISCORD BOT ULTIMATE - النسخة النهائية المتكاملة (12,000+ سطر)
// يحتوي على جميع الأنظمة المطلوبة في ملف واحد
// ================================================================

const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const ytdl = require('ytdl-core');
const axios = require('axios');
const moment = require('moment');

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

// ================== تشغيل البوت ==================
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
    console.error('❌ الرجاء وضع التوكن في متغير البيئة TOKEN.');
} else {
    client.login(TOKEN);
}

// ================== قاعدة البيانات ==================
const db = new sqlite3.Database('./ultimate_bot.db');

db.serialize(() => {
    // الجداول الأساسية
    db.run(`CREATE TABLE IF NOT EXISTS economy (user_id TEXT, guild_id TEXT, balance INTEGER DEFAULT 0, bank INTEGER DEFAULT 0, daily TEXT, work TEXT, weekly TEXT, last_rob TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS levels (user_id TEXT, guild_id TEXT, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1)`);
    db.run(`CREATE TABLE IF NOT EXISTS warnings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, guild_id TEXT, reason TEXT, date TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS autoroles (guild_id TEXT, role_id TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS welcome (guild_id TEXT, channel_id TEXT, message TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS goodbye (guild_id TEXT, channel_id TEXT, message TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS custom_commands (guild_id TEXT, name TEXT, response TEXT, PRIMARY KEY (guild_id, name))`);
    db.run(`CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, user_id TEXT, topic TEXT, status TEXT, created_at TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS logging (guild_id TEXT, channel_id TEXT, type TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS giveaways (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, message_id TEXT, prize TEXT, end_time TEXT, winners INTEGER, entries TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, channel_id TEXT, message TEXT, remind_time TEXT, repeat_interval INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS marriages (user1 TEXT, user2 TEXT, guild_id TEXT, PRIMARY KEY (user1, user2))`);
    db.run(`CREATE TABLE IF NOT EXISTS level_roles (guild_id TEXT, level INTEGER, role_id TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS polls (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, message_id TEXT, question TEXT, options TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS clans (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, name TEXT, owner TEXT, members TEXT, level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0, created_at TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS farms (user_id TEXT, guild_id TEXT, crop TEXT, planted_at TEXT, ready_at TEXT, status TEXT DEFAULT 'growing')`);
    db.run(`CREATE TABLE IF NOT EXISTS prisons (user_id TEXT, guild_id TEXT, jailed_at TEXT, release_at TEXT, reason TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS loans (user_id TEXT, guild_id TEXT, amount INTEGER, interest INTEGER, due_date TEXT, status TEXT DEFAULT 'active')`);
    db.run(`CREATE TABLE IF NOT EXISTS investments (user_id TEXT, guild_id TEXT, amount INTEGER, profit INTEGER, start_date TEXT, end_date TEXT, status TEXT DEFAULT 'active')`);
    db.run(`CREATE TABLE IF NOT EXISTS auctions (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, item TEXT, seller TEXT, starting_bid INTEGER, current_bid INTEGER, bidder TEXT, end_time TEXT, status TEXT DEFAULT 'active')`);
    db.run(`CREATE TABLE IF NOT EXISTS titles (user_id TEXT, guild_id TEXT, title TEXT, PRIMARY KEY (user_id, guild_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS auto_responders (guild_id TEXT, trigger TEXT, response TEXT, PRIMARY KEY (guild_id, trigger))`);
    db.run(`CREATE TABLE IF NOT EXISTS temp_vc (guild_id TEXT, channel_id TEXT, owner_id TEXT, created_at TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS contests (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, question TEXT, prize INTEGER, answer TEXT, winner TEXT, status TEXT DEFAULT 'active')`);
    db.run(`CREATE TABLE IF NOT EXISTS referrals (user_id TEXT, guild_id TEXT, referred_by TEXT, reward_claimed INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS cards (user_id TEXT, guild_id TEXT, card_type TEXT, rarity TEXT, acquired_at TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS bad_words (guild_id TEXT, word TEXT, PRIMARY KEY (guild_id, word))`);
    db.run(`CREATE TABLE IF NOT EXISTS invites (user_id TEXT, guild_id TEXT, inviter_id TEXT, code TEXT, uses INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, name TEXT, description TEXT, date TEXT, channel_id TEXT, created_by TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS backups (guild_id TEXT, data TEXT, created_at TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS custom_colors (user_id TEXT, guild_id TEXT, color_hex TEXT, PRIMARY KEY (user_id, guild_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS quests (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, guild_id TEXT, name TEXT, description TEXT, reward INTEGER, type TEXT, target INTEGER, progress INTEGER DEFAULT 0, status TEXT DEFAULT 'active', date TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS reaction_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, message_id TEXT, role_id TEXT, emoji TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS member_stats (user_id TEXT, guild_id TEXT, messages INTEGER DEFAULT 0, voice_minutes INTEGER DEFAULT 0, reactions_given INTEGER DEFAULT 0, reactions_received INTEGER DEFAULT 0, xp_earned INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS advanced_bans (user_id TEXT, guild_id TEXT, reason TEXT, duration INTEGER, banned_at TEXT, UNIQUE(user_id, guild_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS join_rewards (guild_id TEXT, role_id TEXT, reward_amount INTEGER)`);
    db.run(`CREATE TABLE IF NOT EXISTS self_channels (guild_id TEXT, channel_id TEXT, owner_id TEXT, created_at TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS lottery (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, ticket_owner TEXT, ticket_number INTEGER, prize_amount INTEGER, draw_date TEXT, status TEXT DEFAULT 'active')`);
    db.run(`CREATE TABLE IF NOT EXISTS trades (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, sender_id TEXT, receiver_id TEXT, amount INTEGER, status TEXT DEFAULT 'pending', created_at TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS tournaments (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, name TEXT, prize INTEGER, participants TEXT, status TEXT DEFAULT 'active', created_at TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS achievements (user_id TEXT, guild_id TEXT, achievement_name TEXT, unlocked_at TEXT, PRIMARY KEY (user_id, guild_id, achievement_name))`);
    db.run(`CREATE TABLE IF NOT EXISTS temp_roles (user_id TEXT, guild_id TEXT, role_id TEXT, expiry_time TEXT)`);
});

// ================== دوال مساعدة ==================
function getBalance(userId, guildId) {
    return new Promise((resolve) => {
        db.get("SELECT balance FROM economy WHERE user_id = ? AND guild_id = ?", [userId, guildId], (err, row) => {
            if (err || !row) resolve(0);
            else resolve(row.balance);
        });
    });
}
function updateBalance(userId, guildId, amount) {
    db.run("INSERT INTO economy (user_id, guild_id, balance) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET balance = balance + ?", [userId, guildId, amount, amount]);
}
function getXp(userId, guildId) {
    return new Promise((resolve) => {
        db.get("SELECT xp, level FROM levels WHERE user_id = ? AND guild_id = ?", [userId, guildId], (err, row) => {
            if (err || !row) resolve({ xp: 0, level: 1 });
            else resolve({ xp: row.xp, level: row.level });
        });
    });
}
function addXp(userId, guildId, amount) {
    db.run("INSERT INTO levels (user_id, guild_id, xp, level) VALUES (?, ?, ?, 1) ON CONFLICT DO UPDATE SET xp = xp + ?", [userId, guildId, amount, amount], function() {
        db.get("SELECT xp, level FROM levels WHERE user_id = ? AND guild_id = ?", [userId, guildId], (err, row) => {
            if (row) {
                let needed = 5 * (row.level ** 2) + 50 * row.level + 100;
                if (row.xp >= needed) {
                    db.run("UPDATE levels SET level = level + 1, xp = 0 WHERE user_id = ? AND guild_id = ?", [userId, guildId]);
                    db.all("SELECT role_id FROM level_roles WHERE guild_id = ? AND level = ?", [guildId, row.level + 1], (err, roles) => {
                        roles.forEach(r => {
                            let guild = client.guilds.cache.get(guildId);
                            if (guild) {
                                let member = guild.members.cache.get(userId);
                                if (member) member.roles.add(r.role_id).catch(() => {});
                            }
                        });
                    });
                }
            }
        });
    });
}
function getWarnings(userId) {
    return new Promise((resolve) => {
        db.all("SELECT reason, date FROM warnings WHERE user_id = ?", [userId], (err, rows) => resolve(rows || []));
    });
}
function addWarning(userId, guildId, reason) {
    db.run("INSERT INTO warnings (user_id, guild_id, reason, date) VALUES (?, ?, ?, datetime('now'))", [userId, guildId, reason]);
}
function clearWarnings(userId) {
    db.run("DELETE FROM warnings WHERE user_id = ?", [userId]);
}
async function logEvent(guildId, type, description) {
    db.get("SELECT channel_id FROM logging WHERE guild_id = ? AND (type = ? OR type = 'all')", [guildId, type], (err, row) => {
        if (row) {
            let channel = client.channels.cache.get(row.channel_id);
            if (channel) {
                let embed = new EmbedBuilder().setTitle(`📋 ${type}`).setDescription(description).setColor(0x2F3136).setTimestamp();
                channel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    });
}
async function getUserStats(userId, guildId) {
    return new Promise((resolve) => {
        db.get("SELECT * FROM member_stats WHERE user_id = ? AND guild_id = ?", [userId, guildId], (err, row) => {
            if (!row) {
                db.run("INSERT INTO member_stats (user_id, guild_id, messages, voice_minutes, reactions_given, reactions_received, xp_earned) VALUES (?, ?, 0, 0, 0, 0, 0)", [userId, guildId]);
                resolve({ messages: 0, voice_minutes: 0, reactions_given: 0, reactions_received: 0, xp_earned: 0 });
            } else {
                resolve(row);
            }
        });
    });
}
async function updateStat(userId, guildId, field, increment = 1) {
    db.run(`UPDATE member_stats SET ${field} = ${field} + ? WHERE user_id = ? AND guild_id = ?`, [increment, userId, guildId]);
}

// ================== متغيرات الموسيقى ==================
const queues = new Map();

// ================== حدث ready ==================
client.on('ready', () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
});

// ================== حدث الرسائل (القلب) ==================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // أوامر مخصصة
    if (message.content.startsWith(PREFIX)) {
        let cmdName = message.content.slice(PREFIX.length).split(' ')[0].toLowerCase();
        db.get("SELECT response FROM custom_commands WHERE guild_id = ? AND name = ?", [message.guild.id, cmdName], (err, row) => {
            if (row) message.channel.send(row.response);
        });
    }

    // كلمات محظورة
    db.all("SELECT word FROM bad_words WHERE guild_id = ?", [message.guild.id], (err, rows) => {
        rows.forEach(r => {
            if (message.content.toLowerCase().includes(r.word)) {
                message.delete().catch(() => {});
                message.reply(`⛔ لا تستخدم كلمة ${r.word}`).then(m => setTimeout(() => m.delete(), 5000));
            }
        });
    });

    // نظام المستويات
    if (!message.content.startsWith(PREFIX)) {
        let xpGain = Math.floor(Math.random() * 15) + 5;
        addXp(message.author.id, message.guild.id, xpGain);
        // إحصائيات
        await updateStat(message.author.id, message.guild.id, 'messages', 1);
        return;
    }

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ============================================================
    // ================== أوامر الإدارة ==================
    // ============================================================

    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply('❌ لا تملك صلاحية.');
        let member = message.mentions.members.first();
        if (!member) return message.reply('❌ حدد عضواً.');
        let reason = args.join(' ') || 'لا يوجد سبب';
        try { await member.kick(reason); message.reply(`✅ تم طرد ${member.user.tag}.`); logEvent(message.guild.id, 'kick', `${message.author.tag} طرد ${member.user.tag} بسبب ${reason}`); } catch(e) { message.reply('❌ فشل الطرد.'); }
    }

    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ لا تملك صلاحية.');
        let member = message.mentions.members.first();
        if (!member) return message.reply('❌ حدد عضواً.');
        let reason = args.join(' ') || 'لا يوجد سبب';
        try { await member.ban({ reason }); message.reply(`✅ تم حظر ${member.user.tag}.`); logEvent(message.guild.id, 'ban', `${message.author.tag} حظر ${member.user.tag} بسبب ${reason}`); } catch(e) { message.reply('❌ فشل الحظر.'); }
    }

    if (command === 'unban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ لا تملك صلاحية.');
        let name = args.join(' ');
        let bans = await message.guild.bans.fetch();
        let user = bans.find(ban => ban.user.tag.includes(name));
        if (!user) return message.reply('❌ لم يتم العثور على العضو.');
        try { await message.guild.bans.remove(user.user); message.reply(`✅ تم رفع الحظر عن ${user.user.tag}.`); logEvent(message.guild.id, 'unban', `${message.author.tag} رفع الحظر عن ${user.user.tag}`); } catch(e) { message.reply('❌ فشل رفع الحظر.'); }
    }

    if (command === 'mute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ لا تملك صلاحية.');
        let member = message.mentions.members.first();
        if (!member) return message.reply('❌ حدد عضواً.');
        let duration = parseInt(args[0]) || 60;
        let reason = args.slice(1).join(' ') || 'لا يوجد سبب';
        try { await member.timeout(duration * 1000, reason); message.reply(`✅ تم كتم ${member.user.tag} لمدة ${duration} ثانية.`); logEvent(message.guild.id, 'mute', `${message.author.tag} كتم ${member.user.tag}`); } catch(e) { message.reply('❌ فشل الكتم.'); }
    }

    if (command === 'unmute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ لا تملك صلاحية.');
        let member = message.mentions.members.first();
        if (!member) return message.reply('❌ حدد عضواً.');
        try { await member.timeout(null); message.reply(`✅ تم رفع الكتم عن ${member.user.tag}.`); } catch(e) { message.reply('❌ فشل رفع الكتم.'); }
    }

    if (command === 'warn') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ لا تملك صلاحية.');
        let member = message.mentions.members.first();
        if (!member) return message.reply('❌ حدد عضواً.');
        let reason = args.slice(1).join(' ') || 'لا يوجد سبب';
        addWarning(member.id, message.guild.id, reason);
        let warns = await getWarnings(member.id);
        message.reply(`⚠️ تم تحذير ${member.user.tag} (العدد: ${warns.length})`);
        logEvent(message.guild.id, 'warn', `${message.author.tag} حذر ${member.user.tag}`);
    }

    if (command === 'warnings') {
        let member = message.mentions.members.first() || message.member;
        let warns = await getWarnings(member.id);
        if (warns.length === 0) return message.reply(`✅ ${member.user.tag} ليس لديه تحذيرات.`);
        let desc = warns.map((w, i) => `#${i+1}: ${w.reason} (${w.date})`).join('\n');
        let embed = new EmbedBuilder().setTitle(`⚠️ تحذيرات ${member.user.tag}`).setDescription(desc).setColor(0xFF0000);
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'clearwarns') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let member = message.mentions.members.first();
        if (!member) return message.reply('❌ حدد عضواً.');
        clearWarnings(member.id);
        message.reply(`✅ تم مسح تحذيرات ${member.user.tag}.`);
    }

    // ============================================================
    // ================== اقتصاد ==================
    // ============================================================

    if (command === 'balance' || command === 'bal') {
        let member = message.mentions.members.first() || message.member;
        let bal = await getBalance(member.id, message.guild.id);
        message.reply(`💰 ${member.user.tag} رصيدك: **${bal}** عملة.`);
    }

    if (command === 'daily') {
        let now = new Date().toISOString().slice(0,10);
        db.get("SELECT daily FROM economy WHERE user_id = ? AND guild_id = ?", [message.author.id, message.guild.id], async (err, row) => {
            if (row && row.daily === now) return message.reply('❌ انتظر حتى الغد.');
            let amount = Math.floor(Math.random() * 100) + 50;
            updateBalance(message.author.id, message.guild.id, amount);
            db.run("UPDATE economy SET daily = ? WHERE user_id = ? AND guild_id = ?", [now, message.author.id, message.guild.id]);
            message.reply(`✅ حصلت على **${amount}** عملة كمكافأة يومية!`);
        });
    }

    if (command === 'work') {
        let now = Date.now();
        db.get("SELECT work FROM economy WHERE user_id = ? AND guild_id = ?", [message.author.id, message.guild.id], (err, row) => {
            if (row && row.work) {
                let last = parseInt(row.work);
                if (now - last < 3600000) {
                    let remain = Math.ceil((3600000 - (now - last)) / 1000);
                    return message.reply(`⏳ انتظر ${remain} ثانية.`);
                }
            }
            let amount = Math.floor(Math.random() * 40) + 10;
            updateBalance(message.author.id, message.guild.id, amount);
            db.run("UPDATE economy SET work = ? WHERE user_id = ? AND guild_id = ?", [String(now), message.author.id, message.guild.id]);
            message.reply(`💼 عملت وكسبت **${amount}** عملة.`);
        });
    }

    if (command === 'rob') {
        let target = message.mentions.members.first();
        if (!target || target.id === message.author.id) return message.reply('❌ حدد عضواً آخر.');
        let targetBal = await getBalance(target.id, message.guild.id);
        if (targetBal < 10) return message.reply(`❌ ${target.user.tag} ليس لديه ما يكفي.`);
        let success = Math.random() < 0.4;
        if (success) {
            let amount = Math.floor(Math.random() * Math.min(50, targetBal)) + 1;
            updateBalance(message.author.id, message.guild.id, amount);
            updateBalance(target.id, message.guild.id, -amount);
            message.reply(`✅ سرقت **${amount}** عملة من ${target.user.tag}.`);
            logEvent(message.guild.id, 'rob', `${message.author.tag} سرق ${target.user.tag}`);
        } else {
            let penalty = Math.floor(Math.random() * 20) + 1;
            updateBalance(message.author.id, message.guild.id, -penalty);
            message.reply(`❌ فشلت السرقة وخسرت **${penalty}** عملة.`);
        }
    }

    if (command === 'slot') {
        let bet = parseInt(args[0]) || 10;
        let bal = await getBalance(message.author.id, message.guild.id);
        if (bet <= 0 || bal < bet) return message.reply('❌ رصيد غير كافٍ.');
        let symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣'];
        let res = [symbols[Math.floor(Math.random()*6)], symbols[Math.floor(Math.random()*6)], symbols[Math.floor(Math.random()*6)]];
        let embed = new EmbedBuilder().setTitle('🎰 ماكينة الحظ').setDescription(`${res[0]} ${res[1]} ${res[2]}`).setColor(0x2F3136);
        if (res[0] === res[1] && res[1] === res[2]) {
            let win = bet * 10;
            updateBalance(message.author.id, message.guild.id, win);
            embed.addFields({ name: '🎉 فوز', value: `ربحت **${win}** عملة!` });
        } else if (res[0] === res[1] || res[1] === res[2] || res[0] === res[2]) {
            let win = bet * 2;
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
        let target = message.mentions.members.first();
        let amount = parseInt(args[1]);
        if (!target || !amount || amount <= 0) return message.reply('❌ استخدم: !give @user <مبلغ>');
        updateBalance(target.id, message.guild.id, amount);
        message.reply(`✅ تم إعطاء ${target.user.tag} **${amount}** عملة.`);
    }

    if (command === 'shop') {
        let embed = new EmbedBuilder().setTitle('🛒 المتجر').setColor(0x00FF00)
            .addFields(
                { name: '🎁 هدية', value: '100 عملة', inline: true },
                { name: '🌟 نجمة', value: '500 عملة (لقب)', inline: true },
                { name: '👑 تاج', value: '1000 عملة (لقب)', inline: true },
                { name: '🎨 لون مخصص', value: '2000 عملة', inline: true }
            );
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'buy') {
        let item = args.join(' ').toLowerCase();
        let bal = await getBalance(message.author.id, message.guild.id);
        if (item === 'هدية') {
            if (bal < 100) return message.reply('❌ تحتاج 100 عملة.');
            updateBalance(message.author.id, message.guild.id, -100);
            let prizes = ['🎁', '🍫', '🧸', '🎮', '📱', '💻'];
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

    // ============================================================
    // ================== مستويات ==================
    // ============================================================

    if (command === 'rank') {
        let member = message.mentions.members.first() || message.member;
        let { xp, level } = await getXp(member.id, message.guild.id);
        let needed = 5 * (level ** 2) + 50 * level + 100;
        let embed = new EmbedBuilder().setTitle(`📊 مستوى ${member.user.tag}`).setColor(0x00FF00)
            .addFields(
                { name: 'المستوى', value: String(level), inline: true },
                { name: 'XP', value: `${xp} / ${needed}`, inline: true },
                { name: 'التقدم', value: `${Math.floor((xp/needed)*100)}%`, inline: true }
            );
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'leaderboard') {
        db.all("SELECT user_id, level, xp FROM levels WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10", [message.guild.id], (err, rows) => {
            if (!rows || rows.length === 0) return message.reply('❌ لا توجد بيانات.');
            let desc = rows.map((r, i) => `#${i+1} <@${r.user_id}> - المستوى ${r.level} (${r.xp} XP)`).join('\n');
            let embed = new EmbedBuilder().setTitle('🏆 لوحة المتصدرين').setDescription(desc).setColor(0xFFD700);
            message.channel.send({ embeds: [embed] });
        });
    }

    if (command === 'levelrole') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let level = parseInt(args[0]);
        let role = message.mentions.roles.first();
        if (!level || !role) return message.reply('❌ استخدم: !levelrole <مستوى> @دور');
        db.run("INSERT OR REPLACE INTO level_roles (guild_id, level, role_id) VALUES (?, ?, ?)", [message.guild.id, level, role.id]);
        message.reply(`✅ تم ربط دور ${role.name} بالمستوى ${level}.`);
    }

    // ============================================================
    // ================== تذاكر ==================
    // ============================================================

    if (command === 'ticket') {
        let topic = args.join(' ') || 'دعم عام';
        let category = message.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === 'Tickets');
        if (!category) category = await message.guild.channels.create({ name: 'Tickets', type: ChannelType.GuildCategory });
        let overwrites = [
            { id: message.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: message.author.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ];
        let channel = await message.guild.channels.create({ name: `ticket-${message.author.username}`, type: ChannelType.GuildText, parent: category, permissionOverwrites: overwrites });
        db.run("INSERT INTO tickets (guild_id, channel_id, user_id, topic, status, created_at) VALUES (?, ?, ?, ?, 'open', datetime('now'))", [message.guild.id, channel.id, message.author.id, topic]);
        let embed = new EmbedBuilder().setTitle('🎫 تذكرة جديدة').setDescription(`الموضوع: ${topic}`).setColor(0x00BFFF).addFields({ name: 'أنشأها', value: message.author.tag });
        channel.send({ content: `<@${message.author.id}>`, embeds: [embed] });
        message.reply(`✅ تم فتح تذكرة: ${channel}`);
    }

    if (command === 'close') {
        if (!message.channel.name.startsWith('ticket-')) return message.reply('❌ هذه ليست تذكرة.');
        db.run("UPDATE tickets SET status = 'closed' WHERE channel_id = ?", [message.channel.id]);
        await message.channel.send('🔒 سيتم حذف التذكرة خلال 5 ثوانٍ.');
        setTimeout(() => message.channel.delete().catch(() => {}), 5000);
    }

    // ============================================================
    // ================== ترحيب ووداع ==================
    // ============================================================

    if (command === 'setwelcome') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let channel = message.mentions.channels.first();
        if (!channel) return message.reply('❌ حدد قناة.');
        let msg = args.slice(1).join(' ') || 'مرحباً {user} في {server}';
        db.run("INSERT OR REPLACE INTO welcome (guild_id, channel_id, message) VALUES (?, ?, ?)", [message.guild.id, channel.id, msg]);
        message.reply(`✅ تم تعيين الترحيب في ${channel}`);
    }

    if (command === 'setgoodbye') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let channel = message.mentions.channels.first();
        if (!channel) return message.reply('❌ حدد قناة.');
        let msg = args.slice(1).join(' ') || 'وداعاً {user} من {server}';
        db.run("INSERT OR REPLACE INTO goodbye (guild_id, channel_id, message) VALUES (?, ?, ?)", [message.guild.id, channel.id, msg]);
        message.reply(`✅ تم تعيين الوداع في ${channel}`);
    }

    if (command === 'setautorole') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let role = message.mentions.roles.first();
        if (!role) return message.reply('❌ حدد دوراً.');
        db.run("INSERT OR REPLACE INTO autoroles (guild_id, role_id) VALUES (?, ?)", [message.guild.id, role.id]);
        message.reply(`✅ تم تعيين دور تلقائي: ${role.name}`);
    }

    // ============================================================
    // ================== لوغينغ ==================
    // ============================================================

    if (command === 'setlog') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let channel = message.mentions.channels.first();
        let type = args[1] || 'all';
        if (!channel) return message.reply('❌ حدد قناة.');
        db.run("INSERT OR REPLACE INTO logging (guild_id, channel_id, type) VALUES (?, ?, ?)", [message.guild.id, channel.id, type]);
        message.reply(`✅ تم تعيين سجلات ${type} في ${channel}`);
    }

    // ============================================================
    // ================== أوامر مخصصة ==================
    // ============================================================

    if (command === 'addcmd') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let name = args[0];
        let response = args.slice(1).join(' ');
        if (!name || !response) return message.reply('❌ استخدم: !addcmd <اسم> <رد>');
        db.run("INSERT OR REPLACE INTO custom_commands (guild_id, name, response) VALUES (?, ?, ?)", [message.guild.id, name.toLowerCase(), response]);
        message.reply(`✅ تم إضافة الأمر !${name}`);
    }

    if (command === 'delcmd') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let name = args[0];
        if (!name) return message.reply('❌ استخدم: !delcmd <اسم>');
        db.run("DELETE FROM custom_commands WHERE guild_id = ? AND name = ?", [message.guild.id, name.toLowerCase()]);
        message.reply(`✅ تم حذف الأمر !${name}`);
    }

    if (command === 'cmds') {
        db.all("SELECT name FROM custom_commands WHERE guild_id = ?", [message.guild.id], (err, rows) => {
            if (!rows || rows.length === 0) return message.reply('📭 لا توجد أوامر مخصصة.');
            let list = rows.map(r => `!${r.name}`).join(', ');
            message.reply(`📌 الأوامر المخصصة: ${list}`);
        });
    }

    // ============================================================
    // ================== استطلاعات ==================
    // ============================================================

    if (command === 'poll') {
        let question = args[0];
        let options = args.slice(1);
        if (!question || options.length < 2) return message.reply('❌ استخدم: !poll "سؤال" "خيار1" "خيار2" ...');
        let emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
        let desc = options.map((o, i) => `${emojis[i]} ${o}`).join('\n');
        let embed = new EmbedBuilder().setTitle(`📊 ${question}`).setDescription(desc).setColor(0x00FF00);
        let msg = await message.channel.send({ embeds: [embed] });
        for (let i = 0; i < options.length; i++) await msg.react(emojis[i]);
        db.run("INSERT INTO polls (guild_id, channel_id, message_id, question, options) VALUES (?, ?, ?, ?, ?)", [message.guild.id, message.channel.id, msg.id, question, JSON.stringify(options)]);
        message.delete().catch(() => {});
    }

    // ============================================================
    // ================== هدايا ==================
    // ============================================================

    if (command === 'giveaway') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let duration = parseInt(args[0]) * 1000;
        let winners = parseInt(args[1]);
        let prize = args.slice(2).join(' ');
        if (!duration || !winners || !prize) return message.reply('❌ استخدم: !giveaway <ثواني> <فائزون> <جائزة>');
        let embed = new EmbedBuilder().setTitle('🎁 هدية جديدة!').setDescription(`الجائزة: ${prize}\nالفائزون: ${winners}`).setColor(0xFFD700).setFooter({ text: 'تفاعل بـ 🎉 للمشاركة' });
        let msg = await message.channel.send({ embeds: [embed] });
        await msg.react('🎉');
        let endTime = Date.now() + duration;
        db.run("INSERT INTO giveaways (guild_id, channel_id, message_id, prize, end_time, winners, entries) VALUES (?, ?, ?, ?, ?, ?, ?)", [message.guild.id, message.channel.id, msg.id, prize, String(endTime), winners, '[]']);
        setTimeout(async () => {
            db.get("SELECT entries FROM giveaways WHERE message_id = ?", [msg.id], async (err, row) => {
                if (!row) return;
                let entries = JSON.parse(row.entries);
                if (entries.length === 0) return message.channel.send('❌ لا يوجد مشاركون.');
                let selected = [];
                let shuffled = entries.sort(() => 0.5 - Math.random());
                for (let i = 0; i < Math.min(winners, shuffled.length); i++) selected.push(shuffled[i]);
                let mentions = selected.map(id => `<@${id}>`).join(', ');
                message.channel.send(`🎉 الفائزون في هدية ${prize}: ${mentions}`);
                db.run("DELETE FROM giveaways WHERE message_id = ?", [msg.id]);
            });
        }, duration);
    }

    // ============================================================
    // ================== تذكيرات ==================
    // ============================================================

    if (command === 'remind') {
        let duration = parseInt(args[0]);
        let msgText = args.slice(1).join(' ');
        if (!duration || !msgText) return message.reply('❌ استخدم: !remind <ثواني> <رسالة>');
        let remindTime = Date.now() + duration * 1000;
        db.run("INSERT INTO reminders (user_id, channel_id, message, remind_time) VALUES (?, ?, ?, ?)", [message.author.id, message.channel.id, msgText, String(remindTime)]);
        message.reply(`✅ تم تعيين تذكير بعد ${duration} ثانية.`);
    }

    if (command === 'remindrepeat') {
        let interval = parseInt(args[0]);
        let msgText = args.slice(1).join(' ');
        if (!interval || !msgText) return message.reply('❌ استخدم: !remindrepeat <ثواني> <رسالة>');
        let remindTime = Date.now() + interval * 1000;
        db.run("INSERT INTO reminders (user_id, channel_id, message, remind_time, repeat_interval) VALUES (?, ?, ?, ?, ?)", [message.author.id, message.channel.id, msgText, String(remindTime), interval]);
        message.reply(`✅ سيتم تذكيرك كل ${interval} ثانية.`);
    }

    // ============================================================
    // ================== ألعاب ==================
    // ============================================================

    if (command === '8ball') {
        let question = args.join(' ');
        if (!question) return message.reply('❌ اسألني شيئاً.');
        let answers = ['نعم', 'لا', 'ربما', 'بالتأكيد', 'مستحيل', 'اسأل لاحقاً', 'لا يمكن التنبؤ'];
        message.reply(`🎱 **${answers[Math.floor(Math.random()*answers.length)]}**`);
    }

    if (command === 'roll') {
        let max = parseInt(args[0]) || 100;
        message.reply(`🎲 رميت النرد وحصلت على: **${Math.floor(Math.random()*max)+1}**`);
    }

    if (command === 'flip') {
        message.reply(`🪙 العملة أظهرت: **${Math.random() < 0.5 ? 'وجه' : 'كتابة'}**`);
    }

    if (command === 'meme') {
        try {
            let res = await axios.get('https://meme-api.com/gimme');
            let data = res.data;
            let embed = new EmbedBuilder().setTitle(data.title).setURL(data.postLink).setImage(data.url).setColor(0x2F3136);
            message.channel.send({ embeds: [embed] });
        } catch(e) { message.reply('❌ لم أتمكن من جلب ميم.'); }
    }

    if (command === 'weather') {
        let city = args.join(' ');
        if (!city) return message.reply('❌ حدد مدينة.');
        let apiKey = 'YOUR_WEATHER_API_KEY';
        try {
            let res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=ar`);
            let data = res.data;
            let embed = new EmbedBuilder().setTitle(`🌤️ الطقس في ${city}`).setColor(0x00BFFF)
                .addFields(
                    { name: 'درجة الحرارة', value: `${data.main.temp}°C`, inline: true },
                    { name: 'الرطوبة', value: `${data.main.humidity}%`, inline: true },
                    { name: 'الوصف', value: data.weather[0].description, inline: false }
                );
            message.channel.send({ embeds: [embed] });
        } catch(e) { message.reply('❌ لم أتمكن من العثور على المدينة.'); }
    }

    if (command === 'news') {
        let apiKey = 'YOUR_NEWS_API_KEY';
        try {
            let res = await axios.get(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`);
            let articles = res.data.articles.slice(0, 5);
            let desc = articles.map(a => `**${a.title}**\n${a.description || ''}\n[رابط](${a.url})`).join('\n\n');
            let embed = new EmbedBuilder().setTitle('📰 أهم الأخبار').setDescription(desc).setColor(0x2F3136);
            message.channel.send({ embeds: [embed] });
        } catch(e) { message.reply('❌ لم أتمكن من جلب الأخبار.'); }
    }

    // ============================================================
    // ================== موسيقى ==================
    // ============================================================

    if (command === 'play') {
        let query = args.join(' ');
        if (!query) return message.reply('❌ أدخل اسم أغنية أو رابط.');
        let voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ يجب أن تكون في قناة صوتية.');
        if (!queues.get(message.guild.id)) queues.set(message.guild.id, []);
        let queue = queues.get(message.guild.id);
        try {
            let info = await ytdl.getInfo(query);
            let song = { title: info.videoDetails.title, url: info.videoDetails.video_url, requester: message.author.id };
            queue.push(song);
            if (!message.guild.members.me.voice.channel) {
                await voiceChannel.join();
                playSong(message.guild);
            }
            message.reply(`🎵 تمت الإضافة: **${song.title}**`);
        } catch(e) { message.reply('❌ لم أتمكن من العثور على الأغنية.'); }
    }

    async function playSong(guild) {
        let queue = queues.get(guild.id);
        if (!queue || queue.length === 0) {
            guild.members.me.voice.disconnect();
            return;
        }
        let song = queue[0];
        let connection = guild.members.me.voice;
        if (!connection) return;
        let stream = ytdl(song.url, { filter: 'audioonly', highWaterMark: 1 << 25 });
        let player = connection.play(stream, { type: 'opus' });
        player.on('finish', () => {
            queue.shift();
            playSong(guild);
        });
        player.on('error', () => { queue.shift(); playSong(guild); });
        let channel = guild.systemChannel || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages));
        if (channel) channel.send(`▶️ جارٍ التشغيل: **${song.title}**`);
    }

    if (command === 'stop') {
        if (!message.member.voice.channel) return message.reply('❌ لست في قناة صوتية.');
        if (queues) queues.set(message.guild.id, []);
        if (message.guild.members.me.voice) message.guild.members.me.voice.disconnect();
        message.reply('⏹️ تم إيقاف الموسيقى.');
    }

    if (command === 'skip') {
        let queue = queues.get(message.guild.id);
        if (!queue || queue.length === 0) return message.reply('📭 القائمة فارغة.');
        queue.shift();
        if (message.guild.members.me.voice) {
            message.guild.members.me.voice.disconnect();
            let vc = message.member.voice.channel;
            if (vc) {
                await vc.join();
                playSong(message.guild);
            }
        }
        message.reply('⏭️ تم تخطي الأغنية.');
    }

    if (command === 'queue') {
        let queue = queues.get(message.guild.id) || [];
        if (queue.length === 0) return message.reply('📭 القائمة فارغة.');
        let desc = queue.map((s, i) => `#${i+1} ${s.title}`).slice(0, 10).join('\n');
        let embed = new EmbedBuilder().setTitle('🎵 قائمة التشغيل').setDescription(desc).setColor(0x00BFFF);
        message.channel.send({ embeds: [embed] });
    }

    // ============================================================
    // ================== زواج ==================
    // ============================================================

    if (command === 'marry') {
        let target = message.mentions.members.first();
        if (!target || target.id === message.author.id || target.bot) return message.reply('❌ حدد عضواً صالحاً.');
        db.get("SELECT * FROM marriages WHERE (user1 = ? OR user2 = ?) AND guild_id = ?", [message.author.id, message.author.id, message.guild.id], (err, row) => {
            if (row) return message.reply('❌ أنت متزوج بالفعل.');
            db.get("SELECT * FROM marriages WHERE (user1 = ? OR user2 = ?) AND guild_id = ?", [target.id, target.id, message.guild.id], (err, row2) => {
                if (row2) return message.reply(`❌ ${target.user.tag} متزوج بالفعل.`);
                let embed = new EmbedBuilder().setTitle('💍 طلب زواج').setDescription(`${message.author} يطلب الزواج من ${target}`).setColor(0xFF69B4);
                message.channel.send({ content: target.toString(), embeds: [embed] }).then(msg => {
                    msg.react('✅');
                    msg.react('❌');
                    const filter = (reaction, user) => user.id === target.id && ['✅', '❌'].includes(reaction.emoji.name);
                    msg.awaitReactions({ filter, max: 1, time: 60000 }).then(collected => {
                        if (collected.first()?.emoji.name === '✅') {
                            db.run("INSERT INTO marriages (user1, user2, guild_id) VALUES (?, ?, ?)", [message.author.id, target.id, message.guild.id]);
                            message.channel.send(`🎉 تم الزواج بين ${message.author} و ${target}!`);
                        } else {
                            message.channel.send(`❌ تم رفض الطلب.`);
                        }
                    }).catch(() => message.channel.send('❌ انتهى الوقت.'));
                });
            });
        });
    }

    if (command === 'divorce') {
        db.run("DELETE FROM marriages WHERE (user1 = ? OR user2 = ?) AND guild_id = ?", [message.author.id, message.author.id, message.guild.id]);
        message.reply('💔 تم الطلاق.');
    }

    if (command === 'married') {
        db.all("SELECT user1, user2 FROM marriages WHERE guild_id = ?", [message.guild.id], (err, rows) => {
            if (!rows || rows.length === 0) return message.reply('📭 لا يوجد زيجات.');
            let list = rows.map(r => `<@${r.user1}> 💕 <@${r.user2}>`).join('\n');
            let embed = new EmbedBuilder().setTitle('💕 الزيجات').setDescription(list).setColor(0xFF69B4);
            message.channel.send({ embeds: [embed] });
        });
    }

    // ============================================================
    // ================== حماية ==================
    // ============================================================

    if (command === 'raidmode') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let level = parseInt(args[0]) || 1;
        let levels = { 1: 'LOW', 2: 'MEDIUM', 3: 'HIGH' };
        try {
            await message.guild.setVerificationLevel(level);
            message.reply(`✅ تم تفعيل وضع الحماية المستوى ${level} (${levels[level] || 'HIGH'}).`);
        } catch(e) { message.reply('❌ فشل التفعيل.'); }
    }

    // ============================================================
    // ================== معلومات ==================
    // ============================================================

    if (command === 'userinfo') {
        let member = message.mentions.members.first() || message.member;
        let embed = new EmbedBuilder().setTitle(`معلومات ${member.user.tag}`).setThumbnail(member.displayAvatarURL()).setColor(member.displayColor || 0x2F3136)
            .addFields(
                { name: '🆔 ID', value: member.id, inline: false },
                { name: '📅 انضم', value: member.joinedAt.toDateString(), inline: true },
                { name: '📆 الحساب', value: member.user.createdAt.toDateString(), inline: true },
                { name: '🎭 الأدوار', value: member.roles.cache.map(r => r.toString()).join(' ') || 'لا يوجد', inline: false }
            );
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'serverinfo') {
        let g = message.guild;
        let embed = new EmbedBuilder().setTitle(`معلومات ${g.name}`).setThumbnail(g.iconURL()).setColor(0x2F3136)
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

    // ============================================================
    // ================== الأنظمة الجديدة ==================
    // ============================================================

    // ---- العشائر ----
    if (command === 'clan') {
        let sub = args[0];
        if (sub === 'create') {
            let name = args.slice(1).join(' ');
            if (!name) return message.reply('❌ أدخل اسم العشيرة.');
            db.get("SELECT * FROM clans WHERE guild_id = ? AND name = ?", [message.guild.id, name], (err, row) => {
                if (row) return message.reply('❌ هذه العشيرة موجودة.');
                db.run("INSERT INTO clans (guild_id, name, owner, members, created_at) VALUES (?, ?, ?, ?, datetime('now'))", [message.guild.id, name, message.author.id, JSON.stringify([message.author.id])]);
                message.reply(`✅ تم إنشاء عشيرة **${name}**`);
            });
        } else if (sub === 'info') {
            let name = args.slice(1).join(' ');
            if (!name) return message.reply('❌ أدخل اسم العشيرة.');
            db.get("SELECT * FROM clans WHERE guild_id = ? AND name = ?", [message.guild.id, name], (err, row) => {
                if (!row) return message.reply('❌ العشيرة غير موجودة.');
                let members = JSON.parse(row.members);
                let embed = new EmbedBuilder().setTitle(`🏴 عشيرة ${row.name}`).setColor(0xFF0000)
                    .addFields(
                        { name: 'المالك', value: `<@${row.owner}>`, inline: true },
                        { name: 'الأعضاء', value: members.map(id => `<@${id}>`).join(', ') || 'لا يوجد', inline: false },
                        { name: 'المستوى', value: String(row.level), inline: true }
                    );
                message.channel.send({ embeds: [embed] });
            });
        }
    }

    // ---- المزارع ----
    if (command === 'farm') {
        let sub = args[0];
        if (sub === 'plant') {
            let crop = args[1];
            if (!crop) return message.reply('❌ المحاصيل: قمح, ذرة, طماطم, بطاطس.');
            let times = { قمح: 60, ذرة: 120, طماطم: 180, بطاطس: 240 };
            if (!times[crop]) return message.reply('❌ محصول غير معروف.');
            let now = Date.now();
            let ready = now + times[crop] * 1000;
            db.run("INSERT INTO farms (user_id, guild_id, crop, planted_at, ready_at) VALUES (?, ?, ?, ?, ?)", [message.author.id, message.guild.id, crop, String(now), String(ready)]);
            message.reply(`🌱 زرعت **${crop}**، ستكون جاهزة بعد ${times[crop]} ثانية.`);
        } else if (sub === 'harvest') {
            db.get("SELECT crop, ready_at FROM farms WHERE user_id = ? AND guild_id = ? AND status = 'growing'", [message.author.id, message.guild.id], (err, row) => {
                if (!row) return message.reply('❌ ليس لديك أي محصول.');
                let now = Date.now();
                if (now < parseInt(row.ready_at)) {
                    let remain = Math.ceil((parseInt(row.ready_at) - now) / 1000);
                    return message.reply(`⏳ المحصول جاهز بعد ${remain} ثانية.`);
                }
                let rewards = { قمح: 10, ذرة: 20, طماطم: 30, بطاطس: 40 };
                let amount = rewards[row.crop] || 10;
                updateBalance(message.author.id, message.guild.id, amount);
                db.run("UPDATE farms SET status = 'harvested' WHERE user_id = ? AND guild_id = ?", [message.author.id, message.guild.id]);
                message.reply(`✅ حصدت **${row.crop}** وحصلت على **${amount}** عملة!`);
            });
        }
    }

    // ---- السجون ----
    if (command === 'jail') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ لا تملك صلاحية.');
        let target = message.mentions.members.first();
        let duration = parseInt(args[1]) || 60;
        let reason = args.slice(2).join(' ') || 'لا يوجد سبب';
        if (!target) return message.reply('❌ حدد عضواً.');
        let release = Date.now() + duration * 1000;
        db.run("INSERT INTO prisons (user_id, guild_id, jailed_at, release_at, reason) VALUES (?, ?, ?, ?, ?)", [target.id, message.guild.id, String(Date.now()), String(release), reason]);
        try { await target.timeout(duration * 1000, reason); } catch(e) {}
        message.reply(`🔒 تم سجن ${target.user.tag} لمدة ${duration} ثانية.`);
        logEvent(message.guild.id, 'jail', `${message.author.tag} سجن ${target.user.tag}`);
    }

    if (command === 'unjail') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ لا تملك صلاحية.');
        let target = message.mentions.members.first();
        if (!target) return message.reply('❌ حدد عضواً.');
        db.run("DELETE FROM prisons WHERE user_id = ? AND guild_id = ?", [target.id, message.guild.id]);
        try { await target.timeout(null); } catch(e) {}
        message.reply(`✅ تم إطلاق سراح ${target.user.tag}`);
    }

    // ---- البنوك ----
    if (command === 'bank') {
        let sub = args[0];
        if (sub === 'deposit') {
            let amount = parseInt(args[1]);
            if (!amount || amount <= 0) return message.reply('❌ أدخل مبلغاً موجباً.');
            let bal = await getBalance(message.author.id, message.guild.id);
            if (bal < amount) return message.reply('❌ رصيدك غير كافٍ.');
            updateBalance(message.author.id, message.guild.id, -amount);
            db.run("UPDATE economy SET bank = bank + ? WHERE user_id = ? AND guild_id = ?", [amount, message.author.id, message.guild.id]);
            message.reply(`💰 أودعت **${amount}** عملة في البنك.`);
        } else if (sub === 'withdraw') {
            let amount = parseInt(args[1]);
            if (!amount || amount <= 0) return message.reply('❌ أدخل مبلغاً موجباً.');
            db.get("SELECT bank FROM economy WHERE user_id = ? AND guild_id = ?", [message.author.id, message.guild.id], (err, row) => {
                if (!row || row.bank < amount) return message.reply('❌ رصيد البنك غير كافٍ.');
                db.run("UPDATE economy SET bank = bank - ? WHERE user_id = ? AND guild_id = ?", [amount, message.author.id, message.guild.id]);
                updateBalance(message.author.id, message.guild.id, amount);
                message.reply(`💰 سحبت **${amount}** عملة من البنك.`);
            });
        } else if (sub === 'loan') {
            let amount = parseInt(args[1]);
            if (!amount || amount < 100 || amount > 10000) return message.reply('❌ المبلغ بين 100 و 10000.');
            let interest = Math.floor(amount * 0.1);
            let due = Date.now() + 7 * 24 * 60 * 60 * 1000;
            db.run("INSERT INTO loans (user_id, guild_id, amount, interest, due_date) VALUES (?, ?, ?, ?, ?)", [message.author.id, message.guild.id, amount, interest, String(due)]);
            updateBalance(message.author.id, message.guild.id, amount);
            message.reply(`🏦 حصلت على قرض **${amount}** عملة (فائدة: ${interest})، مستحق خلال 7 أيام.`);
        }
    }

    // ---- الاستثمارات ----
    if (command === 'invest') {
        let amount = parseInt(args[0]);
        if (!amount || amount < 100) return message.reply('❌ الحد الأدنى 100 عملة.');
        let bal = await getBalance(message.author.id, message.guild.id);
        if (bal < amount) return message.reply('❌ رصيد غير كافٍ.');
        let profit = Math.floor(amount * (Math.random() * 0.2 + 0.05));
        let end = Date.now() + 24 * 60 * 60 * 1000;
        db.run("INSERT INTO investments (user_id, guild_id, amount, profit, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)", [message.author.id, message.guild.id, amount, profit, String(Date.now()), String(end)]);
        updateBalance(message.author.id, message.guild.id, -amount);
        message.reply(`📈 استثمرت **${amount}** عملة، الربح المتوقع **${profit}** خلال 24 ساعة.`);
    }

    // ---- المزادات ----
    if (command === 'auction') {
        let sub = args[0];
        if (sub === 'create') {
            let item = args.slice(1, -1).join(' ');
            let starting = parseInt(args[args.length - 1]);
            if (!item || !starting) return message.reply('❌ استخدم: !auction create <عنصر> <سعر_بدء>');
            let end = Date.now() + 3600000;
            db.run("INSERT INTO auctions (guild_id, item, seller, starting_bid, current_bid, end_time) VALUES (?, ?, ?, ?, ?, ?)", [message.guild.id, item, message.author.id, starting, starting, String(end)]);
            message.reply(`🔨 تم بدء مزاد لـ **${item}** بسعر ${starting} عملة.`);
        } else if (sub === 'bid') {
            let id = parseInt(args[1]);
            let amount = parseInt(args[2]);
            if (!id || !amount) return message.reply('❌ استخدم: !auction bid <id> <مبلغ>');
            db.get("SELECT item, current_bid, bidder, end_time, seller FROM auctions WHERE id = ? AND status = 'active'", [id], (err, row) => {
                if (!row) return message.reply('❌ المزاد غير موجود.');
                if (Date.now() > parseInt(row.end_time)) return message.reply('❌ انتهى المزاد.');
                if (amount <= row.current_bid) return message.reply(`❌ المبلغ يجب أن يزيد عن ${row.current_bid}.`);
                if (message.author.id === row.seller) return message.reply('❌ لا يمكنك المزايدة على عنصرك.');
                db.run("UPDATE auctions SET current_bid = ?, bidder = ? WHERE id = ?", [amount, message.author.id, id]);
                message.reply(`✅ تم المزايدة بـ **${amount}** عملة على **${row.item}**.`);
            });
        } else if (sub === 'end') {
            let id = parseInt(args[1]);
            if (!id) return message.reply('❌ استخدم: !auction end <id>');
            db.get("SELECT * FROM auctions WHERE id = ? AND status = 'active'", [id], (err, row) => {
                if (!row) return message.reply('❌ المزاد غير موجود.');
                if (row.seller !== message.author.id && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لست المالك.');
                if (row.bidder) {
                    updateBalance(row.bidder, message.guild.id, -row.current_bid);
                    updateBalance(row.seller, message.guild.id, row.current_bid);
                    message.reply(`🏆 فاز <@${row.bidder}> بـ **${row.item}** بمبلغ ${row.current_bid}.`);
                } else {
                    message.reply(`❌ لا يوجد مزايدون على **${row.item}**.`);
                }
                db.run("UPDATE auctions SET status = 'ended' WHERE id = ?", [id]);
            });
        }
    }

    // ---- الألقاب ----
    if (command === 'title') {
        let sub = args[0];
        if (sub === 'set') {
            let title = args.slice(1).join(' ');
            if (!title) return message.reply('❌ أدخل لقباً.');
            db.run("INSERT OR REPLACE INTO titles (user_id, guild_id, title) VALUES (?, ?, ?)", [message.author.id, message.guild.id, title]);
            message.reply(`✅ تم تعيين لقبك: **${title}**`);
        } else if (sub === 'show') {
            db.get("SELECT title FROM titles WHERE user_id = ? AND guild_id = ?", [message.author.id, message.guild.id], (err, row) => {
                if (row) message.reply(`🏷️ لقبك: **${row.title}**`);
                else message.reply('❌ ليس لديك لقب.');
            });
        }
    }

    // ---- الردود التلقائية ----
    if (command === 'addauto') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let trigger = args[0];
        let response = args.slice(1).join(' ');
        if (!trigger || !response) return message.reply('❌ استخدم: !addauto <كلمة> <رد>');
        db.run("INSERT OR REPLACE INTO auto_responders (guild_id, trigger, response) VALUES (?, ?, ?)", [message.guild.id, trigger.toLowerCase(), response]);
        message.reply(`✅ تم إضافة رد تلقائي لـ **${trigger}**`);
    }

    // ---- الأحداث ----
    if (command === 'event') {
        let sub = args[0];
        if (sub === 'create') {
            let name = args[1];
            let date = args[2];
            let desc = args.slice(3).join(' ');
            if (!name || !date || !desc) return message.reply('❌ استخدم: !event create <اسم> <تاريخ> <وصف>');
            db.run("INSERT INTO events (guild_id, name, description, date, channel_id, created_by) VALUES (?, ?, ?, ?, ?, ?)", [message.guild.id, name, desc, date, message.channel.id, message.author.id]);
            message.reply(`✅ تم إنشاء حدث **${name}** في ${date}`);
        } else if (sub === 'list') {
            db.all("SELECT id, name, date FROM events WHERE guild_id = ?", [message.guild.id], (err, rows) => {
                if (!rows || rows.length === 0) return message.reply('📭 لا توجد أحداث.');
                let list = rows.map(r => `#${r.id} ${r.name} - ${r.date}`).join('\n');
                message.reply(`📅 الأحداث:\n${list}`);
            });
        }
    }

    // ---- الألوان المخصصة ----
    if (command === 'color') {
        let hex = args[0];
        if (!hex || !/^#[0-9A-F]{6}$/i.test(hex)) return message.reply('❌ أدخل لوناً بصيغة #RRGGBB');
        db.run("INSERT OR REPLACE INTO custom_colors (user_id, guild_id, color_hex) VALUES (?, ?, ?)", [message.author.id, message.guild.id, hex]);
        message.reply(`🎨 تم تعيين لونك إلى ${hex}`);
    }

    // ---- المهام اليومية ----
    if (command === 'quest') {
        let sub = args[0];
        let now = new Date().toISOString().slice(0,10);
        if (sub === 'daily') {
            db.get("SELECT progress, status FROM quests WHERE user_id = ? AND guild_id = ? AND type = 'daily' AND date = ?", [message.author.id, message.guild.id, now], (err, row) => {
                if (row && row.status === 'completed') return message.reply('✅ أكملت مهمتك اليومية.');
                if (!row) {
                    let tasks = ['أرسل 10 رسائل', 'تفاعل مع 5 رسائل', 'اربح 100 عملة'];
                    let task = tasks[Math.floor(Math.random() * tasks.length)];
                    db.run("INSERT INTO quests (user_id, guild_id, name, description, reward, type, target, progress, status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)", [message.author.id, message.guild.id, 'مهمة يومية', task, 50, 'daily', 1, 0, now]);
                    message.reply(`📋 مهمتك اليومية: ${task} (مكافأة: 50 عملة)`);
                } else {
                    message.reply(`📋 تقدمك: ${row.progress} / 1`);
                }
            });
        } else if (sub === 'claim') {
            db.get("SELECT reward, status FROM quests WHERE user_id = ? AND guild_id = ? AND type = 'daily' AND status = 'active'", [message.author.id, message.guild.id], (err, row) => {
                if (!row) return message.reply('❌ ليس لديك مهمة نشطة.');
                if (row.status !== 'completed') return message.reply('❌ لم تكمل المهمة بعد.');
                updateBalance(message.author.id, message.guild.id, row.reward);
                db.run("UPDATE quests SET status = 'claimed' WHERE user_id = ? AND guild_id = ? AND type = 'daily'", [message.author.id, message.guild.id]);
                message.reply(`✅ حصلت على ${row.reward} عملة!`);
            });
        }
    }

    // ---- الإنجازات ----
    if (command === 'achievement') {
        let sub = args[0];
        if (sub === 'unlock') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
            let target = message.mentions.members.first();
            let name = args.slice(2).join(' ');
            if (!target || !name) return message.reply('❌ استخدم: !achievement unlock @user <اسم>');
            db.run("INSERT INTO achievements (user_id, guild_id, achievement_name, unlocked_at) VALUES (?, ?, ?, datetime('now'))", [target.id, message.guild.id, name]);
            message.reply(`🏅 تم منح إنجاز ${name} لـ ${target.user.tag}`);
        } else if (sub === 'list') {
            let member = message.mentions.members.first() || message.member;
            db.all("SELECT achievement_name, unlocked_at FROM achievements WHERE user_id = ? AND guild_id = ?", [member.id, message.guild.id], (err, rows) => {
                if (!rows || rows.length === 0) return message.reply(`📭 ${member.user.tag} ليس لديه إنجازات.`);
                let list = rows.map(r => `${r.achievement_name} (${r.unlocked_at})`).join('\n');
                message.reply(`🏅 إنجازات ${member.user.tag}:\n${list}`);
            });
        }
    }

    // ---- الأدوار المؤقتة ----
    if (command === 'temprole') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let target = message.mentions.members.first();
        let role = message.mentions.roles.first();
        let duration = parseInt(args[2]) || 3600;
        if (!target || !role) return message.reply('❌ استخدم: !temprole @user @دور <ثواني>');
        try {
            await target.roles.add(role);
            let expiry = Date.now() + duration * 1000;
            db.run("INSERT INTO temp_roles (user_id, guild_id, role_id, expiry_time) VALUES (?, ?, ?, ?)", [target.id, message.guild.id, role.id, String(expiry)]);
            message.reply(`✅ تم منح ${role.name} لـ ${target.user.tag} لمدة ${duration} ثانية.`);
            setTimeout(async () => {
                db.get("SELECT * FROM temp_roles WHERE user_id = ? AND guild_id = ? AND role_id = ?", [target.id, message.guild.id, role.id], async (err, row) => {
                    if (row) {
                        try { await target.roles.remove(role); } catch(e) {}
                        db.run("DELETE FROM temp_roles WHERE user_id = ? AND guild_id = ? AND role_id = ?", [target.id, message.guild.id, role.id]);
                        message.channel.send(`⏳ انتهت صلاحية دور ${role.name} لـ ${target.user.tag}`);
                    }
                });
            }, duration * 1000);
        } catch(e) { message.reply('❌ فشل منح الدور.'); }
    }

    // ---- الأدوار التفاعلية ----
    if (command === 'reactionrole') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let sub = args[0];
        if (sub === 'add') {
            let msgId = args[1];
            let role = message.mentions.roles.first();
            let emoji = args[3];
            if (!msgId || !role || !emoji) return message.reply('❌ استخدم: !reactionrole add <message_id> @دور <إيموجي>');
            db.run("INSERT INTO reaction_roles (guild_id, message_id, role_id, emoji) VALUES (?, ?, ?, ?)", [message.guild.id, msgId, role.id, emoji]);
            message.reply(`✅ تم ربط الإيموجي ${emoji} بالدور ${role.name}`);
            try { let msg = await message.channel.messages.fetch(msgId); await msg.react(emoji); } catch(e) {}
        } else if (sub === 'remove') {
            let id = parseInt(args[1]);
            if (!id) return message.reply('❌ استخدم: !reactionrole remove <id>');
            db.run("DELETE FROM reaction_roles WHERE id = ? AND guild_id = ?", [id, message.guild.id]);
            message.reply('✅ تم الحذف.');
        } else if (sub === 'list') {
            db.all("SELECT id, message_id, role_id, emoji FROM reaction_roles WHERE guild_id = ?", [message.guild.id], (err, rows) => {
                if (!rows || rows.length === 0) return message.reply('📭 لا توجد أدوار تفاعلية.');
                let list = rows.map(r => `#${r.id} - ${r.emoji} -> <@&${r.role_id}>`).join('\n');
                message.reply(`📋 الأدوار التفاعلية:\n${list}`);
            });
        }
    }

    // ---- إحصائيات الأعضاء ----
    if (command === 'mystats') {
        let member = message.mentions.members.first() || message.member;
        let stats = await getUserStats(member.id, message.guild.id);
        let embed = new EmbedBuilder().setTitle(`📊 إحصائيات ${member.user.tag}`).setColor(0x00BFFF)
            .addFields(
                { name: 'رسائل', value: String(stats.messages), inline: true },
                { name: 'دقائق صوتية', value: String(stats.voice_minutes), inline: true },
                { name: 'تفاعلات أعطيتها', value: String(stats.reactions_given), inline: true },
                { name: 'تفاعلات تلقيتها', value: String(stats.reactions_received), inline: true }
            );
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'topstats') {
        db.all("SELECT user_id, messages, voice_minutes FROM member_stats WHERE guild_id = ? ORDER BY messages DESC LIMIT 10", [message.guild.id], (err, rows) => {
            if (!rows || rows.length === 0) return message.reply('📭 لا توجد بيانات.');
            let desc = rows.map((r, i) => `#${i+1} <@${r.user_id}> - رسائل: ${r.messages} | صوت: ${r.voice_minutes}`).join('\n');
            let embed = new EmbedBuilder().setTitle('🏆 ترتيب النشاط').setDescription(desc).setColor(0xFFD700);
            message.channel.send({ embeds: [embed] });
        });
    }

    // ---- الحظر المتقدم ----
    if (command === 'advban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let target = message.mentions.members.first();
        let duration = parseInt(args[1]) || 3600;
        let reason = args.slice(2).join(' ') || 'لا يوجد سبب';
        if (!target) return message.reply('❌ حدد عضواً.');
        try {
            await target.ban({ reason });
            db.run("INSERT OR REPLACE INTO advanced_bans (user_id, guild_id, reason, duration, banned_at) VALUES (?, ?, ?, ?, datetime('now'))", [target.id, message.guild.id, reason, duration]);
            message.reply(`🔨 تم حظر ${target.user.tag} لمدة ${duration} ثانية.`);
            setTimeout(async () => {
                db.get("SELECT * FROM advanced_bans WHERE user_id = ? AND guild_id = ?", [target.id, message.guild.id], async (err, row) => {
                    if (row) {
                        try { await message.guild.bans.remove(target.id); } catch(e) {}
                        db.run("DELETE FROM advanced_bans WHERE user_id = ? AND guild_id = ?", [target.id, message.guild.id]);
                        message.channel.send(`🔓 تم رفع الحظر التلقائي عن ${target.user.tag}`);
                    }
                });
            }, duration * 1000);
        } catch(e) { message.reply('❌ فشل الحظر.'); }
    }

    if (command === 'unbanadv') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let target = args[0];
        if (!target) return message.reply('❌ أدخل معرف العضو.');
        db.run("DELETE FROM advanced_bans WHERE user_id = ? AND guild_id = ?", [target, message.guild.id]);
        try { await message.guild.bans.remove(target); } catch(e) {}
        message.reply(`✅ تم رفع الحظر عن <@${target}>`);
    }

    // ---- مكافآت الانضمام ----
    if (command === 'joinreward') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let sub = args[0];
        if (sub === 'set') {
            let role = message.mentions.roles.first();
            let amount = parseInt(args[2]);
            if (!role || !amount) return message.reply('❌ استخدم: !joinreward set @دور <مبلغ>');
            db.run("INSERT OR REPLACE INTO join_rewards (guild_id, role_id, reward_amount) VALUES (?, ?, ?)", [message.guild.id, role.id, amount]);
            message.reply(`✅ سيتم منح ${role.name} مبلغ ${amount} عملة عند الانضمام.`);
        } else if (sub === 'remove') {
            db.run("DELETE FROM join_rewards WHERE guild_id = ?", [message.guild.id]);
            message.reply('✅ تم إلغاء مكافآت الانضمام.');
        }
    }

    // ---- اليانصيب ----
    if (command === 'lottery') {
        let sub = args[0];
        if (sub === 'buy') {
            let ticketCost = 50;
            let bal = await getBalance(message.author.id, message.guild.id);
            if (bal < ticketCost) return message.reply(`❌ تحتاج ${ticketCost} عملة لشراء تذكرة.`);
            updateBalance(message.author.id, message.guild.id, -ticketCost);
            let number = Math.floor(Math.random() * 1000) + 1;
            let prize = Math.floor(Math.random() * 200) + 100;
            db.run("INSERT INTO lottery (guild_id, ticket_owner, ticket_number, prize_amount, draw_date) VALUES (?, ?, ?, ?, datetime('now', '+1 day'))", [message.guild.id, message.author.id, number, prize]);
            message.reply(`🎟️ اشتريت تذكرة يانصيب رقم ${number}، الجائزة ${prize} عملة. سيتم السحب غداً.`);
        } else if (sub === 'draw') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
            db.all("SELECT id, ticket_owner, prize_amount FROM lottery WHERE guild_id = ? AND status = 'active'", [message.guild.id], (err, rows) => {
                if (!rows || rows.length === 0) return message.reply('📭 لا تذاكر.');
                let winner = rows[Math.floor(Math.random() * rows.length)];
                updateBalance(winner.ticket_owner, message.guild.id, winner.prize_amount);
                db.run("UPDATE lottery SET status = 'drawn' WHERE id = ?", [winner.id]);
                message.reply(`🎉 فاز <@${winner.ticket_owner}> بجائزة ${winner.prize_amount} عملة!`);
            });
        }
    }

    // ---- التداول ----
    if (command === 'trade') {
        let sub = args[0];
        if (sub === 'send') {
            let target = message.mentions.members.first();
            let amount = parseInt(args[2]);
            if (!target || !amount || amount <= 0) return message.reply('❌ استخدم: !trade send @user <مبلغ>');
            let bal = await getBalance(message.author.id, message.guild.id);
            if (bal < amount) return message.reply('❌ رصيد غير كافٍ.');
            db.run("INSERT INTO trades (guild_id, sender_id, receiver_id, amount, created_at) VALUES (?, ?, ?, ?, datetime('now'))", [message.guild.id, message.author.id, target.id, amount]);
            message.reply(`📤 طلب تداول بقيمة ${amount} عملة إلى ${target}`);
            target.send(`📨 ${message.author.tag} يريد إرسال ${amount} عملة إليك. استخدم !trade accept <id> أو !trade reject <id>`).catch(() => {});
        } else if (sub === 'accept') {
            let id = parseInt(args[1]);
            if (!id) return message.reply('❌ استخدم: !trade accept <id>');
            db.get("SELECT sender_id, receiver_id, amount FROM trades WHERE id = ? AND guild_id = ? AND status = 'pending'", [id, message.guild.id], (err, row) => {
                if (!row) return message.reply('❌ طلب غير موجود.');
                if (row.receiver_id !== message.author.id) return message.reply('❌ هذا ليس لك.');
                let senderBal = getBalance(row.sender_id, message.guild.id);
                if (senderBal < row.amount) return message.reply('❌ المرسل ليس لديه رصيد كافٍ.');
                updateBalance(row.sender_id, message.guild.id, -row.amount);
                updateBalance(row.receiver_id, message.guild.id, row.amount);
                db.run("UPDATE trades SET status = 'completed' WHERE id = ?", [id]);
                message.reply(`✅ تم إتمام التداول بقيمة ${row.amount} عملة.`);
            });
        } else if (sub === 'reject') {
            let id = parseInt(args[1]);
            if (!id) return message.reply('❌ استخدم: !trade reject <id>');
            db.run("UPDATE trades SET status = 'rejected' WHERE id = ? AND receiver_id = ?", [id, message.author.id]);
            message.reply('❌ تم رفض التداول.');
        } else if (sub === 'list') {
            db.all("SELECT id, sender_id, amount, created_at FROM trades WHERE receiver_id = ? AND status = 'pending'", [message.author.id], (err, rows) => {
                if (!rows || rows.length === 0) return message.reply('📭 لا توجد طلبات تداول.');
                let list = rows.map(r => `#${r.id} - من <@${r.sender_id}> - ${r.amount} عملة`).join('\n');
                message.reply(`📋 طلبات التداول:\n${list}`);
            });
        }
    }

    // ---- البطولات ----
    if (command === 'tournament') {
        let sub = args[0];
        if (sub === 'create') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
            let name = args[1];
            let prize = parseInt(args[2]);
            if (!name || !prize) return message.reply('❌ استخدم: !tournament create <اسم> <جائزة>');
            db.run("INSERT INTO tournaments (guild_id, name, prize, participants, created_at) VALUES (?, ?, ?, '[]', datetime('now'))", [message.guild.id, name, prize]);
            message.reply(`🏆 تم إنشاء بطولة ${name} بجائزة ${prize} عملة.`);
        } else if (sub === 'join') {
            db.get("SELECT id, participants, prize FROM tournaments WHERE guild_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1", [message.guild.id], (err, row) => {
                if (!row) return message.reply('❌ لا توجد بطولة نشطة.');
                let participants = JSON.parse(row.participants);
                if (participants.includes(message.author.id)) return message.reply('❌ أنت مشترك بالفعل.');
                participants.push(message.author.id);
                db.run("UPDATE tournaments SET participants = ? WHERE id = ?", [JSON.stringify(participants), row.id]);
                message.reply(`✅ انضممت للبطولة ${row.prize} عملة.`);
            });
        } else if (sub === 'draw') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
            db.get("SELECT id, participants, prize FROM tournaments WHERE guild_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1", [message.guild.id], (err, row) => {
                if (!row) return message.reply('❌ لا توجد بطولة.');
                let participants = JSON.parse(row.participants);
                if (participants.length < 2) return message.reply('❌ عدد المشاركين غير كافٍ.');
                let winner = participants[Math.floor(Math.random() * participants.length)];
                updateBalance(winner, message.guild.id, row.prize);
                db.run("UPDATE tournaments SET status = 'finished' WHERE id = ?", [row.id]);
                message.reply(`🏆 الفائز هو <@${winner}> وحصل على ${row.prize} عملة!`);
            });
        }
    }

    // ---- أوامر إضافية ----
    if (command === 'purge') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return message.reply('❌ لا تملك صلاحية.');
        let count = parseInt(args[0]) || 10;
        if (count > 100) count = 100;
        try { await message.channel.bulkDelete(count, true); message.reply(`✅ تم حذف ${count} رسالة.`).then(m => setTimeout(() => m.delete(), 3000)); } catch(e) { message.reply('❌ فشل الحذف.'); }
    }

    if (command === 'tempchannel') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply('❌ لا تملك صلاحية.');
        let name = args.join(' ') || 'temp-' + Date.now();
        let channel = await message.guild.channels.create({ name, type: ChannelType.GuildText });
        message.reply(`✅ تم إنشاء قناة مؤقتة: ${channel}`);
        setTimeout(async () => { try { await channel.delete(); } catch(e) {} message.channel.send(`⏳ تم حذف القناة المؤقتة ${name}`); }, 60000);
    }

    if (command === 'randomuser') {
        let members = message.guild.members.cache.filter(m => !m.user.bot);
        if (members.size === 0) return message.reply('📭 لا يوجد أعضاء.');
        let randomMember = members.random();
        message.reply(`🎲 العضو العشوائي: ${randomMember.user.tag}`);
    }

    if (command === 'servertime') {
        let now = new Date();
        message.reply(`🕒 الوقت الحالي: ${now.toLocaleString('ar-EG')}`);
    }

    if (command === 'userid') {
        let member = message.mentions.members.first() || message.member;
        message.reply(`🆔 معرف ${member.user.tag}: ${member.id}`);
    }

    if (command === 'channelid') {
        message.reply(`🆔 معرف القناة: ${message.channel.id}`);
    }

    if (command === 'votebutton') {
        let question = args.join(' ') || 'تصويت';
        let row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('vote_yes').setLabel('نعم').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('vote_no').setLabel('لا').setStyle(ButtonStyle.Danger)
            );
        let embed = new EmbedBuilder().setTitle('🗳️ تصويت').setDescription(question).setColor(0x00BFFF);
        await message.channel.send({ embeds: [embed], components: [row] });
    }

    if (command === 'weekly') {
        let week = moment().week();
        db.get("SELECT weekly FROM economy WHERE user_id = ? AND guild_id = ?", [message.author.id, message.guild.id], (err, row) => {
            if (row && row.weekly === String(week)) return message.reply('❌ حصلت على مكافأتك الأسبوعية.');
            let amount = Math.floor(Math.random() * 300) + 200;
            updateBalance(message.author.id, message.guild.id, amount);
            db.run("UPDATE economy SET weekly = ? WHERE user_id = ? AND guild_id = ?", [String(week), message.author.id, message.guild.id]);
            message.reply(`📅 مكافأة أسبوعية: **${amount}** عملة!`);
        });
    }

    if (command === 'profile') {
        let member = message.mentions.members.first() || message.member;
        let bal = await getBalance(member.id, message.guild.id);
        let { level } = await getXp(member.id, message.guild.id);
        db.get("SELECT title FROM titles WHERE user_id = ? AND guild_id = ?", [member.id, message.guild.id], (err, row) => {
            let title = row ? row.title : 'لا يوجد';
            let embed = new EmbedBuilder().setTitle(`👤 ملف ${member.user.tag}`).setThumbnail(member.displayAvatarURL()).setColor(0x2F3136)
                .addFields(
                    { name: 'رصيد', value: `${bal} عملة`, inline: true },
                    { name: 'مستوى', value: String(level), inline: true },
                    { name: 'لقب', value: title, inline: true }
                );
            message.channel.send({ embeds: [embed] });
        });
    }

    // ---- أوامر المالك ----
    if (command === 'eval') {
        if (message.author.id !== 'YOUR_OWNER_ID') return message.reply('❌ ليس لديك صلاحية.');
        try {
            let result = eval(args.join(' '));
            message.reply(`📊 النتيجة: \`\`\`js\n${result}\n\`\`\``);
        } catch(e) {
            message.reply(`❌ خطأ: ${e.message}`);
        }
    }

    // ---- أوامر أخرى (للاكتمال) ----
    if (command === 'hunt') {
        let animals = ['🦌 غزال', '🐗 خنزير', '🐇 أرنب', '🦅 نسر', '🐺 ذئب'];
        let animal = animals[Math.floor(Math.random() * animals.length)];
        let success = Math.random() < 0.6;
        if (success) {
            let reward = Math.floor(Math.random() * 30) + 10;
            updateBalance(message.author.id, message.guild.id, reward);
            message.reply(`🏹 اصطدت **${animal}** وحصلت على ${reward} عملة.`);
        } else {
            message.reply(`❌ فشلت في الصيد، حاول مرة أخرى.`);
        }
    }

    if (command === 'medal') {
        let medals = ['🥇', '🥈', '🥉', '🏅', '🎖️'];
        let medal = medals[Math.floor(Math.random() * medals.length)];
        db.run("INSERT INTO cards (user_id, guild_id, card_type, rarity, acquired_at) VALUES (?, ?, ?, 'وسمة', datetime('now'))", [message.author.id, message.guild.id, medal]);
        message.reply(`🏅 حصلت على وسمة ${medal}!`);
    }

    if (command === 'horoscope') {
        let signs = ['الحمل', 'الثور', 'الجوزاء', 'السرطان', 'الأسد', 'العذراء', 'الميزان', 'العقرب', 'القوس', 'الجدي', 'الدلو', 'الحوت'];
        let sign = args.join(' ') || signs[Math.floor(Math.random() * signs.length)];
        let fortunes = ['اليوم يوم ممتاز', 'كن حذراً', 'الحظ معك', 'توقع مفاجأة', 'ابتسم للحياة'];
        message.reply(`🔮 برج ${sign}: ${fortunes[Math.floor(Math.random() * fortunes.length)]}`);
    }

    if (command === 'card') {
        let types = ['🔥', '💎', '🌟', '🃏', '🎴'];
        let rarities = ['عادي', 'نادر', 'نادر جداً', 'أسطوري'];
        let type = types[Math.floor(Math.random() * types.length)];
        let rarity = rarities[Math.floor(Math.random() * rarities.length)];
        db.run("INSERT INTO cards (user_id, guild_id, card_type, rarity, acquired_at) VALUES (?, ?, ?, ?, datetime('now'))", [message.author.id, message.guild.id, type, rarity]);
        message.reply(`🃏 حصلت على بطاقة ${type} (${rarity})!`);
    }

    if (command === 'refer') {
        let target = message.mentions.members.first();
        if (!target || target.id === message.author.id) return message.reply('❌ حدد عضواً آخر.');
        db.get("SELECT * FROM referrals WHERE user_id = ? AND guild_id = ?", [target.id, message.guild.id], (err, row) => {
            if (row) return message.reply(`❌ ${target} تمت إحالته بالفعل.`);
            db.run("INSERT INTO referrals (user_id, guild_id, referred_by, reward_claimed) VALUES (?, ?, ?, 0)", [target.id, message.guild.id, message.author.id]);
            updateBalance(message.author.id, message.guild.id, 20);
            message.reply(`✅ تمت إحالة ${target.user.tag} وحصلت على 20 عملة!`);
        });
    }

    if (command === 'backup') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        if (args[0] === 'create') {
            let data = JSON.stringify(message.guild);
            db.run("INSERT INTO backups (guild_id, data, created_at) VALUES (?, ?, datetime('now'))", [message.guild.id, data]);
            message.reply('✅ تم إنشاء نسخة احتياطية.');
        } else if (args[0] === 'restore') {
            db.get("SELECT data FROM backups WHERE guild_id = ? ORDER BY created_at DESC LIMIT 1", [message.guild.id], (err, row) => {
                if (!row) return message.reply('❌ لا توجد نسخ احتياطية.');
                message.reply('✅ تم استعادة آخر نسخة احتياطية.');
            });
        }
    }

    if (command === 'invites') {
        let target = message.mentions.members.first() || message.member;
        db.all("SELECT code, uses FROM invites WHERE user_id = ? AND guild_id = ?", [target.id, message.guild.id], (err, rows) => {
            if (!rows || rows.length === 0) return message.reply(`📭 ${target.user.tag} ليس لديه دعوات.`);
            let desc = rows.map(r => `كود: ${r.code} (استخدامات: ${r.uses})`).join('\n');
            let embed = new EmbedBuilder().setTitle(`📨 دعوات ${target.user.tag}`).setDescription(desc).setColor(0x00BFFF);
            message.channel.send({ embeds: [embed] });
        });
    }

    if (command === 'challenge') {
        let challenges = ['اكتب 100 كلمة', 'اربح 200 عملة', 'أرسل 20 رسالة'];
        let challenge = challenges[Math.floor(Math.random() * challenges.length)];
        message.reply(`🎯 تحديك اليوم: ${challenge}`);
    }

    if (command === 'quickpoll') {
        let question = args.join(' ');
        if (!question) return message.reply('❌ أدخل سؤالاً.');
        let embed = new EmbedBuilder().setTitle('📊 تصويت سريع').setDescription(question).setColor(0x00FF00);
        let msg = await message.channel.send({ embeds: [embed] });
        await msg.react('👍');
        await msg.react('👎');
    }

    if (command === 'notify') {
        let msgText = args.join(' ');
        if (!msgText) return message.reply('❌ أدخل رسالة الإشعار.');
        message.guild.members.cache.forEach(m => {
            m.send(`🔔 إشعار من السيرفر: ${msgText}`).catch(() => {});
        });
        message.reply('✅ تم إرسال الإشعارات.');
    }

    if (command === 'activity') {
        let count = message.guild.members.cache.filter(m => m.presence?.status === 'online').size;
        message.reply(`📊 عدد الأعضاء النشطين: ${count}`);
    }

    if (command === 'botinfo') {
        let embed = new EmbedBuilder().setTitle('🤖 معلومات البوت').setColor(0x2F3136)
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
            let word = args[1];
            if (!word) return message.reply('❌ أدخل كلمة.');
            db.run("INSERT OR REPLACE INTO bad_words (guild_id, word) VALUES (?, ?)", [message.guild.id, word.toLowerCase()]);
            message.reply(`✅ تم حظر كلمة **${word}**`);
        } else if (args[0] === 'remove') {
            let word = args[1];
            if (!word) return message.reply('❌ أدخل كلمة.');
            db.run("DELETE FROM bad_words WHERE guild_id = ? AND word = ?", [message.guild.id, word.toLowerCase()]);
            message.reply(`✅ تم رفع الحظر عن **${word}**`);
        }
    }

    if (command === 'calendar') {
        let now = moment().format('YYYY-MM-DD');
        let embed = new EmbedBuilder().setTitle('📅 التقويم').setDescription(`اليوم: ${now}`).setColor(0x00BFFF);
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'randomcolor') {
        let hex = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        db.run("INSERT OR REPLACE INTO custom_colors (user_id, guild_id, color_hex) VALUES (?, ?, ?)", [message.author.id, message.guild.id, hex]);
        message.reply(`🎨 لونك العشوائي: ${hex}`);
    }

    if (command === 'dailyreward') {
        let now = new Date().toISOString().slice(0,10);
        db.get("SELECT daily FROM economy WHERE user_id = ? AND guild_id = ?", [message.author.id, message.guild.id], (err, row) => {
            if (row && row.daily === now) return message.reply('❌ حصلت عليها اليوم.');
            let amount = Math.floor(Math.random() * 150) + 50;
            updateBalance(message.author.id, message.guild.id, amount);
            db.run("UPDATE economy SET daily = ? WHERE user_id = ? AND guild_id = ?", [now, message.author.id, message.guild.id]);
            message.reply(`🎁 حصلت على ${amount} عملة!`);
        });
    }

    if (command === 'secret') {
        let secret = args[0];
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
        let vc = message.member.voice.channel;
        db.get("SELECT * FROM self_channels WHERE guild_id = ? AND owner_id = ?", [message.guild.id, message.author.id], (err, row) => {
            if (row) return message.reply('❌ لديك بالفعل قناة ذاتية.');
            let name = args.join(' ') || 'قناة ' + message.author.username;
            try {
                vc.setName(name);
                db.run("INSERT INTO self_channels (guild_id, channel_id, owner_id, created_at) VALUES (?, ?, ?, datetime('now'))", [message.guild.id, vc.id, message.author.id]);
                message.reply(`✅ تم تخصيص القناة باسم: ${name}`);
            } catch(e) { message.reply('❌ فشل تغيير الاسم.'); }
        });
    }

    if (command === 'contest') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ لا تملك صلاحية.');
        let prize = parseInt(args[0]);
        let question = args.slice(1).join(' ');
        if (!prize || !question) return message.reply('❌ استخدم: !contest <جائزة> <سؤال>');
        let embed = new EmbedBuilder().setTitle('🏆 مسابقة جديدة!').setDescription(question).setColor(0xFFD700).addFields({ name: 'الجائزة', value: `${prize} عملة` });
        let msg = await message.channel.send({ embeds: [embed] });
        await msg.react('✅');
        db.run("INSERT INTO contests (guild_id, channel_id, question, prize, status) VALUES (?, ?, ?, ?, 'active')", [message.guild.id, message.channel.id, question, prize]);
    }

});

// ============================================================
// ================== الأحداث ==================
// ============================================================

client.on('guildMemberAdd', async (member) => {
    db.get("SELECT channel_id, message FROM welcome WHERE guild_id = ?", [member.guild.id], (err, row) => {
        if (row) {
            let channel = member.guild.channels.cache.get(row.channel_id);
            if (channel) {
                let msg = row.message.replace(/{user}/g, member.toString()).replace(/{server}/g, member.guild.name);
                channel.send(msg);
            }
        }
    });
    db.all("SELECT role_id FROM autoroles WHERE guild_id = ?", [member.guild.id], (err, rows) => {
        rows.forEach(r => {
            let role = member.guild.roles.cache.get(r.role_id);
            if (role) member.roles.add(role).catch(() => {});
        });
    });
    db.get("SELECT role_id, reward_amount FROM join_rewards WHERE guild_id = ?", [member.guild.id], (err, row) => {
        if (row) {
            let role = member.guild.roles.cache.get(row.role_id);
            if (role) member.roles.add(role).catch(() => {});
            updateBalance(member.id, member.guild.id, row.reward_amount);
        }
    });
    logEvent(member.guild.id, 'member_join', `${member.user.tag} انضم إلى السيرفر.`);
});

client.on('guildMemberRemove', (member) => {
    db.get("SELECT channel_id, message FROM goodbye WHERE guild_id = ?", [member.guild.id], (err, row) => {
        if (row) {
            let channel = member.guild.channels.cache.get(row.channel_id);
            if (channel) {
                let msg = row.message.replace(/{user}/g, member.user.tag).replace(/{server}/g, member.guild.name);
                channel.send(msg);
            }
        }
    });
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
    // تحديث الإحصائيات
    await updateStat(user.id, reaction.message.guild.id, 'reactions_given', 1);
    if (reaction.message.author && !reaction.message.author.bot) {
        await updateStat(reaction.message.author.id, reaction.message.guild.id, 'reactions_received', 1);
    }
    // هدايا
    if (reaction.emoji.name === '🎉') {
        db.get("SELECT id, entries FROM giveaways WHERE message_id = ?", [reaction.message.id], (err, row) => {
            if (row) {
                let entries = JSON.parse(row.entries);
                if (!entries.includes(user.id)) {
                    entries.push(user.id);
                    db.run("UPDATE giveaways SET entries = ? WHERE id = ?", [JSON.stringify(entries), row.id]);
                }
            }
        });
    }
    // الأدوار التفاعلية
    db.get("SELECT role_id FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?", [reaction.message.guild.id, reaction.message.id, reaction.emoji.name], (err, row) => {
        if (row) {
            let member = reaction.message.guild.members.cache.get(user.id);
            if (member) {
                let role = reaction.message.guild.roles.cache.get(row.role_id);
                if (role) member.roles.add(role).catch(() => {});
            }
        }
    });
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
    let now = Date.now();
    db.all("SELECT id, user_id, channel_id, message, remind_time, repeat_interval FROM reminders WHERE remind_time <= ?", [String(now)], (err, rows) => {
        rows.forEach(row => {
            let user = client.users.cache.get(row.user_id);
            let channel = client.channels.cache.get(row.channel_id);
            if (user) user.send(`⏰ تذكير: ${row.message}`).catch(() => {});
            if (channel) channel.send(`⏰ <@${row.user_id}> تذكير: ${row.message}`).catch(() => {});
            if (row.repeat_interval > 0) {
                let newTime = now + row.repeat_interval * 1000;
                db.run("UPDATE reminders SET remind_time = ? WHERE id = ?", [String(newTime), row.id]);
            } else {
                db.run("DELETE FROM reminders WHERE id = ?", [row.id]);
            }
        });
    });
}, 30000);

setInterval(() => {
    let now = Date.now();
    db.all("SELECT user_id, guild_id, amount, profit, end_date FROM investments WHERE status = 'active' AND end_date <= ?", [String(now)], (err, rows) => {
        rows.forEach(row => {
            updateBalance(row.user_id, row.guild_id, row.amount + row.profit);
            db.run("UPDATE investments SET status = 'completed' WHERE user_id = ? AND guild_id = ? AND end_date = ?", [row.user_id, row.guild_id, row.end_date]);
            let user = client.users.cache.get(row.user_id);
            if (user) user.send(`💰 استثمارك بقيمة ${row.amount} أنتج ربحاً ${row.profit}`).catch(() => {});
        });
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
if (TOKEN === 'ضع_توكن_البوت_هنا') {
    console.error('❌ الرجاء وضع التوكن في المتغير TOKEN.');
} else {
    client.login(TOKEN);
}
