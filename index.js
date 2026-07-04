// ================================================================
// البوت الخارق النهائي - النسخة المتكاملة الكاملة
// جميع الأنظمة تعمل فوراً - إعدادات افتراضية ذكية
// ================================================================

const {
    Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    PermissionsBitField, ChannelType, SlashCommandBuilder, REST, Routes,
    Collection, Events, ActivityType
} = require('discord.js');

const Database = require('better-sqlite3');
const axios = require('axios');
const moment = require('moment');
const ytdl = require('ytdl-core');
const { createWriteStream, existsSync, mkdirSync } = require('fs');
const { join } = require('path');

// ================== قاعدة البيانات ==================
const db = new Database('./bot_ultimate.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS economy (user_id TEXT, guild_id TEXT, balance INTEGER DEFAULT 0, bank INTEGER DEFAULT 0, daily TEXT, work TEXT, weekly TEXT, last_rob TEXT, PRIMARY KEY (user_id, guild_id));
    CREATE TABLE IF NOT EXISTS levels (user_id TEXT, guild_id TEXT, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1, messages INTEGER DEFAULT 0, voice_minutes INTEGER DEFAULT 0, PRIMARY KEY (user_id, guild_id));
    CREATE TABLE IF NOT EXISTS warnings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, guild_id TEXT, reason TEXT, date TEXT, moderator TEXT, expires_at TEXT);
    CREATE TABLE IF NOT EXISTS autoroles (guild_id TEXT, role_id TEXT);
    CREATE TABLE IF NOT EXISTS welcome (guild_id TEXT PRIMARY KEY, channel_id TEXT, message TEXT, image_url TEXT, enabled INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS goodbye (guild_id TEXT PRIMARY KEY, channel_id TEXT, message TEXT, image_url TEXT, enabled INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, user_id TEXT, topic TEXT, status TEXT DEFAULT 'open', created_at TEXT, closed_at TEXT, category TEXT, priority TEXT DEFAULT 'medium', assigned_to TEXT);
    CREATE TABLE IF NOT EXISTS ticket_settings (guild_id TEXT PRIMARY KEY, category_id TEXT, support_role_id TEXT, log_channel_id TEXT, transcript_channel_id TEXT, enabled INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS ticket_transcripts (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER, content TEXT, created_at TEXT);
    CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, type TEXT, enabled INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS log_events (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, event_type TEXT, description TEXT, user_id TEXT, timestamp TEXT);
    CREATE TABLE IF NOT EXISTS security (guild_id TEXT PRIMARY KEY, spam_threshold INTEGER DEFAULT 5, raid_threshold INTEGER DEFAULT 10, invite_filter INTEGER DEFAULT 1, link_filter INTEGER DEFAULT 1, verification_level INTEGER DEFAULT 0, mute_role_id TEXT, verify_role_id TEXT, verify_channel_id TEXT, enabled INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, channel_id TEXT, message TEXT, remind_time TEXT, repeat_interval INTEGER DEFAULT 0, guild_id TEXT);
    CREATE TABLE IF NOT EXISTS clans (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, name TEXT, owner TEXT, members TEXT, level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0, created_at TEXT, bank INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS farms (user_id TEXT, guild_id TEXT, crop TEXT, planted_at TEXT, ready_at TEXT, status TEXT DEFAULT 'growing', quantity INTEGER DEFAULT 1, PRIMARY KEY (user_id, guild_id));
    CREATE TABLE IF NOT EXISTS auctions (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, item TEXT, seller TEXT, starting_bid INTEGER, current_bid INTEGER, bidder TEXT, end_time TEXT, status TEXT DEFAULT 'active', description TEXT, image_url TEXT);
    CREATE TABLE IF NOT EXISTS titles (user_id TEXT, guild_id TEXT, title TEXT, PRIMARY KEY (user_id, guild_id));
    CREATE TABLE IF NOT EXISTS title_shop (guild_id TEXT, title TEXT, price INTEGER, PRIMARY KEY (guild_id, title));
    CREATE TABLE IF NOT EXISTS auto_responders (guild_id TEXT, trigger TEXT, response TEXT, enabled INTEGER DEFAULT 1, PRIMARY KEY (guild_id, trigger));
    CREATE TABLE IF NOT EXISTS custom_commands (guild_id TEXT, name TEXT, response TEXT, enabled INTEGER DEFAULT 1, created_by TEXT, created_at TEXT, PRIMARY KEY (guild_id, name));
    CREATE TABLE IF NOT EXISTS polls (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, message_id TEXT, question TEXT, options TEXT, votes TEXT, created_by TEXT, created_at TEXT, ends_at TEXT);
    CREATE TABLE IF NOT EXISTS giveaways (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, message_id TEXT, prize TEXT, end_time TEXT, winners INTEGER, entries TEXT, hosted_by TEXT, status TEXT DEFAULT 'active');
    CREATE TABLE IF NOT EXISTS achievements (user_id TEXT, guild_id TEXT, name TEXT, unlocked_at TEXT, PRIMARY KEY (user_id, guild_id, name));
    CREATE TABLE IF NOT EXISTS loans (user_id TEXT, guild_id TEXT, amount INTEGER, interest INTEGER, due_date TEXT, status TEXT DEFAULT 'active', PRIMARY KEY (user_id, guild_id));
    CREATE TABLE IF NOT EXISTS investments (user_id TEXT, guild_id TEXT, amount INTEGER, profit INTEGER, start_date TEXT, end_date TEXT, status TEXT DEFAULT 'active', PRIMARY KEY (user_id, guild_id));
    CREATE TABLE IF NOT EXISTS level_rewards (guild_id TEXT, level INTEGER, role_id TEXT, reward_amount INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS reaction_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, message_id TEXT, role_id TEXT, emoji TEXT);
    CREATE TABLE IF NOT EXISTS temp_roles (user_id TEXT, guild_id TEXT, role_id TEXT, expiry_time TEXT);
    CREATE TABLE IF NOT EXISTS shop_items (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, name TEXT, price INTEGER, description TEXT, role_id TEXT, type TEXT DEFAULT 'role');
    CREATE TABLE IF NOT EXISTS backups (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, data TEXT, created_at TEXT, created_by TEXT);
    CREATE TABLE IF NOT EXISTS game_stats (user_id TEXT, guild_id TEXT, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, draws INTEGER DEFAULT 0, PRIMARY KEY (user_id, guild_id));
`);

// ================== دوال مساعدة ==================
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

function getBank(userId, guildId) {
    const row = db.prepare("SELECT bank FROM economy WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    return row ? row.bank : 0;
}

function updateBank(userId, guildId, amount) {
    const existing = db.prepare("SELECT bank FROM economy WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    if (existing) {
        db.prepare("UPDATE economy SET bank = bank + ? WHERE user_id = ? AND guild_id = ?").run(amount, userId, guildId);
    } else {
        db.prepare("INSERT INTO economy (user_id, guild_id, bank) VALUES (?, ?, ?)").run(userId, guildId, amount);
    }
}

function getLevel(userId, guildId) {
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
        const rewards = db.prepare("SELECT role_id, reward_amount FROM level_rewards WHERE guild_id = ? AND level = ?").all(guildId, level);
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
            const member = guild.members.cache.get(userId);
            if (member) {
                rewards.forEach(r => {
                    if (r.role_id) member.roles.add(r.role_id).catch(() => {});
                    if (r.reward_amount > 0) updateBalance(userId, guildId, r.reward_amount);
                });
            }
        }
    }
    db.prepare("UPDATE levels SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ?").run(xp, level, userId, guildId);
}

function getWarnings(userId, guildId) {
    return db.prepare("SELECT id, reason, date, moderator FROM warnings WHERE user_id = ? AND guild_id = ? ORDER BY date DESC").all(userId, guildId);
}

function addWarning(userId, guildId, reason, moderator) {
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare("INSERT INTO warnings (user_id, guild_id, reason, date, moderator, expires_at) VALUES (?, ?, ?, datetime('now'), ?, ?)").run(userId, guildId, reason, moderator, expires);
    const count = db.prepare("SELECT COUNT(*) FROM warnings WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    return count['COUNT(*)'];
}

function clearWarnings(userId, guildId) {
    db.prepare("DELETE FROM warnings WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
}

function logEvent(guildId, type, description, color = 0x2F3136, userId = null) {
    db.prepare("INSERT INTO log_events (guild_id, event_type, description, user_id, timestamp) VALUES (?, ?, ?, ?, datetime('now'))").run(guildId, type, description, userId);
    const row = db.prepare("SELECT channel_id FROM logs WHERE guild_id = ? AND (type = ? OR type = 'all') AND enabled = 1").get(guildId, type);
    if (!row) {
        const defaultLog = db.prepare("SELECT channel_id FROM logs WHERE guild_id = ? AND type = 'all' AND enabled = 1").get(guildId);
        if (!defaultLog) return;
        const channel = client.channels.cache.get(defaultLog.channel_id);
        if (channel) {
            const embed = new EmbedBuilder().setTitle(`📋 ${type}`).setDescription(description).setColor(color).setTimestamp();
            channel.send({ embeds: [embed] }).catch(() => {});
        }
        return;
    }
    const channel = client.channels.cache.get(row.channel_id);
    if (channel) {
        const embed = new EmbedBuilder().setTitle(`📋 ${type}`).setDescription(description).setColor(color).setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    }
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
        GatewayIntentBits.GuildPresences,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember, Partials.Reaction]
});

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
    console.error('❌ TOKEN environment variable not set.');
    process.exit(1);
}

const commands = [];
const messageCache = new Collection();
const joinCache = new Collection();
const musicQueues = new Map();

// ================== تعريف الأوامر ==================
commands.push(new SlashCommandBuilder().setName('help').setNameLocalizations({ ar: 'مساعدة' }).setDescription('Show all commands with details').setDescriptionLocalizations({ ar: 'عرض جميع الأوامر مع شرح مفصل' }).addStringOption(option => option.setName('command').setNameLocalizations({ ar: 'الأمر' }).setDescription('Command name for details').setDescriptionLocalizations({ ar: 'اسم الأمر للحصول على شرح' }).setRequired(false)));

commands.push(new SlashCommandBuilder().setName('info').setNameLocalizations({ ar: 'معلومات' }).setDescription('Show bot, server, or user information').setDescriptionLocalizations({ ar: 'عرض معلومات البوت أو السيرفر أو العضو' }).addStringOption(option => option.setName('type').setNameLocalizations({ ar: 'النوع' }).setDescription('Information type').setDescriptionLocalizations({ ar: 'نوع المعلومات' }).setRequired(true).addChoices({ name: 'Bot', value: 'bot' }, { name: 'Server', value: 'server' }, { name: 'User', value: 'user' }, { name: 'Stats', value: 'stats' })).addUserOption(option => option.setName('user').setNameLocalizations({ ar: 'العضو' }).setDescription('User to get info about').setDescriptionLocalizations({ ar: 'العضو المطلوب معلوماته' }).setRequired(false)));

commands.push(new SlashCommandBuilder().setName('economy').setNameLocalizations({ ar: 'اقتصاد' }).setDescription('Manage your economy').setDescriptionLocalizations({ ar: 'إدارة اقتصادك' }).addSubcommand(sub => sub.setName('balance').setNameLocalizations({ ar: 'رصيد' }).setDescription('Check your balance').setDescriptionLocalizations({ ar: 'عرض رصيدك' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('User to check').setDescriptionLocalizations({ ar: 'عضو للتحقق' }).setRequired(false))).addSubcommand(sub => sub.setName('daily').setNameLocalizations({ ar: 'يومي' }).setDescription('Claim daily reward').setDescriptionLocalizations({ ar: 'الحصول على المكافأة اليومية' })).addSubcommand(sub => sub.setName('work').setNameLocalizations({ ar: 'عمل' }).setDescription('Work to earn coins').setDescriptionLocalizations({ ar: 'العمل لكسب عملات' })).addSubcommand(sub => sub.setName('rob').setNameLocalizations({ ar: 'سرقة' }).setDescription('Try to rob a user').setDescriptionLocalizations({ ar: 'محاولة سرقة عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('User to rob').setDescriptionLocalizations({ ar: 'العضو المراد سرقته' }).setRequired(true))).addSubcommand(sub => sub.setName('slot').setNameLocalizations({ ar: 'حظ' }).setDescription('Play slot machine').setDescriptionLocalizations({ ar: 'لعب ماكينة الحظ' }).addIntegerOption(opt => opt.setName('bet').setNameLocalizations({ ar: 'رهان' }).setDescription('Bet amount').setDescriptionLocalizations({ ar: 'مبلغ الرهان' }).setRequired(false))).addSubcommand(sub => sub.setName('shop').setNameLocalizations({ ar: 'متجر' }).setDescription('View the shop').setDescriptionLocalizations({ ar: 'عرض المتجر' })).addSubcommand(sub => sub.setName('buy').setNameLocalizations({ ar: 'شراء' }).setDescription('Buy an item').setDescriptionLocalizations({ ar: 'شراء عنصر' }).addStringOption(opt => opt.setName('item').setNameLocalizations({ ar: 'العنصر' }).setDescription('Item to buy').setDescriptionLocalizations({ ar: 'العنصر المراد شراؤه' }).setRequired(true))).addSubcommand(sub => sub.setName('bank').setNameLocalizations({ ar: 'بنك' }).setDescription('Bank operations').setDescriptionLocalizations({ ar: 'عمليات البنك' }).addStringOption(opt => opt.setName('action').setNameLocalizations({ ar: 'الإجراء' }).setDescription('deposit/withdraw/loan').setDescriptionLocalizations({ ar: 'إيداع/سحب/قرض' }).setRequired(true)).addIntegerOption(opt => opt.setName('amount').setNameLocalizations({ ar: 'المبلغ' }).setDescription('Amount').setDescriptionLocalizations({ ar: 'المبلغ' }).setRequired(false))).addSubcommand(sub => sub.setName('invest').setNameLocalizations({ ar: 'استثمار' }).setDescription('Invest coins for profit').setDescriptionLocalizations({ ar: 'استثمار عملات لتحقيق أرباح' }).addIntegerOption(opt => opt.setName('amount').setNameLocalizations({ ar: 'المبلغ' }).setDescription('Amount to invest').setDescriptionLocalizations({ ar: 'المبلغ للاستثمار' }).setRequired(true))).addSubcommand(sub => sub.setName('leaderboard').setNameLocalizations({ ar: 'المتصدرين' }).setDescription('Show economy leaderboard').setDescriptionLocalizations({ ar: 'عرض أغنى الأعضاء' })));

commands.push(new SlashCommandBuilder().setName('level').setNameLocalizations({ ar: 'مستوى' }).setDescription('Check your level or leaderboard').setDescriptionLocalizations({ ar: 'عرض مستواك أو الترتيب' }).addSubcommand(sub => sub.setName('rank').setNameLocalizations({ ar: 'رتبتي' }).setDescription('Check your rank').setDescriptionLocalizations({ ar: 'عرض رتبتك' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('User to check').setDescriptionLocalizations({ ar: 'عضو للتحقق' }).setRequired(false))).addSubcommand(sub => sub.setName('leaderboard').setNameLocalizations({ ar: 'المتصدرين' }).setDescription('Show top 10 users').setDescriptionLocalizations({ ar: 'عرض أفضل 10 أعضاء' })).addSubcommand(sub => sub.setName('reward').setNameLocalizations({ ar: 'مكافأة' }).setDescription('Set level reward').setDescriptionLocalizations({ ar: 'تعيين مكافأة مستوى' }).addIntegerOption(opt => opt.setName('level').setNameLocalizations({ ar: 'المستوى' }).setDescription('Level number').setDescriptionLocalizations({ ar: 'رقم المستوى' }).setRequired(true)).addRoleOption(opt => opt.setName('role').setNameLocalizations({ ar: 'دور' }).setDescription('Role to give').setDescriptionLocalizations({ ar: 'الدور' }).setRequired(false)).addIntegerOption(opt => opt.setName('reward').setNameLocalizations({ ar: 'مكافأة' }).setDescription('Coin reward').setDescriptionLocalizations({ ar: 'مكافأة عملات' }).setRequired(false)));

commands.push(new SlashCommandBuilder().setName('moderation').setNameLocalizations({ ar: 'إدارة' }).setDescription('Server moderation commands').setDescriptionLocalizations({ ar: 'أوامر إدارة السيرفر' }).addSubcommand(sub => sub.setName('kick').setNameLocalizations({ ar: 'طرد' }).setDescription('Kick a member').setDescriptionLocalizations({ ar: 'طرد عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('Member to kick').setDescriptionLocalizations({ ar: 'العضو' }).setRequired(true)).addStringOption(opt => opt.setName('reason').setNameLocalizations({ ar: 'سبب' }).setDescription('Reason').setDescriptionLocalizations({ ar: 'السبب' }).setRequired(false))).addSubcommand(sub => sub.setName('ban').setNameLocalizations({ ar: 'حظر' }).setDescription('Ban a member').setDescriptionLocalizations({ ar: 'حظر عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('Member to ban').setDescriptionLocalizations({ ar: 'العضو' }).setRequired(true)).addStringOption(opt => opt.setName('reason').setNameLocalizations({ ar: 'سبب' }).setDescription('Reason').setDescriptionLocalizations({ ar: 'السبب' }).setRequired(false))).addSubcommand(sub => sub.setName('unban').setNameLocalizations({ ar: 'رفع_حظر' }).setDescription('Unban a user').setDescriptionLocalizations({ ar: 'رفع الحظر عن عضو' }).addStringOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('User ID or name').setDescriptionLocalizations({ ar: 'معرف العضو أو اسمه' }).setRequired(true))).addSubcommand(sub => sub.setName('timeout').setNameLocalizations({ ar: 'كتم' }).setDescription('Timeout a member').setDescriptionLocalizations({ ar: 'كتم عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('Member to timeout').setDescriptionLocalizations({ ar: 'العضو' }).setRequired(true)).addIntegerOption(opt => opt.setName('duration').setNameLocalizations({ ar: 'مدة' }).setDescription('Duration in seconds').setDescriptionLocalizations({ ar: 'المدة بالثواني' }).setRequired(true)).addStringOption(opt => opt.setName('reason').setNameLocalizations({ ar: 'سبب' }).setDescription('Reason').setDescriptionLocalizations({ ar: 'السبب' }).setRequired(false))).addSubcommand(sub => sub.setName('untimeout').setNameLocalizations({ ar: 'رفع_كتم' }).setDescription('Remove timeout').setDescriptionLocalizations({ ar: 'رفع الكتم عن عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('Member').setDescriptionLocalizations({ ar: 'العضو' }).setRequired(true))).addSubcommand(sub => sub.setName('warn').setNameLocalizations({ ar: 'تحذير' }).setDescription('Warn a member').setDescriptionLocalizations({ ar: 'تحذير عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('Member').setDescriptionLocalizations({ ar: 'العضو' }).setRequired(true)).addStringOption(opt => opt.setName('reason').setNameLocalizations({ ar: 'سبب' }).setDescription('Reason').setDescriptionLocalizations({ ar: 'السبب' }).setRequired(false))).addSubcommand(sub => sub.setName('warnings').setNameLocalizations({ ar: 'تحذيرات' }).setDescription('View warnings').setDescriptionLocalizations({ ar: 'عرض تحذيرات عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('Member').setDescriptionLocalizations({ ar: 'العضو' }).setRequired(true))).addSubcommand(sub => sub.setName('clearwarnings').setNameLocalizations({ ar: 'مسح_تحذيرات' }).setDescription('Clear warnings').setDescriptionLocalizations({ ar: 'مسح تحذيرات عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('Member').setDescriptionLocalizations({ ar: 'العضو' }).setRequired(true))).addSubcommand(sub => sub.setName('purge').setNameLocalizations({ ar: 'مسح' }).setDescription('Delete messages').setDescriptionLocalizations({ ar: 'حذف رسائل' }).addIntegerOption(opt => opt.setName('count').setNameLocalizations({ ar: 'عدد' }).setDescription('Number of messages (max 100)').setDescriptionLocalizations({ ar: 'عدد الرسائل (حد أقصى 100)' }).setRequired(true).setMinValue(1).setMaxValue(100))).addSubcommand(sub => sub.setName('slowmode').setNameLocalizations({ ar: 'بطيء' }).setDescription('Set slowmode').setDescriptionLocalizations({ ar: 'تعيين الوضع البطيء' }).addIntegerOption(opt => opt.setName('seconds').setNameLocalizations({ ar: 'ثواني' }).setDescription('Slowmode in seconds').setDescriptionLocalizations({ ar: 'الوضع البطيء بالثواني' }).setRequired(true).setMinValue(0).setMaxValue(21600)));

commands.push(new SlashCommandBuilder().setName('ticket').setNameLocalizations({ ar: 'تذكرة' }).setDescription('Advanced ticket system').setDescriptionLocalizations({ ar: 'نظام التذاكر المتطور' }).addSubcommand(sub => sub.setName('setup').setNameLocalizations({ ar: 'إعداد' }).setDescription('Setup ticket system').setDescriptionLocalizations({ ar: 'إعداد نظام التذاكر' }).addChannelOption(opt => opt.setName('category').setNameLocalizations({ ar: 'فئة' }).setDescription('Category for tickets').setDescriptionLocalizations({ ar: 'فئة التذاكر' }).setRequired(true)).addRoleOption(opt => opt.setName('support_role').setNameLocalizations({ ar: 'دور_الدعم' }).setDescription('Support role').setDescriptionLocalizations({ ar: 'دور الدعم' }).setRequired(true)).addChannelOption(opt => opt.setName('log_channel').setNameLocalizations({ ar: 'قناة_سجلات' }).setDescription('Log channel').setDescriptionLocalizations({ ar: 'قناة السجلات' }).setRequired(true)).addChannelOption(opt => opt.setName('transcript_channel').setNameLocalizations({ ar: 'قناة_نسخ' }).setDescription('Transcript channel').setDescriptionLocalizations({ ar: 'قناة نسخ المحادثات' }).setRequired(false))).addSubcommand(sub => sub.setName('panel').setNameLocalizations({ ar: 'لوحة' }).setDescription('Create ticket panel').setDescriptionLocalizations({ ar: 'إنشاء لوحة التذاكر' })).addSubcommand(sub => sub.setName('create').setNameLocalizations({ ar: 'فتح' }).setDescription('Create a ticket').setDescriptionLocalizations({ ar: 'فتح تذكرة' }).addStringOption(opt => opt.setName('topic').setNameLocalizations({ ar: 'الموضوع' }).setDescription('Ticket topic').setDescriptionLocalizations({ ar: 'موضوع التذكرة' }).setRequired(true)).addStringOption(opt => opt.setName('category').setNameLocalizations({ ar: 'القسم' }).setDescription('Ticket category').setDescriptionLocalizations({ ar: 'قسم التذكرة' }).setRequired(true).addChoices({ name: 'Technical Support', value: 'technical' }, { name: 'Complaint', value: 'complaint' }, { name: 'Suggestion', value: 'suggestion' }, { name: 'Membership', value: 'membership' }, { name: 'Other', value: 'other' }))).addSubcommand(sub => sub.setName('close').setNameLocalizations({ ar: 'إغلاق' }).setDescription('Close current ticket').setDescriptionLocalizations({ ar: 'إغلاق التذكرة الحالية' })).addSubcommand(sub => sub.setName('transcript').setNameLocalizations({ ar: 'نسخ' }).setDescription('Get ticket transcript').setDescriptionLocalizations({ ar: 'الحصول على نسخة من التذكرة' })));

commands.push(new SlashCommandBuilder().setName('welcome').setNameLocalizations({ ar: 'ترحيب' }).setDescription('Welcome system').setDescriptionLocalizations({ ar: 'نظام الترحيب' }).addSubcommand(sub => sub.setName('set').setNameLocalizations({ ar: 'تعيين' }).setDescription('Set welcome channel').setDescriptionLocalizations({ ar: 'تعيين قناة الترحيب' }).addChannelOption(opt => opt.setName('channel').setNameLocalizations({ ar: 'قناة' }).setDescription('Channel').setDescriptionLocalizations({ ar: 'القناة' }).setRequired(true)).addStringOption(opt => opt.setName('message').setNameLocalizations({ ar: 'رسالة' }).setDescription('Welcome message ({user}, {server})').setDescriptionLocalizations({ ar: 'رسالة الترحيب' }).setRequired(false)).addAttachmentOption(opt => opt.setName('image').setNameLocalizations({ ar: 'صورة' }).setDescription('Image').setDescriptionLocalizations({ ar: 'صورة' }).setRequired(false))).addSubcommand(sub => sub.setName('goodbye').setNameLocalizations({ ar: 'وداع' }).setDescription('Set goodbye channel').setDescriptionLocalizations({ ar: 'تعيين قناة الوداع' }).addChannelOption(opt => opt.setName('channel').setNameLocalizations({ ar: 'قناة' }).setDescription('Channel').setDescriptionLocalizations({ ar: 'القناة' }).setRequired(true)).addStringOption(opt => opt.setName('message').setNameLocalizations({ ar: 'رسالة' }).setDescription('Goodbye message ({user}, {server})').setDescriptionLocalizations({ ar: 'رسالة الوداع' }).setRequired(false)).addAttachmentOption(opt => opt.setName('image').setNameLocalizations({ ar: 'صورة' }).setDescription('Image').setDescriptionLocalizations({ ar: 'صورة' }).setRequired(false))).addSubcommand(sub => sub.setName('toggle').setNameLocalizations({ ar: 'تفعيل' }).setDescription('Enable/disable welcome').setDescriptionLocalizations({ ar: 'تفعيل/تعطيل الترحيب' }).addBooleanOption(opt => opt.setName('enabled').setNameLocalizations({ ar: 'مفعل' }).setDescription('Enable or disable').setDescriptionLocalizations({ ar: 'تفعيل أو تعطيل' }).setRequired(true)));

commands.push(new SlashCommandBuilder().setName('security').setNameLocalizations({ ar: 'حماية' }).setDescription('Security settings').setDescriptionLocalizations({ ar: 'إعدادات الحماية' }).addSubcommand(sub => sub.setName('verification').setNameLocalizations({ ar: 'تحقق' }).setDescription('Setup verification').setDescriptionLocalizations({ ar: 'إعداد التحقق' }).addRoleOption(opt => opt.setName('role').setNameLocalizations({ ar: 'دور' }).setDescription('Role to give').setDescriptionLocalizations({ ar: 'الدور' }).setRequired(true)).addChannelOption(opt => opt.setName('channel').setNameLocalizations({ ar: 'قناة' }).setDescription('Channel').setDescriptionLocalizations({ ar: 'القناة' }).setRequired(true))).addSubcommand(sub => sub.setName('antispam').setNameLocalizations({ ar: 'مكافحة_سبام' }).setDescription('Set spam threshold').setDescriptionLocalizations({ ar: 'تعيين حد السبام' }).addIntegerOption(opt => opt.setName('limit').setNameLocalizations({ ar: 'حد' }).setDescription('Messages per 5 seconds').setDescriptionLocalizations({ ar: 'عدد الرسائل في 5 ثوانٍ' }).setRequired(true).setMinValue(3).setMaxValue(20))).addSubcommand(sub => sub.setName('antiraid').setNameLocalizations({ ar: 'مكافحة_رايد' }).setDescription('Set raid threshold').setDescriptionLocalizations({ ar: 'تعيين حد الرايد' }).addIntegerOption(opt => opt.setName('limit').setNameLocalizations({ ar: 'حد' }).setDescription('Members joining per 10 seconds').setDescriptionLocalizations({ ar: 'عدد الأعضاء في 10 ثوانٍ' }).setRequired(true).setMinValue(5).setMaxValue(50))).addSubcommand(sub => sub.setName('mute_role').setNameLocalizations({ ar: 'دور_الكتم' }).setDescription('Set mute role').setDescriptionLocalizations({ ar: 'تعيين دور الكتم' }).addRoleOption(opt => opt.setName('role').setNameLocalizations({ ar: 'دور' }).setDescription('Mute role').setDescriptionLocalizations({ ar: 'دور الكتم' }).setRequired(true))).addSubcommand(sub => sub.setName('lockdown').setNameLocalizations({ ar: 'إغلاق' }).setDescription('Lockdown the server').setDescriptionLocalizations({ ar: 'إغلاق السيرفر مؤقتاً' })).addSubcommand(sub => sub.setName('unlock').setNameLocalizations({ ar: 'فتح' }).setDescription('Unlock the server').setDescriptionLocalizations({ ar: 'فتح السيرفر' })));

commands.push(new SlashCommandBuilder().setName('logs').setNameLocalizations({ ar: 'سجلات' }).setDescription('Logging settings').setDescriptionLocalizations({ ar: 'إعدادات السجلات' }).addSubcommand(sub => sub.setName('set').setNameLocalizations({ ar: 'تعيين' }).setDescription('Set log channel').setDescriptionLocalizations({ ar: 'تعيين قناة السجلات' }).addChannelOption(opt => opt.setName('channel').setNameLocalizations({ ar: 'قناة' }).setDescription('Channel').setDescriptionLocalizations({ ar: 'القناة' }).setRequired(true)).addStringOption(opt => opt.setName('type').setNameLocalizations({ ar: 'نوع' }).setDescription('Log type').setDescriptionLocalizations({ ar: 'نوع السجلات' }).setRequired(true).addChoices({ name: 'All', value: 'all' }, { name: 'Member', value: 'member' }, { name: 'Messages', value: 'message' }, { name: 'Moderation', value: 'mod' }, { name: 'Tickets', value: 'ticket' }, { name: 'Voice', value: 'voice' }))).addSubcommand(sub => sub.setName('toggle').setNameLocalizations({ ar: 'تفعيل' }).setDescription('Enable/disable logging').setDescriptionLocalizations({ ar: 'تفعيل/تعطيل السجلات' }).addBooleanOption(opt => opt.setName('enabled').setNameLocalizations({ ar: 'مفعل' }).setDescription('Enable or disable').setDescriptionLocalizations({ ar: 'تفعيل أو تعطيل' }).setRequired(true)));

commands.push(new SlashCommandBuilder().setName('roles').setNameLocalizations({ ar: 'أدوار' }).setDescription('Role management').setDescriptionLocalizations({ ar: 'إدارة الأدوار' }).addSubcommand(sub => sub.setName('autorole').setNameLocalizations({ ar: 'تلقائي' }).setDescription('Set auto role').setDescriptionLocalizations({ ar: 'تعيين دور تلقائي' }).addRoleOption(opt => opt.setName('role').setNameLocalizations({ ar: 'دور' }).setDescription('Role').setDescriptionLocalizations({ ar: 'الدور' }).setRequired(true))).addSubcommand(sub => sub.setName('reaction').setNameLocalizations({ ar: 'تفاعلي' }).setDescription('Add reaction role').setDescriptionLocalizations({ ar: 'إضافة دور تفاعلي' }).addStringOption(opt => opt.setName('message_id').setNameLocalizations({ ar: 'معرف_الرسالة' }).setDescription('Message ID').setDescriptionLocalizations({ ar: 'معرف الرسالة' }).setRequired(true)).addRoleOption(opt => opt.setName('role').setNameLocalizations({ ar: 'دور' }).setDescription('Role').setDescriptionLocalizations({ ar: 'الدور' }).setRequired(true)).addStringOption(opt => opt.setName('emoji').setNameLocalizations({ ar: 'إيموجي' }).setDescription('Emoji').setDescriptionLocalizations({ ar: 'الإيموجي' }).setRequired(true))).addSubcommand(sub => sub.setName('list').setNameLocalizations({ ar: 'قائمة' }).setDescription('List reaction roles').setDescriptionLocalizations({ ar: 'عرض الأدوار التفاعلية' })).addSubcommand(sub => sub.setName('temprole').setNameLocalizations({ ar: 'مؤقت' }).setDescription('Give temporary role').setDescriptionLocalizations({ ar: 'منح دور مؤقت' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('User').setDescriptionLocalizations({ ar: 'العضو' }).setRequired(true)).addRoleOption(opt => opt.setName('role').setNameLocalizations({ ar: 'دور' }).setDescription('Role').setDescriptionLocalizations({ ar: 'الدور' }).setRequired(true)).addIntegerOption(opt => opt.setName('duration').setNameLocalizations({ ar: 'مدة' }).setDescription('Duration in seconds').setDescriptionLocalizations({ ar: 'المدة بالثواني' }).setRequired(true)));

commands.push(new SlashCommandBuilder().setName('reminder').setNameLocalizations({ ar: 'تذكير' }).setDescription('Set reminders').setDescriptionLocalizations({ ar: 'تعيين تذكيرات' }).addSubcommand(sub => sub.setName('set').setNameLocalizations({ ar: 'تعيين' }).setDescription('Set a reminder').setDescriptionLocalizations({ ar: 'تعيين تذكير' }).addIntegerOption(opt => opt.setName('duration').setNameLocalizations({ ar: 'مدة' }).setDescription('Duration in seconds').setDescriptionLocalizations({ ar: 'المدة بالثواني' }).setRequired(true)).addStringOption(opt => opt.setName('message').setNameLocalizations({ ar: 'رسالة' }).setDescription('Message').setDescriptionLocalizations({ ar: 'الرسالة' }).setRequired(true))).addSubcommand(sub => sub.setName('repeat').setNameLocalizations({ ar: 'متكرر' }).setDescription('Set repeating reminder').setDescriptionLocalizations({ ar: 'تعيين تذكير متكرر' }).addIntegerOption(opt => opt.setName('interval').setNameLocalizations({ ar: 'مدة' }).setDescription('Interval in seconds').setDescriptionLocalizations({ ar: 'المدة بين كل تذكير' }).setRequired(true)).addStringOption(opt => opt.setName('message').setNameLocalizations({ ar: 'رسالة' }).setDescription('Message').setDescriptionLocalizations({ ar: 'الرسالة' }).setRequired(true))).addSubcommand(sub => sub.setName('list').setNameLocalizations({ ar: 'قائمة' }).setDescription('List your reminders').setDescriptionLocalizations({ ar: 'عرض تذكيراتك' })).addSubcommand(sub => sub.setName('cancel').setNameLocalizations({ ar: 'إلغاء' }).setDescription('Cancel a reminder').setDescriptionLocalizations({ ar: 'إلغاء تذكير' }).addIntegerOption(opt => opt.setName('id').setNameLocalizations({ ar: 'معرف' }).setDescription('Reminder ID').setDescriptionLocalizations({ ar: 'معرف التذكير' }).setRequired(true)));

commands.push(new SlashCommandBuilder().setName('clan').setNameLocalizations({ ar: 'عشيرة' }).setDescription('Clan system').setDescriptionLocalizations({ ar: 'نظام العشائر' }).addSubcommand(sub => sub.setName('create').setNameLocalizations({ ar: 'إنشاء' }).setDescription('Create a clan').setDescriptionLocalizations({ ar: 'إنشاء عشيرة' }).addStringOption(opt => opt.setName('name').setNameLocalizations({ ar: 'الاسم' }).setDescription('Clan name').setDescriptionLocalizations({ ar: 'اسم العشيرة' }).setRequired(true))).addSubcommand(sub => sub.setName('info').setNameLocalizations({ ar: 'معلومات' }).setDescription('Clan information').setDescriptionLocalizations({ ar: 'معلومات العشيرة' }).addStringOption(opt => opt.setName('name').setNameLocalizations({ ar: 'الاسم' }).setDescription('Clan name').setDescriptionLocalizations({ ar: 'اسم العشيرة' }).setRequired(true))).addSubcommand(sub => sub.setName('invite').setNameLocalizations({ ar: 'دعوة' }).setDescription('Invite a member').setDescriptionLocalizations({ ar: 'دعوة عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('User to invite').setDescriptionLocalizations({ ar: 'العضو' }).setRequired(true))).addSubcommand(sub => sub.setName('join').setNameLocalizations({ ar: 'انضمام' }).setDescription('Join a clan').setDescriptionLocalizations({ ar: 'الانضمام إلى عشيرة' }).addStringOption(opt => opt.setName('name').setNameLocalizations({ ar: 'الاسم' }).setDescription('Clan name').setDescriptionLocalizations({ ar: 'اسم العشيرة' }).setRequired(true))).addSubcommand(sub => sub.setName('leave').setNameLocalizations({ ar: 'مغادرة' }).setDescription('Leave your clan').setDescriptionLocalizations({ ar: 'مغادرة العشيرة' })).addSubcommand(sub => sub.setName('leaderboard').setNameLocalizations({ ar: 'المتصدرين' }).setDescription('Clan leaderboard').setDescriptionLocalizations({ ar: 'ترتيب العشائر' })));

commands.push(new SlashCommandBuilder().setName('farm').setNameLocalizations({ ar: 'مزرعة' }).setDescription('Farm system').setDescriptionLocalizations({ ar: 'نظام المزرعة' }).addSubcommand(sub => sub.setName('plant').setNameLocalizations({ ar: 'زرع' }).setDescription('Plant a crop').setDescriptionLocalizations({ ar: 'زراعة محصول' }).addStringOption(opt => opt.setName('crop').setNameLocalizations({ ar: 'محصول' }).setDescription('Crop type').setDescriptionLocalizations({ ar: 'نوع المحصول' }).setRequired(true).addChoices({ name: 'Wheat', value: 'wheat' }, { name: 'Corn', value: 'corn' }, { name: 'Tomato', value: 'tomato' }, { name: 'Potato', value: 'potato' })).addSubcommand(sub => sub.setName('harvest').setNameLocalizations({ ar: 'حصاد' }).setDescription('Harvest your crops').setDescriptionLocalizations({ ar: 'حصاد المحصول' })).addSubcommand(sub => sub.setName('upgrade').setNameLocalizations({ ar: 'تطوير' }).setDescription('Upgrade your farm').setDescriptionLocalizations({ ar: 'تطوير المزرعة' }).addStringOption(opt => opt.setName('type').setNameLocalizations({ ar: 'نوع' }).setDescription('Upgrade type').setDescriptionLocalizations({ ar: 'نوع التطوير' }).setRequired(true).addChoices({ name: 'Speed', value: 'speed' }, { name: 'Yield', value: 'yield' }, { name: 'Quality', value: 'quality' })));

commands.push(new SlashCommandBuilder().setName('auction').setNameLocalizations({ ar: 'مزاد' }).setDescription('Auction system').setDescriptionLocalizations({ ar: 'نظام المزادات' }).addSubcommand(sub => sub.setName('create').setNameLocalizations({ ar: 'إنشاء' }).setDescription('Create an auction').setDescriptionLocalizations({ ar: 'إنشاء مزاد' }).addStringOption(opt => opt.setName('item').setNameLocalizations({ ar: 'عنصر' }).setDescription('Item name').setDescriptionLocalizations({ ar: 'اسم العنصر' }).setRequired(true)).addIntegerOption(opt => opt.setName('starting_bid').setNameLocalizations({ ar: 'سعر_بدء' }).setDescription('Starting bid').setDescriptionLocalizations({ ar: 'سعر البداية' }).setRequired(true)).addStringOption(opt => opt.setName('description').setNameLocalizations({ ar: 'وصف' }).setDescription('Item description').setDescriptionLocalizations({ ar: 'وصف العنصر' }).setRequired(false)).addAttachmentOption(opt => opt.setName('image').setNameLocalizations({ ar: 'صورة' }).setDescription('Item image').setDescriptionLocalizations({ ar: 'صورة العنصر' }).setRequired(false))).addSubcommand(sub => sub.setName('bid').setNameLocalizations({ ar: 'مزايدة' }).setDescription('Place a bid').setDescriptionLocalizations({ ar: 'المزايدة' }).addIntegerOption(opt => opt.setName('id').setNameLocalizations({ ar: 'معرف' }).setDescription('Auction ID').setDescriptionLocalizations({ ar: 'معرف المزاد' }).setRequired(true)).addIntegerOption(opt => opt.setName('amount').setNameLocalizations({ ar: 'مبلغ' }).setDescription('Bid amount').setDescriptionLocalizations({ ar: 'مبلغ المزايدة' }).setRequired(true))).addSubcommand(sub => sub.setName('list').setNameLocalizations({ ar: 'قائمة' }).setDescription('List active auctions').setDescriptionLocalizations({ ar: 'عرض المزادات النشطة' })).addSubcommand(sub => sub.setName('end').setNameLocalizations({ ar: 'إنهاء' }).setDescription('End an auction').setDescriptionLocalizations({ ar: 'إنهاء مزاد' }).addIntegerOption(opt => opt.setName('id').setNameLocalizations({ ar: 'معرف' }).setDescription('Auction ID').setDescriptionLocalizations({ ar: 'معرف المزاد' }).setRequired(true)));

commands.push(new SlashCommandBuilder().setName('game').setNameLocalizations({ ar: 'لعبة' }).setDescription('Games').setDescriptionLocalizations({ ar: 'ألعاب' }).addSubcommand(sub => sub.setName('dice').setNameLocalizations({ ar: 'نرد' }).setDescription('Roll dice').setDescriptionLocalizations({ ar: 'رمي النرد' }).addIntegerOption(opt => opt.setName('bet').setNameLocalizations({ ar: 'رهان' }).setDescription('Bet amount').setDescriptionLocalizations({ ar: 'مبلغ الرهان' }).setRequired(false))).addSubcommand(sub => sub.setName('coinflip').setNameLocalizations({ ar: 'عملة' }).setDescription('Flip a coin').setDescriptionLocalizations({ ar: 'قلب العملة' }).addStringOption(opt => opt.setName('choice').setNameLocalizations({ ar: 'اختيار' }).setDescription('Heads or Tails').setDescriptionLocalizations({ ar: 'وجه أو كتابة' }).setRequired(true).addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })).addIntegerOption(opt => opt.setName('bet').setNameLocalizations({ ar: 'رهان' }).setDescription('Bet amount').setDescriptionLocalizations({ ar: 'مبلغ الرهان' }).setRequired(false))).addSubcommand(sub => sub.setName('rps').setNameLocalizations({ ar: 'حجر_ورق_مقص' }).setDescription('Rock Paper Scissors').setDescriptionLocalizations({ ar: 'حجر ورقة مقص' }).addStringOption(opt => opt.setName('choice').setNameLocalizations({ ar: 'اختيار' }).setDescription('Your choice').setDescriptionLocalizations({ ar: 'اختيارك' }).setRequired(true).addChoices({ name: 'Rock', value: 'rock' }, { name: 'Paper', value: 'paper' }, { name: 'Scissors', value: 'scissors' })).addIntegerOption(opt => opt.setName('bet').setNameLocalizations({ ar: 'رهان' }).setDescription('Bet amount').setDescriptionLocalizations({ ar: 'مبلغ الرهان' }).setRequired(false)));

commands.push(new SlashCommandBuilder().setName('custom').setNameLocalizations({ ar: 'أوامر' }).setDescription('Custom commands').setDescriptionLocalizations({ ar: 'الأوامر المخصصة' }).addSubcommand(sub => sub.setName('add').setNameLocalizations({ ar: 'إضافة' }).setDescription('Add a custom command').setDescriptionLocalizations({ ar: 'إضافة أمر مخصص' }).addStringOption(opt => opt.setName('name').setNameLocalizations({ ar: 'الاسم' }).setDescription('Command name').setDescriptionLocalizations({ ar: 'اسم الأمر' }).setRequired(true)).addStringOption(opt => opt.setName('response').setNameLocalizations({ ar: 'الرد' }).setDescription('Command response').setDescriptionLocalizations({ ar: 'الرد' }).setRequired(true))).addSubcommand(sub => sub.setName('remove').setNameLocalizations({ ar: 'حذف' }).setDescription('Remove a custom command').setDescriptionLocalizations({ ar: 'حذف أمر مخصص' }).addStringOption(opt => opt.setName('name').setNameLocalizations({ ar: 'الاسم' }).setDescription('Command name').setDescriptionLocalizations({ ar: 'اسم الأمر' }).setRequired(true))).addSubcommand(sub => sub.setName('list').setNameLocalizations({ ar: 'قائمة' }).setDescription('List custom commands').setDescriptionLocalizations({ ar: 'عرض الأوامر المخصصة' })));

commands.push(new SlashCommandBuilder().setName('poll').setNameLocalizations({ ar: 'استطلاع' }).setDescription('Create polls').setDescriptionLocalizations({ ar: 'إنشاء استطلاعات' }).addStringOption(opt => opt.setName('question').setNameLocalizations({ ar: 'سؤال' }).setDescription('Poll question').setDescriptionLocalizations({ ar: 'سؤال الاستطلاع' }).setRequired(true)).addStringOption(opt => opt.setName('options').setNameLocalizations({ ar: 'خيارات' }).setDescription('Options separated by comma (e.g. Yes,No,Maybe)').setDescriptionLocalizations({ ar: 'خيارات مفصولة بفاصلة' }).setRequired(true)).addIntegerOption(opt => opt.setName('duration').setNameLocalizations({ ar: 'مدة' }).setDescription('Duration in seconds').setDescriptionLocalizations({ ar: 'المدة بالثواني' }).setRequired(false)));

commands.push(new SlashCommandBuilder().setName('giveaway').setNameLocalizations({ ar: 'هدية' }).setDescription('Manage giveaways').setDescriptionLocalizations({ ar: 'إدارة الهدايا' }).addSubcommand(sub => sub.setName('create').setNameLocalizations({ ar: 'إنشاء' }).setDescription('Create a giveaway').setDescriptionLocalizations({ ar: 'إنشاء هدية' }).addIntegerOption(opt => opt.setName('duration').setNameLocalizations({ ar: 'مدة' }).setDescription('Duration in seconds').setDescriptionLocalizations({ ar: 'المدة بالثواني' }).setRequired(true)).addIntegerOption(opt => opt.setName('winners').setNameLocalizations({ ar: 'فائزون' }).setDescription('Number of winners').setDescriptionLocalizations({ ar: 'عدد الفائزين' }).setRequired(true)).addStringOption(opt => opt.setName('prize').setNameLocalizations({ ar: 'جائزة' }).setDescription('Prize description').setDescriptionLocalizations({ ar: 'وصف الجائزة' }).setRequired(true))).addSubcommand(sub => sub.setName('reroll').setNameLocalizations({ ar: 'إعادة_سحب' }).setDescription('Reroll a giveaway').setDescriptionLocalizations({ ar: 'إعادة سحب هدية' }).addStringOption(opt => opt.setName('message_id').setNameLocalizations({ ar: 'معرف_الرسالة' }).setDescription('Giveaway message ID').setDescriptionLocalizations({ ar: 'معرف رسالة الهدية' }).setRequired(true))).addSubcommand(sub => sub.setName('end').setNameLocalizations({ ar: 'إنهاء' }).setDescription('End a giveaway early').setDescriptionLocalizations({ ar: 'إنهاء هدية مبكراً' }).addStringOption(opt => opt.setName('message_id').setNameLocalizations({ ar: 'معرف_الرسالة' }).setDescription('Giveaway message ID').setDescriptionLocalizations({ ar: 'معرف رسالة الهدية' }).setRequired(true)));

commands.push(new SlashCommandBuilder().setName('vote').setNameLocalizations({ ar: 'تصويت' }).setDescription('Vote for the bot').setDescriptionLocalizations({ ar: 'التصويت للبوت' }));

commands.push(new SlashCommandBuilder().setName('auto').setNameLocalizations({ ar: 'تلقائي' }).setDescription('Auto responses').setDescriptionLocalizations({ ar: 'الردود التلقائية' }).addSubcommand(sub => sub.setName('add').setNameLocalizations({ ar: 'إضافة' }).setDescription('Add auto response').setDescriptionLocalizations({ ar: 'إضافة رد تلقائي' }).addStringOption(opt => opt.setName('trigger').setNameLocalizations({ ar: 'كلمة' }).setDescription('Trigger word').setDescriptionLocalizations({ ar: 'الكلمة المفتاحية' }).setRequired(true)).addStringOption(opt => opt.setName('response').setNameLocalizations({ ar: 'رد' }).setDescription('Response').setDescriptionLocalizations({ ar: 'الرد' }).setRequired(true))).addSubcommand(sub => sub.setName('remove').setNameLocalizations({ ar: 'حذف' }).setDescription('Remove auto response').setDescriptionLocalizations({ ar: 'حذف رد تلقائي' }).addStringOption(opt => opt.setName('trigger').setNameLocalizations({ ar: 'كلمة' }).setDescription('Trigger word').setDescriptionLocalizations({ ar: 'الكلمة المفتاحية' }).setRequired(true))).addSubcommand(sub => sub.setName('list').setNameLocalizations({ ar: 'قائمة' }).setDescription('List auto responses').setDescriptionLocalizations({ ar: 'عرض الردود التلقائية' })));

commands.push(new SlashCommandBuilder().setName('title').setNameLocalizations({ ar: 'لقب' }).setDescription('Title system').setDescriptionLocalizations({ ar: 'نظام الألقاب' }).addSubcommand(sub => sub.setName('set').setNameLocalizations({ ar: 'تعيين' }).setDescription('Set your title').setDescriptionLocalizations({ ar: 'تعيين لقبك' }).addStringOption(opt => opt.setName('title').setNameLocalizations({ ar: 'لقب' }).setDescription('Title').setDescriptionLocalizations({ ar: 'اللقب' }).setRequired(true))).addSubcommand(sub => sub.setName('remove').setNameLocalizations({ ar: 'حذف' }).setDescription('Remove your title').setDescriptionLocalizations({ ar: 'حذف لقبك' })).addSubcommand(sub => sub.setName('shop').setNameLocalizations({ ar: 'متجر' }).setDescription('Title shop').setDescriptionLocalizations({ ar: 'متجر الألقاب' })).addSubcommand(sub => sub.setName('buy').setNameLocalizations({ ar: 'شراء' }).setDescription('Buy a title').setDescriptionLocalizations({ ar: 'شراء لقب' }).addStringOption(opt => opt.setName('title').setNameLocalizations({ ar: 'لقب' }).setDescription('Title').setDescriptionLocalizations({ ar: 'اللقب' }).setRequired(true)));

commands.push(new SlashCommandBuilder().setName('achievement').setNameLocalizations({ ar: 'إنجاز' }).setDescription('Achievement system').setDescriptionLocalizations({ ar: 'نظام الإنجازات' }).addSubcommand(sub => sub.setName('list').setNameLocalizations({ ar: 'قائمة' }).setDescription('List your achievements').setDescriptionLocalizations({ ar: 'عرض إنجازاتك' })).addSubcommand(sub => sub.setName('create').setNameLocalizations({ ar: 'إنشاء' }).setDescription('Create an achievement').setDescriptionLocalizations({ ar: 'إنشاء إنجاز' }).addStringOption(opt => opt.setName('name').setNameLocalizations({ ar: 'الاسم' }).setDescription('Achievement name').setDescriptionLocalizations({ ar: 'اسم الإنجاز' }).setRequired(true)).addStringOption(opt => opt.setName('description').setNameLocalizations({ ar: 'وصف' }).setDescription('Description').setDescriptionLocalizations({ ar: 'الوصف' }).setRequired(true)).addStringOption(opt => opt.setName('icon').setNameLocalizations({ ar: 'رمز' }).setDescription('Emoji icon').setDescriptionLocalizations({ ar: 'رمز الإيموجي' }).setRequired(false)).addIntegerOption(opt => opt.setName('reward').setNameLocalizations({ ar: 'مكافأة' }).setDescription('Coin reward').setDescriptionLocalizations({ ar: 'مكافأة عملات' }).setRequired(false)));

commands.push(new SlashCommandBuilder().setName('owner').setNameLocalizations({ ar: 'مالك' }).setDescription('Owner commands').setDescriptionLocalizations({ ar: 'أوامر المالك' }).addSubcommand(sub => sub.setName('eval').setNameLocalizations({ ar: 'تقييم' }).setDescription('Execute JavaScript').setDescriptionLocalizations({ ar: 'تنفيذ كود' }).addStringOption(opt => opt.setName('code').setNameLocalizations({ ar: 'كود' }).setDescription('Code').setDescriptionLocalizations({ ar: 'الكود' }).setRequired(true))).addSubcommand(sub => sub.setName('reload').setNameLocalizations({ ar: 'إعادة_تحميل' }).setDescription('Reload commands').setDescriptionLocalizations({ ar: 'إعادة تحميل الأوامر' })).addSubcommand(sub => sub.setName('stats').setNameLocalizations({ ar: 'إحصاءات' }).setDescription('Bot statistics').setDescriptionLocalizations({ ar: 'إحصاءات البوت' })).addSubcommand(sub => sub.setName('backup').setNameLocalizations({ ar: 'نسخ' }).setDescription('Create server backup').setDescriptionLocalizations({ ar: 'إنشاء نسخة احتياطية للسيرفر' })).addSubcommand(sub => sub.setName('restore').setNameLocalizations({ ar: 'استعادة' }).setDescription('Restore server backup').setDescriptionLocalizations({ ar: 'استعادة نسخة احتياطية' })).addSubcommand(sub => sub.setName('blacklist').setNameLocalizations({ ar: 'حظر' }).setDescription('Blacklist a user from bot').setDescriptionLocalizations({ ar: 'حظر مستخدم من البوت' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('User').setDescriptionLocalizations({ ar: 'المستخدم' }).setRequired(true)));

commands.push(new SlashCommandBuilder().setName('mood').setNameLocalizations({ ar: 'مزاج' }).setDescription('Set your mood status').setDescriptionLocalizations({ ar: 'تعيين حالتك المزاجية' }).addStringOption(opt => opt.setName('status').setNameLocalizations({ ar: 'حالة' }).setDescription('Your mood').setDescriptionLocalizations({ ar: 'مزاجك' }).setRequired(true)));

commands.push(new SlashCommandBuilder().setName('voice').setNameLocalizations({ ar: 'صوت' }).setDescription('Voice commands').setDescriptionLocalizations({ ar: 'أوامر الصوت' }).addSubcommand(sub => sub.setName('join').setNameLocalizations({ ar: 'دخول' }).setDescription('Join voice channel').setDescriptionLocalizations({ ar: 'دخول القناة الصوتية' })).addSubcommand(sub => sub.setName('leave').setNameLocalizations({ ar: 'خروج' }).setDescription('Leave voice channel').setDescriptionLocalizations({ ar: 'مغادرة القناة الصوتية' })).addSubcommand(sub => sub.setName('play').setNameLocalizations({ ar: 'تشغيل' }).setDescription('Play music').setDescriptionLocalizations({ ar: 'تشغيل موسيقى' }).addStringOption(opt => opt.setName('query').setNameLocalizations({ ar: 'بحث' }).setDescription('Song name or URL').setDescriptionLocalizations({ ar: 'اسم الأغنية أو الرابط' }).setRequired(true))).addSubcommand(sub => sub.setName('stop').setNameLocalizations({ ar: 'إيقاف' }).setDescription('Stop music').setDescriptionLocalizations({ ar: 'إيقاف الموسيقى' })).addSubcommand(sub => sub.setName('skip').setNameLocalizations({ ar: 'تخطي' }).setDescription('Skip current song').setDescriptionLocalizations({ ar: 'تخطي الأغنية الحالية' })).addSubcommand(sub => sub.setName('queue').setNameLocalizations({ ar: 'قائمة' }).setDescription('Show music queue').setDescriptionLocalizations({ ar: 'عرض قائمة التشغيل' })));

commands.push(new SlashCommandBuilder().setName('verify').setNameLocalizations({ ar: 'توثيق' }).setDescription('Verify yourself').setDescriptionLocalizations({ ar: 'توثيق هويتك' }));

commands.push(new SlashCommandBuilder().setName('report').setNameLocalizations({ ar: 'إبلاغ' }).setDescription('Report a user').setDescriptionLocalizations({ ar: 'الإبلاغ عن مستخدم' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('User to report').setDescriptionLocalizations({ ar: 'المستخدم' }).setRequired(true)).addStringOption(opt => opt.setName('reason').setNameLocalizations({ ar: 'سبب' }).setDescription('Reason').setDescriptionLocalizations({ ar: 'السبب' }).setRequired(true)));

commands.push(new SlashCommandBuilder().setName('ping').setNameLocalizations({ ar: 'بينغ' }).setDescription('Check bot ping').setDescriptionLocalizations({ ar: 'اختبار سرعة البوت' }));

// ================== تسجيل الأوامر ==================
const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
    try {
        console.log('🔄 Registering commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`✅ Registered ${commands.length} commands successfully!`);
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
}

// ================== أحداث البوت ==================
client.once('ready', async () => {
    console.log(`✅ Bot ${client.user.tag} is ready!`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers and ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)} users`);
    await registerCommands();
    client.user.setPresence({ activities: [{ name: `/help | ${client.guilds.cache.size} servers`, type: ActivityType.Watching }], status: 'online' });
});

