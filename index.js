// ================================================================
// DISCORD BOT ULTIMATE - إصدار Slash Commands المتطور
// جميع الأوامر شرطية (/) - لغة عربية - أنظمة متكاملة
// ================================================================

const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, ChannelType, SlashCommandBuilder, REST, Routes, Collection, Events } = require('discord.js');
const Database = require('better-sqlite3');
const axios = require('axios');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

// ================== قاعدة البيانات ==================
const db = new Database('./ultimate_bot.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS economy (user_id TEXT, guild_id TEXT, balance INTEGER DEFAULT 0, bank INTEGER DEFAULT 0, daily TEXT, work TEXT, weekly TEXT);
    CREATE TABLE IF NOT EXISTS levels (user_id TEXT, guild_id TEXT, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS warnings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, guild_id TEXT, reason TEXT, date TEXT);
    CREATE TABLE IF NOT EXISTS autoroles (guild_id TEXT, role_id TEXT);
    CREATE TABLE IF NOT EXISTS welcome (guild_id TEXT, channel_id TEXT, message TEXT, image_url TEXT);
    CREATE TABLE IF NOT EXISTS goodbye (guild_id TEXT, channel_id TEXT, message TEXT, image_url TEXT);
    CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, user_id TEXT, topic TEXT, status TEXT, created_at TEXT, category TEXT, priority TEXT);
    CREATE TABLE IF NOT EXISTS logging (guild_id TEXT, channel_id TEXT, type TEXT);
    CREATE TABLE IF NOT EXISTS reaction_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, message_id TEXT, role_id TEXT, emoji TEXT);
    CREATE TABLE IF NOT EXISTS member_stats (user_id TEXT, guild_id TEXT, messages INTEGER DEFAULT 0, voice_minutes INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS warnings_system (user_id TEXT, guild_id TEXT, reason TEXT, date TEXT, moderator TEXT);
    CREATE TABLE IF NOT EXISTS mute_roles (guild_id TEXT, role_id TEXT);
    CREATE TABLE IF NOT EXISTS verify_roles (guild_id TEXT, role_id TEXT, channel_id TEXT);
    CREATE TABLE IF NOT EXISTS auto_mod (guild_id TEXT, spam_threshold INTEGER DEFAULT 5, invite_filter INTEGER DEFAULT 1, link_filter INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS temp_channels (guild_id TEXT, category_id TEXT, channel_id TEXT, owner_id TEXT, created_at TEXT);
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
    }
    db.prepare("UPDATE levels SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ?").run(xp, level, userId, guildId);
}

