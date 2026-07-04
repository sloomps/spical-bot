// ================================================================
// DISCORD BOT ULTIMATE - النسخة العالمية
// جميع الأوامر شرطية (/) - أنظمة متكاملة - أداء فائق
// ================================================================

const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, ChannelType, SlashCommandBuilder, REST, Routes, Collection, Events } = require('discord.js');
const Database = require('better-sqlite3');
const axios = require('axios');
const moment = require('moment');

// ================== قاعدة البيانات ==================
const db = new Database('./ultimate_bot.db');

// إنشاء جميع الجداول المطلوبة
db.exec(`
    -- الاقتصاد
    CREATE TABLE IF NOT EXISTS economy (user_id TEXT, guild_id TEXT, balance INTEGER DEFAULT 0, bank INTEGER DEFAULT 0, daily TEXT, work TEXT, weekly TEXT);
    -- المستويات
    CREATE TABLE IF NOT EXISTS levels (user_id TEXT, guild_id TEXT, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1);
    -- التحذيرات
    CREATE TABLE IF NOT EXISTS warnings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, guild_id TEXT, reason TEXT, date TEXT, moderator TEXT);
    -- الأدوار التلقائية
    CREATE TABLE IF NOT EXISTS autoroles (guild_id TEXT, role_id TEXT);
    -- الترحيب والوداع
    CREATE TABLE IF NOT EXISTS welcome (guild_id TEXT, channel_id TEXT, message TEXT, image_url TEXT);
    CREATE TABLE IF NOT EXISTS goodbye (guild_id TEXT, channel_id TEXT, message TEXT, image_url TEXT);
    -- التذاكر
    CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, user_id TEXT, topic TEXT, status TEXT, created_at TEXT, category TEXT, priority TEXT);
    -- السجلات
    CREATE TABLE IF NOT EXISTS logging (guild_id TEXT, channel_id TEXT, type TEXT);
    -- الأدوار التفاعلية
    CREATE TABLE IF NOT EXISTS reaction_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, message_id TEXT, role_id TEXT, emoji TEXT);
    -- إحصائيات الأعضاء
    CREATE TABLE IF NOT EXISTS member_stats (user_id TEXT, guild_id TEXT, messages INTEGER DEFAULT 0, voice_minutes INTEGER DEFAULT 0, reactions_given INTEGER DEFAULT 0, reactions_received INTEGER DEFAULT 0, xp_earned INTEGER DEFAULT 0);
    -- الحماية
    CREATE TABLE IF NOT EXISTS auto_mod (guild_id TEXT, spam_threshold INTEGER DEFAULT 5, invite_filter INTEGER DEFAULT 1, link_filter INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS mute_roles (guild_id TEXT, role_id TEXT);
    CREATE TABLE IF NOT EXISTS verify_roles (guild_id TEXT, role_id TEXT, channel_id TEXT);
    -- التذكيرات
    CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, channel_id TEXT, message TEXT, remind_time TEXT, repeat_interval INTEGER DEFAULT 0);
    -- العشائر
    CREATE TABLE IF NOT EXISTS clans (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, name TEXT, owner TEXT, members TEXT, level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0, created_at TEXT);
    -- المزارع
    CREATE TABLE IF NOT EXISTS farms (user_id TEXT, guild_id TEXT, crop TEXT, planted_at TEXT, ready_at TEXT, status TEXT DEFAULT 'growing');
    -- المزادات
    CREATE TABLE IF NOT EXISTS auctions (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, item TEXT, seller TEXT, starting_bid INTEGER, current_bid INTEGER, bidder TEXT, end_time TEXT, status TEXT DEFAULT 'active');
    -- الألقاب
    CREATE TABLE IF NOT EXISTS titles (user_id TEXT, guild_id TEXT, title TEXT, PRIMARY KEY (user_id, guild_id));
    -- الردود التلقائية
    CREATE TABLE IF NOT EXISTS auto_responders (guild_id TEXT, trigger TEXT, response TEXT, PRIMARY KEY (guild_id, trigger));
    -- الأحداث
    CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, name TEXT, description TEXT, date TEXT, channel_id TEXT, created_by TEXT);
    -- الأوامر المخصصة
    CREATE TABLE IF NOT EXISTS custom_commands (guild_id TEXT, name TEXT, response TEXT, PRIMARY KEY (guild_id, name));
    -- الاستطلاعات
    CREATE TABLE IF NOT EXISTS polls (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, message_id TEXT, question TEXT, options TEXT);
    -- الهدايا
    CREATE TABLE IF NOT EXISTS giveaways (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, message_id TEXT, prize TEXT, end_time TEXT, winners INTEGER, entries TEXT);
    -- الإنجازات
    CREATE TABLE IF NOT EXISTS achievements (user_id TEXT, guild_id TEXT, achievement_name TEXT, unlocked_at TEXT, PRIMARY KEY (user_id, guild_id, achievement_name));
    -- الأدوار المؤقتة
    CREATE TABLE IF NOT EXISTS temp_roles (user_id TEXT, guild_id TEXT, role_id TEXT, expiry_time TEXT);
    -- القروض
    CREATE TABLE IF NOT EXISTS loans (user_id TEXT, guild_id TEXT, amount INTEGER, interest INTEGER, due_date TEXT, status TEXT DEFAULT 'active');
    -- الاستثمارات
    CREATE TABLE IF NOT EXISTS investments (user_id TEXT, guild_id TEXT, amount INTEGER, profit INTEGER, start_date TEXT, end_date TEXT, status TEXT DEFAULT 'active');
    -- التذاكر المتقدمة
    CREATE TABLE IF NOT EXISTS ticket_settings (guild_id TEXT, category_id TEXT, support_role_id TEXT, log_channel_id TEXT);
`);

// ================== دوال مساعدة محسّنة ==================
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

function getWarnings(userId, guildId) {
    return db.prepare("SELECT reason, date, moderator FROM warnings WHERE user_id = ? AND guild_id = ? ORDER BY date DESC").all(userId, guildId);
}

function addWarning(userId, guildId, reason, moderator) {
    db.prepare("INSERT INTO warnings (user_id, guild_id, reason, date, moderator) VALUES (?, ?, ?, datetime('now'), ?)").run(userId, guildId, reason, moderator);
    const count = db.prepare("SELECT COUNT(*) FROM warnings WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    return count['COUNT(*)'];
}

function clearWarnings(userId, guildId) {
    db.prepare("DELETE FROM warnings WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
}

function logEvent(guildId, type, description, color = 0x2F3136) {
    const row = db.prepare("SELECT channel_id FROM logging WHERE guild_id = ? AND (type = ? OR type = 'all')").get(guildId, type);
    if (!row) return;
    const channel = client.channels.cache.get(row.channel_id);
    if (channel) {
        const embed = new EmbedBuilder().setTitle(`📋 ${type}`).setDescription(description).setColor(color).setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
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
        GatewayIntentBits.GuildPresences,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember, Partials.Reaction]
});

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
    console.error('❌ TOKEN environment variable not set.');
    process.exit(1);
}

// ================== أوامر البوت ==================
const commands = [];