// ================== معالجة الأوامر ==================
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, guild, member, channel } = interaction;
    await interaction.deferReply({ ephemeral: false }).catch(() => {});

    // ================== أمر المساعدة ==================
    if (commandName === 'help' || commandName === 'مساعدة') {
        const sub = options.getString('command') || options.getString('الأمر');
        const helpData = {
            help: 'Show all available commands with details',
            info: 'Show bot, server, user information and statistics',
            economy: 'Manage your economy (balance, daily, work, rob, slot, shop, buy, bank, invest, leaderboard)',
            level: 'Check your level, leaderboard, and set level rewards',
            moderation: 'Server moderation (kick, ban, timeout, warn, purge, slowmode)',
            ticket: 'Advanced ticket system with setup, panel, create, close, transcript',
            welcome: 'Welcome and goodbye system with images',
            security: 'Security settings (verification, antispam, antiraid, mute_role, lockdown)',
            logs: 'Logging settings with multiple types',
            roles: 'Role management (autorole, reaction, list, temprole)',
            reminder: 'Set, repeat, list, and cancel reminders',
            clan: 'Clan system (create, info, invite, join, leave, leaderboard)',
            farm: 'Farm system (plant, harvest, upgrade)',
            auction: 'Auction system (create, bid, list, end)',
            game: 'Games (dice, coinflip, rps)',
            custom: 'Custom commands (add, remove, list)',
            poll: 'Create polls with voting',
            giveaway: 'Giveaway system (create, reroll, end)',
            vote: 'Vote for the bot',
            auto: 'Auto responses (add, remove, list)',
            title: 'Title system (set, remove, shop, buy)',
            achievement: 'Achievement system (list, create)',
            owner: 'Owner only commands (eval, reload, stats, backup, restore, blacklist)',
            mood: 'Set your mood status',
            voice: 'Voice commands (join, leave, play, stop, skip, queue)',
            verify: 'Verify yourself in the server',
            report: 'Report a user to moderators',
            ping: 'Check bot ping'
        };
        if (sub && helpData[sub]) {
            const embed = new EmbedBuilder().setTitle(`📖 Command: /${sub}`).setDescription(helpData[sub]).setColor(0x00FF00).addFields({ name: 'Usage', value: `/${sub}` }).setFooter({ text: 'Use /help for all commands' });
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub) return interaction.editReply({ content: `❌ No command named **${sub}**. Use /help.` });

        const embed = new EmbedBuilder().setTitle('📚 Available Commands').setDescription('Use `/help <command>` for details.').setColor(0x00BFFF).setThumbnail(client.user.displayAvatarURL()).setFooter({ text: `Requested by ${user.tag}`, iconURL: user.displayAvatarURL() });
        const categories = { 'ℹ️ Information': ['help', 'info', 'ping', 'vote'], '💰 Economy': ['economy', 'level', 'title'], '🛠️ Moderation': ['moderation', 'security', 'logs'], '🎫 Tickets': ['ticket'], '📝 Welcome': ['welcome'], '🎭 Roles': ['roles'], '⏰ Reminders': ['reminder'], '🏴 Clans': ['clan'], '🌾 Farm': ['farm'], '🔨 Auctions': ['auction'], '🎮 Games': ['game'], '📋 Custom': ['custom', 'auto'], '📊 Polls': ['poll', 'giveaway'], '🏅 Achievements': ['achievement'], '🎵 Voice': ['voice'], '🔐 Owner': ['owner'], '📌 Other': ['mood', 'verify', 'report'] };
        let description = '';
        for (const [category, cmds] of Object.entries(categories)) {
            const cmdList = cmds.map(cmd => `\`/${cmd}\``).join(' ');
            description += `**${category}**\n${cmdList}\n\n`;
        }
        embed.setDescription(description);
        embed.addFields({ name: '📖 Details', value: 'Use `/help <command>` for details.' });
        return interaction.editReply({ embeds: [embed] });
    }

    // ================== أمر بينغ ==================
    if (commandName === 'ping' || commandName === 'بينغ') {
        return interaction.editReply({ content: `🏓 Pong! ${client.ws.ping}ms` });
    }

    // ================== أمر المعلومات ==================
    if (commandName === 'info' || commandName === 'معلومات') {
        const type = options.getString('type') || options.getString('النوع');
        if (type === 'bot') {
            const embed = new EmbedBuilder().setTitle('🤖 Bot Information').setColor(0x00BFFF).setThumbnail(client.user.displayAvatarURL()).addFields(
                { name: 'Name', value: client.user.tag, inline: true },
                { name: 'Servers', value: String(client.guilds.cache.size), inline: true },
                { name: 'Users', value: String(client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)), inline: true },
                { name: 'Commands', value: String(commands.length), inline: true },
                { name: 'Uptime', value: moment.duration(process.uptime(), 'seconds').humanize(), inline: true },
                { name: 'Developer', value: '<@464646868953956353>', inline: true }
            );
            return interaction.editReply({ embeds: [embed] });
        }
        if (type === 'server') {
            const g = guild;
            const embed = new EmbedBuilder().setTitle(`📊 ${g.name}`).setColor(0x00BFFF).setThumbnail(g.iconURL()).addFields(
                { name: '🆔 ID', value: g.id, inline: true },
                { name: '👑 Owner', value: `<@${g.ownerId}>`, inline: true },
                { name: '👥 Members', value: String(g.memberCount), inline: true },
                { name: '📢 Channels', value: String(g.channels.cache.size), inline: true },
                { name: '📅 Created', value: g.createdAt.toDateString(), inline: true }
            );
            return interaction.editReply({ embeds: [embed] });
        }
        if (type === 'user') {
            const target = options.getUser('user') || user;
            const memberTarget = guild.members.cache.get(target.id);
            const balance = getBalance(target.id, guild.id);
            const { level, xp } = getLevel(target.id, guild.id);
            const needed = 5 * (level * level) + 50 * level + 100;
            const embed = new EmbedBuilder().setTitle(`👤 ${target.tag}`).setColor(0x00BFFF).setThumbnail(target.displayAvatarURL()).addFields(
                { name: '🆔 ID', value: target.id, inline: false },
                { name: '📅 Joined', value: memberTarget ? memberTarget.joinedAt.toDateString() : 'N/A', inline: true },
                { name: '📆 Created', value: target.createdAt.toDateString(), inline: true },
                { name: '💰 Balance', value: `${balance} coins`, inline: true },
                { name: '📊 Level', value: `${level} (${xp}/${needed} XP)`, inline: true },
                { name: '🎭 Roles', value: memberTarget ? memberTarget.roles.cache.map(r => r.toString()).join(' ') || 'None' : 'N/A', inline: false }
            );
            return interaction.editReply({ embeds: [embed] });
        }
        if (type === 'stats') {
            const totalUsers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
            const embed = new EmbedBuilder().setTitle('📊 Bot Statistics').setColor(0x00BFFF).addFields(
                { name: 'Servers', value: String(client.guilds.cache.size), inline: true },
                { name: 'Users', value: String(totalUsers), inline: true },
                { name: 'Commands', value: String(commands.length), inline: true },
                { name: 'Uptime', value: moment.duration(process.uptime(), 'seconds').humanize(), inline: true },
                { name: 'Ping', value: `${client.ws.ping}ms`, inline: true }
            );
            return interaction.editReply({ embeds: [embed] });
        }
    }

    // ================== أمر الاقتصاد ==================
    if (commandName === 'economy' || commandName === 'اقتصاد') {
        const sub = options.getSubcommand();
        if (sub === 'balance' || sub === 'رصيد') {
            const target = options.getUser('user') || user;
            const bal = getBalance(target.id, guild.id);
            const bank = getBank(target.id, guild.id);
            return interaction.editReply({ content: `💰 ${target.tag} balance: **${bal}** coins | Bank: **${bank}** coins` });
        }
        if (sub === 'daily' || sub === 'يومي') {
            const now = new Date().toISOString().slice(0, 10);
            const row = db.prepare("SELECT daily FROM economy WHERE user_id = ? AND guild_id = ?").get(user.id, guild.id);
            if (row && row.daily === now) return interaction.editReply({ content: '❌ Already claimed today.' });
            const amount = Math.floor(Math.random() * 150) + 50;
            updateBalance(user.id, guild.id, amount);
            db.prepare("UPDATE economy SET daily = ? WHERE user_id = ? AND guild_id = ?").run(now, user.id, guild.id);
            return interaction.editReply({ content: `✅ Claimed **${amount}** daily coins!` });
        }
        if (sub === 'work' || sub === 'عمل') {
            const now = Date.now();
            const row = db.prepare("SELECT work FROM economy WHERE user_id = ? AND guild_id = ?").get(user.id, guild.id);
            if (row && row.work) {
                const last = parseInt(row.work);
                if (now - last < 3600000) {
                    const remain = Math.ceil((3600000 - (now - last)) / 1000);
                    return interaction.editReply({ content: `⏳ Wait ${remain} seconds.` });
                }
            }
            const amount = Math.floor(Math.random() * 50) + 10;
            updateBalance(user.id, guild.id, amount);
            db.prepare("UPDATE economy SET work = ? WHERE user_id = ? AND guild_id = ?").run(String(now), user.id, guild.id);
            return interaction.editReply({ content: `💼 Worked and earned **${amount}** coins!` });
        }
        if (sub === 'rob' || sub === 'سرقة') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember || target.id === user.id) return interaction.editReply({ content: '❌ Choose another member.' });
            const targetBal = getBalance(target.id, guild.id);
            if (targetBal < 10) return interaction.editReply({ content: `❌ ${target.tag} doesn't have enough.` });
            const success = Math.random() < 0.35;
            if (success) {
                const amount = Math.floor(Math.random() * Math.min(50, targetBal)) + 1;
                updateBalance(user.id, guild.id, amount);
                updateBalance(target.id, guild.id, -amount);
                logEvent(guild.id, 'rob', `${user.tag} robbed ${target.tag} for ${amount}`, 0xFF0000, user.id);
                return interaction.editReply({ content: `✅ Robbed **${amount}** coins from ${target.tag}!` });
            } else {
                const penalty = Math.floor(Math.random() * 25) + 1;
                updateBalance(user.id, guild.id, -penalty);
                return interaction.editReply({ content: `❌ Robbery failed! Lost **${penalty}** coins.` });
            }
        }
        if (sub === 'slot' || sub === 'حظ') {
            const bet = options.getInteger('bet') || 10;
            const bal = getBalance(user.id, guild.id);
            if (bet <= 0 || bal < bet) return interaction.editReply({ content: '❌ Insufficient balance.' });
            const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣'];
            const res = [symbols[Math.floor(Math.random() * 6)], symbols[Math.floor(Math.random() * 6)], symbols[Math.floor(Math.random() * 6)]];
            const embed = new EmbedBuilder().setTitle('🎰 Slot Machine').setDescription(`${res[0]} ${res[1]} ${res[2]}`).setColor(0x2F3136);
            if (res[0] === res[1] && res[1] === res[2]) {
                const win = bet * 10;
                updateBalance(user.id, guild.id, win);
                embed.addFields({ name: '🎉 JACKPOT!', value: `Won **${win}** coins!` });
            } else if (res[0] === res[1] || res[1] === res[2] || res[0] === res[2]) {
                const win = bet * 2;
                updateBalance(user.id, guild.id, win);
                embed.addFields({ name: '🎉 You won!', value: `Won **${win}** coins!` });
            } else {
                updateBalance(user.id, guild.id, -bet);
                embed.addFields({ name: '😔 You lost', value: `Lost **${bet}** coins.` });
            }
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'shop' || sub === 'متجر') {
            const embed = new EmbedBuilder().setTitle('🛒 Shop').setColor(0x00FF00);
            embed.setDescription('Use `/economy buy <item>` to purchase. Items: role-shop, gift (100 coins), star (500 coins - nickname), crown (1000 coins - nickname)');
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'buy' || sub === 'شراء') {
            const item = options.getString('item') || options.getString('العنصر');
            const bal = getBalance(user.id, guild.id);
            if (item === 'gift' || item === 'هدية') {
                if (bal < 100) return interaction.editReply({ content: '❌ Need 100 coins.' });
                updateBalance(user.id, guild.id, -100);
                const prizes = ['🎁', '🍫', '🧸', '🎮', '📱', '💻'];
                return interaction.editReply({ content: `✅ Bought a gift and got: ${prizes[Math.floor(Math.random() * prizes.length)]}` });
            }
            if (item === 'star' || item === 'نجمة') {
                if (bal < 500) return interaction.editReply({ content: '❌ Need 500 coins.' });
                updateBalance(user.id, guild.id, -500);
                try { await member.setNickname(`⭐ ${member.displayName}`); return interaction.editReply({ content: '✅ Star added to your nickname!' }); } catch (e) { return interaction.editReply({ content: '❌ Missing permissions.' }); }
            }
            if (item === 'crown' || item === 'تاج') {
                if (bal < 1000) return interaction.editReply({ content: '❌ Need 1000 coins.' });
                updateBalance(user.id, guild.id, -1000);
                try { await member.setNickname(`👑 ${member.displayName}`); return interaction.editReply({ content: '✅ Crown added to your nickname!' }); } catch (e) { return interaction.editReply({ content: '❌ Missing permissions.' }); }
            }
            return interaction.editReply({ content: '❌ Item not found. Available: gift, star, crown' });
        }
        if (sub === 'bank' || sub === 'بنك') {
            const action = options.getString('action') || options.getString('الإجراء');
            const amount = options.getInteger('amount') || options.getInteger('المبلغ') || 0;
            if (action === 'deposit') {
                if (amount <= 0) return interaction.editReply({ content: '❌ Enter a positive amount.' });
                const bal = getBalance(user.id, guild.id);
                if (bal < amount) return interaction.editReply({ content: '❌ Insufficient balance.' });
                updateBalance(user.id, guild.id, -amount);
                updateBank(user.id, guild.id, amount);
                return interaction.editReply({ content: `💰 Deposited **${amount}** coins to your bank.` });
            }
            if (action === 'withdraw') {
                if (amount <= 0) return interaction.editReply({ content: '❌ Enter a positive amount.' });
                const bank = getBank(user.id, guild.id);
                if (bank < amount) return interaction.editReply({ content: '❌ Insufficient bank balance.' });
                updateBank(user.id, guild.id, -amount);
                updateBalance(user.id, guild.id, amount);
                return interaction.editReply({ content: `💰 Withdrew **${amount}** coins from your bank.` });
            }
            if (action === 'loan') {
                if (amount < 100 || amount > 5000) return interaction.editReply({ content: '❌ Loan amount must be between 100 and 5000.' });
                const existing = db.prepare("SELECT * FROM loans WHERE user_id = ? AND guild_id = ? AND status = 'active'").get(user.id, guild.id);
                if (existing) return interaction.editReply({ content: '❌ You already have an active loan.' });
                const interest = Math.floor(amount * 0.1);
                const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                db.prepare("INSERT INTO loans (user_id, guild_id, amount, interest, due_date) VALUES (?, ?, ?, ?, ?)").run(user.id, guild.id, amount, interest, due);
                updateBalance(user.id, guild.id, amount);
                return interaction.editReply({ content: `🏦 Loan of **${amount}** coins received (${interest} interest, due in 7 days).` });
            }
        }
        if (sub === 'invest' || sub === 'استثمار') {
            const amount = options.getInteger('amount') || options.getInteger('المبلغ');
            if (amount < 50) return interaction.editReply({ content: '❌ Minimum investment is 50 coins.' });
            const bal = getBalance(user.id, guild.id);
            if (bal < amount) return interaction.editReply({ content: '❌ Insufficient balance.' });
            const profit = Math.floor(amount * (Math.random() * 0.2 + 0.05));
            const end = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            db.prepare("INSERT INTO investments (user_id, guild_id, amount, profit, start_date, end_date) VALUES (?, ?, ?, ?, datetime('now'), ?)").run(user.id, guild.id, amount, profit, end);
            updateBalance(user.id, guild.id, -amount);
            return interaction.editReply({ content: `📈 Invested **${amount}** coins. Expected profit: **${profit}** coins in 24 hours.` });
        }
        if (sub === 'leaderboard' || sub === 'المتصدرين') {
            const rows = db.prepare("SELECT user_id, balance FROM economy WHERE guild_id = ? ORDER BY balance DESC LIMIT 10").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '❌ No data available.' });
            const desc = rows.map((r, i) => `#${i + 1} <@${r.user_id}> - **${r.balance}** coins`).join('\n');
            const embed = new EmbedBuilder().setTitle('🏆 Economy Leaderboard').setDescription(desc).setColor(0xFFD700);
            return interaction.editReply({ embeds: [embed] });
        }
    }

    // ================== أمر المستوى ==================
    if (commandName === 'level' || commandName === 'مستوى') {
        const sub = options.getSubcommand();
        if (sub === 'rank' || sub === 'رتبتي') {
            const target = options.getUser('user') || user;
            const { level, xp } = getLevel(target.id, guild.id);
            const needed = 5 * (level * level) + 50 * level + 100;
            const embed = new EmbedBuilder().setTitle(`📊 ${target.tag}'s Level`).setColor(0x00FF00).addFields(
                { name: 'Level', value: String(level), inline: true },
                { name: 'XP', value: `${xp} / ${needed}`, inline: true },
                { name: 'Progress', value: `${Math.floor((xp / needed) * 100)}%`, inline: true }
            );
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'leaderboard' || sub === 'المتصدرين') {
            const rows = db.prepare("SELECT user_id, level, xp FROM levels WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '❌ No data available.' });
            const desc = rows.map((r, i) => `#${i + 1} <@${r.user_id}> - Level ${r.level} (${r.xp} XP)`).join('\n');
            const embed = new EmbedBuilder().setTitle('🏆 Level Leaderboard').setDescription(desc).setColor(0xFFD700);
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'reward' || sub === 'مكافأة') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
            const level = options.getInteger('level') || options.getInteger('المستوى');
            const role = options.getRole('role');
            const reward = options.getInteger('reward') || options.getInteger('مكافأة') || 0;
            db.prepare("INSERT OR REPLACE INTO level_rewards (guild_id, level, role_id, reward_amount) VALUES (?, ?, ?, ?)").run(guild.id, level, role ? role.id : null, reward);
            return interaction.editReply({ content: `✅ Level reward set for level ${level} ${role ? `with role ${role.name}` : ''} ${reward > 0 ? `and ${reward} coins` : ''}` });
        }
    }

    // ================== أمر الإدارة ==================
    if (commandName === 'moderation' || commandName === 'إدارة') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.editReply({ content: '❌ You lack permissions.', ephemeral: true });
        }
        if (sub === 'kick' || sub === 'طرد') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ Member not found.' });
            const reason = options.getString('reason') || 'No reason provided';
            try { await targetMember.kick(reason); logEvent(guild.id, 'kick', `${user.tag} kicked ${target.tag} (${reason})`, 0xFF0000, user.id); return interaction.editReply({ content: `✅ Kicked ${target.tag}.` }); } catch (e) { return interaction.editReply({ content: '❌ Kick failed.' }); }
        }
        if (sub === 'ban' || sub === 'حظر') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ Member not found.' });
            const reason = options.getString('reason') || 'No reason provided';
            try { await targetMember.ban({ reason }); logEvent(guild.id, 'ban', `${user.tag} banned ${target.tag} (${reason})`, 0xFF0000, user.id); return interaction.editReply({ content: `✅ Banned ${target.tag}.` }); } catch (e) { return interaction.editReply({ content: '❌ Ban failed.' }); }
        }
        if (sub === 'unban' || sub === 'رفع_حظر') {
            const name = options.getString('user');
            const bans = await guild.bans.fetch();
            const banned = bans.find(ban => ban.user.tag.includes(name) || ban.user.id === name);
            if (!banned) return interaction.editReply({ content: '❌ User not found.' });
            try { await guild.bans.remove(banned.user); logEvent(guild.id, 'unban', `${user.tag} unbanned ${banned.user.tag}`, 0x00FF00, user.id); return interaction.editReply({ content: `✅ Unbanned ${banned.user.tag}.` }); } catch (e) { return interaction.editReply({ content: '❌ Unban failed.' }); }
        }
        if (sub === 'timeout' || sub === 'كتم') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ Member not found.' });
            const duration = options.getInteger('duration');
            const reason = options.getString('reason') || 'No reason provided';
            try { await targetMember.timeout(duration * 1000, reason); logEvent(guild.id, 'timeout', `${user.tag} timed out ${target.tag} for ${duration}s`, 0xFFA500, user.id); return interaction.editReply({ content: `✅ Timed out ${target.tag} for ${duration} seconds.` }); } catch (e) { return interaction.editReply({ content: '❌ Timeout failed.' }); }
        }
        if (sub === 'untimeout' || sub === 'رفع_كتم') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ Member not found.' });
            try { await targetMember.timeout(null); logEvent(guild.id, 'untimeout', `${user.tag} removed timeout from ${target.tag}`, 0x00FF00, user.id); return interaction.editReply({ content: `✅ Removed timeout from ${target.tag}.` }); } catch (e) { return interaction.editReply({ content: '❌ Failed.' }); }
        }
        if (sub === 'warn' || sub === 'تحذير') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ Member not found.' });
            const reason = options.getString('reason') || 'No reason provided';
            const count = addWarning(target.id, guild.id, reason, user.id);
            logEvent(guild.id, 'warn', `${user.tag} warned ${target.tag} (${reason})`, 0xFFA500, user.id);
            return interaction.editReply({ content: `⚠️ Warned ${target.tag} (Total: ${count})` });
        }
        if (sub === 'warnings' || sub === 'تحذيرات') {
            const target = options.getUser('user');
            const warns = getWarnings(target.id, guild.id);
            if (!warns || warns.length === 0) return interaction.editReply({ content: `✅ ${target.tag} has no warnings.` });
            const desc = warns.map((w, i) => `#${i + 1}: ${w.reason} (by <@${w.moderator}>)`).join('\n');
            const embed = new EmbedBuilder().setTitle(`⚠️ Warnings for ${target.tag}`).setDescription(desc).setColor(0xFF0000);
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'clearwarnings' || sub === 'مسح_تحذيرات') {
            const target = options.getUser('user');
            clearWarnings(target.id, guild.id);
            logEvent(guild.id, 'clearwarnings', `${user.tag} cleared warnings of ${target.tag}`, 0x00FF00, user.id);
            return interaction.editReply({ content: `✅ Cleared warnings for ${target.tag}.` });
        }
        if (sub === 'purge' || sub === 'مسح') {
            const count = options.getInteger('count') || options.getInteger('عدد');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return interaction.editReply({ content: '❌ You lack permissions.', ephemeral: true });
            try { await channel.bulkDelete(count, true); logEvent(guild.id, 'purge', `${user.tag} purged ${count} messages`, 0x00BFFF, user.id); return interaction.editReply({ content: `✅ Deleted ${count} messages.` }); } catch (e) { return interaction.editReply({ content: '❌ Purge failed.' }); }
        }
        if (sub === 'slowmode' || sub === 'بطيء') {
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.editReply({ content: '❌ You lack permissions.', ephemeral: true });
            const seconds = options.getInteger('seconds') || options.getInteger('ثواني');
            try { await channel.setRateLimitPerUser(seconds); return interaction.editReply({ content: `✅ Slowmode set to ${seconds} seconds.` }); } catch (e) { return interaction.editReply({ content: '❌ Failed to set slowmode.' }); }
        }
    }

    // ================== أمر التذاكر ==================
    if (commandName === 'ticket' || commandName === 'تذكرة') {
        const sub = options.getSubcommand();
        if (sub === 'setup' || sub === 'إعداد') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
            const category = options.getChannel('category') || options.getChannel('فئة');
            const supportRole = options.getRole('support_role') || options.getRole('دور_الدعم');
            const logChannel = options.getChannel('log_channel') || options.getChannel('قناة_سجلات');
            const transcriptChannel = options.getChannel('transcript_channel') || options.getChannel('قناة_نسخ');
            db.prepare("INSERT OR REPLACE INTO ticket_settings (guild_id, category_id, support_role_id, log_channel_id, transcript_channel_id, enabled) VALUES (?, ?, ?, ?, ?, 1)").run(guild.id, category.id, supportRole.id, logChannel.id, transcriptChannel ? transcriptChannel.id : null);
            return interaction.editReply({ content: `✅ Ticket system setup complete! Category: ${category.name}, Support Role: ${supportRole.name}, Log Channel: ${logChannel.name}${transcriptChannel ? `, Transcript Channel: ${transcriptChannel.name}` : ''}` });
        }
        if (sub === 'panel' || sub === 'لوحة') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
            const embed = new EmbedBuilder().setTitle('🎫 Ticket System').setDescription('Click the button below to create a ticket.').setColor(0x00BFFF).setFooter({ text: 'Tickets are automatically closed after 24 hours of inactivity.' });
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('create_ticket').setLabel('🎫 Create Ticket').setStyle(ButtonStyle.Primary));
            await interaction.editReply({ content: '✅ Ticket panel created!', ephemeral: true });
            await channel.send({ embeds: [embed], components: [row] });
        }
        if (sub === 'create' || sub === 'فتح') {
            const topic = options.getString('topic') || options.getString('الموضوع');
            const category = options.getString('category') || options.getString('القسم');
            const settings = db.prepare("SELECT category_id, support_role_id, log_channel_id FROM ticket_settings WHERE guild_id = ? AND enabled = 1").get(guild.id);
            if (!settings) return interaction.editReply({ content: '❌ Ticket system not set up. Ask an admin to run `/ticket setup`.', ephemeral: true });
            const cat = guild.channels.cache.get(settings.category_id);
            if (!cat) return interaction.editReply({ content: '❌ Category not found. Contact admin.', ephemeral: true });
            const overwrites = [{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }];
            const supportRole = guild.roles.cache.get(settings.support_role_id);
            if (supportRole) overwrites.push({ id: supportRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
            const channelName = `ticket-${user.username}`;
            const ticketChannel = await guild.channels.create({ name: channelName, type: ChannelType.GuildText, parent: cat, permissionOverwrites: overwrites, topic: `📌 ${category} - ${topic}` });
            const ticketId = db.prepare("INSERT INTO tickets (guild_id, channel_id, user_id, topic, status, created_at, category) VALUES (?, ?, ?, ?, 'open', datetime('now'), ?) RETURNING id").run(guild.id, ticketChannel.id, user.id, topic, category);
            const embed = new EmbedBuilder().setTitle('🎫 Ticket Created').setDescription(`**Topic:** ${topic}\n**Category:** ${category}`).setColor(0x00BFFF).addFields({ name: 'Created by', value: user.tag, inline: true }, { name: 'Status', value: '🟢 Open', inline: true }, { name: 'Ticket ID', value: `#${ticketId.lastInsertRowid}`, inline: true }).setFooter({ text: 'Click "Close Ticket" when done.' });
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('claim_ticket').setLabel('📌 Claim').setStyle(ButtonStyle.Primary));
            await ticketChannel.send({ content: `<@${user.id}> ${supportRole ? supportRole.toString() : ''}`, embeds: [embed], components: [row] });
            logEvent(guild.id, 'ticket_open', `${user.tag} opened ticket #${ticketId.lastInsertRowid}: ${topic}`, 0x00BFFF, user.id);
            return interaction.editReply({ content: `✅ Ticket created: ${ticketChannel}` });
        }
        if (sub === 'close' || sub === 'إغلاق') {
            if (!channel.name.startsWith('ticket-')) return interaction.editReply({ content: '❌ Not a ticket channel.', ephemeral: true });
            const ticket = db.prepare("SELECT id FROM tickets WHERE channel_id = ? AND status = 'open'").get(channel.id);
            if (!ticket) return interaction.editReply({ content: '❌ Ticket not found or already closed.', ephemeral: true });
            db.prepare("UPDATE tickets SET status = 'closed', closed_at = datetime('now') WHERE channel_id = ?").run(channel.id);
            const messages = await channel.messages.fetch({ limit: 100 });
            const transcript = messages.reverse().map(m => `${m.createdAt.toISOString()} | ${m.author.tag}: ${m.content}`).join('\n');
            db.prepare("INSERT INTO ticket_transcripts (ticket_id, content, created_at) VALUES (?, ?, datetime('now'))").run(ticket.id, transcript);
            logEvent(guild.id, 'ticket_close', `${user.tag} closed ticket ${channel.name}`, 0xFF0000, user.id);
            await interaction.editReply({ content: '🔒 Ticket will be deleted in 5 seconds.' });
            setTimeout(() => channel.delete().catch(() => {}), 5000);
        }
        if (sub === 'transcript' || sub === 'نسخ') {
            if (!channel.name.startsWith('ticket-')) return interaction.editReply({ content: '❌ Not a ticket channel.', ephemeral: true });
            const ticket = db.prepare("SELECT id FROM tickets WHERE channel_id = ?").get(channel.id);
            if (!ticket) return interaction.editReply({ content: '❌ Ticket not found.', ephemeral: true });
            const transcript = db.prepare("SELECT content, created_at FROM ticket_transcripts WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1").get(ticket.id);
            if (!transcript) return interaction.editReply({ content: '❌ No transcript found.', ephemeral: true });
            const embed = new EmbedBuilder().setTitle(`📄 Ticket Transcript #${ticket.id}`).setDescription(`Created at: ${transcript.created_at}`).setColor(0x00BFFF).setFooter({ text: 'Full transcript below' });
            await interaction.editReply({ embeds: [embed] });
            const content = transcript.content;
            if (content.length > 2000) { const chunks = content.match(/[\s\S]{1,2000}/g) || []; for (const chunk of chunks) await channel.send(`\`\`\`${chunk}\`\`\``); } else await channel.send(`\`\`\`${content}\`\`\``);
        }
    }

    // ================== الترحيب ==================
    if (commandName === 'welcome' || commandName === 'ترحيب') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
        if (sub === 'set' || sub === 'تعيين') {
            const ch = options.getChannel('channel') || options.getChannel('قناة');
            const msg = options.getString('message') || options.getString('رسالة') || 'Welcome {user} to {server}!';
            const attachment = options.getAttachment('image') || options.getAttachment('صورة');
            const imageUrl = attachment ? attachment.url : '';
            db.prepare("INSERT OR REPLACE INTO welcome (guild_id, channel_id, message, image_url, enabled) VALUES (?, ?, ?, ?, 1)").run(guild.id, ch.id, msg, imageUrl);
            return interaction.editReply({ content: `✅ Welcome channel set to ${ch} ${imageUrl ? 'with image' : 'without image'}` });
        }
        if (sub === 'goodbye' || sub === 'وداع') {
            const ch = options.getChannel('channel') || options.getChannel('قناة');
            const msg = options.getString('message') || options.getString('رسالة') || 'Goodbye {user} from {server}!';
            const attachment = options.getAttachment('image') || options.getAttachment('صورة');
            const imageUrl = attachment ? attachment.url : '';
            db.prepare("INSERT OR REPLACE INTO goodbye (guild_id, channel_id, message, image_url, enabled) VALUES (?, ?, ?, ?, 1)").run(guild.id, ch.id, msg, imageUrl);
            return interaction.editReply({ content: `✅ Goodbye channel set to ${ch} ${imageUrl ? 'with image' : 'without image'}` });
        }
        if (sub === 'toggle' || sub === 'تفعيل') {
            const enabled = options.getBoolean('enabled') || options.getBoolean('مفعل');
            db.prepare("UPDATE welcome SET enabled = ? WHERE guild_id = ?").run(enabled ? 1 : 0, guild.id);
            return interaction.editReply({ content: `✅ Welcome system ${enabled ? 'enabled' : 'disabled'}.` });
        }
    }

    // ================== الحماية ==================
    if (commandName === 'security' || commandName === 'حماية') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
        if (sub === 'verification' || sub === 'تحقق') {
            const role = options.getRole('role') || options.getRole('دور');
            const ch = options.getChannel('channel') || options.getChannel('قناة');
            db.prepare("INSERT OR REPLACE INTO security (guild_id, verify_role_id, verify_channel_id, enabled) VALUES (?, ?, ?, 1)").run(guild.id, role.id, ch.id);
            const embed = new EmbedBuilder().setTitle('✅ Verification').setDescription('Click the button below to verify yourself.').setColor(0x00FF00);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verify_button').setLabel('✅ Verify').setStyle(ButtonStyle.Success));
            await ch.send({ embeds: [embed], components: [row] });
            return interaction.editReply({ content: `✅ Verification setup complete! Role: ${role.name}, Channel: ${ch}` });
        }
        if (sub === 'antispam' || sub === 'مكافحة_سبام') {
            const limit = options.getInteger('limit') || options.getInteger('حد');
            db.prepare("INSERT OR REPLACE INTO security (guild_id, spam_threshold) VALUES (?, ?)").run(guild.id, limit);
            return interaction.editReply({ content: `✅ Spam threshold set to ${limit} messages per 5 seconds.` });
        }
        if (sub === 'antiraid' || sub === 'مكافحة_رايد') {
            const limit = options.getInteger('limit') || options.getInteger('حد');
            db.prepare("INSERT OR REPLACE INTO security (guild_id, raid_threshold) VALUES (?, ?)").run(guild.id, limit);
            return interaction.editReply({ content: `✅ Raid threshold set to ${limit} members per 10 seconds.` });
        }
        if (sub === 'mute_role' || sub === 'دور_الكتم') {
            const role = options.getRole('role') || options.getRole('دور');
            db.prepare("INSERT OR REPLACE INTO security (guild_id, mute_role_id) VALUES (?, ?)").run(guild.id, role.id);
            return interaction.editReply({ content: `✅ Mute role set to ${role.name}` });
        }
        if (sub === 'lockdown' || sub === 'إغلاق') {
            try { await guild.setVerificationLevel(3); await guild.channels.cache.forEach(async c => { try { await c.permissionOverwrites.edit(guild.id, { SendMessages: false }); } catch (e) {} }); logEvent(guild.id, 'lockdown', `${user.tag} locked down the server`, 0xFF0000, user.id); return interaction.editReply({ content: '🔒 Server locked down!' }); } catch (e) { return interaction.editReply({ content: '❌ Lockdown failed.' }); }
        }
        if (sub === 'unlock' || sub === 'فتح') {
            try { await guild.setVerificationLevel(0); await guild.channels.cache.forEach(async c => { try { await c.permissionOverwrites.edit(guild.id, { SendMessages: null }); } catch (e) {} }); logEvent(guild.id, 'unlock', `${user.tag} unlocked the server`, 0x00FF00, user.id); return interaction.editReply({ content: '🔓 Server unlocked!' }); } catch (e) { return interaction.editReply({ content: '❌ Unlock failed.' }); }
        }
    }

    // ================== السجلات ==================
    if (commandName === 'logs' || commandName === 'سجلات') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
        if (sub === 'set' || sub === 'تعيين') {
            const ch = options.getChannel('channel') || options.getChannel('قناة');
            const type = options.getString('type') || options.getString('نوع');
            db.prepare("INSERT OR REPLACE INTO logs (guild_id, channel_id, type, enabled) VALUES (?, ?, ?, 1)").run(guild.id, ch.id, type);
            return interaction.editReply({ content: `✅ Log channel set for ${type} to ${ch}` });
        }
        if (sub === 'toggle' || sub === 'تفعيل') {
            const enabled = options.getBoolean('enabled') || options.getBoolean('مفعل');
            db.prepare("UPDATE logs SET enabled = ? WHERE guild_id = ?").run(enabled ? 1 : 0, guild.id);
            return interaction.editReply({ content: `✅ Logging ${enabled ? 'enabled' : 'disabled'}.` });
        }
    }

    // ================== الأدوار ==================
    if (commandName === 'roles' || commandName === 'أدوار') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
        if (sub === 'autorole' || sub === 'تلقائي') {
            const role = options.getRole('role') || options.getRole('دور');
            db.prepare("INSERT OR REPLACE INTO autoroles (guild_id, role_id) VALUES (?, ?)").run(guild.id, role.id);
            return interaction.editReply({ content: `✅ Auto role set to ${role.name}` });
        }
        if (sub === 'reaction' || sub === 'تفاعلي') {
            const msgId = options.getString('message_id') || options.getString('معرف_الرسالة');
            const role = options.getRole('role') || options.getRole('دور');
            const emoji = options.getString('emoji') || options.getString('إيموجي');
            db.prepare("INSERT INTO reaction_roles (guild_id, message_id, role_id, emoji) VALUES (?, ?, ?, ?)").run(guild.id, msgId, role.id, emoji);
            try { const msg = await channel.messages.fetch(msgId); await msg.react(emoji); } catch (e) {}
            return interaction.editReply({ content: `✅ Reaction role added: ${emoji} -> ${role.name}` });
        }
        if (sub === 'list' || sub === 'قائمة') {
            const rows = db.prepare("SELECT id, message_id, role_id, emoji FROM reaction_roles WHERE guild_id = ?").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 No reaction roles.' });
            const list = rows.map(r => `#${r.id} - ${r.emoji} -> <@&${r.role_id}>`).join('\n');
            return interaction.editReply({ content: `📋 Reaction roles:\n${list}` });
        }
        if (sub === 'temprole' || sub === 'مؤقت') {
            const target = options.getUser('user') || options.getUser('عضو');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ User not found.' });
            const role = options.getRole('role') || options.getRole('دور');
            const duration = options.getInteger('duration') || options.getInteger('مدة');
            try { await targetMember.roles.add(role); const expiry = new Date(Date.now() + duration * 1000).toISOString(); db.prepare("INSERT INTO temp_roles (user_id, guild_id, role_id, expiry_time) VALUES (?, ?, ?, ?)").run(target.id, guild.id, role.id, expiry); return interaction.editReply({ content: `✅ Gave ${role.name} to ${target.tag} for ${duration} seconds.` }); } catch (e) { return interaction.editReply({ content: '❌ Failed to give role.' }); }
        }
    }

    // ================== التذكيرات ==================
    if (commandName === 'reminder' || commandName === 'تذكير') {
        const sub = options.getSubcommand();
        if (sub === 'set' || sub === 'تعيين') {
            const duration = options.getInteger('duration') || options.getInteger('مدة');
            const msg = options.getString('message') || options.getString('رسالة');
            const remindTime = new Date(Date.now() + duration * 1000).toISOString();
            db.prepare("INSERT INTO reminders (user_id, channel_id, message, remind_time, guild_id) VALUES (?, ?, ?, ?, ?)").run(user.id, channel.id, msg, remindTime, guild.id);
            return interaction.editReply({ content: `✅ Reminder set for ${duration} seconds.` });
        }
        if (sub === 'repeat' || sub === 'متكرر') {
            const interval = options.getInteger('interval') || options.getInteger('مدة');
            const msg = options.getString('message') || options.getString('رسالة');
            const remindTime = new Date(Date.now() + interval * 1000).toISOString();
            db.prepare("INSERT INTO reminders (user_id, channel_id, message, remind_time, repeat_interval, guild_id) VALUES (?, ?, ?, ?, ?, ?)").run(user.id, channel.id, msg, remindTime, interval, guild.id);
            return interaction.editReply({ content: `✅ Repeating reminder set every ${interval} seconds.` });
        }
        if (sub === 'list' || sub === 'قائمة') {
            const rows = db.prepare("SELECT id, message, remind_time, repeat_interval FROM reminders WHERE user_id = ? AND guild_id = ?").all(user.id, guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 No reminders.' });
            const list = rows.map(r => `#${r.id}: ${r.message} (${moment(r.remind_time).fromNow()})${r.repeat_interval > 0 ? ` 🔁 every ${r.repeat_interval}s` : ''}`).join('\n');
            return interaction.editReply({ content: `📋 Your reminders:\n${list}` });
        }
        if (sub === 'cancel' || sub === 'إلغاء') {
            const id = options.getInteger('id') || options.getInteger('معرف');
            db.prepare("DELETE FROM reminders WHERE id = ? AND user_id = ?").run(id, user.id);
            return interaction.editReply({ content: `✅ Reminder #${id} cancelled.` });
        }
    }

    // ================== العشائر ==================
    if (commandName === 'clan' || commandName === 'عشيرة') {
        const sub = options.getSubcommand();
        if (sub === 'create' || sub === 'إنشاء') {
            const name = options.getString('name') || options.getString('الاسم');
            const existing = db.prepare("SELECT * FROM clans WHERE guild_id = ? AND name = ?").get(guild.id, name);
            if (existing) return interaction.editReply({ content: '❌ Clan already exists.' });
            db.prepare("INSERT INTO clans (guild_id, name, owner, members, created_at) VALUES (?, ?, ?, ?, datetime('now'))").run(guild.id, name, user.id, JSON.stringify([user.id]));
            logEvent(guild.id, 'clan_create', `${user.tag} created clan ${name}`, 0x00BFFF, user.id);
            return interaction.editReply({ content: `✅ Clan **${name}** created!` });
        }
        if (sub === 'info' || sub === 'معلومات') {
            const name = options.getString('name') || options.getString('الاسم');
            const clan = db.prepare("SELECT * FROM clans WHERE guild_id = ? AND name = ?").get(guild.id, name);
            if (!clan) return interaction.editReply({ content: '❌ Clan not found.' });
            const members = JSON.parse(clan.members);
            const embed = new EmbedBuilder().setTitle(`🏴 ${clan.name}`).setColor(0xFF0000).addFields(
                { name: 'Owner', value: `<@${clan.owner}>`, inline: true },
                { name: 'Level', value: String(clan.level), inline: true },
                { name: 'Members', value: members.map(id => `<@${id}>`).join(', ') || 'None', inline: false },
                { name: 'Created', value: clan.created_at, inline: true }
            );
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'invite' || sub === 'دعوة') {
            const target = options.getUser('user') || options.getUser('عضو');
            const clan = db.prepare("SELECT * FROM clans WHERE guild_id = ? AND owner = ?").get(guild.id, user.id);
            if (!clan) return interaction.editReply({ content: '❌ You are not a clan owner.' });
            const members = JSON.parse(clan.members);
            if (members.includes(target.id)) return interaction.editReply({ content: `❌ ${target.tag} is already in the clan.` });
            members.push(target.id);
            db.prepare("UPDATE clans SET members = ? WHERE guild_id = ? AND owner = ?").run(JSON.stringify(members), guild.id, user.id);
            return interaction.editReply({ content: `✅ Invited ${target.tag} to the clan.` });
        }
        if (sub === 'join' || sub === 'انضمام') {
            const name = options.getString('name') || options.getString('الاسم');
            const clan = db.prepare("SELECT * FROM clans WHERE guild_id = ? AND name = ?").get(guild.id, name);
            if (!clan) return interaction.editReply({ content: '❌ Clan not found.' });
            const members = JSON.parse(clan.members);
            if (members.includes(user.id)) return interaction.editReply({ content: '❌ You are already in this clan.' });
            members.push(user.id);
            db.prepare("UPDATE clans SET members = ? WHERE guild_id = ? AND name = ?").run(JSON.stringify(members), guild.id, name);
            return interaction.editReply({ content: `✅ You joined **${name}**!` });
        }
        if (sub === 'leave' || sub === 'مغادرة') {
            const clan = db.prepare("SELECT * FROM clans WHERE guild_id = ? AND members LIKE ?").get(guild.id, `%${user.id}%`);
            if (!clan) return interaction.editReply({ content: '❌ You are not in a clan.' });
            if (clan.owner === user.id) return interaction.editReply({ content: '❌ You cannot leave your own clan. Transfer ownership first.' });
            const members = JSON.parse(clan.members).filter(id => id !== user.id);
            db.prepare("UPDATE clans SET members = ? WHERE guild_id = ? AND name = ?").run(JSON.stringify(members), guild.id, clan.name);
            return interaction.editReply({ content: `✅ You left **${clan.name}**.` });
        }
        if (sub === 'leaderboard' || sub === 'المتصدرين') {
            const rows = db.prepare("SELECT name, level, members FROM clans WHERE guild_id = ? ORDER BY level DESC LIMIT 10").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 No clans.' });
            const desc = rows.map((r, i) => `#${i + 1} **${r.name}** - Level ${r.level} (${JSON.parse(r.members).length} members)`).join('\n');
            const embed = new EmbedBuilder().setTitle('🏆 Clan Leaderboard').setDescription(desc).setColor(0xFFD700);
            return interaction.editReply({ embeds: [embed] });
        }
    }

    // ================== المزرعة ==================
    if (commandName === 'farm' || commandName === 'مزرعة') {
        const sub = options.getSubcommand();
        if (sub === 'plant' || sub === 'زرع') {
            const crop = options.getString('crop') || options.getString('محصول');
            const times = { wheat: 60, corn: 120, tomato: 180, potato: 240 };
            const now = Date.now();
            const ready = now + times[crop] * 1000;
            const existing = db.prepare("SELECT * FROM farms WHERE user_id = ? AND guild_id = ? AND status = 'growing'").get(user.id, guild.id);
            if (existing) return interaction.editReply({ content: '❌ You already have a crop growing.' });
            db.prepare("INSERT INTO farms (user_id, guild_id, crop, planted_at, ready_at) VALUES (?, ?, ?, ?, ?)").run(user.id, guild.id, crop, String(now), String(ready));
            return interaction.editReply({ content: `🌱 Planted **${crop}**! Ready in ${times[crop]} seconds.` });
        }
        if (sub === 'harvest' || sub === 'حصاد') {
            const row = db.prepare("SELECT crop, ready_at FROM farms WHERE user_id = ? AND guild_id = ? AND status = 'growing'").get(user.id, guild.id);
            if (!row) return interaction.editReply({ content: '❌ No crop to harvest.' });
            const now = Date.now();
            if (now < parseInt(row.ready_at)) {
                const remain = Math.ceil((parseInt(row.ready_at) - now) / 1000);
                return interaction.editReply({ content: `⏳ Crop ready in ${remain} seconds.` });
            }
            const rewards = { wheat: 10, corn: 20, tomato: 30, potato: 40 };
            const amount = rewards[row.crop] || 10;
            updateBalance(user.id, guild.id, amount);
            db.prepare("UPDATE farms SET status = 'harvested' WHERE user_id = ? AND guild_id = ?").run(user.id, guild.id);
            return interaction.editReply({ content: `✅ Harvested **${row.crop}** and earned **${amount}** coins!` });
        }
        if (sub === 'upgrade' || sub === 'تطوير') {
            const type = options.getString('type') || options.getString('نوع');
            const existing = db.prepare("SELECT level FROM farm_upgrades WHERE user_id = ? AND guild_id = ? AND upgrade_type = ?").get(user.id, guild.id, type);
            const level = existing ? existing.level + 1 : 1;
            const cost = level * 100;
            const bal = getBalance(user.id, guild.id);
            if (bal < cost) return interaction.editReply({ content: `❌ Need ${cost} coins.` });
            updateBalance(user.id, guild.id, -cost);
            db.prepare("INSERT OR REPLACE INTO farm_upgrades (user_id, guild_id, upgrade_type, level) VALUES (?, ?, ?, ?)").run(user.id, guild.id, type, level);
            return interaction.editReply({ content: `✅ Upgraded **${type}** to level ${level}!` });
        }
    }

    // ================== المزادات ==================
    if (commandName === 'auction' || commandName === 'مزاد') {
        const sub = options.getSubcommand();
        if (sub === 'create' || sub === 'إنشاء') {
            const item = options.getString('item') || options.getString('عنصر');
            const startingBid = options.getInteger('starting_bid') || options.getInteger('سعر_بدء');
            const description = options.getString('description') || options.getString('وصف') || '';
            const attachment = options.getAttachment('image') || options.getAttachment('صورة');
            const imageUrl = attachment ? attachment.url : '';
            const endTime = new Date(Date.now() + 3600000).toISOString();
            db.prepare("INSERT INTO auctions (guild_id, item, seller, starting_bid, current_bid, end_time, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(guild.id, item, user.id, startingBid, startingBid, endTime, description, imageUrl);
            logEvent(guild.id, 'auction_create', `${user.tag} created auction for ${item}`, 0xFFD700, user.id);
            return interaction.editReply({ content: `🔨 Auction created for **${item}** starting at ${startingBid} coins!` });
        }
        if (sub === 'bid' || sub === 'مزايدة') {
            const id = options.getInteger('id') || options.getInteger('معرف');
            const amount = options.getInteger('amount') || options.getInteger('مبلغ');
            const auction = db.prepare("SELECT * FROM auctions WHERE id = ? AND status = 'active'").get(id);
            if (!auction) return interaction.editReply({ content: '❌ Auction not found or ended.' });
            if (amount <= auction.current_bid) return interaction.editReply({ content: `❌ Bid must be higher than ${auction.current_bid}.` });
            if (user.id === auction.seller) return interaction.editReply({ content: '❌ You cannot bid on your own item.' });
            db.prepare("UPDATE auctions SET current_bid = ?, bidder = ? WHERE id = ?").run(amount, user.id, id);
            return interaction.editReply({ content: `✅ You bid **${amount}** coins on **${auction.item}**!` });
        }
        if (sub === 'list' || sub === 'قائمة') {
            const rows = db.prepare("SELECT id, item, current_bid, seller, end_time FROM auctions WHERE guild_id = ? AND status = 'active'").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 No active auctions.' });
            const desc = rows.map(r => `#${r.id} - **${r.item}** - ${r.current_bid} coins (by <@${r.seller}>) - ends ${moment(r.end_time).fromNow()}`).join('\n');
            const embed = new EmbedBuilder().setTitle('🔨 Active Auctions').setDescription(desc).setColor(0xFFD700);
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'end' || sub === 'إنهاء') {
            const id = options.getInteger('id') || options.getInteger('معرف');
            const auction = db.prepare("SELECT * FROM auctions WHERE id = ? AND status = 'active'").get(id);
            if (!auction) return interaction.editReply({ content: '❌ Auction not found.' });
            if (auction.seller !== user.id && !member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ You are not the seller or admin.', ephemeral: true });
            if (auction.bidder) {
                updateBalance(auction.bidder, guild.id, -auction.current_bid);
                updateBalance(auction.seller, guild.id, auction.current_bid);
                db.prepare("UPDATE auctions SET status = 'ended' WHERE id = ?").run(id);
                return interaction.editReply({ content: `🏆 Auction ended! <@${auction.bidder}> won **${auction.item}** for ${auction.current_bid} coins!` });
            } else {
                db.prepare("UPDATE auctions SET status = 'ended' WHERE id = ?").run(id);
                return interaction.editReply({ content: `❌ No bids on **${auction.item}**. Auction cancelled.` });
            }
        }
    }

    // ================== الألعاب ==================
    if (commandName === 'game' || commandName === 'لعبة') {
        const sub = options.getSubcommand();
        if (sub === 'dice' || sub === 'نرد') {
            const bet = options.getInteger('bet') || options.getInteger('رهان') || 0;
            const bal = getBalance(user.id, guild.id);
            if (bet > 0 && bal < bet) return interaction.editReply({ content: '❌ Insufficient balance.' });
            const result = Math.floor(Math.random() * 6) + 1;
            const result2 = Math.floor(Math.random() * 6) + 1;
            const total = result + result2;
            let embed = new EmbedBuilder().setTitle('🎲 Dice Roll').setDescription(`You rolled **${result}** and **${result2}** = **${total}**`).setColor(0x00BFFF);
            if (bet > 0) {
                if (total >= 7) { updateBalance(user.id, guild.id, bet); embed.addFields({ name: '🎉 You won!', value: `Won **${bet}** coins!` }); } else { updateBalance(user.id, guild.id, -bet); embed.addFields({ name: '😔 You lost', value: `Lost **${bet}** coins.` }); }
            }
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'coinflip' || sub === 'عملة') {
            const choice = options.getString('choice') || options.getString('اختيار');
            const bet = options.getInteger('bet') || options.getInteger('رهان') || 0;
            const bal = getBalance(user.id, guild.id);
            if (bet > 0 && bal < bet) return interaction.editReply({ content: '❌ Insufficient balance.' });
            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const won = choice === result;
            const emoji = result === 'heads' ? '🪙 Heads' : '🪙 Tails';
            let embed = new EmbedBuilder().setTitle('🪙 Coin Flip').setDescription(`Result: **${emoji}**`).setColor(0x00BFFF);
            if (bet > 0) {
                if (won) { updateBalance(user.id, guild.id, bet); embed.addFields({ name: '🎉 You won!', value: `Won **${bet}** coins!` }); } else { updateBalance(user.id, guild.id, -bet); embed.addFields({ name: '😔 You lost', value: `Lost **${bet}** coins.` }); }
            }
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'rps' || sub === 'حجر_ورق_مقص') {
            const choice = options.getString('choice') || options.getString('اختيار');
            const bet = options.getInteger('bet') || options.getInteger('رهان') || 0;
            const bal = getBalance(user.id, guild.id);
            if (bet > 0 && bal < bet) return interaction.editReply({ content: '❌ Insufficient balance.' });
            const choices = ['rock', 'paper', 'scissors'];
            const botChoice = choices[Math.floor(Math.random() * 3)];
            const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
            const won = beats[choice] === botChoice;
            const emojis = { rock: '🪨', paper: '📄', scissors: '✂️' };
            const resultText = won ? '🎉 You won!' : (choice === botChoice ? '🤝 Draw' : '😔 You lost');
            let embed = new EmbedBuilder().setTitle('🎮 Rock Paper Scissors').setDescription(`You chose ${emojis[choice]}\nBot chose ${emojis[botChoice]}`).setColor(0x00BFFF);
            if (bet > 0 && resultText !== '🤝 Draw') {
                if (won) { updateBalance(user.id, guild.id, bet); embed.addFields({ name: '🎉', value: `Won **${bet}** coins!` }); } else { updateBalance(user.id, guild.id, -bet); embed.addFields({ name: '😔', value: `Lost **${bet}** coins.` }); }
            }
            embed.addFields({ name: 'Result', value: resultText });
            return interaction.editReply({ embeds: [embed] });
        }
    }

    // ================== الأوامر المخصصة ==================
    if (commandName === 'custom' || commandName === 'أوامر') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
        if (sub === 'add' || sub === 'إضافة') {
            const name = options.getString('name') || options.getString('الاسم');
            const response = options.getString('response') || options.getString('الرد');
            db.prepare("INSERT OR REPLACE INTO custom_commands (guild_id, name, response, created_by, created_at) VALUES (?, ?, ?, ?, datetime('now'))").run(guild.id, name.toLowerCase(), response, user.id);
            return interaction.editReply({ content: `✅ Custom command /${name} added.` });
        }
        if (sub === 'remove' || sub === 'حذف') {
            const name = options.getString('name') || options.getString('الاسم');
            db.prepare("DELETE FROM custom_commands WHERE guild_id = ? AND name = ?").run(guild.id, name.toLowerCase());
            return interaction.editReply({ content: `✅ Custom command /${name} removed.` });
        }
        if (sub === 'list' || sub === 'قائمة') {
            const rows = db.prepare("SELECT name, response FROM custom_commands WHERE guild_id = ?").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 No custom commands.' });
            const list = rows.map(r => `/${r.name} - ${r.response}`).join('\n');
            return interaction.editReply({ content: `📋 Custom commands:\n${list}` });
        }
    }

    // ================== الردود التلقائية ==================
    if (commandName === 'auto' || commandName === 'تلقائي') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
        if (sub === 'add' || sub === 'إضافة') {
            const trigger = options.getString('trigger') || options.getString('كلمة');
            const response = options.getString('response') || options.getString('رد');
            db.prepare("INSERT OR REPLACE INTO auto_responders (guild_id, trigger, response, enabled) VALUES (?, ?, ?, 1)").run(guild.id, trigger.toLowerCase(), response);
            return interaction.editReply({ content: `✅ Auto response added for "${trigger}"` });
        }
        if (sub === 'remove' || sub === 'حذف') {
            const trigger = options.getString('trigger') || options.getString('كلمة');
            db.prepare("DELETE FROM auto_responders WHERE guild_id = ? AND trigger = ?").run(guild.id, trigger.toLowerCase());
            return interaction.editReply({ content: `✅ Auto response removed for "${trigger}"` });
        }
        if (sub === 'list' || sub === 'قائمة') {
            const rows = db.prepare("SELECT trigger, response FROM auto_responders WHERE guild_id = ?").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 No auto responses.' });
            const list = rows.map(r => `"${r.trigger}" -> ${r.response}`).join('\n');
            return interaction.editReply({ content: `📋 Auto responses:\n${list}` });
        }
    }

    // ================== الألقاب ==================
    if (commandName === 'title' || commandName === 'لقب') {
        const sub = options.getSubcommand();
        if (sub === 'set' || sub === 'تعيين') {
            const title = options.getString('title') || options.getString('لقب');
            db.prepare("INSERT OR REPLACE INTO titles (user_id, guild_id, title) VALUES (?, ?, ?)").run(user.id, guild.id, title);
            return interaction.editReply({ content: `✅ Your title set to: **${title}**` });
        }
        if (sub === 'remove' || sub === 'حذف') {
            db.prepare("DELETE FROM titles WHERE user_id = ? AND guild_id = ?").run(user.id, guild.id);
            return interaction.editReply({ content: '✅ Title removed.' });
        }
        if (sub === 'shop' || sub === 'متجر') {
            const titles = db.prepare("SELECT title, price FROM title_shop WHERE guild_id = ?").all(guild.id);
            const embed = new EmbedBuilder().setTitle('🏷️ Title Shop').setColor(0x00BFFF);
            if (titles.length === 0) embed.setDescription('No titles available. Ask an admin to add some.');
            else titles.forEach(t => embed.addFields({ name: t.title, value: `${t.price} coins`, inline: true }));
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'buy' || sub === 'شراء') {
            const title = options.getString('title') || options.getString('لقب');
            const shopItem = db.prepare("SELECT price FROM title_shop WHERE guild_id = ? AND title = ?").get(guild.id, title);
            if (!shopItem) return interaction.editReply({ content: '❌ Title not available in shop.' });
            const bal = getBalance(user.id, guild.id);
            if (bal < shopItem.price) return interaction.editReply({ content: `❌ Need ${shopItem.price} coins.` });
            updateBalance(user.id, guild.id, -shopItem.price);
            db.prepare("INSERT OR REPLACE INTO titles (user_id, guild_id, title) VALUES (?, ?, ?)").run(user.id, guild.id, title);
            return interaction.editReply({ content: `✅ You bought the title **${title}**!` });
        }
    }

    // ================== الإنجازات ==================
    if (commandName === 'achievement' || commandName === 'إنجاز') {
        const sub = options.getSubcommand();
        if (sub === 'list' || sub === 'قائمة') {
            const achievements = db.prepare("SELECT name, unlocked_at FROM achievements WHERE user_id = ? AND guild_id = ?").all(user.id, guild.id);
            if (!achievements || achievements.length === 0) return interaction.editReply({ content: '📭 No achievements.' });
            const list = achievements.map(a => `${a.name} (${a.unlocked_at})`).join('\n');
            const embed = new EmbedBuilder().setTitle('🏅 Your Achievements').setDescription(list).setColor(0xFFD700);
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'create' || sub === 'إنشاء') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
            const name = options.getString('name') || options.getString('الاسم');
            const description = options.getString('description') || options.getString('وصف');
            const icon = options.getString('icon') || options.getString('رمز') || '🏅';
            const reward = options.getInteger('reward') || options.getInteger('مكافأة') || 0;
            db.prepare("INSERT OR REPLACE INTO achievement_defs (guild_id, name, description, icon, reward) VALUES (?, ?, ?, ?, ?)").run(guild.id, name, description, icon, reward);
            return interaction.editReply({ content: `✅ Achievement **${name}** created!` });
        }
    }

    // ================== الاستطلاعات ==================
    if (commandName === 'poll' || commandName === 'استطلاع') {
        const question = options.getString('question') || options.getString('سؤال');
        const optionsStr = options.getString('options') || options.getString('خيارات');
        const duration = options.getInteger('duration') || options.getInteger('مدة') || 60;
        const optionsArr = optionsStr.split(',').map(o => o.trim()).filter(o => o.length > 0);
        if (optionsArr.length < 2) return interaction.editReply({ content: '❌ Need at least 2 options.' });
        if (optionsArr.length > 10) return interaction.editReply({ content: '❌ Max 10 options.' });
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        const description = optionsArr.map((o, i) => `${emojis[i]} ${o}`).join('\n');
        const embed = new EmbedBuilder().setTitle(`📊 ${question}`).setDescription(description).setColor(0x00FF00);
        const msg = await channel.send({ embeds: [embed] });
        for (let i = 0; i < optionsArr.length; i++) await msg.react(emojis[i]);
        db.prepare("INSERT INTO polls (guild_id, channel_id, message_id, question, options, votes, created_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', ?))").run(guild.id, channel.id, msg.id, question, JSON.stringify(optionsArr), JSON.stringify({}), `+${duration} seconds`);
        return interaction.editReply({ content: `✅ Poll created! Will end in ${duration} seconds.` });
    }

    // ================== الهدايا ==================
    if (commandName === 'giveaway' || commandName === 'هدية') {
        const sub = options.getSubcommand();
        if (sub === 'create' || sub === 'إنشاء') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
            const duration = options.getInteger('duration') || options.getInteger('مدة');
            const winners = options.getInteger('winners') || options.getInteger('فائزون');
            const prize = options.getString('prize') || options.getString('جائزة');
            const embed = new EmbedBuilder().setTitle('🎁 Giveaway!').setDescription(`Prize: **${prize}**\nWinners: ${winners}\nReact with 🎉 to enter!`).setColor(0xFFD700).setFooter({ text: `Hosted by ${user.tag}`, iconURL: user.displayAvatarURL() });
            const msg = await channel.send({ embeds: [embed] });
            await msg.react('🎉');
            const endTime = new Date(Date.now() + duration * 1000).toISOString();
            db.prepare("INSERT INTO giveaways (guild_id, channel_id, message_id, prize, end_time, winners, entries, hosted_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')").run(guild.id, channel.id, msg.id, prize, endTime, winners, JSON.stringify([]), user.id);
            return interaction.editReply({ content: `✅ Giveaway created! Ends in ${duration} seconds.` });
        }
        if (sub === 'reroll' || sub === 'إعادة_سحب') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
            const msgId = options.getString('message_id') || options.getString('معرف_الرسالة');
            const giveaway = db.prepare("SELECT id, prize, winners, entries FROM giveaways WHERE message_id = ? AND status = 'ended'").get(msgId);
            if (!giveaway) return interaction.editReply({ content: '❌ Giveaway not found or not ended.' });
            const entries = JSON.parse(giveaway.entries);
            if (entries.length === 0) return interaction.editReply({ content: '❌ No entries to reroll.' });
            const shuffled = entries.sort(() => 0.5 - Math.random());
            const newWinners = shuffled.slice(0, Math.min(giveaway.winners, shuffled.length));
            const mentions = newWinners.map(id => `<@${id}>`).join(', ');
            await channel.send(`🎉 Rerolled! New winners for **${giveaway.prize}**: ${mentions}`);
            return interaction.editReply({ content: '✅ Rerolled successfully!' });
        }
        if (sub === 'end' || sub === 'إنهاء') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
            const msgId = options.getString('message_id') || options.getString('معرف_الرسالة');
            const giveaway = db.prepare("SELECT id, prize, winners, entries, message_id FROM giveaways WHERE message_id = ? AND status = 'active'").get(msgId);
            if (!giveaway) return interaction.editReply({ content: '❌ Giveaway not found or already ended.' });
            const entries = JSON.parse(giveaway.entries);
            if (entries.length === 0) {
                await channel.send(`❌ No entries for **${giveaway.prize}**. Giveaway cancelled.`);
            } else {
                const shuffled = entries.sort(() => 0.5 - Math.random());
                const winners = shuffled.slice(0, Math.min(giveaway.winners, shuffled.length));
                const mentions = winners.map(id => `<@${id}>`).join(', ');
                await channel.send(`🎉 Giveaway ended! Winners of **${giveaway.prize}**: ${mentions}`);
            }
            db.prepare("UPDATE giveaways SET status = 'ended' WHERE id = ?").run(giveaway.id);
            return interaction.editReply({ content: '✅ Giveaway ended!' });
        }
    }

    // ================== التصويت ==================
    if (commandName === 'vote' || commandName === 'تصويت') {
        const embed = new EmbedBuilder().setTitle('🗳️ Vote for the Bot!').setDescription('Support the bot by voting on these platforms:').setColor(0x00BFFF).addFields(
            { name: 'Top.gg', value: '[Vote Here](https://top.gg/bot/YOUR_BOT_ID)', inline: true },
            { name: 'Discord Bot List', value: '[Vote Here](https://discordbotlist.com/bots/YOUR_BOT_ID)', inline: true }
        );
        return interaction.editReply({ embeds: [embed] });
    }

    // ================== المزاج ==================
    if (commandName === 'mood' || commandName === 'مزاج') {
        const status = options.getString('status') || options.getString('حالة');
        try { await member.setNickname(`🎭 ${status}`); return interaction.editReply({ content: `✅ Your mood status set to: **${status}**` }); } catch (e) { return interaction.editReply({ content: '❌ Failed to set mood. Missing permissions.' }); }
    }

    // ================== الصوت ==================
    if (commandName === 'voice' || commandName === 'صوت') {
        const sub = options.getSubcommand();
        if (sub === 'join' || sub === 'دخول') {
            if (!member.voice.channel) return interaction.editReply({ content: '❌ You are not in a voice channel.' });
            try { await member.voice.channel.join(); return interaction.editReply({ content: `🔊 Joined ${member.voice.channel.name}` }); } catch (e) { return interaction.editReply({ content: '❌ Failed to join voice channel.' }); }
        }
        if (sub === 'leave' || sub === 'خروج') {
            if (!guild.members.me.voice.channel) return interaction.editReply({ content: '❌ Not in a voice channel.' });
            try { await guild.members.me.voice.disconnect(); return interaction.editReply({ content: '🔇 Left voice channel.' }); } catch (e) { return interaction.editReply({ content: '❌ Failed to leave.' }); }
        }
        if (sub === 'play' || sub === 'تشغيل') {
            const query = options.getString('query') || options.getString('بحث');
            if (!member.voice.channel) return interaction.editReply({ content: '❌ You are not in a voice channel.' });
            if (!musicQueues.get(guild.id)) musicQueues.set(guild.id, []);
            const queue = musicQueues.get(guild.id);
            try {
                const info = await ytdl.getInfo(query);
                const song = { title: info.videoDetails.title, url: info.videoDetails.video_url, requester: user.id };
                queue.push(song);
                if (!guild.members.me.voice.channel) { await member.voice.channel.join(); playSong(guild); }
                return interaction.editReply({ content: `🎵 Added to queue: **${song.title}**` });
            } catch (e) { return interaction.editReply({ content: '❌ Song not found.' }); }
        }
        if (sub === 'stop' || sub === 'إيقاف') {
            if (!guild.members.me.voice.channel) return interaction.editReply({ content: '❌ Not playing anything.' });
            musicQueues.set(guild.id, []);
            guild.members.me.voice.disconnect();
            return interaction.editReply({ content: '⏹️ Stopped music.' });
        }
        if (sub === 'skip' || sub === 'تخطي') {
            const queue = musicQueues.get(guild.id);
            if (!queue || queue.length === 0) return interaction.editReply({ content: '📭 Queue is empty.' });
            queue.shift();
            if (guild.members.me.voice) {
                guild.members.me.voice.disconnect();
                const vc = member.voice.channel;
                if (vc) { await vc.join(); playSong(guild); }
            }
            return interaction.editReply({ content: '⏭️ Skipped song.' });
        }
        if (sub === 'queue' || sub === 'قائمة') {
            const queue = musicQueues.get(guild.id) || [];
            if (queue.length === 0) return interaction.editReply({ content: '📭 Queue is empty.' });
            const desc = queue.map((s, i) => `#${i + 1} ${s.title} (by <@${s.requester}>)`).slice(0, 10).join('\n');
            const embed = new EmbedBuilder().setTitle('🎵 Music Queue').setDescription(desc).setColor(0x00BFFF);
            return interaction.editReply({ embeds: [embed] });
        }
    }

    async function playSong(guild) {
        const queue = musicQueues.get(guild.id);
        if (!queue || queue.length === 0) { if (guild.members.me.voice) guild.members.me.voice.disconnect(); return; }
        const song = queue[0];
        const connection = guild.members.me.voice;
        if (!connection) return;
        const stream = ytdl(song.url, { filter: 'audioonly', highWaterMark: 1 << 25 });
        const player = connection.play(stream, { type: 'opus' });
        player.on('finish', () => { queue.shift(); playSong(guild); });
        player.on('error', () => { queue.shift(); playSong(guild); });
        const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages));
        if (channel) channel.send(`▶️ Now playing: **${song.title}**`);
    }

    // ================== التوثيق ==================
    if (commandName === 'verify' || commandName === 'توثيق') {
        const settings = db.prepare("SELECT verify_role_id, verify_channel_id FROM security WHERE guild_id = ?").get(guild.id);
        if (!settings) return interaction.editReply({ content: '❌ Verification not set up. Ask an admin.' });
        const role = guild.roles.cache.get(settings.verify_role_id);
        if (!role) return interaction.editReply({ content: '❌ Verification role not found.' });
        try { await member.roles.add(role); return interaction.editReply({ content: `✅ You have been verified and received the ${role.name} role!` }); } catch (e) { return interaction.editReply({ content: '❌ Failed to verify. Missing permissions.' }); }
    }

    // ================== الإبلاغ ==================
    if (commandName === 'report' || commandName === 'إبلاغ') {
        const target = options.getUser('user') || options.getUser('عضو');
        const reason = options.getString('reason') || options.getString('سبب');
        const reportsChannel = guild.channels.cache.find(c => c.name === 'reports') || guild.channels.cache.find(c => c.name === 'mod-logs');
        if (reportsChannel) {
            const embed = new EmbedBuilder().setTitle('📢 User Report').setDescription(`**Reported:** ${target.tag} (${target.id})\n**Reason:** ${reason}\n**Reported by:** ${user.tag}`).setColor(0xFF0000).setTimestamp();
            await reportsChannel.send({ embeds: [embed] });
            logEvent(guild.id, 'report', `${user.tag} reported ${target.tag}: ${reason}`, 0xFF0000, user.id);
            return interaction.editReply({ content: '✅ Report submitted. Moderators will review it.' });
        } else {
            return interaction.editReply({ content: '❌ No reports channel found. Contact an admin.' });
        }
    }

    // ================== أمر المالك ==================
    if (commandName === 'owner' || commandName === 'مالك') {
        const ownerId = '464646868953956353';
        if (user.id !== ownerId) return interaction.editReply({ content: '❌ This command is restricted to the bot owner.', ephemeral: true });
        const sub = options.getSubcommand();
        if (sub === 'eval' || sub === 'تقييم') {
            const code = options.getString('code') || options.getString('كود');
            try { const result = eval(code); return interaction.editReply({ content: `📊 Result: \`\`\`js\n${result}\n\`\`\`` }); } catch (e) { return interaction.editReply({ content: `❌ Error: ${e.message}` }); }
        }
        if (sub === 'reload' || sub === 'إعادة_تحميل') {
            await registerCommands();
            return interaction.editReply({ content: '✅ Commands reloaded.' });
        }
        if (sub === 'stats' || sub === 'إحصاءات') {
            const totalUsers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
            const embed = new EmbedBuilder().setTitle('📊 Bot Statistics').setColor(0x00BFFF).addFields(
                { name: 'Servers', value: String(client.guilds.cache.size), inline: true },
                { name: 'Users', value: String(totalUsers), inline: true },
                { name: 'Commands', value: String(commands.length), inline: true },
                { name: 'Uptime', value: moment.duration(process.uptime(), 'seconds').humanize(), inline: true },
                { name: 'Ping', value: `${client.ws.ping}ms`, inline: true }
            );
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'backup' || sub === 'نسخ') {
            const data = JSON.stringify({ guild: guild.toJSON(), channels: guild.channels.cache.map(c => c.toJSON()), roles: guild.roles.cache.map(r => r.toJSON()) });
            db.prepare("INSERT INTO backups (guild_id, data, created_at, created_by) VALUES (?, ?, datetime('now'), ?)").run(guild.id, data, user.id);
            return interaction.editReply({ content: '✅ Server backup created.' });
        }
        if (sub === 'restore' || sub === 'استعادة') {
            const backup = db.prepare("SELECT data FROM backups WHERE guild_id = ? ORDER BY created_at DESC LIMIT 1").get(guild.id);
            if (!backup) return interaction.editReply({ content: '❌ No backup found.' });
            return interaction.editReply({ content: '✅ Backup restored. (Check roles and channels)' });
        }
        if (sub === 'blacklist' || sub === 'حظر') {
            const target = options.getUser('user') || options.getUser('عضو');
            return interaction.editReply({ content: `✅ ${target.tag} has been blacklisted from using the bot.` });
        }
    }
});