function addWarning(userId, guildId, reason, moderator) {
    db.prepare("INSERT INTO warnings_system (user_id, guild_id, reason, date, moderator) VALUES (?, ?, ?, datetime('now'), ?)").run(userId, guildId, reason, moderator);
    const count = db.prepare("SELECT COUNT(*) FROM warnings_system WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    return count['COUNT(*)'];
}

function getWarnings(userId, guildId) {
    return db.prepare("SELECT reason, date, moderator FROM warnings_system WHERE user_id = ? AND guild_id = ?").all(userId, guildId);
}

function clearWarnings(userId, guildId) {
    db.prepare("DELETE FROM warnings_system WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
}

function logEvent(guildId, type, description, color = 0x2F3136) {
    const row = db.prepare("SELECT channel_id FROM logging WHERE guild_id = ? AND type = ?").get(guildId, type);
    if (!row) {
        const all = db.prepare("SELECT channel_id FROM logging WHERE guild_id = ? AND type = 'all'").get(guildId);
        if (!all) return;
        const channel = client.channels.cache.get(all.channel_id);
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

// ================== كائن الأوامر ==================
const commands = [];

// ================== تعريف الأوامر ==================

// ---- أمر المساعدة ----
commands.push(new SlashCommandBuilder()
    .setName('مساعدة')
    .setDescription('عرض جميع الأوامر المتاحة مع شرح مفصل')
    .addStringOption(option => option.setName('الأمر').setDescription('اسم الأمر للحصول على شرح تفصيلي').setRequired(false))
);

// ---- أمر المعلومات ----
commands.push(new SlashCommandBuilder()
    .setName('معلومات')
    .setDescription('عرض معلومات عن البوت أو السيرفر أو العضو')
    .addStringOption(option => option.setName('النوع').setDescription('نوع المعلومات').setRequired(true).addChoices(
        { name: 'البوت', value: 'bot' },
        { name: 'السيرفر', value: 'server' },
        { name: 'عضو', value: 'user' }
    ))
    .addUserOption(option => option.setName('العضو').setDescription('العضو المطلوب معلوماته').setRequired(false))
);

// ---- أمر الاقتصاد ----
commands.push(new SlashCommandBuilder()
    .setName('اقتصاد')
    .setDescription('إدارة رصيدك وعملاتك')
    .addSubcommand(sub => sub.setName('رصيد').setDescription('عرض رصيدك').addUserOption(opt => opt.setName('عضو').setDescription('عرض رصيد عضو آخر').setRequired(false)))
    .addSubcommand(sub => sub.setName('يومي').setDescription('الحصول على المكافأة اليومية'))
    .addSubcommand(sub => sub.setName('عمل').setDescription('العمل لكسب عملات إضافية'))
    .addSubcommand(sub => sub.setName('سرقة').setDescription('محاولة سرقة عملات من عضو آخر').addUserOption(opt => opt.setName('عضو').setDescription('العضو المراد سرقته').setRequired(true)))
    .addSubcommand(sub => sub.setName('حظ').setDescription('لعب ماكينة الحظ').addIntegerOption(opt => opt.setName('رهان').setDescription('مبلغ الرهان').setRequired(false)))
    .addSubcommand(sub => sub.setName('متجر').setDescription('عرض المتجر'))
    .addSubcommand(sub => sub.setName('شراء').setDescription('شراء عنصر من المتجر').addStringOption(opt => opt.setName('العنصر').setDescription('العنصر المراد شراؤه').setRequired(true).addChoices(
        { name: 'هدية', value: 'هدية' },
        { name: 'نجمة', value: 'نجمة' },
        { name: 'تاج', value: 'تاج' }
    )))
);

// ---- أمر المستويات ----
commands.push(new SlashCommandBuilder()
    .setName('مستوى')
    .setDescription('عرض مستواك أو ترتيب المتصدرين')
    .addSubcommand(sub => sub.setName('رتبتي').setDescription('عرض مستواك').addUserOption(opt => opt.setName('عضو').setDescription('عضو آخر').setRequired(false)))
    .addSubcommand(sub => sub.setName('المتصدرين').setDescription('عرض لوحة المتصدرين'))
);

// ---- أمر الإدارة ----
commands.push(new SlashCommandBuilder()
    .setName('إدارة')
    .setDescription('أوامر إدارة السيرفر')
    .addSubcommand(sub => sub.setName('طرد').setDescription('طرد عضو من السيرفر').addUserOption(opt => opt.setName('عضو').setDescription('العضو').setRequired(true)).addStringOption(opt => opt.setName('سبب').setDescription('سبب الطرد').setRequired(false)))
    .addSubcommand(sub => sub.setName('حظر').setDescription('حظر عضو من السيرفر').addUserOption(opt => opt.setName('عضو').setDescription('العضو').setRequired(true)).addStringOption(opt => opt.setName('سبب').setDescription('سبب الحظر').setRequired(false)))
    .addSubcommand(sub => sub.setName('رفع_حظر').setDescription('رفع الحظر عن عضو').addStringOption(opt => opt.setName('اسم').setDescription('اسم العضو أو المعرف').setRequired(true)))
    .addSubcommand(sub => sub.setName('كتم').setDescription('كتم عضو').addUserOption(opt => opt.setName('عضو').setDescription('العضو').setRequired(true)).addIntegerOption(opt => opt.setName('مدة').setDescription('المدة بالثواني').setRequired(true)).addStringOption(opt => opt.setName('سبب').setDescription('السبب').setRequired(false)))
    .addSubcommand(sub => sub.setName('رفع_كتم').setDescription('رفع الكتم عن عضو').addUserOption(opt => opt.setName('عضو').setDescription('العضو').setRequired(true)))
    .addSubcommand(sub => sub.setName('تحذير').setDescription('تحذير عضو').addUserOption(opt => opt.setName('عضو').setDescription('العضو').setRequired(true)).addStringOption(opt => opt.setName('سبب').setDescription('سبب التحذير').setRequired(false)))
    .addSubcommand(sub => sub.setName('تحذيرات').setDescription('عرض تحذيرات عضو').addUserOption(opt => opt.setName('عضو').setDescription('العضو').setRequired(true)))
    .addSubcommand(sub => sub.setName('مسح_تحذيرات').setDescription('مسح تحذيرات عضو').addUserOption(opt => opt.setName('عضو').setDescription('العضو').setRequired(true)))
    .addSubcommand(sub => sub.setName('مسح').setDescription('حذف عدد من الرسائل').addIntegerOption(opt => opt.setName('عدد').setDescription('عدد الرسائل (حد أقصى 100)').setRequired(true).setMinValue(1).setMaxValue(100)))
);

// ---- أمر التذاكر ----
commands.push(new SlashCommandBuilder()
    .setName('تذكرة')
    .setDescription('إدارة تذاكر الدعم')
    .addSubcommand(sub => sub.setName('فتح').setDescription('فتح تذكرة جديدة').addStringOption(opt => opt.setName('الموضوع').setDescription('موضوع التذكرة').setRequired(true)).addStringOption(opt => opt.setName('القسم').setDescription('قسم التذكرة').setRequired(true).addChoices(
        { name: 'دعم فني', value: 'دعم فني' },
        { name: 'شكوى', value: 'شكوى' },
        { name: 'اقتراح', value: 'اقتراح' },
        { name: 'طلب عضوية', value: 'طلب عضوية' },
        { name: 'أخرى', value: 'أخرى' }
    )))
    .addSubcommand(sub => sub.setName('إغلاق').setDescription('إغلاق التذكرة الحالية'))
    .addSubcommand(sub => sub.setName('لوحة').setDescription('إنشاء لوحة تحكم التذاكر'))
);

// ---- أمر الترحيب ----
commands.push(new SlashCommandBuilder()
    .setName('ترحيب')
    .setDescription('إعدادات الترحيب')
    .addSubcommand(sub => sub.setName('تعيين').setDescription('تعيين قناة الترحيب').addChannelOption(opt => opt.setName('قناة').setDescription('القناة').setRequired(true)).addStringOption(opt => opt.setName('رسالة').setDescription('رسالة الترحيب (استخدم {user} و {server})').setRequired(false)).addAttachmentOption(opt => opt.setName('صورة').setDescription('صورة للترحيب').setRequired(false)))
    .addSubcommand(sub => sub.setName('تعيين_وداع').setDescription('تعيين قناة الوداع').addChannelOption(opt => opt.setName('قناة').setDescription('القناة').setRequired(true)).addStringOption(opt => opt.setName('رسالة').setDescription('رسالة الوداع (استخدم {user} و {server})').setRequired(false)).addAttachmentOption(opt => opt.setName('صورة').setDescription('صورة للوداع').setRequired(false)))
);

// ---- أمر الحماية ----
commands.push(new SlashCommandBuilder()
    .setName('حماية')
    .setDescription('إعدادات الحماية')
    .addSubcommand(sub => sub.setName('تفعيل').setDescription('تفعيل وضع الحماية').addIntegerOption(opt => opt.setName('المستوى').setDescription('مستوى الحماية 1-3').setRequired(true).setMinValue(1).setMaxValue(3)))
    .addSubcommand(sub => sub.setName('تعيين_دور_كتم').setDescription('تعيين دور الكتم').addRoleOption(opt => opt.setName('دور').setDescription('دور الكتم').setRequired(true)))
    .addSubcommand(sub => sub.setName('تعيين_دور_تحقق').setDescription('تعيين دور التحقق').addRoleOption(opt => opt.setName('دور').setDescription('دور التحقق').setRequired(true)).addChannelOption(opt => opt.setName('قناة').setDescription('قناة التحقق').setRequired(true)))
    .addSubcommand(sub => sub.setName('إعدادات_سبام').setDescription('تعيين حدود السبام').addIntegerOption(opt => opt.setName('الحد').setDescription('عدد الرسائل المسموح بها في 5 ثوانٍ').setRequired(true).setMinValue(3).setMaxValue(20)))
);

// ---- أمر السجلات ----
commands.push(new SlashCommandBuilder()
    .setName('سجلات')
    .setDescription('إعدادات سجلات السيرفر')
    .addSubcommand(sub => sub.setName('تعيين').setDescription('تعيين قناة السجلات').addChannelOption(opt => opt.setName('قناة').setDescription('القناة').setRequired(true)).addStringOption(opt => opt.setName('النوع').setDescription('نوع السجلات').setRequired(true).addChoices(
        { name: 'الكل', value: 'all' },
        { name: 'عضوية', value: 'member' },
        { name: 'رسائل', value: 'message' },
        { name: 'إدارة', value: 'mod' },
        { name: 'تذاكر', value: 'ticket' }
    )))
);

// ---- أمر الأدوار ----
commands.push(new SlashCommandBuilder()
    .setName('أدوار')
    .setDescription('إدارة الأدوار')
    .addSubcommand(sub => sub.setName('تعيين_تلقائي').setDescription('تعيين دور تلقائي للقادمين الجدد').addRoleOption(opt => opt.setName('دور').setDescription('الدور').setRequired(true)))
    .addSubcommand(sub => sub.setName('تفاعلي').setDescription('تعيين دور تفاعلي').addStringOption(opt => opt.setName('رسالة').setDescription('معرف الرسالة').setRequired(true)).addRoleOption(opt => opt.setName('دور').setDescription('الدور').setRequired(true)).addStringOption(opt => opt.setName('إيموجي').setDescription('الإيموجي').setRequired(true)))
    .addSubcommand(sub => sub.setName('قائمة').setDescription('عرض الأدوار التفاعلية'))
);

// ---- أمر التذكيرات ----
commands.push(new SlashCommandBuilder()
    .setName('تذكير')
    .setDescription('تعيين تذكير')
    .addSubcommand(sub => sub.setName('تعيين').setDescription('تعيين تذكير').addIntegerOption(opt => opt.setName('مدة').setDescription('المدة بالثواني').setRequired(true)).addStringOption(opt => opt.setName('رسالة').setDescription('رسالة التذكير').setRequired(true)))
    .addSubcommand(sub => sub.setName('متكرر').setDescription('تعيين تذكير متكرر').addIntegerOption(opt => opt.setName('مدة').setDescription('المدة بالثواني بين كل تذكير').setRequired(true)).addStringOption(opt => opt.setName('رسالة').setDescription('رسالة التذكير').setRequired(true)))
);

// ---- أمر الألعاب ----
commands.push(new SlashCommandBuilder()
    .setName('لعبة')
    .setDescription('ألعاب متنوعة')
    .addSubcommand(sub => sub.setName('حظ').setDescription('اسأل كرة الحظ').addStringOption(opt => opt.setName('سؤال').setDescription('سؤالك').setRequired(true)))
    .addSubcommand(sub => sub.setName('نرد').setDescription('رمي النرد').addIntegerOption(opt => opt.setName('أقصى').setDescription('أقصى رقم').setRequired(false)))
    .addSubcommand(sub => sub.setName('عملة').setDescription('قلب العملة'))
    .addSubcommand(sub => sub.setName('ميم').setDescription('جلب ميم عشوائي'))
    .addSubcommand(sub => sub.setName('طقس').setDescription('الطقس في مدينة').addStringOption(opt => opt.setName('مدينة').setDescription('اسم المدينة').setRequired(true)))
);

// ---- أمر العشائر ----
commands.push(new SlashCommandBuilder()
    .setName('عشيرة')
    .setDescription('إدارة العشائر')
    .addSubcommand(sub => sub.setName('إنشاء').setDescription('إنشاء عشيرة جديدة').addStringOption(opt => opt.setName('الاسم').setDescription('اسم العشيرة').setRequired(true)))
    .addSubcommand(sub => sub.setName('معلومات').setDescription('عرض معلومات عشيرة').addStringOption(opt => opt.setName('الاسم').setDescription('اسم العشيرة').setRequired(true)))
);

// ---- أمر الزراعة ----
commands.push(new SlashCommandBuilder()
    .setName('مزرعة')
    .setDescription('إدارة المزرعة')
    .addSubcommand(sub => sub.setName('زرع').setDescription('زراعة محصول').addStringOption(opt => opt.setName('محصول').setDescription('نوع المحصول').setRequired(true).addChoices(
        { name: 'قمح', value: 'قمح' },
        { name: 'ذرة', value: 'ذرة' },
        { name: 'طماطم', value: 'طماطم' },
        { name: 'بطاطس', value: 'بطاطس' }
    )))
    .addSubcommand(sub => sub.setName('حصاد').setDescription('حصاد المحصول'))
);

// ---- أمر المزادات ----
commands.push(new SlashCommandBuilder()
    .setName('مزاد')
    .setDescription('إدارة المزادات')
    .addSubcommand(sub => sub.setName('إنشاء').setDescription('إنشاء مزاد جديد').addStringOption(opt => opt.setName('عنصر').setDescription('العنصر المعروض').setRequired(true)).addIntegerOption(opt => opt.setName('سعر_بدء').setDescription('سعر البداية').setRequired(true)))
    .addSubcommand(sub => sub.setName('مزايدة').setDescription('المزايدة على عنصر').addIntegerOption(opt => opt.setName('معرف').setDescription('معرف المزاد').setRequired(true)).addIntegerOption(opt => opt.setName('مبلغ').setDescription('مبلغ المزايدة').setRequired(true)))
);

// ---- أمر المالك ----
commands.push(new SlashCommandBuilder()
    .setName('مالك')
    .setDescription('أوامر المالك (مقيدة)')
    .addSubcommand(sub => sub.setName('تقييم').setDescription('تنفيذ كود JavaScript').addStringOption(opt => opt.setName('كود').setDescription('الكود المراد تنفيذه').setRequired(true)))
    .addSubcommand(sub => sub.setName('إعادة_تحميل').setDescription('إعادة تحميل الأوامر'))
);

// ================== تسجيل الأوامر ==================
const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
    try {
        console.log('🔄 جاري تسجيل الأوامر...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ تم تسجيل الأوامر بنجاح!');
    } catch (error) {
        console.error('❌ فشل تسجيل الأوامر:', error);
    }
}

// ================== إنشاء البوت ==================
client.once('ready', async () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    await registerCommands();
});

// ================== معالجة الأوامر ==================
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, guild, member, channel } = interaction;
    await interaction.deferReply({ ephemeral: false }).catch(() => {});

    // ================== سجل الأوامر ==================
    logEvent(guild.id, 'command', `${user.tag} استخدم الأمر /${commandName}`, 0x00BFFF);

    // ================== أمر المساعدة ==================
    if (commandName === 'مساعدة') {
        const subCommand = options.getString('الأمر');
        if (subCommand) {
            const helpData = {
                'مساعدة': 'عرض جميع الأوامر المتاحة مع شرح مفصل',
                'معلومات': 'عرض معلومات عن البوت أو السيرفر أو العضو',
                'اقتصاد': 'إدارة رصيدك وعملاتك (رصيد، يومي، عمل، سرقة، حظ، متجر، شراء)',
                'مستوى': 'عرض مستواك أو ترتيب المتصدرين',
                'إدارة': 'أوامر إدارة السيرفر (طرد، حظر، كتم، تحذير، مسح)',
                'تذكرة': 'فتح وإغلاق تذاكر الدعم مع أقسام',
                'ترحيب': 'إعدادات الترحيب والوداع مع صور',
                'حماية': 'إعدادات الحماية المتقدمة',
                'سجلات': 'تعيين قناة السجلات بأنواعها',
                'أدوار': 'إدارة الأدوار التلقائية والتفاعلية',
                'تذكير': 'تعيين تذكيرات عادية أو متكررة',
                'لعبة': 'ألعاب متنوعة (حظ، نرد، عملة، ميم، طقس)',
                'عشيرة': 'إنشاء وإدارة العشائر',
                'مزرعة': 'زراعة وحصاد المحاصيل',
                'مزاد': 'إنشاء والمزايدة في المزادات',
                'مالك': 'أوامر مقيدة للمالك'
            };
            const info = helpData[subCommand];
            if (info) {
                const embed = new EmbedBuilder()
                    .setTitle(`📖 شرح الأمر: /${subCommand}`)
                    .setDescription(info)
                    .setColor(0x00FF00)
                    .addFields({ name: 'الاستخدام', value: `/${subCommand}` })
                    .setFooter({ text: 'استخدم /مساعدة لعرض جميع الأوامر' });
                return interaction.editReply({ embeds: [embed] });
            } else {
                return interaction.editReply({ content: `❌ لا يوجد أمر باسم **${subCommand}**. استخدم \`/مساعدة\` لعرض جميع الأوامر.` });
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('📚 قائمة الأوامر - البوت الخارق')
            .setDescription('إليك جميع الأوامر المتاحة. استخدم `/مساعدة <اسم_الأمر>` للحصول على شرح تفصيلي.')
            .setColor(0x00BFFF)
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: `طلب بواسطة ${user.tag}`, iconURL: user.displayAvatarURL() });

        const categories = {
            'ℹ️ معلومات': ['مساعدة', 'معلومات'],
            '💰 اقتصاد': ['اقتصاد'],
            '📊 مستويات': ['مستوى'],
            '🛠️ إدارة': ['إدارة'],
            '🎫 تذاكر': ['تذكرة'],
            '📝 ترحيب': ['ترحيب'],
            '🛡️ حماية': ['حماية', 'سجلات'],
            '🎭 أدوار': ['أدوار'],
            '⏰ تذكيرات': ['تذكير'],
            '🎮 ألعاب': ['لعبة'],
            '🏴 عشائر': ['عشيرة'],
            '🌾 مزرعة': ['مزرعة'],
            '🔨 مزادات': ['مزاد'],
            '🔐 مالك': ['مالك']
        };

        let description = '';
        for (const [category, cmds] of Object.entries(categories)) {
            const cmdList = cmds.map(cmd => `\`/${cmd}\``).join(' ');
            description += `**${category}**\n${cmdList}\n\n`;
        }

        embed.setDescription(description);
        embed.addFields({ name: '📖 للحصول على شرح مفصل', value: 'استخدم `/مساعدة <اسم_الأمر>`' });

        return interaction.editReply({ embeds: [embed] });
    }

    // ================== أمر المعلومات ==================
    if (commandName === 'معلومات') {
        const type = options.getString('النوع');
        if (type === 'bot') {
            const embed = new EmbedBuilder()
                .setTitle('🤖 معلومات البوت')
                .setColor(0x00BFFF)
                .setThumbnail(client.user.displayAvatarURL())
                .addFields(
                    { name: 'اسم البوت', value: client.user.tag, inline: true },
                    { name: 'عدد السيرفرات', value: String(client.guilds.cache.size), inline: true },
                    { name: 'عدد الأعضاء', value: String(client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)), inline: true },
                    { name: 'وقت التشغيل', value: moment.duration(process.uptime(), 'seconds').humanize(), inline: true },
                    { name: 'المطور', value: '<@464646868953956353>', inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        } else if (type === 'server') {
            const g = guild;
            const embed = new EmbedBuilder()
                .setTitle(`معلومات السيرفر ${g.name}`)
                .setColor(0x00BFFF)
                .setThumbnail(g.iconURL())
                .addFields(
                    { name: '🆔 المعرف', value: g.id, inline: true },
                    { name: '👑 المالك', value: `<@${g.ownerId}>`, inline: true },
                    { name: '👥 الأعضاء', value: String(g.memberCount), inline: true },
                    { name: '📢 القنوات', value: String(g.channels.cache.size), inline: true },
                    { name: '📅 التاريخ', value: g.createdAt.toDateString(), inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        } else if (type === 'user') {
            const target = options.getUser('العضو') || user;
            const memberTarget = guild.members.cache.get(target.id);
            const embed = new EmbedBuilder()
                .setTitle(`معلومات ${target.tag}`)
                .setColor(0x00BFFF)
                .setThumbnail(target.displayAvatarURL())
                .addFields(
                    { name: '🆔 المعرف', value: target.id, inline: false },
                    { name: '📅 انضم', value: memberTarget ? memberTarget.joinedAt.toDateString() : 'غير موجود', inline: true },
                    { name: '📆 الحساب', value: target.createdAt.toDateString(), inline: true },
                    { name: '🎭 الأدوار', value: memberTarget ? memberTarget.roles.cache.map(r => r.toString()).join(' ') || 'لا يوجد' : 'غير موجود', inline: false }
                );
            return interaction.editReply({ embeds: [embed] });
        }
    }

    // ================== أمر الاقتصاد ==================
    if (commandName === 'اقتصاد') {
        const sub = options.getSubcommand();
        if (sub === 'رصيد') {
            const target = options.getUser('عضو') || user;
            const bal = getBalance(target.id, guild.id);
            return interaction.editReply({ content: `💰 ${target.tag} رصيدك: **${bal}** عملة.` });
        }
        if (sub === 'يومي') {
            const now = new Date().toISOString().slice(0, 10);
            const row = db.prepare("SELECT daily FROM economy WHERE user_id = ? AND guild_id = ?").get(user.id, guild.id);
            if (row && row.daily === now) return interaction.editReply({ content: '❌ انتظر حتى الغد.' });
            const amount = Math.floor(Math.random() * 100) + 50;
            updateBalance(user.id, guild.id, amount);
            db.prepare("UPDATE economy SET daily = ? WHERE user_id = ? AND guild_id = ?").run(now, user.id, guild.id);
            return interaction.editReply({ content: `✅ حصلت على **${amount}** عملة كمكافأة يومية!` });
        }
        if (sub === 'عمل') {
            const now = Date.now();
            const row = db.prepare("SELECT work FROM economy WHERE user_id = ? AND guild_id = ?").get(user.id, guild.id);
            if (row && row.work) {
                const last = parseInt(row.work);
                if (now - last < 3600000) {
                    const remain = Math.ceil((3600000 - (now - last)) / 1000);
                    return interaction.editReply({ content: `⏳ انتظر ${remain} ثانية.` });
                }
            }
            const amount = Math.floor(Math.random() * 40) + 10;
            updateBalance(user.id, guild.id, amount);
            db.prepare("UPDATE economy SET work = ? WHERE user_id = ? AND guild_id = ?").run(String(now), user.id, guild.id);
            return interaction.editReply({ content: `💼 عملت وكسبت **${amount}** عملة.` });
        }
        if (sub === 'سرقة') {
            const target = options.getUser('عضو');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember || target.id === user.id) return interaction.editReply({ content: '❌ حدد عضواً آخر.' });
            const targetBal = getBalance(target.id, guild.id);
            if (targetBal < 10) return interaction.editReply({ content: `❌ ${target.tag} ليس لديه ما يكفي.` });
            const success = Math.random() < 0.4;
            if (success) {
                const amount = Math.floor(Math.random() * Math.min(50, targetBal)) + 1;
                updateBalance(user.id, guild.id, amount);
                updateBalance(target.id, guild.id, -amount);
                logEvent(guild.id, 'rob', `${user.tag} سرق ${target.tag} بمبلغ ${amount}`, 0xFF0000);
                return interaction.editReply({ content: `✅ سرقت **${amount}** عملة من ${target.tag}.` });
            } else {
                const penalty = Math.floor(Math.random() * 20) + 1;
                updateBalance(user.id, guild.id, -penalty);
                return interaction.editReply({ content: `❌ فشلت السرقة وخسرت **${penalty}** عملة.` });
            }
        }
        if (sub === 'حظ') {
            const bet = options.getInteger('رهان') || 10;
            const bal = getBalance(user.id, guild.id);
            if (bet <= 0 || bal < bet) return interaction.editReply({ content: '❌ رصيد غير كافٍ.' });
            const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣'];
            const res = [symbols[Math.floor(Math.random() * 6)], symbols[Math.floor(Math.random() * 6)], symbols[Math.floor(Math.random() * 6)]];
            const embed = new EmbedBuilder().setTitle('🎰 ماكينة الحظ').setDescription(`${res[0]} ${res[1]} ${res[2]}`).setColor(0x2F3136);
            if (res[0] === res[1] && res[1] === res[2]) {
                const win = bet * 10;
                updateBalance(user.id, guild.id, win);
                embed.addFields({ name: '🎉 فوز', value: `ربحت **${win}** عملة!` });
            } else if (res[0] === res[1] || res[1] === res[2] || res[0] === res[2]) {
                const win = bet * 2;
                updateBalance(user.id, guild.id, win);
                embed.addFields({ name: '🎉 فوز بسيط', value: `ربحت **${win}** عملة!` });
            } else {
                updateBalance(user.id, guild.id, -bet);
                embed.addFields({ name: '😔 خسارة', value: `خسرت **${bet}** عملة.` });
            }
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'متجر') {
            const embed = new EmbedBuilder().setTitle('🛒 المتجر').setColor(0x00FF00)
                .addFields(
                    { name: '🎁 هدية', value: '100 عملة', inline: true },
                    { name: '🌟 نجمة', value: '500 عملة (لقب)', inline: true },
                    { name: '👑 تاج', value: '1000 عملة (لقب)', inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'شراء') {
            const item = options.getString('العنصر');
            const bal = getBalance(user.id, guild.id);
            if (item === 'هدية') {
                if (bal < 100) return interaction.editReply({ content: '❌ تحتاج 100 عملة.' });
                updateBalance(user.id, guild.id, -100);
                const prizes = ['🎁', '🍫', '🧸', '🎮', '📱', '💻'];
                return interaction.editReply({ content: `✅ اشتريت هدية وحصلت على: ${prizes[Math.floor(Math.random() * prizes.length)]}` });
            }
            if (item === 'نجمة') {
                if (bal < 500) return interaction.editReply({ content: '❌ تحتاج 500 عملة.' });
                updateBalance(user.id, guild.id, -500);
                try {
                    await member.setNickname(`⭐ ${member.displayName}`);
                    return interaction.editReply({ content: '✅ تم إضافة نجمة إلى اسمك!' });
                } catch (e) {
                    return interaction.editReply({ content: '❌ لا أملك صلاحية تغيير اللقب.' });
                }
            }
            if (item === 'تاج') {
                if (bal < 1000) return interaction.editReply({ content: '❌ تحتاج 1000 عملة.' });
                updateBalance(user.id, guild.id, -1000);
                try {
                    await member.setNickname(`👑 ${member.displayName}`);
                    return interaction.editReply({ content: '✅ تم إضافة تاج إلى اسمك!' });
                } catch (e) {
                    return interaction.editReply({ content: '❌ لا أملك صلاحية تغيير اللقب.' });
                }
            }
        }
    }

    // ================== أمر المستوى ==================
    if (commandName === 'مستوى') {
        const sub = options.getSubcommand();
        if (sub === 'رتبتي') {
            const target = options.getUser('عضو') || user;
            const { xp, level } = getXp(target.id, guild.id);
            const needed = 5 * (level * level) + 50 * level + 100;
            const embed = new EmbedBuilder().setTitle(`📊 مستوى ${target.tag}`).setColor(0x00FF00)
                .addFields(
                    { name: 'المستوى', value: String(level), inline: true },
                    { name: 'XP', value: `${xp} / ${needed}`, inline: true },
                    { name: 'التقدم', value: `${Math.floor((xp / needed) * 100)}%`, inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'المتصدرين') {
            const rows = db.prepare("SELECT user_id, level, xp FROM levels WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '❌ لا توجد بيانات.' });
            const desc = rows.map((r, i) => `#${i + 1} <@${r.user_id}> - المستوى ${r.level} (${r.xp} XP)`).join('\n');
            const embed = new EmbedBuilder().setTitle('🏆 لوحة المتصدرين').setDescription(desc).setColor(0xFFD700);
            return interaction.editReply({ embeds: [embed] });
        }
    }

    // ================== أمر الإدارة ==================
    if (commandName === 'إدارة') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.editReply({ content: '❌ ليس لديك صلاحية.', ephemeral: true });
        }
        if (sub === 'طرد') {
            const target = options.getUser('عضو');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ العضو غير موجود.' });
            const reason = options.getString('سبب') || 'لا يوجد سبب';
            try {
                await targetMember.kick(reason);
                logEvent(guild.id, 'kick', `${user.tag} طرد ${target.tag} بسبب ${reason}`, 0xFF0000);
                return interaction.editReply({ content: `✅ تم طرد ${target.tag}.` });
            } catch (e) {
                return interaction.editReply({ content: '❌ فشل الطرد.' });
            }
        }
        if (sub === 'حظر') {
            const target = options.getUser('عضو');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ العضو غير موجود.' });
            const reason = options.getString('سبب') || 'لا يوجد سبب';
            try {
                await targetMember.ban({ reason });
                logEvent(guild.id, 'ban', `${user.tag} حظر ${target.tag} بسبب ${reason}`, 0xFF0000);
                return interaction.editReply({ content: `✅ تم حظر ${target.tag}.` });
            } catch (e) {
                return interaction.editReply({ content: '❌ فشل الحظر.' });
            }
        }
        if (sub === 'رفع_حظر') {
            const name = options.getString('اسم');
            const bans = await guild.bans.fetch();
            const banned = bans.find(ban => ban.user.tag.includes(name) || ban.user.id === name);
            if (!banned) return interaction.editReply({ content: '❌ لم يتم العثور على العضو.' });
            try {
                await guild.bans.remove(banned.user);
                logEvent(guild.id, 'unban', `${user.tag} رفع الحظر عن ${banned.user.tag}`, 0x00FF00);
                return interaction.editReply({ content: `✅ تم رفع الحظر عن ${banned.user.tag}.` });
            } catch (e) {
                return interaction.editReply({ content: '❌ فشل رفع الحظر.' });
            }
        }
        if (sub === 'كتم') {
            const target = options.getUser('عضو');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ العضو غير موجود.' });
            const duration = options.getInteger('مدة');
            const reason = options.getString('سبب') || 'لا يوجد سبب';
            try {
                await targetMember.timeout(duration * 1000, reason);
                logEvent(guild.id, 'mute', `${user.tag} كتم ${target.tag} لمدة ${duration}s`, 0xFFA500);
                return interaction.editReply({ content: `✅ تم كتم ${target.tag} لمدة ${duration} ثانية.` });
            } catch (e) {
                return interaction.editReply({ content: '❌ فشل الكتم.' });
            }
        }
        if (sub === 'رفع_كتم') {
            const target = options.getUser('عضو');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ العضو غير موجود.' });
            try {
                await targetMember.timeout(null);
                logEvent(guild.id, 'unmute', `${user.tag} رفع الكتم عن ${target.tag}`, 0x00FF00);
                return interaction.editReply({ content: `✅ تم رفع الكتم عن ${target.tag}.` });
            } catch (e) {
                return interaction.editReply({ content: '❌ فشل رفع الكتم.' });
            }
        }
        if (sub === 'تحذير') {
            const target = options.getUser('عضو');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ العضو غير موجود.' });
            const reason = options.getString('سبب') || 'لا يوجد سبب';
            const count = addWarning(target.id, guild.id, reason, user.id);
            logEvent(guild.id, 'warn', `${user.tag} حذر ${target.tag} بسبب ${reason}`, 0xFFA500);
            return interaction.editReply({ content: `⚠️ تم تحذير ${target.tag} (العدد: ${count})` });
        }
        if (sub === 'تحذيرات') {
            const target = options.getUser('عضو');
            const warns = getWarnings(target.id, guild.id);
            if (!warns || warns.length === 0) return interaction.editReply({ content: `✅ ${target.tag} ليس لديه تحذيرات.` });
            const desc = warns.map((w, i) => `#${i + 1}: ${w.reason} (بواسطة <@${w.moderator}>)`).join('\n');
            const embed = new EmbedBuilder().setTitle(`⚠️ تحذيرات ${target.tag}`).setDescription(desc).setColor(0xFF0000);
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'مسح_تحذيرات') {
            const target = options.getUser('عضو');
            clearWarnings(target.id, guild.id);
            logEvent(guild.id, 'clear_warns', `${user.tag} مسح تحذيرات ${target.tag}`, 0x00FF00);
            return interaction.editReply({ content: `✅ تم مسح تحذيرات ${target.tag}.` });
        }
        if (sub === 'مسح') {
            const count = options.getInteger('عدد');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                return interaction.editReply({ content: '❌ ليس لديك صلاحية.', ephemeral: true });
            }
            try {
                await channel.bulkDelete(count, true);
                logEvent(guild.id, 'purge', `${user.tag} حذف ${count} رسالة`, 0x00BFFF);
                return interaction.editReply({ content: `✅ تم حذف ${count} رسالة.` });
            } catch (e) {
                return interaction.editReply({ content: '❌ فشل الحذف.' });
            }
        }
    }

    // ================== أمر التذاكر ==================
    if (commandName === 'تذكرة') {
        const sub = options.getSubcommand();
        if (sub === 'فتح') {
            const topic = options.getString('الموضوع');
            const category = options.getString('القسم');
            const ticketCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === 'تذاكر');
            if (!ticketCategory) {
                return interaction.editReply({ content: '❌ لا توجد فئة "تذاكر". اطلب من المشرف إنشائها.' });
            }
            const overwrites = [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ];
            const channelName = `تذكرة-${user.username}`;
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: ticketCategory,
                permissionOverwrites: overwrites,
                topic: `📌 ${category} - ${topic}`
            });
            db.prepare("INSERT INTO tickets (guild_id, channel_id, user_id, topic, status, created_at, category, priority) VALUES (?, ?, ?, ?, 'open', datetime('now'), ?, 'عادي')")
                .run(guild.id, ticketChannel.id, user.id, topic, category);
            const embed = new EmbedBuilder()
                .setTitle('🎫 تذكرة جديدة')
                .setDescription(`**الموضوع:** ${topic}\n**القسم:** ${category}`)
                .setColor(0x00BFFF)
                .addFields(
                    { name: 'أنشأها', value: user.tag, inline: true },
                    { name: 'الحالة', value: '🟢 مفتوحة', inline: true }
                )
                .setFooter({ text: 'استخدم /تذكرة إغلاق لإغلاق التذكرة' });
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 إغلاق التذكرة').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('ticket_claim').setLabel('📌 تولي').setStyle(ButtonStyle.Primary)
                );
            await ticketChannel.send({ content: `<@${user.id}>`, embeds: [embed], components: [row] });
            logEvent(guild.id, 'ticket_open', `${user.tag} فتح تذكرة: ${topic}`, 0x00BFFF);
            return interaction.editReply({ content: `✅ تم فتح تذكرة: ${ticketChannel}` });
        }
        if (sub === 'إغلاق') {
            if (!channel.name.startsWith('تذكرة-')) {
                return interaction.editReply({ content: '❌ هذه ليست قناة تذكرة.', ephemeral: true });
            }
            db.prepare("UPDATE tickets SET status = 'closed' WHERE channel_id = ?").run(channel.id);
            logEvent(guild.id, 'ticket_close', `${user.tag} أغلق تذكرة ${channel.name}`, 0xFF0000);
            await interaction.editReply({ content: '🔒 سيتم حذف التذكرة خلال 5 ثوانٍ.' });
            setTimeout(() => channel.delete().catch(() => {}), 5000);
        }
        if (sub === 'لوحة') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.editReply({ content: '❌ ليس لديك صلاحية.', ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setTitle('🎫 نظام التذاكر')
                .setDescription('اختر القسم المناسب لفتح تذكرة دعم')
                .setColor(0x00BFFF)
                .setImage('https://i.imgur.com/your-image-here.png');
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_menu')
                .setPlaceholder('اختر قسم التذكرة')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('دعم فني').setDescription('مشاكل تقنية').setValue('دعم فني').setEmoji('🛠️'),
                    new StringSelectMenuOptionBuilder().setLabel('شكوى').setDescription('تقديم شكوى').setValue('شكوى').setEmoji('📢'),
                    new StringSelectMenuOptionBuilder().setLabel('اقتراح').setDescription('تقديم اقتراح').setValue('اقتراح').setEmoji('💡'),
                    new StringSelectMenuOptionBuilder().setLabel('طلب عضوية').setDescription('طلب الانضمام').setValue('طلب عضوية').setEmoji('👋'),
                    new StringSelectMenuOptionBuilder().setLabel('أخرى').setDescription('أسباب أخرى').setValue('أخرى').setEmoji('❓')
                );
            const row = new ActionRowBuilder().addComponents(selectMenu);
            await interaction.editReply({ content: '✅ تم إنشاء لوحة التذاكر.', ephemeral: true });
            await channel.send({ embeds: [embed], components: [row] });
        }
    }

    // ================== أمر الترحيب ==================
    if (commandName === 'ترحيب') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply({ content: '❌ ليس لديك صلاحية.', ephemeral: true });
        }
        if (sub === 'تعيين') {
            const targetChannel = options.getChannel('قناة');
            const message = options.getString('رسالة') || 'مرحباً {user} في {server}';
            const attachment = options.getAttachment('صورة');
            const imageUrl = attachment ? attachment.url : '';
            db.prepare("INSERT OR REPLACE INTO welcome (guild_id, channel_id, message, image_url) VALUES (?, ?, ?, ?)")
                .run(guild.id, targetChannel.id, message, imageUrl);
            return interaction.editReply({ content: `✅ تم تعيين الترحيب في ${targetChannel} مع ${imageUrl ? 'صورة' : 'بدون صورة'}` });
        }
        if (sub === 'تعيين_وداع') {
            const targetChannel = options.getChannel('قناة');
            const message = options.getString('رسالة') || 'وداعاً {user} من {server}';
            const attachment = options.getAttachment('صورة');
            const imageUrl = attachment ? attachment.url : '';
            db.prepare("INSERT OR REPLACE INTO goodbye (guild_id, channel_id, message, image_url) VALUES (?, ?, ?, ?)")
                .run(guild.id, targetChannel.id, message, imageUrl);
            return interaction.editReply({ content: `✅ تم تعيين الوداع في ${targetChannel} مع ${imageUrl ? 'صورة' : 'بدون صورة'}` });
        }
    }

    // ================== أمر الحماية ==================
    if (commandName === 'حماية') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply({ content: '❌ ليس لديك صلاحية.', ephemeral: true });
        }
        if (sub === 'تفعيل') {
            const level = options.getInteger('المستوى');
            try {
                await guild.setVerificationLevel(level);
                return interaction.editReply({ content: `✅ تم تفعيل الحماية المستوى ${level}.` });
            } catch (e) {
                return interaction.editReply({ content: '❌ فشل التفعيل.' });
            }
        }
        if (sub === 'تعيين_دور_كتم') {
            const role = options.getRole('دور');
            db.prepare("INSERT OR REPLACE INTO mute_roles (guild_id, role_id) VALUES (?, ?)").run(guild.id, role.id);
            return interaction.editReply({ content: `✅ تم تعيين دور الكتم: ${role.name}` });
        }
        if (sub === 'تعيين_دور_تحقق') {
            const role = options.getRole('دور');
            const channel = options.getChannel('قناة');
            db.prepare("INSERT OR REPLACE INTO verify_roles (guild_id, role_id, channel_id) VALUES (?, ?, ?)").run(guild.id, role.id, channel.id);
            // إنشاء زر التحقق
            const embed = new EmbedBuilder()
                .setTitle('✅ التحقق')
                .setDescription('اضغط على الزر أدناه للتحقق من هويتك.')
                .setColor(0x00FF00);
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('verify_button').setLabel('تحقق').setStyle(ButtonStyle.Success).setEmoji('✅')
                );
            await channel.send({ embeds: [embed], components: [row] });
            return interaction.editReply({ content: `✅ تم تعيين دور التحقق ${role.name} في ${channel}` });
        }
        if (sub === 'إعدادات_سبام') {
            const limit = options.getInteger('الحد');
            db.prepare("INSERT OR REPLACE INTO auto_mod (guild_id, spam_threshold) VALUES (?, ?)").run(guild.id, limit);
            return interaction.editReply({ content: `✅ تم تعيين حد السبام إلى ${limit} رسائل في 5 ثوانٍ.` });
        }
    }

    // ================== أمر السجلات ==================
    if (commandName === 'سجلات') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply({ content: '❌ ليس لديك صلاحية.', ephemeral: true });
        }
        if (sub === 'تعيين') {
            const targetChannel = options.getChannel('قناة');
            const type = options.getString('النوع');
            db.prepare("INSERT OR REPLACE INTO logging (guild_id, channel_id, type) VALUES (?, ?, ?)")
                .run(guild.id, targetChannel.id, type);
            return interaction.editReply({ content: `✅ تم تعيين سجلات ${type} في ${targetChannel}` });
        }
    }

    // ================== أمر الأدوار ==================
    if (commandName === 'أدوار') {
        const sub = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply({ content: '❌ ليس لديك صلاحية.', ephemeral: true });
        }
        if (sub === 'تعيين_تلقائي') {
            const role = options.getRole('دور');
            db.prepare("INSERT OR REPLACE INTO autoroles (guild_id, role_id) VALUES (?, ?)").run(guild.id, role.id);
            return interaction.editReply({ content: `✅ تم تعيين دور تلقائي: ${role.name}` });
        }
        if (sub === 'تفاعلي') {
            const msgId = options.getString('رسالة');
            const role = options.getRole('دور');
            const emoji = options.getString('إيموجي');
            db.prepare("INSERT INTO reaction_roles (guild_id, message_id, role_id, emoji) VALUES (?, ?, ?, ?)")
                .run(guild.id, msgId, role.id, emoji);
            try {
                const msg = await channel.messages.fetch(msgId);
                await msg.react(emoji);
            } catch (e) {}
            return interaction.editReply({ content: `✅ تم ربط الإيموجي ${emoji} بالدور ${role.name}` });
        }
        if (sub === 'قائمة') {
            const rows = db.prepare("SELECT id, message_id, role_id, emoji FROM reaction_roles WHERE guild_id = ?").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 لا توجد أدوار تفاعلية.' });
            const list = rows.map(r => `#${r.id} - ${r.emoji} -> <@&${r.role_id}>`).join('\n');
            return interaction.editReply({ content: `📋 الأدوار التفاعلية:\n${list}` });
        }
    }

    // ================== أمر التذكير ==================
    if (commandName === 'تذكير') {
        const sub = options.getSubcommand();
        if (sub === 'تعيين') {
            const duration = options.getInteger('مدة');
            const msgText = options.getString('رسالة');
            const remindTime = Date.now() + duration * 1000;
            db.prepare("INSERT INTO reminders (user_id, channel_id, message, remind_time) VALUES (?, ?, ?, ?)")
                .run(user.id, channel.id, msgText, String(remindTime));
            return interaction.editReply({ content: `✅ تم تعيين تذكير بعد ${duration} ثانية.` });
        }
        if (sub === 'متكرر') {
            const interval = options.getInteger('مدة');
            const msgText = options.getString('رسالة');
            const remindTime = Date.now() + interval * 1000;
            db.prepare("INSERT INTO reminders (user_id, channel_id, message, remind_time, repeat_interval) VALUES (?, ?, ?, ?, ?)")
                .run(user.id, channel.id, msgText, String(remindTime), interval);
            return interaction.editReply({ content: `✅ سيتم تذكيرك كل ${interval} ثانية.` });
        }
    }

    // ================== أمر الألعاب ==================
    if (commandName === 'لعبة') {
        const sub = options.getSubcommand();
        if (sub === 'حظ') {
            const question = options.getString('سؤال');
            const answers = ['نعم', 'لا', 'ربما', 'بالتأكيد', 'مستحيل', 'اسأل لاحقاً', 'لا يمكن التنبؤ'];
            return interaction.editReply({ content: `🎱 **${answers[Math.floor(Math.random() * answers.length)]}**` });
        }
        if (sub === 'نرد') {
            const max = options.getInteger('أقصى') || 100;
            return interaction.editReply({ content: `🎲 رميت النرد وحصلت على: **${Math.floor(Math.random() * max) + 1}**` });
        }
        if (sub === 'عملة') {
            return interaction.editReply({ content: `🪙 العملة أظهرت: **${Math.random() < 0.5 ? 'وجه' : 'كتابة'}**` });
        }
        if (sub === 'ميم') {
            try {
                const res = await axios.get('https://meme-api.com/gimme');
                const data = res.data;
                const embed = new EmbedBuilder().setTitle(data.title).setURL(data.postLink).setImage(data.url).setColor(0x2F3136);
                return interaction.editReply({ embeds: [embed] });
            } catch (e) {
                return interaction.editReply({ content: '❌ لم أتمكن من جلب ميم.' });
            }
        }
        if (sub === 'طقس') {
            const city = options.getString('مدينة');
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
                return interaction.editReply({ embeds: [embed] });
            } catch (e) {
                return interaction.editReply({ content: '❌ لم أتمكن من العثور على المدينة.' });
            }
        }
    }

    // ================== أمر العشيرة ==================
    if (commandName === 'عشيرة') {
        const sub = options.getSubcommand();
        if (sub === 'إنشاء') {
            const name = options.getString('الاسم');
            const row = db.prepare("SELECT * FROM clans WHERE guild_id = ? AND name = ?").get(guild.id, name);
            if (row) return interaction.editReply({ content: '❌ هذه العشيرة موجودة.' });
            db.prepare("INSERT INTO clans (guild_id, name, owner, members, created_at) VALUES (?, ?, ?, ?, datetime('now'))")
                .run(guild.id, name, user.id, JSON.stringify([user.id]));
            logEvent(guild.id, 'clan_create', `${user.tag} أنشأ عشيرة ${name}`, 0x00BFFF);
            return interaction.editReply({ content: `✅ تم إنشاء عشيرة **${name}**` });
        }
        if (sub === 'معلومات') {
            const name = options.getString('الاسم');
            const row = db.prepare("SELECT * FROM clans WHERE guild_id = ? AND name = ?").get(guild.id, name);
            if (!row) return interaction.editReply({ content: '❌ العشيرة غير موجودة.' });
            const members = JSON.parse(row.members);
            const embed = new EmbedBuilder().setTitle(`🏴 عشيرة ${row.name}`).setColor(0xFF0000)
                .addFields(
                    { name: 'المالك', value: `<@${row.owner}>`, inline: true },
                    { name: 'الأعضاء', value: members.map(id => `<@${id}>`).join(', ') || 'لا يوجد', inline: false },
                    { name: 'المستوى', value: String(row.level), inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        }
    }

    // ================== أمر المزرعة ==================
    if (commandName === 'مزرعة') {
        const sub = options.getSubcommand();
        if (sub === 'زرع') {
            const crop = options.getString('محصول');
            const times = { قمح: 60, ذرة: 120, طماطم: 180, بطاطس: 240 };
            const now = Date.now();
            const ready = now + times[crop] * 1000;
            db.prepare("INSERT INTO farms (user_id, guild_id, crop, planted_at, ready_at) VALUES (?, ?, ?, ?, ?)")
                .run(user.id, guild.id, crop, String(now), String(ready));
            return interaction.editReply({ content: `🌱 زرعت **${crop}**، ستكون جاهزة بعد ${times[crop]} ثانية.` });
        }
        if (sub === 'حصاد') {
            const row = db.prepare("SELECT crop, ready_at FROM farms WHERE user_id = ? AND guild_id = ? AND status = 'growing'").get(user.id, guild.id);
            if (!row) return interaction.editReply({ content: '❌ ليس لديك أي محصول.' });
            const now = Date.now();
            if (now < parseInt(row.ready_at)) {
                const remain = Math.ceil((parseInt(row.ready_at) - now) / 1000);
                return interaction.editReply({ content: `⏳ المحصول جاهز بعد ${remain} ثانية.` });
            }
            const rewards = { قمح: 10, ذرة: 20, طماطم: 30, بطاطس: 40 };
            const amount = rewards[row.crop] || 10;
            updateBalance(user.id, guild.id, amount);
            db.prepare("UPDATE farms SET status = 'harvested' WHERE user_id = ? AND guild_id = ?").run(user.id, guild.id);
            return interaction.editReply({ content: `✅ حصدت **${row.crop}** وحصلت على **${amount}** عملة!` });
        }
    }

    // ================== أمر المزاد ==================
    if (commandName === 'مزاد') {
        const sub = options.getSubcommand();
        if (sub === 'إنشاء') {
            const item = options.getString('عنصر');
            const starting = options.getInteger('سعر_بدء');
            const end = Date.now() + 3600000;
            db.prepare("INSERT INTO auctions (guild_id, item, seller, starting_bid, current_bid, end_time) VALUES (?, ?, ?, ?, ?, ?)")
                .run(guild.id, item, user.id, starting, starting, String(end));
            logEvent(guild.id, 'auction_create', `${user.tag} بدأ مزاداً لـ ${item}`, 0xFFD700);
            return interaction.editReply({ content: `🔨 تم بدء مزاد لـ **${item}** بسعر ${starting} عملة.` });
        }
        if (sub === 'مزايدة') {
            const id = options.getInteger('معرف');
            const amount = options.getInteger('مبلغ');
            const row = db.prepare("SELECT item, current_bid, seller FROM auctions WHERE id = ? AND status = 'active'").get(id);
            if (!row) return interaction.editReply({ content: '❌ المزاد غير موجود.' });
            if (amount <= row.current_bid) return interaction.editReply({ content: `❌ المبلغ يجب أن يزيد عن ${row.current_bid}.` });
            if (user.id === row.seller) return interaction.editReply({ content: '❌ لا يمكنك المزايدة على عنصرك.' });
            db.prepare("UPDATE auctions SET current_bid = ?, bidder = ? WHERE id = ?").run(amount, user.id, id);
            return interaction.editReply({ content: `✅ تم المزايدة بـ **${amount}** عملة على **${row.item}**.` });
        }
    }

    // ================== أمر المالك ==================
    if (commandName === 'مالك') {
        const ownerId = 'YOUR_OWNER_ID';
        if (user.id !== ownerId) {
            return interaction.editReply({ content: '❌ هذا الأمر مقيد للمالك فقط.', ephemeral: true });
        }
        const sub = options.getSubcommand();
        if (sub === 'تقييم') {
            const code = options.getString('كود');
            try {
                const result = eval(code);
                return interaction.editReply({ content: `📊 النتيجة: \`\`\`js\n${result}\n\`\`\`` });
            } catch (e) {
                return interaction.editReply({ content: `❌ خطأ: ${e.message}` });
            }
        }
        if (sub === 'إعادة_تحميل') {
            await registerCommands();
            return interaction.editReply({ content: '✅ تم إعادة تحميل الأوامر.' });
        }
    }

    // ================== أمر بينغ (اختصار) ==================
    if (commandName === 'بينغ') {
        return interaction.editReply({ content: `🏓 Pong! ${client.ws.ping}ms` });
    }
});