// ---- أمر المساعدة ----
commands.push(new SlashCommandBuilder()
    .setName('help')
    .setNameLocalizations({ ar: 'مساعدة' })
    .setDescription('Show all available commands with details')
    .setDescriptionLocalizations({ ar: 'عرض جميع الأوامر المتاحة مع الشرح' })
    .addStringOption(option => option.setName('command').setNameLocalizations({ ar: 'الأمر' }).setDescription('Command name for details').setDescriptionLocalizations({ ar: 'اسم الأمر للشرح المفصل' }).setRequired(false))
);

// ---- أمر المعلومات ----
commands.push(new SlashCommandBuilder()
    .setName('info')
    .setNameLocalizations({ ar: 'معلومات' })
    .setDescription('Show bot, server, or user information')
    .setDescriptionLocalizations({ ar: 'عرض معلومات البوت أو السيرفر أو العضو' })
    .addStringOption(option => option.setName('type').setNameLocalizations({ ar: 'النوع' }).setDescription('Information type').setDescriptionLocalizations({ ar: 'نوع المعلومات' }).setRequired(true).addChoices(
        { name: 'Bot', value: 'bot' },
        { name: 'Server', value: 'server' },
        { name: 'User', value: 'user' }
    ))
    .addUserOption(option => option.setName('user').setNameLocalizations({ ar: 'العضو' }).setDescription('User to get info about').setDescriptionLocalizations({ ar: 'العضو المطلوب معلوماته' }).setRequired(false))
);