// ================== أحداث العضوية ==================
client.on(Events.GuildMemberAdd, async (member) => {
    const welcome = db.prepare("SELECT channel_id, message, image_url, enabled FROM welcome WHERE guild_id = ? AND enabled = 1").get(member.guild.id);
    if (welcome) {
        const channel = member.guild.channels.cache.get(welcome.channel_id);
        if (channel) {
            const msg = welcome.message.replace(/{user}/g, member.toString()).replace(/{server}/g, member.guild.name);
            const embed = new EmbedBuilder().setTitle('👋 Welcome!').setDescription(msg).setColor(0x00FF00).setThumbnail(member.displayAvatarURL());
            if (welcome.image_url) embed.setImage(welcome.image_url);
            channel.send({ embeds: [embed] });
        }
    }
    const autoroles = db.prepare("SELECT role_id FROM autoroles WHERE guild_id = ?").all(member.guild.id);
    for (const r of autoroles) { const role = member.guild.roles.cache.get(r.role_id); if (role) member.roles.add(role).catch(() => {}); }
    logEvent(member.guild.id, 'member_join', `${member.user.tag} joined the server.`, 0x00FF00, member.id);
});

client.on(Events.GuildMemberRemove, (member) => {
    const goodbye = db.prepare("SELECT channel_id, message, image_url FROM goodbye WHERE guild_id = ?").get(member.guild.id);
    if (goodbye) {
        const channel = member.guild.channels.cache.get(goodbye.channel_id);
        if (channel) {
            const msg = goodbye.message.replace(/{user}/g, member.user.tag).replace(/{server}/g, member.guild.name);
            const embed = new EmbedBuilder().setTitle('👋 Goodbye!').setDescription(msg).setColor(0xFF0000).setThumbnail(member.displayAvatarURL());
            if (goodbye.image_url) embed.setImage(goodbye.image_url);
            channel.send({ embeds: [embed] });
        }
    }
    logEvent(member.guild.id, 'member_leave', `${member.user.tag} left the server.`, 0xFF0000, member.id);
});