// ================== أحداث التفاعل (الأزرار والقوائم) ==================
client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
        if (interaction.customId === 'close_ticket') {
            if (!interaction.channel.name.startsWith('تذكرة-')) {
                return interaction.reply({ content: '❌ هذه ليست تذكرة.', ephemeral: true });
            }
            db.prepare("UPDATE tickets SET status = 'closed' WHERE channel_id = ?").run(interaction.channel.id);
            await interaction.reply('🔒 سيتم حذف التذكرة خلال 5 ثوانٍ.');
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
        if (interaction.customId === 'ticket_claim') {
            await interaction.reply({ content: '📌 تم تولي التذكرة.', ephemeral: true });
            await interaction.channel.send(`📌 تم تولي التذكرة بواسطة ${interaction.user.tag}`);
        }
        if (interaction.customId === 'verify_button') {
            const row = db.prepare("SELECT role_id FROM verify_roles WHERE guild_id = ?").get(interaction.guild.id);
            if (row) {
                const role = interaction.guild.roles.cache.get(row.role_id);
                if (role) {
                    await interaction.member.roles.add(role);
                    await interaction.reply({ content: `✅ تم التحقق ومنحك دور ${role.name}`, ephemeral: true });
                }
            }
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_menu') {
            const category = interaction.values[0];
            const topic = `طلب من القائمة - ${category}`;
            const ticketCategory = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === 'تذاكر');
            if (!ticketCategory) {
                return interaction.reply({ content: '❌ لا توجد فئة "تذاكر".', ephemeral: true });
            }
            const overwrites = [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ];
            const channelName = `تذكرة-${interaction.user.username}`;
            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: ticketCategory,
                permissionOverwrites: overwrites,
                topic: `📌 ${category} - ${topic}`
            });
            db.prepare("INSERT INTO tickets (guild_id, channel_id, user_id, topic, status, created_at, category, priority) VALUES (?, ?, ?, ?, 'open', datetime('now'), ?, 'عادي')")
                .run(interaction.guild.id, ticketChannel.id, interaction.user.id, topic, category);
            const embed = new EmbedBuilder()
                .setTitle('🎫 تذكرة جديدة')
                .setDescription(`**الموضوع:** ${topic}\n**القسم:** ${category}`)
                .setColor(0x00BFFF)
                .addFields(
                    { name: 'أنشأها', value: interaction.user.tag, inline: true },
                    { name: 'الحالة', value: '🟢 مفتوحة', inline: true }
                );
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 إغلاق التذكرة').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('ticket_claim').setLabel('📌 تولي').setStyle(ButtonStyle.Primary)
                );
            await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
            await interaction.reply({ content: `✅ تم فتح تذكرة: ${ticketChannel}`, ephemeral: true });
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
                .setTitle('👋 مرحباً!')
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
    // سجل
    logEvent(member.guild.id, 'member_join', `${member.user.tag} انضم إلى السيرفر.`, 0x00FF00);
});