// ---- أمر الاقتصاد ----
commands.push(new SlashCommandBuilder()
    .setName('economy')
    .setNameLocalizations({ ar: 'اقتصاد' })
    .setDescription('Manage your economy')
    .setDescriptionLocalizations({ ar: 'إدارة اقتصادك' })
    .addSubcommand(sub => sub.setName('balance').setNameLocalizations({ ar: 'رصيد' }).setDescription('Check your balance').setDescriptionLocalizations({ ar: 'عرض رصيدك' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('User to check').setDescriptionLocalizations({ ar: 'عضو للتحقق من رصيده' }).setRequired(false)))
    .addSubcommand(sub => sub.setName('daily').setNameLocalizations({ ar: 'يومي' }).setDescription('Claim daily reward').setDescriptionLocalizations({ ar: 'الحصول على المكافأة اليومية' }))
    .addSubcommand(sub => sub.setName('work').setNameLocalizations({ ar: 'عمل' }).setDescription('Work to earn coins').setDescriptionLocalizations({ ar: 'العمل لكسب عملات' }))
    .addSubcommand(sub => sub.setName('rob').setNameLocalizations({ ar: 'سرقة' }).setDescription('Try to rob a user').setDescriptionLocalizations({ ar: 'محاولة سرقة عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('User to rob').setDescriptionLocalizations({ ar: 'العضو المراد سرقته' }).setRequired(true)))
    .addSubcommand(sub => sub.setName('slot').setNameLocalizations({ ar: 'حظ' }).setDescription('Play slot machine').setDescriptionLocalizations({ ar: 'لعب ماكينة الحظ' }).addIntegerOption(opt => opt.setName('bet').setNameLocalizations({ ar: 'رهان' }).setDescription('Bet amount').setDescriptionLocalizations({ ar: 'مبلغ الرهان' }).setRequired(false)))
    .addSubcommand(sub => sub.setName('shop').setNameLocalizations({ ar: 'متجر' }).setDescription('View the shop').setDescriptionLocalizations({ ar: 'عرض المتجر' }))
    .addSubcommand(sub => sub.setName('buy').setNameLocalizations({ ar: 'شراء' }).setDescription('Buy an item').setDescriptionLocalizations({ ar: 'شراء عنصر' }).addStringOption(opt => opt.setName('item').setNameLocalizations({ ar: 'العنصر' }).setDescription('Item to buy').setDescriptionLocalizations({ ar: 'العنصر المراد شراؤه' }).setRequired(true).addChoices(
        { name: 'Gift', value: 'gift' },
        { name: 'Star', value: 'star' },
        { name: 'Crown', value: 'crown' }
    )))
);

// ---- أمر المستويات ----
commands.push(new SlashCommandBuilder()
    .setName('level')
    .setNameLocalizations({ ar: 'مستوى' })
    .setDescription('Check your level or leaderboard')
    .setDescriptionLocalizations({ ar: 'عرض مستواك أو الترتيب' })
    .addSubcommand(sub => sub.setName('rank').setNameLocalizations({ ar: 'رتبتي' }).setDescription('Check your rank').setDescriptionLocalizations({ ar: 'عرض رتبتك' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('User to check').setDescriptionLocalizations({ ar: 'عضو للتحقق' }).setRequired(false)))
    .addSubcommand(sub => sub.setName('leaderboard').setNameLocalizations({ ar: 'المتصدرين' }).setDescription('Show top 10 users').setDescriptionLocalizations({ ar: 'عرض أفضل 10 أعضاء' }))
);

// ---- أمر الإدارة ----
commands.push(new SlashCommandBuilder()
    .setName('moderation')
    .setNameLocalizations({ ar: 'إدارة' })
    .setDescription('Server moderation commands')
    .setDescriptionLocalizations({ ar: 'أوامر إدارة السيرفر' })
    .addSubcommand(sub => sub.setName('kick').setNameLocalizations({ ar: 'طرد' }).setDescription('Kick a member').setDescriptionLocalizations({ ar: 'طرد عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('Member to kick').setDescriptionLocalizations({ ar: 'العضو المراد طرده' }).setRequired(true)).addStringOption(opt => opt.setName('reason').setNameLocalizations({ ar: 'سبب' }).setDescription('Reason for kick').setDescriptionLocalizations({ ar: 'سبب الطرد' }).setRequired(false)))
    .addSubcommand(sub => sub.setName('ban').setNameLocalizations({ ar: 'حظر' }).setDescription('Ban a member').setDescriptionLocalizations({ ar: 'حظر عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('Member to ban').setDescriptionLocalizations({ ar: 'العضو المراد حظره' }).setRequired(true)).addStringOption(opt => opt.setName('reason').setNameLocalizations({ ar: 'سبب' }).setDescription('Reason for ban').setDescriptionLocalizations({ ar: 'سبب الحظر' }).setRequired(false)))
    .addSubcommand(sub => sub.setName('unban').setNameLocalizations({ ar: 'رفع_حظر' }).setDescription('Unban a user').setDescriptionLocalizations({ ar: 'رفع الحظر عن عضو' }).addStringOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('User ID or name').setDescriptionLocalizations({ ar: 'معرف العضو أو اسمه' }).setRequired(true)))
    .addSubcommand(sub => sub.setName('timeout').setNameLocalizations({ ar: 'كتم' }).setDescription('Timeout a member').setDescriptionLocalizations({ ar: 'كتم عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('Member to timeout').setDescriptionLocalizations({ ar: 'العضو المراد كتمه' }).setRequired(true)).addIntegerOption(opt => opt.setName('duration').setNameLocalizations({ ar: 'مدة' }).setDescription('Duration in seconds').setDescriptionLocalizations({ ar: 'المدة بالثواني' }).setRequired(true)).addStringOption(opt => opt.setName('reason').setNameLocalizations({ ar: 'سبب' }).setDescription('Reason for timeout').setDescriptionLocalizations({ ar: 'سبب الكتم' }).setRequired(false)))
    .addSubcommand(sub => sub.setName('untimeout').setNameLocalizations({ ar: 'رفع_كتم' }).setDescription('Remove timeout from a member').setDescriptionLocalizations({ ar: 'رفع الكتم عن عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('Member to untimeout').setDescriptionLocalizations({ ar: 'العضو المراد رفع الكتم عنه' }).setRequired(true)))
    .addSubcommand(sub => sub.setName('warn').setNameLocalizations({ ar: 'تحذير' }).setDescription('Warn a member').setDescriptionLocalizations({ ar: 'تحذير عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('Member to warn').setDescriptionLocalizations({ ar: 'العضو المراد تحذيره' }).setRequired(true)).addStringOption(opt => opt.setName('reason').setNameLocalizations({ ar: 'سبب' }).setDescription('Reason for warning').setDescriptionLocalizations({ ar: 'سبب التحذير' }).setRequired(false)))
    .addSubcommand(sub => sub.setName('warnings').setNameLocalizations({ ar: 'تحذيرات' }).setDescription('View warnings of a member').setDescriptionLocalizations({ ar: 'عرض تحذيرات عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('Member to check').setDescriptionLocalizations({ ar: 'العضو المراد عرض تحذيراته' }).setRequired(true)))
    .addSubcommand(sub => sub.setName('clearwarnings').setNameLocalizations({ ar: 'مسح_تحذيرات' }).setDescription('Clear warnings of a member').setDescriptionLocalizations({ ar: 'مسح تحذيرات عضو' }).addUserOption(opt => opt.setName('user').setNameLocalizations({ ar: 'عضو' }).setDescription('Member to clear').setDescriptionLocalizations({ ar: 'العضو المراد مسح تحذيراته' }).setRequired(true)))
    .addSubcommand(sub => sub.setName('purge').setNameLocalizations({ ar: 'مسح' }).setDescription('Delete multiple messages').setDescriptionLocalizations({ ar: 'حذف عدد من الرسائل' }).addIntegerOption(opt => opt.setName('count').setNameLocalizations({ ar: 'عدد' }).setDescription('Number of messages to delete (max 100)').setDescriptionLocalizations({ ar: 'عدد الرسائل (حد أقصى 100)' }).setRequired(true).setMinValue(1).setMaxValue(100)))
);

// ---- أمر التذاكر ----
commands.push(new SlashCommandBuilder()
    .setName('ticket')
    .setNameLocalizations({ ar: 'تذكرة' })
    .setDescription('Ticket system')
    .setDescriptionLocalizations({ ar: 'نظام التذاكر' })
    .addSubcommand(sub => sub.setName('setup').setNameLocalizations({ ar: 'إعداد' }).setDescription('Setup the ticket system').setDescriptionLocalizations({ ar: 'إعداد نظام التذاكر' }).addChannelOption(opt => opt.setName('category').setNameLocalizations({ ar: 'فئة' }).setDescription('Category for tickets').setDescriptionLocalizations({ ar: 'الفئة للتذاكر' }).setRequired(true)).addRoleOption(opt => opt.setName('support_role').setNameLocalizations({ ar: 'دور_الدعم' }).setDescription('Support role').setDescriptionLocalizations({ ar: 'دور الدعم' }).setRequired(true)).addChannelOption(opt => opt.setName('log_channel').setNameLocalizations({ ar: 'قناة_السجلات' }).setDescription('Log channel for tickets').setDescriptionLocalizations({ ar: 'قناة سجلات التذاكر' }).setRequired(true)))
    .addSubcommand(sub => sub.setName('panel').setNameLocalizations({ ar: 'لوحة' }).setDescription('Create ticket panel').setDescriptionLocalizations({ ar: 'إنشاء لوحة التذاكر' }))
    .addSubcommand(sub => sub.setName('close').setNameLocalizations({ ar: 'إغلاق' }).setDescription('Close current ticket').setDescriptionLocalizations({ ar: 'إغلاق التذكرة الحالية' }))
);

// ---- أمر الترحيب ----
commands.push(new SlashCommandBuilder()
    .setName('welcome')
    .setNameLocalizations({ ar: 'ترحيب' })
    .setDescription('Welcome system')
    .setDescriptionLocalizations({ ar: 'نظام الترحيب' })
    .addSubcommand(sub => sub.setName('set').setNameLocalizations({ ar: 'تعيين' }).setDescription('Set welcome channel').setDescriptionLocalizations({ ar: 'تعيين قناة الترحيب' }).addChannelOption(opt => opt.setName('channel').setNameLocalizations({ ar: 'قناة' }).setDescription('Channel for welcome').setDescriptionLocalizations({ ar: 'قناة الترحيب' }).setRequired(true)).addStringOption(opt => opt.setName('message').setNameLocalizations({ ar: 'رسالة' }).setDescription('Welcome message ({user}, {server})').setDescriptionLocalizations({ ar: 'رسالة الترحيب' }).setRequired(false)).addAttachmentOption(opt => opt.setName('image').setNameLocalizations({ ar: 'صورة' }).setDescription('Image for welcome').setDescriptionLocalizations({ ar: 'صورة الترحيب' }).setRequired(false)))
    .addSubcommand(sub => sub.setName('goodbye').setNameLocalizations({ ar: 'وداع' }).setDescription('Set goodbye channel').setDescriptionLocalizations({ ar: 'تعيين قناة الوداع' }).addChannelOption(opt => opt.setName('channel').setNameLocalizations({ ar: 'قناة' }).setDescription('Channel for goodbye').setDescriptionLocalizations({ ar: 'قناة الوداع' }).setRequired(true)).addStringOption(opt => opt.setName('message').setNameLocalizations({ ar: 'رسالة' }).setDescription('Goodbye message ({user}, {server})').setDescriptionLocalizations({ ar: 'رسالة الوداع' }).setRequired(false)).addAttachmentOption(opt => opt.setName('image').setNameLocalizations({ ar: 'صورة' }).setDescription('Image for goodbye').setDescriptionLocalizations({ ar: 'صورة الوداع' }).setRequired(false)))
);

// ---- أمر الحماية ----
commands.push(new SlashCommandBuilder()
    .setName('security')
    .setNameLocalizations({ ar: 'حماية' })
    .setDescription('Security settings')
    .setDescriptionLocalizations({ ar: 'إعدادات الحماية' })
    .addSubcommand(sub => sub.setName('verification').setNameLocalizations({ ar: 'تحقق' }).setDescription('Setup verification').setDescriptionLocalizations({ ar: 'إعداد نظام التحقق' }).addRoleOption(opt => opt.setName('role').setNameLocalizations({ ar: 'دور' }).setDescription('Role to give on verify').setDescriptionLocalizations({ ar: 'الدور الذي يُمنح عند التحقق' }).setRequired(true)).addChannelOption(opt => opt.setName('channel').setNameLocalizations({ ar: 'قناة' }).setDescription('Channel for verification').setDescriptionLocalizations({ ar: 'قناة التحقق' }).setRequired(true)))
    .addSubcommand(sub => sub.setName('antispam').setNameLocalizations({ ar: 'مكافحة_سبام' }).setDescription('Set spam threshold').setDescriptionLocalizations({ ar: 'تعيين حد السبام' }).addIntegerOption(opt => opt.setName('limit').setNameLocalizations({ ar: 'حد' }).setDescription('Messages per 5 seconds').setDescriptionLocalizations({ ar: 'عدد الرسائل في 5 ثوانٍ' }).setRequired(true).setMinValue(3).setMaxValue(20)))
    .addSubcommand(sub => sub.setName('mute_role').setNameLocalizations({ ar: 'دور_الكتم' }).setDescription('Set mute role').setDescriptionLocalizations({ ar: 'تعيين دور الكتم' }).addRoleOption(opt => opt.setName('role').setNameLocalizations({ ar: 'دور' }).setDescription('Mute role').setDescriptionLocalizations({ ar: 'دور الكتم' }).setRequired(true)))
);

// ---- أمر السجلات ----
commands.push(new SlashCommandBuilder()
    .setName('logs')
    .setNameLocalizations({ ar: 'سجلات' })
    .setDescription('Logging settings')
    .setDescriptionLocalizations({ ar: 'إعدادات السجلات' })
    .addSubcommand(sub => sub.setName('set').setNameLocalizations({ ar: 'تعيين' }).setDescription('Set log channel').setDescriptionLocalizations({ ar: 'تعيين قناة السجلات' }).addChannelOption(opt => opt.setName('channel').setNameLocalizations({ ar: 'قناة' }).setDescription('Log channel').setDescriptionLocalizations({ ar: 'قناة السجلات' }).setRequired(true)).addStringOption(opt => opt.setName('type').setNameLocalizations({ ar: 'نوع' }).setDescription('Log type').setDescriptionLocalizations({ ar: 'نوع السجلات' }).setRequired(true).addChoices(
        { name: 'All', value: 'all' },
        { name: 'Member', value: 'member' },
        { name: 'Messages', value: 'message' },
        { name: 'Moderation', value: 'mod' }
    )))
);

// ---- أمر الأدوار ----
commands.push(new SlashCommandBuilder()
    .setName('roles')
    .setNameLocalizations({ ar: 'أدوار' })
    .setDescription('Role management')
    .setDescriptionLocalizations({ ar: 'إدارة الأدوار' })
    .addSubcommand(sub => sub.setName('autorole').setNameLocalizations({ ar: 'تلقائي' }).setDescription('Set auto role for new members').setDescriptionLocalizations({ ar: 'تعيين دور تلقائي للقادمين الجدد' }).addRoleOption(opt => opt.setName('role').setNameLocalizations({ ar: 'دور' }).setDescription('Role to assign').setDescriptionLocalizations({ ar: 'الدور' }).setRequired(true)))
    .addSubcommand(sub => sub.setName('reaction').setNameLocalizations({ ar: 'تفاعلي' }).setDescription('Add reaction role').setDescriptionLocalizations({ ar: 'إضافة دور تفاعلي' }).addStringOption(opt => opt.setName('message_id').setNameLocalizations({ ar: 'معرف_الرسالة' }).setDescription('Message ID').setDescriptionLocalizations({ ar: 'معرف الرسالة' }).setRequired(true)).addRoleOption(opt => opt.setName('role').setNameLocalizations({ ar: 'دور' }).setDescription('Role to assign').setDescriptionLocalizations({ ar: 'الدور' }).setRequired(true)).addStringOption(opt => opt.setName('emoji').setNameLocalizations({ ar: 'إيموجي' }).setDescription('Emoji for reaction').setDescriptionLocalizations({ ar: 'الإيموجي' }).setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setNameLocalizations({ ar: 'قائمة' }).setDescription('List reaction roles').setDescriptionLocalizations({ ar: 'عرض الأدوار التفاعلية' }))
);

// ---- أمر التذكير ----
commands.push(new SlashCommandBuilder()
    .setName('reminder')
    .setNameLocalizations({ ar: 'تذكير' })
    .setDescription('Set reminders')
    .setDescriptionLocalizations({ ar: 'تعيين تذكيرات' })
    .addSubcommand(sub => sub.setName('set').setNameLocalizations({ ar: 'تعيين' }).setDescription('Set a reminder').setDescriptionLocalizations({ ar: 'تعيين تذكير' }).addIntegerOption(opt => opt.setName('duration').setNameLocalizations({ ar: 'مدة' }).setDescription('Duration in seconds').setDescriptionLocalizations({ ar: 'المدة بالثواني' }).setRequired(true)).addStringOption(opt => opt.setName('message').setNameLocalizations({ ar: 'رسالة' }).setDescription('Reminder message').setDescriptionLocalizations({ ar: 'رسالة التذكير' }).setRequired(true)))
    .addSubcommand(sub => sub.setName('repeat').setNameLocalizations({ ar: 'متكرر' }).setDescription('Set a repeating reminder').setDescriptionLocalizations({ ar: 'تعيين تذكير متكرر' }).addIntegerOption(opt => opt.setName('interval').setNameLocalizations({ ar: 'مدة' }).setDescription('Interval in seconds').setDescriptionLocalizations({ ar: 'المدة بين كل تذكير' }).setRequired(true)).addStringOption(opt => opt.setName('message').setNameLocalizations({ ar: 'رسالة' }).setDescription('Reminder message').setDescriptionLocalizations({ ar: 'رسالة التذكير' }).setRequired(true)))
);

// ---- أمر المالك ----
commands.push(new SlashCommandBuilder()
    .setName('owner')
    .setNameLocalizations({ ar: 'مالك' })
    .setDescription('Owner only commands')
    .setDescriptionLocalizations({ ar: 'أوامر المالك فقط' })
    .addSubcommand(sub => sub.setName('eval').setNameLocalizations({ ar: 'تقييم' }).setDescription('Execute JavaScript code').setDescriptionLocalizations({ ar: 'تنفيذ كود JavaScript' }).addStringOption(opt => opt.setName('code').setNameLocalizations({ ar: 'كود' }).setDescription('Code to execute').setDescriptionLocalizations({ ar: 'الكود المراد تنفيذه' }).setRequired(true)))
    .addSubcommand(sub => sub.setName('reload').setNameLocalizations({ ar: 'إعادة_تحميل' }).setDescription('Reload slash commands').setDescriptionLocalizations({ ar: 'إعادة تحميل الأوامر الشرطية' }))
);

// ================== تسجيل الأوامر ==================
const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
    try {
        console.log('🔄 Registering commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Commands registered successfully!');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
}

// ================== أحداث البوت ==================
client.once('ready', async () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    await registerCommands();
});

// ================== معالجة الأوامر ==================
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, guild, member, channel } = interaction;
    await interaction.deferReply({ ephemeral: false }).catch(() => {});

    // سجل الأمر
    logEvent(guild.id, 'command', `${user.tag} used /${commandName}`, 0x00BFFF);

    // ================== أمر المساعدة ==================
    if (commandName === 'help' || commandName === 'مساعدة') {
        const sub = options.getString('command') || options.getString('الأمر');
        if (sub) {
            const helpData = {
                help: 'Show all available commands with details',
                info: 'Show bot, server, or user information',
                economy: 'Manage your economy (balance, daily, work, rob, slot, shop, buy)',
                level: 'Check your level or leaderboard',
                moderation: 'Server moderation (kick, ban, timeout, warn, purge)',
                ticket: 'Ticket system (setup, panel, close)',
                welcome: 'Welcome and goodbye system',
                security: 'Security settings (verification, antispam, mute_role)',
                logs: 'Logging settings',
                roles: 'Role management (autorole, reaction, list)',
                reminder: 'Set reminders',
                owner: 'Owner only commands'
            };
            const info = helpData[sub];
            if (info) {
                const embed = new EmbedBuilder()
                    .setTitle(`📖 Command: /${sub}`)
                    .setDescription(info)
                    .setColor(0x00FF00)
                    .addFields({ name: 'Usage', value: `/${sub}` })
                    .setFooter({ text: 'Use /help for all commands' });
                return interaction.editReply({ embeds: [embed] });
            } else {
                return interaction.editReply({ content: `❌ No command named **${sub}**. Use /help.` });
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('📚 Available Commands')
            .setDescription('Use `/help <command>` for details.')
            .setColor(0x00BFFF)
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: `Requested by ${user.tag}`, iconURL: user.displayAvatarURL() });

        const categories = {
            'ℹ️ Information': ['help', 'info'],
            '💰 Economy': ['economy'],
            '📊 Levels': ['level'],
            '🛠️ Moderation': ['moderation'],
            '🎫 Tickets': ['ticket'],
            '📝 Welcome': ['welcome'],
            '🛡️ Security': ['security', 'logs'],
            '🎭 Roles': ['roles'],
            '⏰ Reminders': ['reminder'],
            '🔐 Owner': ['owner']
        };

        let description = '';
        for (const [category, cmds] of Object.entries(categories)) {
            const cmdList = cmds.map(cmd => `\`/${cmd}\``).join(' ');
            description += `**${category}**\n${cmdList}\n\n`;
        }

        embed.setDescription(description);
        embed.addFields({ name: '📖 Details', value: 'Use `/help <command>` for details.' });

        return interaction.editReply({ embeds: [embed] });
    }

    // ================== أمر المعلومات ==================
    if (commandName === 'info' || commandName === 'معلومات') {
        const type = options.getString('type') || options.getString('النوع');
        if (type === 'bot') {
            const embed = new EmbedBuilder()
                .setTitle('🤖 Bot Information')
                .setColor(0x00BFFF)
                .setThumbnail(client.user.displayAvatarURL())
                .addFields(
                    { name: 'Name', value: client.user.tag, inline: true },
                    { name: 'Servers', value: String(client.guilds.cache.size), inline: true },
                    { name: 'Users', value: String(client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)), inline: true },
                    { name: 'Uptime', value: moment.duration(process.uptime(), 'seconds').humanize(), inline: true },
                    { name: 'Developer', value: '<@464646868953956353>', inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        } else if (type === 'server') {
            const g = guild;
            const embed = new EmbedBuilder()
                .setTitle(`📊 ${g.name}`)
                .setColor(0x00BFFF)
                .setThumbnail(g.iconURL())
                .addFields(
                    { name: '🆔 ID', value: g.id, inline: true },
                    { name: '👑 Owner', value: `<@${g.ownerId}>`, inline: true },
                    { name: '👥 Members', value: String(g.memberCount), inline: true },
                    { name: '📢 Channels', value: String(g.channels.cache.size), inline: true },
                    { name: '📅 Created', value: g.createdAt.toDateString(), inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        } else if (type === 'user') {
            const target = options.getUser('user') || user;
            const memberTarget = guild.members.cache.get(target.id);
            const embed = new EmbedBuilder()
                .setTitle(`👤 ${target.tag}`)
                .setColor(0x00BFFF)
                .setThumbnail(target.displayAvatarURL())
                .addFields(
                    { name: '🆔 ID', value: target.id, inline: false },
                    { name: '📅 Joined', value: memberTarget ? memberTarget.joinedAt.toDateString() : 'N/A', inline: true },
                    { name: '📆 Created', value: target.createdAt.toDateString(), inline: true },
                    { name: '🎭 Roles', value: memberTarget ? memberTarget.roles.cache.map(r => r.toString()).join(' ') || 'None' : 'N/A', inline: false }
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
            return interaction.editReply({ content: `💰 ${target.tag} balance: **${bal}** coins.` });
        }
        if (sub === 'daily' || sub === 'يومي') {
            const now = new Date().toISOString().slice(0, 10);
            const row = db.prepare("SELECT daily FROM economy WHERE user_id = ? AND guild_id = ?").get(user.id, guild.id);
            if (row && row.daily === now) return interaction.editReply({ content: '❌ Already claimed today.' });
            const amount = Math.floor(Math.random() * 100) + 50;
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
            const amount = Math.floor(Math.random() * 40) + 10;
            updateBalance(user.id, guild.id, amount);
            db.prepare("UPDATE economy SET work = ? WHERE user_id = ? AND guild_id = ?").run(String(now), user.id, guild.id);
            return interaction.editReply({ content: `💼 Worked and earned **${amount}** coins.` });
        }
        if (sub === 'rob' || sub === 'سرقة') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember || target.id === user.id) return interaction.editReply({ content: '❌ Choose another member.' });
            const targetBal = getBalance(target.id, guild.id);
            if (targetBal < 10) return interaction.editReply({ content: `❌ ${target.tag} doesn't have enough.` });
            const success = Math.random() < 0.4;
            if (success) {
                const amount = Math.floor(Math.random() * Math.min(50, targetBal)) + 1;
                updateBalance(user.id, guild.id, amount);
                updateBalance(target.id, guild.id, -amount);
                logEvent(guild.id, 'rob', `${user.tag} robbed ${target.tag} for ${amount}`, 0xFF0000);
                return interaction.editReply({ content: `✅ Robbed **${amount}** coins from ${target.tag}.` });
            } else {
                const penalty = Math.floor(Math.random() * 20) + 1;
                updateBalance(user.id, guild.id, -penalty);
                return interaction.editReply({ content: `❌ Failed and lost **${penalty}** coins.` });
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
                embed.addFields({ name: '🎉 Win!', value: `Won **${win}** coins!` });
            } else if (res[0] === res[1] || res[1] === res[2] || res[0] === res[2]) {
                const win = bet * 2;
                updateBalance(user.id, guild.id, win);
                embed.addFields({ name: '🎉 Small win!', value: `Won **${win}** coins!` });
            } else {
                updateBalance(user.id, guild.id, -bet);
                embed.addFields({ name: '😔 Loss', value: `Lost **${bet}** coins.` });
            }
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'shop' || sub === 'متجر') {
            const embed = new EmbedBuilder().setTitle('🛒 Shop').setColor(0x00FF00)
                .addFields(
                    { name: '🎁 Gift', value: '100 coins', inline: true },
                    { name: '⭐ Star', value: '500 coins (nickname)', inline: true },
                    { name: '👑 Crown', value: '1000 coins (nickname)', inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'buy' || sub === 'شراء') {
            const item = options.getString('item') || options.getString('العنصر');
            const bal = getBalance(user.id, guild.id);
            if (item === 'gift') {
                if (bal < 100) return interaction.editReply({ content: '❌ Need 100 coins.' });
                updateBalance(user.id, guild.id, -100);
                const prizes = ['🎁', '🍫', '🧸', '🎮', '📱', '💻'];
                return interaction.editReply({ content: `✅ Bought a gift and got: ${prizes[Math.floor(Math.random() * prizes.length)]}` });
            }
            if (item === 'star') {
                if (bal < 500) return interaction.editReply({ content: '❌ Need 500 coins.' });
                updateBalance(user.id, guild.id, -500);
                try { await member.setNickname(`⭐ ${member.displayName}`); return interaction.editReply({ content: '✅ Star added to your nickname!' }); } catch (e) { return interaction.editReply({ content: '❌ Missing permissions.' }); }
            }
            if (item === 'crown') {
                if (bal < 1000) return interaction.editReply({ content: '❌ Need 1000 coins.' });
                updateBalance(user.id, guild.id, -1000);
                try { await member.setNickname(`👑 ${member.displayName}`); return interaction.editReply({ content: '✅ Crown added to your nickname!' }); } catch (e) { return interaction.editReply({ content: '❌ Missing permissions.' }); }
            }
        }
    }

    // ================== أمر المستويات ==================
    if (commandName === 'level' || commandName === 'مستوى') {
        const sub = options.getSubcommand();
        if (sub === 'rank' || sub === 'رتبتي') {
            const target = options.getUser('user') || user;
            const { xp, level } = getXp(target.id, guild.id);
            const needed = 5 * (level * level) + 50 * level + 100;
            const embed = new EmbedBuilder().setTitle(`📊 ${target.tag}'s Level`).setColor(0x00FF00)
                .addFields(
                    { name: 'Level', value: String(level), inline: true },
                    { name: 'XP', value: `${xp} / ${needed}`, inline: true },
                    { name: 'Progress', value: `${Math.floor((xp / needed) * 100)}%`, inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'leaderboard' || sub === 'المتصدرين') {
            const rows = db.prepare("SELECT user_id, level, xp FROM levels WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '❌ No data.' });
            const desc = rows.map((r, i) => `#${i + 1} <@${r.user_id}> - Level ${r.level} (${r.xp} XP)`).join('\n');
            const embed = new EmbedBuilder().setTitle('🏆 Leaderboard').setDescription(desc).setColor(0xFFD700);
            return interaction.editReply({ embeds: [embed] });
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
            try {
                await targetMember.kick(reason);
                logEvent(guild.id, 'kick', `${user.tag} kicked ${target.tag} (${reason})`, 0xFF0000);
                return interaction.editReply({ content: `✅ Kicked ${target.tag}.` });
            } catch (e) { return interaction.editReply({ content: '❌ Kick failed.' }); }
        }
        if (sub === 'ban' || sub === 'حظر') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ Member not found.' });
            const reason = options.getString('reason') || 'No reason provided';
            try {
                await targetMember.ban({ reason });
                logEvent(guild.id, 'ban', `${user.tag} banned ${target.tag} (${reason})`, 0xFF0000);
                return interaction.editReply({ content: `✅ Banned ${target.tag}.` });
            } catch (e) { return interaction.editReply({ content: '❌ Ban failed.' }); }
        }
        if (sub === 'unban' || sub === 'رفع_حظر') {
            const name = options.getString('user');
            const bans = await guild.bans.fetch();
            const banned = bans.find(ban => ban.user.tag.includes(name) || ban.user.id === name);
            if (!banned) return interaction.editReply({ content: '❌ User not found.' });
            try {
                await guild.bans.remove(banned.user);
                logEvent(guild.id, 'unban', `${user.tag} unbanned ${banned.user.tag}`, 0x00FF00);
                return interaction.editReply({ content: `✅ Unbanned ${banned.user.tag}.` });
            } catch (e) { return interaction.editReply({ content: '❌ Unban failed.' }); }
        }
        if (sub === 'timeout' || sub === 'كتم') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ Member not found.' });
            const duration = options.getInteger('duration');
            const reason = options.getString('reason') || 'No reason provided';
            try {
                await targetMember.timeout(duration * 1000, reason);
                logEvent(guild.id, 'timeout', `${user.tag} timed out ${target.tag} for ${duration}s`, 0xFFA500);
                return interaction.editReply({ content: `✅ Timed out ${target.tag} for ${duration} seconds.` });
            } catch (e) { return interaction.editReply({ content: '❌ Timeout failed.' }); }
        }
        if (sub === 'untimeout' || sub === 'رفع_كتم') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ Member not found.' });
            try {
                await targetMember.timeout(null);
                logEvent(guild.id, 'untimeout', `${user.tag} removed timeout from ${target.tag}`, 0x00FF00);
                return interaction.editReply({ content: `✅ Removed timeout from ${target.tag}.` });
            } catch (e) { return interaction.editReply({ content: '❌ Failed.' }); }
        }
        if (sub === 'warn' || sub === 'تحذير') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ Member not found.' });
            const reason = options.getString('reason') || 'No reason provided';
            const count = addWarning(target.id, guild.id, reason, user.id);
            logEvent(guild.id, 'warn', `${user.tag} warned ${target.tag} (${reason})`, 0xFFA500);
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
            logEvent(guild.id, 'clear_warns', `${user.tag} cleared warnings of ${target.tag}`, 0x00FF00);
            return interaction.editReply({ content: `✅ Cleared warnings for ${target.tag}.` });
        }
        if (sub === 'purge' || sub === 'مسح') {
            const count = options.getInteger('count');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                return interaction.editReply({ content: '❌ You lack permissions.', ephemeral: true });
            }
            try {
                await channel.bulkDelete(count, true);
                logEvent(guild.id, 'purge', `${user.tag} purged ${count} messages`, 0x00BFFF);
                return interaction.editReply({ content: `✅ Deleted ${count} messages.` });
            } catch (e) { return interaction.editReply({ content: '❌ Purge failed.' }); }
        }
    }

    // ================== أمر التذاكر ==================
    if (commandName === 'ticket' || commandName === 'تذكرة') {
        const sub = options.getSubcommand();
        if (sub === 'setup' || sub === 'إعداد') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
            }
            const category = options.getChannel('category');
            const supportRole = options.getRole('support_role');
            const logChannel = options.getChannel('log_channel');
            db.prepare("INSERT OR REPLACE INTO ticket_settings (guild_id, category_id, support_role_id, log_channel_id) VALUES (?, ?, ?, ?)")
                .run(guild.id, category.id, supportRole.id, logChannel.id);
            return interaction.editReply({ content: `✅ Ticket system setup complete! Category: ${category.name}, Support Role: ${supportRole.name}, Log Channel: ${logChannel.name}` });
        }
        if (sub === 'panel' || sub === 'لوحة') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setTitle('🎫 Ticket System')
                .setDescription('Click the button below to create a ticket.')
                .setColor(0x00BFFF)
                .setImage('https://i.imgur.com/your-image-here.png');
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('create_ticket').setLabel('🎫 Create Ticket').setStyle(ButtonStyle.Primary)
                );
            await interaction.editReply({ content: '✅ Ticket panel created!', ephemeral: true });
            await channel.send({ embeds: [embed], components: [row] });
        }
        if (sub === 'close' || sub === 'إغلاق') {
            if (!channel.name.startsWith('ticket-')) {
                return interaction.editReply({ content: '❌ This is not a ticket channel.', ephemeral: true });
            }
            db.prepare("UPDATE tickets SET status = 'closed' WHERE channel_id = ?").run(channel.id);
            logEvent(guild.id, 'ticket_close', `${user.tag} closed ticket ${channel.name}`, 0xFF0000);
            await interaction.editReply({ content: '🔒 Ticket will be deleted in 5 seconds.' });
            setTimeout(() => channel.delete().catch(() => {}), 5000);
        }
    }

    // ================== أمر الترحيب ==================
    if (commandName === 'welcome' || commandName === 'ترحيب') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
        }
        if (sub === 'set' || sub === 'تعيين') {
            const targetChannel = options.getChannel('channel');
            const message = options.getString('message') || 'Welcome {user} to {server}!';
            const attachment = options.getAttachment('image');
            const imageUrl = attachment ? attachment.url : '';
            db.prepare("INSERT OR REPLACE INTO welcome (guild_id, channel_id, message, image_url) VALUES (?, ?, ?, ?)")
                .run(guild.id, targetChannel.id, message, imageUrl);
            return interaction.editReply({ content: `✅ Welcome channel set to ${targetChannel} ${imageUrl ? 'with image' : 'without image'}` });
        }
        if (sub === 'goodbye' || sub === 'وداع') {
            const targetChannel = options.getChannel('channel');
            const message = options.getString('message') || 'Goodbye {user} from {server}!';
            const attachment = options.getAttachment('image');
            const imageUrl = attachment ? attachment.url : '';
            db.prepare("INSERT OR REPLACE INTO goodbye (guild_id, channel_id, message, image_url) VALUES (?, ?, ?, ?)")
                .run(guild.id, targetChannel.id, message, imageUrl);
            return interaction.editReply({ content: `✅ Goodbye channel set to ${targetChannel} ${imageUrl ? 'with image' : 'without image'}` });
        }
    }

    // ================== أمر الحماية ==================
    if (commandName === 'security' || commandName === 'حماية') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
        }
        if (sub === 'verification' || sub === 'تحقق') {
            const role = options.getRole('role');
            const channel = options.getChannel('channel');
            db.prepare("INSERT OR REPLACE INTO verify_roles (guild_id, role_id, channel_id) VALUES (?, ?, ?)").run(guild.id, role.id, channel.id);
            const embed = new EmbedBuilder()
                .setTitle('✅ Verification')
                .setDescription('Click the button below to verify yourself.')
                .setColor(0x00FF00);
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('verify_button').setLabel('✅ Verify').setStyle(ButtonStyle.Success)
                );
            await channel.send({ embeds: [embed], components: [row] });
            return interaction.editReply({ content: `✅ Verification setup complete! Role: ${role.name}, Channel: ${channel}` });
        }
        if (sub === 'antispam' || sub === 'مكافحة_سبام') {
            const limit = options.getInteger('limit');
            db.prepare("INSERT OR REPLACE INTO auto_mod (guild_id, spam_threshold) VALUES (?, ?)").run(guild.id, limit);
            return interaction.editReply({ content: `✅ Spam threshold set to ${limit} messages per 5 seconds.` });
        }
        if (sub === 'mute_role' || sub === 'دور_الكتم') {
            const role = options.getRole('role');
            db.prepare("INSERT OR REPLACE INTO mute_roles (guild_id, role_id) VALUES (?, ?)").run(guild.id, role.id);
            return interaction.editReply({ content: `✅ Mute role set to ${role.name}` });
        }
    }

    // ================== أمر السجلات ==================
    if (commandName === 'logs' || commandName === 'سجلات') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
        }
        if (sub === 'set' || sub === 'تعيين') {
            const targetChannel = options.getChannel('channel');
            const type = options.getString('type');
            db.prepare("INSERT OR REPLACE INTO logging (guild_id, channel_id, type) VALUES (?, ?, ?)")
                .run(guild.id, targetChannel.id, type);
            return interaction.editReply({ content: `✅ Log channel set for ${type} to ${targetChannel}` });
        }
    }

    // ================== أمر الأدوار ==================
    if (commandName === 'roles' || commandName === 'أدوار') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply({ content: '❌ Administrator required.', ephemeral: true });
        }
        if (sub === 'autorole' || sub === 'تلقائي') {
            const role = options.getRole('role');
            db.prepare("INSERT OR REPLACE INTO autoroles (guild_id, role_id) VALUES (?, ?)").run(guild.id, role.id);
            return interaction.editReply({ content: `✅ Auto role set to ${role.name}` });
        }
        if (sub === 'reaction' || sub === 'تفاعلي') {
            const msgId = options.getString('message_id');
            const role = options.getRole('role');
            const emoji = options.getString('emoji');
            db.prepare("INSERT INTO reaction_roles (guild_id, message_id, role_id, emoji) VALUES (?, ?, ?, ?)")
                .run(guild.id, msgId, role.id, emoji);
            try {
                const msg = await channel.messages.fetch(msgId);
                await msg.react(emoji);
            } catch (e) {}
            return interaction.editReply({ content: `✅ Reaction role added: ${emoji} -> ${role.name}` });
        }
        if (sub === 'list' || sub === 'قائمة') {
            const rows = db.prepare("SELECT id, message_id, role_id, emoji FROM reaction_roles WHERE guild_id = ?").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 No reaction roles.' });
            const list = rows.map(r => `#${r.id} - ${r.emoji} -> <@&${r.role_id}>`).join('\n');
            return interaction.editReply({ content: `📋 Reaction roles:\n${list}` });
        }
    }

    // ================== أمر التذكير ==================
    if (commandName === 'reminder' || commandName === 'تذكير') {
        const sub = options.getSubcommand();
        if (sub === 'set' || sub === 'تعيين') {
            const duration = options.getInteger('duration');
            const msgText = options.getString('message');
            const remindTime = Date.now() + duration * 1000;
            db.prepare("INSERT INTO reminders (user_id, channel_id, message, remind_time) VALUES (?, ?, ?, ?)")
                .run(user.id, channel.id, msgText, String(remindTime));
            return interaction.editReply({ content: `✅ Reminder set for ${duration} seconds.` });
        }
        if (sub === 'repeat' || sub === 'متكرر') {
            const interval = options.getInteger('interval');
            const msgText = options.getString('message');
            const remindTime = Date.now() + interval * 1000;
            db.prepare("INSERT INTO reminders (user_id, channel_id, message, remind_time, repeat_interval) VALUES (?, ?, ?, ?, ?)")
                .run(user.id, channel.id, msgText, String(remindTime), interval);
            return interaction.editReply({ content: `✅ Repeating reminder set every ${interval} seconds.` });
        }
    }

    // ================== أمر المالك ==================
    if (commandName === 'owner' || commandName === 'مالك') {
        const ownerId = '464646868953956353';
        if (user.id !== ownerId) {
            return interaction.editReply({ content: '❌ This command is restricted to the bot owner.', ephemeral: true });
        }
        const sub = options.getSubcommand();
        if (sub === 'eval' || sub === 'تقييم') {
            const code = options.getString('code');
            try {
                const result = eval(code);
                return interaction.editReply({ content: `📊 Result: \`\`\`js\n${result}\n\`\`\`` });
            } catch (e) {
                return interaction.editReply({ content: `❌ Error: ${e.message}` });
            }
        }
        if (sub === 'reload' || sub === 'إعادة_تحميل') {
            await registerCommands();
            return interaction.editReply({ content: '✅ Commands reloaded.' });
        }
    }
});

// ================== أحداث العضوية ==================
client.on(Events.GuildMemberAdd, async (member) => {
    // الترحيب
    const welcome = db.prepare("SELECT channel_id, message, image_url FROM welcome WHERE guild_id = ?").get(member.guild.id);
    if (welcome) {
        const channel = member.guild.channels.cache.get(welcome.channel_id);
        if (channel) {
            const msg = welcome.message.replace(/{user}/g, member.toString()).replace(/{server}/g, member.guild.name);
            const embed = new EmbedBuilder()
                .setTitle('👋 Welcome!')
                .setDescription(msg)
                .setColor(0x00FF00)
                .setThumbnail(member.displayAvatarURL());
            if (welcome.image_url) embed.setImage(welcome.image_url);
            channel.send({ embeds: [embed] });
        }
    }
    // الأدوار التلقائية
    const autoroles = db.prepare("SELECT role_id FROM autoroles WHERE guild_id = ?").all(member.guild.id);
    for (const r of autoroles) {
        const role = member.guild.roles.cache.get(r.role_id);
        if (role) member.roles.add(role).catch(() => {});
    }
    // السجلات
    logEvent(member.guild.id, 'member_join', `${member.user.tag} joined the server.`, 0x00FF00);
});

client.on(Events.GuildMemberRemove, (member) => {
    // الوداع
    const goodbye = db.prepare("SELECT channel_id, message, image_url FROM goodbye WHERE guild_id = ?").get(member.guild.id);
    if (goodbye) {
        const channel = member.guild.channels.cache.get(goodbye.channel_id);
        if (channel) {
            const msg = goodbye.message.replace(/{user}/g, member.user.tag).replace(/{server}/g, member.guild.name);
            const embed = new EmbedBuilder()
                .setTitle('👋 Goodbye!')
                .setDescription(msg)
                .setColor(0xFF0000)
                .setThumbnail(member.displayAvatarURL());
            if (goodbye.image_url) embed.setImage(goodbye.image_url);
            channel.send({ embeds: [embed] });
        }
    }
    // السجلات
    logEvent(member.guild.id, 'member_leave', `${member.user.tag} left the server.`, 0xFF0000);
});

// ================== نظام الحماية المتقدم ==================
const messageCache = new Collection();

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    // نظام مكافحة السبام
    const spamConfig = db.prepare("SELECT spam_threshold FROM auto_mod WHERE guild_id = ?").get(message.guild.id);
    const threshold = spamConfig ? spamConfig.spam_threshold : 5;
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
            logEvent(message.guild.id, 'spam', `${message.author.tag} was timed out for spamming.`, 0xFF0000);
            await message.channel.send(`🔇 ${message.author} was timed out for spamming.`);
        } catch (e) {}
    }

    // نظام المستويات
    if (!message.content.startsWith('/')) {
        const xpGain = Math.floor(Math.random() * 15) + 5;
        addXp(message.author.id, message.guild.id, xpGain);
        updateStat(message.author.id, message.guild.id, 'messages', 1);
    }
});

// ================== سجلات الرسائل ==================
client.on(Events.MessageDelete, (message) => {
    if (!message.guild || message.author?.bot) return;
    logEvent(message.guild.id, 'message_delete', `${message.author?.tag} deleted: ${message.content?.slice(0, 100) || '[Media]'}`, 0xFF6347);
});

client.on(Events.MessageUpdate, (oldMsg, newMsg) => {
    if (!oldMsg.guild || oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
    logEvent(oldMsg.guild.id, 'message_edit', `${oldMsg.author?.tag} edited: ${oldMsg.content?.slice(0, 50)} -> ${newMsg.content?.slice(0, 50)}`, 0xFFA500);
});

// ================== أحداث التفاعلات ==================
client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
        if (interaction.customId === 'create_ticket') {
            const settings = db.prepare("SELECT category_id, support_role_id, log_channel_id FROM ticket_settings WHERE guild_id = ?").get(interaction.guild.id);
            if (!settings) {
                return interaction.reply({ content: '❌ Ticket system not set up. Ask an admin to run `/ticket setup`.', ephemeral: true });
            }
            const category = interaction.guild.channels.cache.get(settings.category_id);
            if (!category) {
                return interaction.reply({ content: '❌ Category not found. Please contact an admin.', ephemeral: true });
            }
            const overwrites = [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ];
            // إضافة صلاحيات دور الدعم
            const supportRole = interaction.guild.roles.cache.get(settings.support_role_id);
            if (supportRole) {
                overwrites.push({ id: supportRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
            }
            const channelName = `ticket-${interaction.user.username}`;
            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: overwrites,
                topic: `Ticket for ${interaction.user.tag}`
            });
            db.prepare("INSERT INTO tickets (guild_id, channel_id, user_id, topic, status, created_at, category) VALUES (?, ?, ?, ?, 'open', datetime('now'), ?)")
                .run(interaction.guild.id, ticketChannel.id, interaction.user.id, 'General support', 'General');
            const embed = new EmbedBuilder()
                .setTitle('🎫 Ticket Created')
                .setDescription(`Hello ${interaction.user.tag}! Support team will assist you shortly.`)
                .setColor(0x00BFFF)
                .addFields(
                    { name: '📌 Topic', value: 'General support', inline: true },
                    { name: '👤 Created by', value: interaction.user.tag, inline: true }
                )
                .setFooter({ text: 'Click "Close Ticket" when done.' });
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
                );
            await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
            await interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });
            logEvent(interaction.guild.id, 'ticket_open', `${interaction.user.tag} opened a ticket.`, 0x00BFFF);
        }
        if (interaction.customId === 'close_ticket') {
            if (!interaction.channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });
            }
            db.prepare("UPDATE tickets SET status = 'closed' WHERE channel_id = ?").run(interaction.channel.id);
            await interaction.reply('🔒 Ticket will be deleted in 5 seconds.');
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
        if (interaction.customId === 'verify_button') {
            const row = db.prepare("SELECT role_id FROM verify_roles WHERE guild_id = ?").get(interaction.guild.id);
            if (row) {
                const role = interaction.guild.roles.cache.get(row.role_id);
                if (role) {
                    await interaction.member.roles.add(role);
                    await interaction.reply({ content: `✅ Verified! You received the ${role.name} role.`, ephemeral: true });
                }
            }
        }
    }
});

// ================== التذكيرات ==================
setInterval(() => {
    const now = Date.now();
    const reminders = db.prepare("SELECT id, user_id, channel_id, message, remind_time, repeat_interval FROM reminders WHERE remind_time <= ?").all(String(now));
    for (const row of reminders) {
        const user = client.users.cache.get(row.user_id);
        const channel = client.channels.cache.get(row.channel_id);
        if (user) user.send(`⏰ Reminder: ${row.message}`).catch(() => {});
        if (channel) channel.send(`⏰ <@${row.user_id}> Reminder: ${row.message}`).catch(() => {});
        if (row.repeat_interval > 0) {
            const newTime = now + row.repeat_interval * 1000;
            db.prepare("UPDATE reminders SET remind_time = ? WHERE id = ?").run(String(newTime), row.id);
        } else {
            db.prepare("DELETE FROM reminders WHERE id = ?").run(row.id);
        }
    }
}, 30000);

// ================== تشغيل البوت ==================
client.login(TOKEN);