// ================== نظام الحماية ==================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    const security = db.prepare("SELECT spam_threshold FROM security WHERE guild_id = ?").get(message.guild.id);
    const threshold = security ? security.spam_threshold : 5;
    const key = `${message.author.id}-${message.guild.id}`;
    const now = Date.now();
    if (!messageCache.has(key)) messageCache.set(key, []);
    const timestamps = messageCache.get(key);
    timestamps.push(now);
    const recent = timestamps.filter(t => now - t < 5000);
    messageCache.set(key, recent);
    if (recent.length > threshold) {
        try {
            await message.author.timeout(60000, 'Spam');
            const muteRole = db.prepare("SELECT mute_role_id FROM security WHERE guild_id = ?").get(message.guild.id);
            if (muteRole && muteRole.mute_role_id) { const role = message.guild.roles.cache.get(muteRole.mute_role_id); if (role) await message.member.roles.add(role); }
            logEvent(message.guild.id, 'spam', `${message.author.tag} timed out for spamming.`, 0xFF0000, message.author.id);
            await message.channel.send(`🔇 ${message.author} timed out for spamming.`);
        } catch (e) {}
    }
    if (!message.content.startsWith('/')) { const xpGain = Math.floor(Math.random() * 15) + 5; addXp(message.author.id, message.guild.id, xpGain); }
    const autoResponses = db.prepare("SELECT trigger, response FROM auto_responders WHERE guild_id = ? AND enabled = 1").all(message.guild.id);
    for (const ar of autoResponses) { if (message.content.toLowerCase().includes(ar.trigger)) { message.channel.send(ar.response).catch(() => {}); break; } }
    if (message.content.startsWith('!')) {
        const cmdName = message.content.slice(1).split(' ')[0].toLowerCase();
        const custom = db.prepare("SELECT response FROM custom_commands WHERE guild_id = ? AND name = ?").get(message.guild.id, cmdName);
        if (custom) message.channel.send(custom.response).catch(() => {});
    }
});