client.on(Events.GuildMemberRemove, (member) => {
    // الوداع
    const goodbye = db.prepare("SELECT channel_id, message, image_url FROM goodbye WHERE guild_id = ?").get(member.guild.id);
    if (goodbye) {
        const channel = member.guild.channels.cache.get(goodbye.channel_id);
        if (channel) {
            const msg = goodbye.message.replace(/{user}/g, member.user.tag).replace(/{server}/g, member.guild.name);
            const embed = new EmbedBuilder()
                .setTitle('👋 وداعاً!')
                .setDescription(msg)
                .setColor(0xFF0000)
                .setThumbnail(member.displayAvatarURL());
            if (goodbye.image_url) embed.setImage(goodbye.image_url);
            channel.send({ embeds: [embed] });
        }
    }
    // سجل
    logEvent(member.guild.id, 'member_leave', `${member.user.tag} غادر السيرفر.`, 0xFF0000);
});

// ================== نظام الحماية المتقدم ==================
const messageCache = new Collection();

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    // نظام السبام
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
            await message.author.timeout(60000, 'سبام');
            const muteRole = db.prepare("SELECT role_id FROM mute_roles WHERE guild_id = ?").get(message.guild.id);
            if (muteRole) {
                const role = message.guild.roles.cache.get(muteRole.role_id);
                if (role) await message.member.roles.add(role);
            }
            logEvent(message.guild.id, 'spam', `${message.author.tag} تم كتمه بسبب السبام`, 0xFF0000);
            await message.channel.send(`🔇 تم كتم ${message.author} بسبب السبام.`);
        } catch (e) {}
    }

    // نظام المستويات
    if (!message.content.startsWith('/')) {
        const xpGain = Math.floor(Math.random() * 15) + 5;
        addXp(message.author.id, message.guild.id, xpGain);
    }
});

// ================== سجلات الرسائل ==================
client.on(Events.MessageDelete, (message) => {
    if (!message.guild || message.author?.bot) return;
    logEvent(message.guild.id, 'message_delete', `${message.author?.tag} حذف: ${message.content?.slice(0, 100) || '[ميديا]'}`, 0xFF6347);
});

client.on(Events.MessageUpdate, (oldMsg, newMsg) => {
    if (!oldMsg.guild || oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
    logEvent(oldMsg.guild.id, 'message_edit', `${oldMsg.author?.tag} عدل: ${oldMsg.content?.slice(0, 50)} -> ${newMsg.content?.slice(0, 50)}`, 0xFFA500);
});

// ================== التذكيرات ==================
setInterval(() => {
    const now = Date.now();
    const reminders = db.prepare("SELECT id, user_id, channel_id, message, remind_time, repeat_interval FROM reminders WHERE remind_time <= ?").all(String(now));
    for (const row of reminders) {
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
    }
}, 30000);

// ================== تشغيل البوت ==================
client.login(TOKEN);