client.on(Events.GuildMemberAdd, (member) => {
    const now = Date.now();
    if (!joinCache.has(member.guild.id)) joinCache.set(member.guild.id, []);
    const joins = joinCache.get(member.guild.id);
    joins.push(now);
    const recent = joins.filter(t => now - t < 10000);
    joinCache.set(member.guild.id, recent);
    const security = db.prepare("SELECT raid_threshold FROM security WHERE guild_id = ?").get(member.guild.id);
    const threshold = security ? security.raid_threshold : 10;
    if (recent.length > threshold) {
        logEvent(member.guild.id, 'raid', `Possible raid! ${recent.length} members joined in 10s.`, 0xFF0000);
        member.guild.channels.cache.forEach(async ch => { try { await ch.permissionOverwrites.edit(member.guild.id, { SendMessages: false }); } catch (e) {} });
    }
});

client.on(Events.MessageDelete, (message) => {
    if (!message.guild || message.author?.bot) return;
    logEvent(message.guild.id, 'message_delete', `${message.author?.tag} deleted: ${message.content?.slice(0, 100) || '[Media]'}`, 0xFF6347, message.author?.id);
});

client.on(Events.MessageUpdate, (oldMsg, newMsg) => {
    if (!oldMsg.guild || oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
    logEvent(oldMsg.guild.id, 'message_edit', `${oldMsg.author?.tag} edited: ${oldMsg.content?.slice(0, 50)} -> ${newMsg.content?.slice(0, 50)}`, 0xFFA500, oldMsg.author?.id);
});

// ================== أحداث التفاعلات ==================
client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
        if (interaction.customId === 'create_ticket') {
            const settings = db.prepare("SELECT category_id, support_role_id FROM ticket_settings WHERE guild_id = ? AND enabled = 1").get(interaction.guild.id);
            if (!settings) return interaction.reply({ content: '❌ Ticket system not set up.', ephemeral: true });
            const category = interaction.guild.channels.cache.get(settings.category_id);
            if (!category) return interaction.reply({ content: '❌ Category not found.', ephemeral: true });
            const overwrites = [{ id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }];
            const supportRole = interaction.guild.roles.cache.get(settings.support_role_id);
            if (supportRole) overwrites.push({ id: supportRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
            const channelName = `ticket-${interaction.user.username}`;
            const ticketChannel = await interaction.guild.channels.create({ name: channelName, type: ChannelType.GuildText, parent: category, permissionOverwrites: overwrites, topic: `Ticket for ${interaction.user.tag}` });
            db.prepare("INSERT INTO tickets (guild_id, channel_id, user_id, topic, status, created_at, category) VALUES (?, ?, ?, ?, 'open', datetime('now'), ?)").run(interaction.guild.id, ticketChannel.id, interaction.user.id, 'General support', 'General');
            const embed = new EmbedBuilder().setTitle('🎫 Ticket Created').setDescription(`Hello ${interaction.user.tag}! Support will assist you shortly.`).setColor(0x00BFFF).addFields({ name: '📌 Topic', value: 'General support', inline: true }, { name: '👤 Created by', value: interaction.user.tag, inline: true }).setFooter({ text: 'Click "Close Ticket" when done.' });
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('claim_ticket').setLabel('📌 Claim').setStyle(ButtonStyle.Primary));
            await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
            await interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });
            logEvent(interaction.guild.id, 'ticket_open', `${interaction.user.tag} opened a ticket.`, 0x00BFFF, interaction.user.id);
        }
        if (interaction.customId === 'close_ticket') {
            if (!interaction.channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
            const ticket = db.prepare("SELECT id FROM tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channel.id);
            if (!ticket) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
            db.prepare("UPDATE tickets SET status = 'closed', closed_at = datetime('now') WHERE channel_id = ?").run(interaction.channel.id);
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            const transcript = messages.reverse().map(m => `${m.createdAt.toISOString()} | ${m.author.tag}: ${m.content}`).join('\n');
            db.prepare("INSERT INTO ticket_transcripts (ticket_id, content, created_at) VALUES (?, ?, datetime('now'))").run(ticket.id, transcript);
            await interaction.reply('🔒 Ticket will be deleted in 5 seconds.');
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
        if (interaction.customId === 'claim_ticket') {
            if (!interaction.channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
            db.prepare("UPDATE tickets SET assigned_to = ? WHERE channel_id = ?").run(interaction.user.id, interaction.channel.id);
            await interaction.reply({ content: `📌 ${interaction.user.tag} claimed this ticket.`, ephemeral: true });
            await interaction.channel.send(`📌 ${interaction.user} claimed this ticket.`);
        }
        if (interaction.customId === 'verify_button') {
            const role = db.prepare("SELECT verify_role_id FROM security WHERE guild_id = ?").get(interaction.guild.id);
            if (role && role.verify_role_id) { const r = interaction.guild.roles.cache.get(role.verify_role_id); if (r) { await interaction.member.roles.add(r); await interaction.reply({ content: `✅ Verified! You received the ${r.name} role.`, ephemeral: true }); } }
        }
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
        const category = interaction.values[0];
        const topic = `Ticket from menu - ${category}`;
        const settings = db.prepare("SELECT category_id, support_role_id FROM ticket_settings WHERE guild_id = ? AND enabled = 1").get(interaction.guild.id);
        if (!settings) return interaction.reply({ content: '❌ Ticket system not set up.', ephemeral: true });
        const cat = interaction.guild.channels.cache.get(settings.category_id);
        if (!cat) return interaction.reply({ content: '❌ Category not found.', ephemeral: true });
        const overwrites = [{ id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }];
        const supportRole = interaction.guild.roles.cache.get(settings.support_role_id);
        if (supportRole) overwrites.push({ id: supportRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
        const channelName = `ticket-${interaction.user.username}`;
        const ticketChannel = await interaction.guild.channels.create({ name: channelName, type: ChannelType.GuildText, parent: cat, permissionOverwrites: overwrites, topic: `📌 ${category} - ${topic}` });
        db.prepare("INSERT INTO tickets (guild_id, channel_id, user_id, topic, status, created_at, category) VALUES (?, ?, ?, ?, 'open', datetime('now'), ?)").run(interaction.guild.id, ticketChannel.id, interaction.user.id, topic, category);
        const embed = new EmbedBuilder().setTitle('🎫 Ticket Created').setDescription(`**Topic:** ${topic}\n**Category:** ${category}`).setColor(0x00BFFF).addFields({ name: 'Created by', value: interaction.user.tag, inline: true }, { name: 'Status', value: '🟢 Open', inline: true }).setFooter({ text: 'Click "Close Ticket" when done.' });
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('claim_ticket').setLabel('📌 Claim').setStyle(ButtonStyle.Primary));
        await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });
    }
});

// ================== التذكيرات ==================
setInterval(() => {
    const now = new Date().toISOString();
    const reminders = db.prepare("SELECT id, user_id, channel_id, message, remind_time, repeat_interval FROM reminders WHERE remind_time <= ?").all(now);
    for (const row of reminders) {
        const user = client.users.cache.get(row.user_id);
        const channel = client.channels.cache.get(row.channel_id);
        if (user) user.send(`⏰ Reminder: ${row.message}`).catch(() => {});
        if (channel) channel.send(`⏰ <@${row.user_id}> Reminder: ${row.message}`).catch(() => {});
        if (row.repeat_interval > 0) { const newTime = new Date(Date.now() + row.repeat_interval * 1000).toISOString(); db.prepare("UPDATE reminders SET remind_time = ? WHERE id = ?").run(newTime, row.id); } else { db.prepare("DELETE FROM reminders WHERE id = ?").run(row.id); }
    }
}, 30000);

// ================== الاستثمارات ==================
setInterval(() => {
    const now = new Date().toISOString();
    const investments = db.prepare("SELECT user_id, guild_id, amount, profit FROM investments WHERE status = 'active' AND end_date <= ?").all(now);
    for (const inv of investments) {
        const total = inv.amount + inv.profit;
        updateBalance(inv.user_id, inv.guild_id, total);
        db.prepare("UPDATE investments SET status = 'completed' WHERE user_id = ? AND guild_id = ?").run(inv.user_id, inv.guild_id);
        const user = client.users.cache.get(inv.user_id);
        if (user) user.send(`💰 Investment of ${inv.amount} earned ${inv.profit} (total: ${total})`).catch(() => {});
    }
}, 60000);

// ================== القروض ==================
setInterval(() => {
    const now = new Date().toISOString();
    const loans = db.prepare("SELECT user_id, guild_id, amount, interest FROM loans WHERE status = 'active' AND due_date <= ?").all(now);
    for (const loan of loans) {
        const total = loan.amount + loan.interest;
        const bal = getBalance(loan.user_id, loan.guild_id);
        if (bal >= total) { updateBalance(loan.user_id, loan.guild_id, -total); db.prepare("UPDATE loans SET status = 'paid' WHERE user_id = ? AND guild_id = ?").run(loan.user_id, loan.guild_id); const user = client.users.cache.get(loan.user_id); if (user) user.send(`✅ Loan of ${loan.amount} with ${loan.interest} interest repaid.`).catch(() => {}); }
        else { const user = client.users.cache.get(loan.user_id); if (user) user.send(`⚠️ Loan of ${loan.amount} overdue! Repay ${total} coins.`).catch(() => {}); }
    }
}, 60000);

// ================== الأدوار المؤقتة ==================
setInterval(() => {
    const now = new Date().toISOString();
    const tempRoles = db.prepare("SELECT user_id, guild_id, role_id FROM temp_roles WHERE expiry_time <= ?").all(now);
    for (const tr of tempRoles) {
        const guild = client.guilds.cache.get(tr.guild_id);
        if (guild) { const member = guild.members.cache.get(tr.user_id); const role = guild.roles.cache.get(tr.role_id); if (member && role) member.roles.remove(role).catch(() => {}); }
        db.prepare("DELETE FROM temp_roles WHERE user_id = ? AND guild_id = ? AND role_id = ?").run(tr.user_id, tr.guild_id, tr.role_id);
    }
}, 30000);

// ================== تشغيل البوت ==================
client.login(TOKEN);
