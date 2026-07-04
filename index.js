// ================================================================
// البوت العربي الخارق - النسخة النهائية
// جميع الأوامر بالعربية - أنظمة متطورة - أداء عالمي
// ================================================================

const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, ChannelType, SlashCommandBuilder, REST, Routes, Collection, Events } = require('discord.js');
const Database = require('better-sqlite3');
const axios = require('axios');
const moment = require('moment');

// ================== قاعدة البيانات ==================
const db = new Database('./bot_arabic.db');

db.exec(`
    -- الاقتصاد المتطور
    CREATE TABLE IF NOT EXISTS الاقتصاد (المستخدم TEXT, السيرفر TEXT, الرصيد INTEGER DEFAULT 0, البنك INTEGER DEFAULT 0, اليومي TEXT, العمل TEXT, الاسبوعي TEXT, المستوى INTEGER DEFAULT 1, الخبرة INTEGER DEFAULT 0);
    
    -- التحذيرات
    CREATE TABLE IF NOT EXISTS التحذيرات (id INTEGER PRIMARY KEY AUTOINCREMENT, المستخدم TEXT, السيرفر TEXT, السبب TEXT, التاريخ TEXT, المشرف TEXT);
    
    -- الأدوار التلقائية
    CREATE TABLE IF NOT EXISTS الادوار_التلقائية (السيرفر TEXT, الدور TEXT);
    
    -- الترحيب والوداع
    CREATE TABLE IF NOT EXISTS الترحيب (السيرفر TEXT, القناة TEXT, الرسالة TEXT, الصورة TEXT);
    CREATE TABLE IF NOT EXISTS الوداع (السيرفر TEXT, القناة TEXT, الرسالة TEXT, الصورة TEXT);
    
    -- التذاكر المتطورة
    CREATE TABLE IF NOT EXISTS التذاكر (id INTEGER PRIMARY KEY AUTOINCREMENT, السيرفر TEXT, القناة TEXT, المستخدم TEXT, الموضوع TEXT, الحالة TEXT, التاريخ TEXT, القسم TEXT, الاولوية TEXT);
    CREATE TABLE IF NOT EXISTS اعدادات_التذاكر (السيرفر TEXT, الفئة TEXT, دور_الدعم TEXT, قناة_السجلات TEXT);
    
    -- السجلات
    CREATE TABLE IF NOT EXISTS السجلات (السيرفر TEXT, القناة TEXT, النوع TEXT);
    
    -- الأدوار التفاعلية
    CREATE TABLE IF NOT EXISTS الادوار_التفاعلية (id INTEGER PRIMARY KEY AUTOINCREMENT, السيرفر TEXT, الرسالة TEXT, الدور TEXT, الايموجي TEXT);
    
    -- إحصائيات الأعضاء
    CREATE TABLE IF NOT EXISTS الاحصائيات (المستخدم TEXT, السيرفر TEXT, الرسائل INTEGER DEFAULT 0, الصوت INTEGER DEFAULT 0, التفاعلات INTEGER DEFAULT 0, الخبرة INTEGER DEFAULT 0);
    
    -- الحماية المتقدمة
    CREATE TABLE IF NOT EXISTS الحماية (السيرفر TEXT, حد_السبام INTEGER DEFAULT 5, حماية_الروابط INTEGER DEFAULT 1, حماية_الدعوات INTEGER DEFAULT 1, مستوى_التحقق INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS ادوار_الكتم (السيرفر TEXT, الدور TEXT);
    CREATE TABLE IF NOT EXISTS ادوار_التحقق (السيرفر TEXT, الدور TEXT, القناة TEXT);
    
    -- التذكيرات
    CREATE TABLE IF NOT EXISTS التذكيرات (id INTEGER PRIMARY KEY AUTOINCREMENT, المستخدم TEXT, القناة TEXT, الرسالة TEXT, الوقت TEXT, التكرار INTEGER DEFAULT 0);
    
    -- العشائر
    CREATE TABLE IF NOT EXISTS العشائر (id INTEGER PRIMARY KEY AUTOINCREMENT, السيرفر TEXT, الاسم TEXT, المالك TEXT, الاعضاء TEXT, المستوى INTEGER DEFAULT 1, الخبرة INTEGER DEFAULT 0);
    
    -- المزارع
    CREATE TABLE IF NOT EXISTS المزارع (المستخدم TEXT, السيرفر TEXT, المحصول TEXT, وقت_الزرع TEXT, وقت_الحصاد TEXT, الحالة TEXT DEFAULT 'نمو');
    
    -- المزادات
    CREATE TABLE IF NOT EXISTS المزادات (id INTEGER PRIMARY KEY AUTOINCREMENT, السيرفر TEXT, العنصر TEXT, البائع TEXT, السعر_البدئي INTEGER, السعر_الحالي INTEGER, المزايد TEXT, وقت_الانتهاء TEXT, الحالة TEXT DEFAULT 'نشط');
    
    -- الألقاب
    CREATE TABLE IF NOT EXISTS الالقاب (المستخدم TEXT, السيرفر TEXT, اللقب TEXT, PRIMARY KEY (المستخدم, السيرفر));
    
    -- الردود التلقائية
    CREATE TABLE IF NOT EXISTS الردود_التلقائية (السيرفر TEXT, الكلمة TEXT, الرد TEXT, PRIMARY KEY (السيرفر, الكلمة));
    
    -- الأحداث
    CREATE TABLE IF NOT EXISTS الاحداث (id INTEGER PRIMARY KEY AUTOINCREMENT, السيرفر TEXT, الاسم TEXT, الوصف TEXT, التاريخ TEXT, القناة TEXT, المنشئ TEXT);
    
    -- الأوامر المخصصة
    CREATE TABLE IF NOT EXISTS الاوامر_المخصصة (السيرفر TEXT, الاسم TEXT, الرد TEXT, PRIMARY KEY (السيرفر, الاسم));
    
    -- الاستطلاعات
    CREATE TABLE IF NOT EXISTS الاستطلاعات (id INTEGER PRIMARY KEY AUTOINCREMENT, السيرفر TEXT, القناة TEXT, الرسالة TEXT, السؤال TEXT, الخيارات TEXT);
    
    -- الهدايا
    CREATE TABLE IF NOT EXISTS الهدايا (id INTEGER PRIMARY KEY AUTOINCREMENT, السيرفر TEXT, القناة TEXT, الرسالة TEXT, الجائزة TEXT, وقت_الانتهاء TEXT, الفائزون INTEGER, المشاركون TEXT);
    
    -- الإنجازات
    CREATE TABLE IF NOT EXISTS الانجازات (المستخدم TEXT, السيرفر TEXT, الاسم TEXT, التاريخ TEXT, PRIMARY KEY (المستخدم, السيرفر, الاسم));
    
    -- الأدوار المؤقتة
    CREATE TABLE IF NOT EXISTS الادوار_المؤقتة (المستخدم TEXT, السيرفر TEXT, الدور TEXT, وقت_الانتهاء TEXT);
    
    -- القروض
    CREATE TABLE IF NOT EXISTS القروض (المستخدم TEXT, السيرفر TEXT, المبلغ INTEGER, الفائدة INTEGER, تاريخ_الاستحقاق TEXT, الحالة TEXT DEFAULT 'نشط');
    
    -- الاستثمارات
    CREATE TABLE IF NOT EXISTS الاستثمارات (المستخدم TEXT, السيرفر TEXT, المبلغ INTEGER, الربح INTEGER, تاريخ_البدء TEXT, تاريخ_الانتهاء TEXT, الحالة TEXT DEFAULT 'نشط');
    
    -- الاشتراكات المدفوعة
    CREATE TABLE IF NOT EXISTS الاشتراكات (المستخدم TEXT, السيرفر TEXT, المستوى TEXT, تاريخ_البدء TEXT, تاريخ_الانتهاء TEXT, الحالة TEXT DEFAULT 'نشط');
    
    -- متجر الأدوار
    CREATE TABLE IF NOT EXISTS متجر_الادوار (id INTEGER PRIMARY KEY AUTOINCREMENT, السيرفر TEXT, الدور TEXT, السعر INTEGER, الوصف TEXT);
`);

// ================== دوال مساعدة متطورة ==================
function جلب_الرصيد(المستخدم, السيرفر) {
    const row = db.prepare("SELECT الرصيد FROM الاقتصاد WHERE المستخدم = ? AND السيرفر = ?").get(المستخدم, السيرفر);
    return row ? row.الرصيد : 0;
}

function تحديث_الرصيد(المستخدم, السيرفر, المبلغ) {
    const موجود = db.prepare("SELECT الرصيد FROM الاقتصاد WHERE المستخدم = ? AND السيرفر = ?").get(المستخدم, السيرفر);
    if (موجود) {
        db.prepare("UPDATE الاقتصاد SET الرصيد = الرصيد + ? WHERE المستخدم = ? AND السيرفر = ?").run(المبلغ, المستخدم, السيرفر);
    } else {
        db.prepare("INSERT INTO الاقتصاد (المستخدم, السيرفر, الرصيد) VALUES (?, ?, ?)").run(المستخدم, السيرفر, المبلغ);
    }
}

function جلب_المستوى(المستخدم, السيرفر) {
    const row = db.prepare("SELECT المستوى, الخبرة FROM الاقتصاد WHERE المستخدم = ? AND السيرفر = ?").get(المستخدم, السيرفر);
    if (!row) {
        db.prepare("INSERT INTO الاقتصاد (المستخدم, السيرفر, المستوى, الخبرة) VALUES (?, ?, 1, 0)").run(المستخدم, السيرفر);
        return { المستوى: 1, الخبرة: 0 };
    }
    return { المستوى: row.المستوى, الخبرة: row.الخبرة };
}

function اضافة_خبرة(المستخدم, السيرفر, الكمية) {
    const موجود = db.prepare("SELECT المستوى, الخبرة FROM الاقتصاد WHERE المستخدم = ? AND السيرفر = ?").get(المستخدم, السيرفر);
    if (!موجود) {
        db.prepare("INSERT INTO الاقتصاد (المستخدم, السيرفر, المستوى, الخبرة) VALUES (?, ?, 1, ?)").run(المستخدم, السيرفر, الكمية);
        return;
    }
    let خبرة = موجود.الخبرة + الكمية;
    let مستوى = موجود.المستوى;
    let مطلوب = 5 * (مستوى * مستوى) + 50 * مستوى + 100;
    while (خبرة >= مطلوب) {
        خبرة -= مطلوب;
        مستوى++;
        مطلوب = 5 * (مستوى * مستوى) + 50 * مستوى + 100;
    }
    db.prepare("UPDATE الاقتصاد SET المستوى = ?, الخبرة = ? WHERE المستخدم = ? AND السيرفر = ?").run(مستوى, خبرة, المستخدم, السيرفر);
}

function جلب_التحذيرات(المستخدم, السيرفر) {
    return db.prepare("SELECT السبب, التاريخ, المشرف FROM التحذيرات WHERE المستخدم = ? AND السيرفر = ? ORDER BY التاريخ DESC").all(المستخدم, السيرفر);
}

function اضافة_تحذير(المستخدم, السيرفر, السبب, المشرف) {
    db.prepare("INSERT INTO التحذيرات (المستخدم, السيرفر, السبب, التاريخ, المشرف) VALUES (?, ?, ?, datetime('now'), ?)").run(المستخدم, السيرفر, السبب, المشرف);
    const count = db.prepare("SELECT COUNT(*) FROM التحذيرات WHERE المستخدم = ? AND السيرفر = ?").get(المستخدم, السيرفر);
    return count['COUNT(*)'];
}

function مسح_التحذيرات(المستخدم, السيرفر) {
    db.prepare("DELETE FROM التحذيرات WHERE المستخدم = ? AND السيرفر = ?").run(المستخدم, السيرفر);
}

function تسجيل_حدث(السيرفر, النوع, الوصف, اللون = 0x2F3136) {
    const row = db.prepare("SELECT القناة FROM السجلات WHERE السيرفر = ? AND (النوع = ? OR النوع = 'الكل')").get(السيرفر, النوع);
    if (!row) return;
    const القناة = client.channels.cache.get(row.القناة);
    if (القناة) {
        const ايمبد = new EmbedBuilder().setTitle(`📋 ${النوع}`).setDescription(الوصف).setColor(اللون).setTimestamp();
        القناة.send({ embeds: [ايمبد] }).catch(() => {});
    }
}

function جلب_احصائيات(المستخدم, السيرفر) {
    let row = db.prepare("SELECT * FROM الاحصائيات WHERE المستخدم = ? AND السيرفر = ?").get(المستخدم, السيرفر);
    if (!row) {
        db.prepare("INSERT INTO الاحصائيات (المستخدم, السيرفر, الرسائل, الصوت, التفاعلات, الخبرة) VALUES (?, ?, 0, 0, 0, 0)").run(المستخدم, السيرفر);
        row = db.prepare("SELECT * FROM الاحصائيات WHERE المستخدم = ? AND السيرفر = ?").get(المستخدم, السيرفر);
    }
    return row;
}

function تحديث_احصائية(المستخدم, السيرفر, الحقل, الزيادة = 1) {
    db.prepare(`UPDATE الاحصائيات SET ${الحقل} = ${الحقل} + ? WHERE المستخدم = ? AND السيرفر = ?`).run(الزيادة, المستخدم, السيرفر);
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
    console.error('❌ لم يتم تعيين توكن البوت في متغير البيئة TOKEN');
    process.exit(1);
}

// ================== أوامر البوت ==================
const الاوامر = [];

// ---- أمر المساعدة ----
الاوامر.push(new SlashCommandBuilder()
    .setName('مساعدة')
    .setDescription('عرض جميع الأوامر المتاحة مع شرح مفصل')
    .addStringOption(option => option.setName('الأمر').setDescription('اسم الأمر للحصول على شرح تفصيلي').setRequired(false))
);

// ---- أمر المعلومات ----
الاوامر.push(new SlashCommandBuilder()
    .setName('معلومات')
    .setDescription('عرض معلومات البوت أو السيرفر أو العضو')
    .addStringOption(option => option.setName('النوع').setDescription('نوع المعلومات').setRequired(true).addChoices(
        { name: 'البوت', value: 'بوت' },
        { name: 'السيرفر', value: 'سيرفر' },
        { name: 'عضو', value: 'عضو' }
    ))
    .addUserOption(option => option.setName('العضو').setDescription('العضو المطلوب معلوماته').setRequired(false))
);

// ---- أمر الاقتصاد ----
الاوامر.push(new SlashCommandBuilder()
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
الاوامر.push(new SlashCommandBuilder()
    .setName('مستوى')
    .setDescription('عرض مستواك أو ترتيب المتصدرين')
    .addSubcommand(sub => sub.setName('رتبتي').setDescription('عرض مستواك').addUserOption(opt => opt.setName('عضو').setDescription('عضو آخر').setRequired(false)))
    .addSubcommand(sub => sub.setName('المتصدرين').setDescription('عرض لوحة المتصدرين'))
);

// ---- أمر الإدارة ----
الاوامر.push(new SlashCommandBuilder()
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
الاوامر.push(new SlashCommandBuilder()
    .setName('تذكرة')
    .setDescription('نظام التذاكر المتطور')
    .addSubcommand(sub => sub.setName('إعداد').setDescription('إعداد نظام التذاكر').addChannelOption(opt => opt.setName('فئة').setDescription('فئة التذاكر').setRequired(true)).addRoleOption(opt => opt.setName('دور_الدعم').setDescription('دور الدعم').setRequired(true)).addChannelOption(opt => opt.setName('قناة_السجلات').setDescription('قناة سجلات التذاكر').setRequired(true)))
    .addSubcommand(sub => sub.setName('لوحة').setDescription('إنشاء لوحة التذاكر'))
    .addSubcommand(sub => sub.setName('فتح').setDescription('فتح تذكرة جديدة').addStringOption(opt => opt.setName('الموضوع').setDescription('موضوع التذكرة').setRequired(true)).addStringOption(opt => opt.setName('القسم').setDescription('قسم التذكرة').setRequired(true).addChoices(
        { name: 'دعم فني', value: 'دعم فني' },
        { name: 'شكوى', value: 'شكوى' },
        { name: 'اقتراح', value: 'اقتراح' },
        { name: 'طلب عضوية', value: 'طلب عضوية' },
        { name: 'أخرى', value: 'أخرى' }
    )))
    .addSubcommand(sub => sub.setName('إغلاق').setDescription('إغلاق التذكرة الحالية'))
);

// ---- أمر الترحيب ----
الاوامر.push(new SlashCommandBuilder()
    .setName('ترحيب')
    .setDescription('نظام الترحيب والوداع')
    .addSubcommand(sub => sub.setName('تعيين').setDescription('تعيين قناة الترحيب').addChannelOption(opt => opt.setName('قناة').setDescription('قناة الترحيب').setRequired(true)).addStringOption(opt => opt.setName('رسالة').setDescription('رسالة الترحيب (استخدم {user} و {server})').setRequired(false)).addAttachmentOption(opt => opt.setName('صورة').setDescription('صورة للترحيب').setRequired(false)))
    .addSubcommand(sub => sub.setName('وداع').setDescription('تعيين قناة الوداع').addChannelOption(opt => opt.setName('قناة').setDescription('قناة الوداع').setRequired(true)).addStringOption(opt => opt.setName('رسالة').setDescription('رسالة الوداع (استخدم {user} و {server})').setRequired(false)).addAttachmentOption(opt => opt.setName('صورة').setDescription('صورة للوداع').setRequired(false)))
);

// ---- أمر الحماية ----
الاوامر.push(new SlashCommandBuilder()
    .setName('حماية')
    .setDescription('إعدادات الحماية المتقدمة')
    .addSubcommand(sub => sub.setName('تفعيل').setDescription('تفعيل وضع الحماية').addIntegerOption(opt => opt.setName('المستوى').setDescription('مستوى الحماية 1-3').setRequired(true).setMinValue(1).setMaxValue(3)))
    .addSubcommand(sub => sub.setName('تحقق').setDescription('إعداد نظام التحقق').addRoleOption(opt => opt.setName('دور').setDescription('دور التحقق').setRequired(true)).addChannelOption(opt => opt.setName('قناة').setDescription('قناة التحقق').setRequired(true)))
    .addSubcommand(sub => sub.setName('مكافحة_سبام').setDescription('تعيين حد السبام').addIntegerOption(opt => opt.setName('الحد').setDescription('عدد الرسائل المسموح بها في 5 ثوانٍ').setRequired(true).setMinValue(3).setMaxValue(20)))
    .addSubcommand(sub => sub.setName('دور_الكتم').setDescription('تعيين دور الكتم').addRoleOption(opt => opt.setName('دور').setDescription('دور الكتم').setRequired(true)))
);

// ---- أمر السجلات ----
الاوامر.push(new SlashCommandBuilder()
    .setName('سجلات')
    .setDescription('إعدادات سجلات السيرفر')
    .addSubcommand(sub => sub.setName('تعيين').setDescription('تعيين قناة السجلات').addChannelOption(opt => opt.setName('قناة').setDescription('قناة السجلات').setRequired(true)).addStringOption(opt => opt.setName('النوع').setDescription('نوع السجلات').setRequired(true).addChoices(
        { name: 'الكل', value: 'الكل' },
        { name: 'عضوية', value: 'عضوية' },
        { name: 'رسائل', value: 'رسائل' },
        { name: 'إدارة', value: 'إدارة' },
        { name: 'تذاكر', value: 'تذاكر' }
    )))
);

// ---- أمر الأدوار ----
الاوامر.push(new SlashCommandBuilder()
    .setName('أدوار')
    .setDescription('إدارة الأدوار المتقدمة')
    .addSubcommand(sub => sub.setName('تلقائي').setDescription('تعيين دور تلقائي للقادمين الجدد').addRoleOption(opt => opt.setName('دور').setDescription('الدور التلقائي').setRequired(true)))
    .addSubcommand(sub => sub.setName('تفاعلي').setDescription('إضافة دور تفاعلي').addStringOption(opt => opt.setName('معرف_الرسالة').setDescription('معرف الرسالة').setRequired(true)).addRoleOption(opt => opt.setName('دور').setDescription('الدور').setRequired(true)).addStringOption(opt => opt.setName('إيموجي').setDescription('الإيموجي').setRequired(true)))
    .addSubcommand(sub => sub.setName('قائمة').setDescription('عرض الأدوار التفاعلية'))
    .addSubcommand(sub => sub.setName('متجر').setDescription('إدارة متجر الأدوار').addRoleOption(opt => opt.setName('دور').setDescription('الدور للبيع').setRequired(true)).addIntegerOption(opt => opt.setName('سعر').setDescription('سعر الدور').setRequired(true)).addStringOption(opt => opt.setName('وصف').setDescription('وصف الدور').setRequired(false)))
);

// ---- أمر التذكير ----
الاوامر.push(new SlashCommandBuilder()
    .setName('تذكير')
    .setDescription('تعيين تذكيرات')
    .addSubcommand(sub => sub.setName('تعيين').setDescription('تعيين تذكير').addIntegerOption(opt => opt.setName('مدة').setDescription('المدة بالثواني').setRequired(true)).addStringOption(opt => opt.setName('رسالة').setDescription('رسالة التذكير').setRequired(true)))
    .addSubcommand(sub => sub.setName('متكرر').setDescription('تعيين تذكير متكرر').addIntegerOption(opt => opt.setName('مدة').setDescription('المدة بين كل تذكير').setRequired(true)).addStringOption(opt => opt.setName('رسالة').setDescription('رسالة التذكير').setRequired(true)))
);

// ---- أمر العشائر ----
الاوامر.push(new SlashCommandBuilder()
    .setName('عشيرة')
    .setDescription('إدارة العشائر')
    .addSubcommand(sub => sub.setName('إنشاء').setDescription('إنشاء عشيرة جديدة').addStringOption(opt => opt.setName('الاسم').setDescription('اسم العشيرة').setRequired(true)))
    .addSubcommand(sub => sub.setName('معلومات').setDescription('عرض معلومات عشيرة').addStringOption(opt => opt.setName('الاسم').setDescription('اسم العشيرة').setRequired(true)))
    .addSubcommand(sub => sub.setName('دعوة').setDescription('دعوة عضو للعشيرة').addUserOption(opt => opt.setName('عضو').setDescription('العضو المراد دعوته').setRequired(true)))
);

// ---- أمر المزرعة ----
الاوامر.push(new SlashCommandBuilder()
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
الاوامر.push(new SlashCommandBuilder()
    .setName('مزاد')
    .setDescription('إدارة المزادات')
    .addSubcommand(sub => sub.setName('إنشاء').setDescription('إنشاء مزاد جديد').addStringOption(opt => opt.setName('عنصر').setDescription('العنصر المعروض').setRequired(true)).addIntegerOption(opt => opt.setName('سعر_بدء').setDescription('سعر البداية').setRequired(true)))
    .addSubcommand(sub => sub.setName('مزايدة').setDescription('المزايدة على عنصر').addIntegerOption(opt => opt.setName('معرف').setDescription('معرف المزاد').setRequired(true)).addIntegerOption(opt => opt.setName('مبلغ').setDescription('مبلغ المزايدة').setRequired(true)))
);

// ---- أمر الأوامر المخصصة ----
الاوامر.push(new SlashCommandBuilder()
    .setName('أوامر')
    .setDescription('إدارة الأوامر المخصصة')
    .addSubcommand(sub => sub.setName('إضافة').setDescription('إضافة أمر مخصص').addStringOption(opt => opt.setName('الاسم').setDescription('اسم الأمر').setRequired(true)).addStringOption(opt => opt.setName('الرد').setDescription('الرد عند استخدام الأمر').setRequired(true)))
    .addSubcommand(sub => sub.setName('حذف').setDescription('حذف أمر مخصص').addStringOption(opt => opt.setName('الاسم').setDescription('اسم الأمر').setRequired(true)))
    .addSubcommand(sub => sub.setName('قائمة').setDescription('عرض الأوامر المخصصة'))
);

// ---- أمر المالك ----
الاوامر.push(new SlashCommandBuilder()
    .setName('مالك')
    .setDescription('أوامر المالك (مقيدة)')
    .addSubcommand(sub => sub.setName('تقييم').setDescription('تنفيذ كود JavaScript').addStringOption(opt => opt.setName('كود').setDescription('الكود المراد تنفيذه').setRequired(true)))
    .addSubcommand(sub => sub.setName('إعادة_تحميل').setDescription('إعادة تحميل الأوامر'))
    .addSubcommand(sub => sub.setName('إحصاءات').setDescription('عرض إحصاءات البوت'))
);

// ---- أمر بينغ ----
الاوامر.push(new SlashCommandBuilder()
    .setName('بينغ')
    .setDescription('اختبار سرعة استجابة البوت')
);

// ---- أمر الاستطلاعات ----
الاوامر.push(new SlashCommandBuilder()
    .setName('استطلاع')
    .setDescription('إنشاء استطلاع رأي')
    .addStringOption(opt => opt.setName('سؤال').setDescription('سؤال الاستطلاع').setRequired(true))
    .addStringOption(opt => opt.setName('خيارات').setDescription('الخيارات مفصولة بفاصلة (مثال: نعم,لا,ربما)').setRequired(true))
);

// ---- أمر الهدايا ----
الاوامر.push(new SlashCommandBuilder()
    .setName('هدية')
    .setDescription('إدارة الهدايا')
    .addSubcommand(sub => sub.setName('إنشاء').setDescription('إنشاء هدية جديدة').addIntegerOption(opt => opt.setName('مدة').setDescription('المدة بالثواني').setRequired(true)).addIntegerOption(opt => opt.setName('فائزون').setDescription('عدد الفائزين').setRequired(true)).addStringOption(opt => opt.setName('جائزة').setDescription('الجائزة').setRequired(true)))
);

// ================== تسجيل الأوامر ==================
const rest = new REST({ version: '10' }).setToken(TOKEN);

async function تسجيل_الاوامر() {
    try {
        console.log('🔄 جاري تسجيل الأوامر...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: الاوامر });
        console.log('✅ تم تسجيل الأوامر بنجاح!');
    } catch (error) {
        console.error('❌ فشل تسجيل الأوامر:', error);
    }
}

// ================== أحداث البوت ==================
client.once('ready', async () => {
    console.log(`✅ البوت ${client.user.tag} جاهز!`);
    await تسجيل_الاوامر();
});

// ================== معالجة الأوامر ==================
client.on(Events.InteractionCreate, async (التفاعل) => {
    if (!التفاعل.isChatInputCommand()) return;

    const { commandName, options, user, guild, member, channel } = التفاعل;
    await التفاعل.deferReply({ ephemeral: false }).catch(() => {});

    // تسجيل الأمر
    تسجيل_حدث(guild.id, 'أمر', `${user.tag} استخدم /${commandName}`, 0x00BFFF);

    // ================== أمر المساعدة ==================
    if (commandName === 'مساعدة') {
        const الامر = options.getString('الأمر');
        if (الامر) {
            const بيانات_المساعدة = {
                'مساعدة': 'عرض جميع الأوامر المتاحة مع شرح مفصل',
                'معلومات': 'عرض معلومات عن البوت أو السيرفر أو العضو',
                'اقتصاد': 'إدارة رصيدك وعملاتك (رصيد، يومي، عمل، سرقة، حظ، متجر، شراء)',
                'مستوى': 'عرض مستواك أو ترتيب المتصدرين',
                'إدارة': 'أوامر إدارة السيرفر (طرد، حظر، كتم، تحذير، مسح)',
                'تذكرة': 'نظام التذاكر المتطور (إعداد، لوحة، فتح، إغلاق)',
                'ترحيب': 'نظام الترحيب والوداع مع صور',
                'حماية': 'إعدادات الحماية المتقدمة',
                'سجلات': 'تعيين قناة السجلات بأنواعها',
                'أدوار': 'إدارة الأدوار التلقائية والتفاعلية ومتجر الأدوار',
                'تذكير': 'تعيين تذكيرات عادية أو متكررة',
                'عشيرة': 'إنشاء وإدارة العشائر',
                'مزرعة': 'زراعة وحصاد المحاصيل',
                'مزاد': 'إنشاء والمزايدة في المزادات',
                'أوامر': 'إدارة الأوامر المخصصة للسيرفر',
                'مالك': 'أوامر مقيدة للمالك',
                'بينغ': 'اختبار سرعة استجابة البوت',
                'استطلاع': 'إنشاء استطلاع رأي تفاعلي',
                'هدية': 'إنشاء هدايا وتوزيع جوائز'
            };
            const معلومات = بيانات_المساعدة[الامر];
            if (معلومات) {
                const ايمبد = new EmbedBuilder()
                    .setTitle(`📖 شرح الأمر: /${الامر}`)
                    .setDescription(معلومات)
                    .setColor(0x00FF00)
                    .addFields({ name: 'الاستخدام', value: `/${الامر}` })
                    .setFooter({ text: 'استخدم /مساعدة لعرض جميع الأوامر' });
                return التفاعل.editReply({ embeds: [ايمبد] });
            } else {
                return التفاعل.editReply({ content: `❌ لا يوجد أمر باسم **${الامر}**. استخدم \`/مساعدة\` لعرض جميع الأوامر.` });
            }
        }

        const ايمبد = new EmbedBuilder()
            .setTitle('📚 قائمة الأوامر - البوت العربي الخارق')
            .setDescription('استخدم `/مساعدة <اسم_الأمر>` للحصول على شرح تفصيلي.')
            .setColor(0x00BFFF)
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: `طلب بواسطة ${user.tag}`, iconURL: user.displayAvatarURL() });

        const التصنيفات = {
            'ℹ️ معلومات': ['مساعدة', 'معلومات', 'بينغ'],
            '💰 اقتصاد': ['اقتصاد', 'مستوى'],
            '🛠️ إدارة': ['إدارة'],
            '🎫 تذاكر': ['تذكرة'],
            '📝 ترحيب': ['ترحيب'],
            '🛡️ حماية': ['حماية', 'سجلات'],
            '🎭 أدوار': ['أدوار'],
            '⏰ تذكيرات': ['تذكير'],
            '🏴 عشائر': ['عشيرة'],
            '🌾 مزرعة': ['مزرعة'],
            '🔨 مزادات': ['مزاد'],
            '📋 أوامر مخصصة': ['أوامر'],
            '📊 استطلاعات وهدايا': ['استطلاع', 'هدية'],
            '🔐 مالك': ['مالك']
        };

        let وصف = '';
        for (const [تصنيف, اوامر] of Object.entries(التصنيفات)) {
            const قائمة = اوامر.map(اسم => `\`/${اسم}\``).join(' ');
            وصف += `**${تصنيف}**\n${قائمة}\n\n`;
        }

        ايمبد.setDescription(وصف);
        ايمبد.addFields({ name: '📖 للحصول على شرح مفصل', value: 'استخدم `/مساعدة <اسم_الأمر>`' });

        return التفاعل.editReply({ embeds: [ايمبد] });
    }

    // ================== أمر بينغ ==================
    if (commandName === 'بينغ') {
        return التفاعل.editReply({ content: `🏓 بونغ! ${client.ws.ping}ms` });
    }

    // ================== أمر المعلومات ==================
    if (commandName === 'معلومات') {
        const النوع = options.getString('النوع');
        if (النوع === 'بوت') {
            const ايمبد = new EmbedBuilder()
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
            return التفاعل.editReply({ embeds: [ايمبد] });
        } else if (النوع === 'سيرفر') {
            const س = guild;
            const ايمبد = new EmbedBuilder()
                .setTitle(`📊 ${س.name}`)
                .setColor(0x00BFFF)
                .setThumbnail(س.iconURL())
                .addFields(
                    { name: '🆔 المعرف', value: س.id, inline: true },
                    { name: '👑 المالك', value: `<@${س.ownerId}>`, inline: true },
                    { name: '👥 الأعضاء', value: String(س.memberCount), inline: true },
                    { name: '📢 القنوات', value: String(س.channels.cache.size), inline: true },
                    { name: '📅 التاريخ', value: س.createdAt.toDateString(), inline: true }
                );
            return التفاعل.editReply({ embeds: [ايمبد] });
        } else if (النوع === 'عضو') {
            const الهدف = options.getUser('العضو') || user;
            const عضو = guild.members.cache.get(الهدف.id);
            const احصائيات = جلب_احصائيات(الهدف.id, guild.id);
            const { المستوى, الخبرة } = جلب_المستوى(الهدف.id, guild.id);
            const مطلوب = 5 * (المستوى * المستوى) + 50 * المستوى + 100;
            const ايمبد = new EmbedBuilder()
                .setTitle(`👤 ${الهدف.tag}`)
                .setColor(0x00BFFF)
                .setThumbnail(الهدف.displayAvatarURL())
                .addFields(
                    { name: '🆔 المعرف', value: الهدف.id, inline: false },
                    { name: '📅 انضم', value: عضو ? عضو.joinedAt.toDateString() : 'غير موجود', inline: true },
                    { name: '📆 الحساب', value: الهدف.createdAt.toDateString(), inline: true },
                    { name: '🎭 الأدوار', value: عضو ? عضو.roles.cache.map(r => r.toString()).join(' ') || 'لا يوجد' : 'غير موجود', inline: false },
                    { name: '📊 المستوى', value: `${المستوى} (${الخبرة}/${مطلوب} XP)`, inline: true },
                    { name: '💰 الرصيد', value: `${جلب_الرصيد(الهدف.id, guild.id)} عملة`, inline: true },
                    { name: '📨 الرسائل', value: String(احصائيات.الرسائل), inline: true },
                    { name: '🎙️ دقائق صوتية', value: String(احصائيات.الصوت), inline: true },
                    { name: '🔁 التفاعلات', value: String(احصائيات.التفاعلات), inline: true }
                );
            return التفاعل.editReply({ embeds: [ايمبد] });
        }
    }

    // ================== أمر الاقتصاد ==================
    if (commandName === 'اقتصاد') {
        const الفرع = options.getSubcommand();
        if (الفرع === 'رصيد') {
            const الهدف = options.getUser('عضو') || user;
            const الرصيد = جلب_الرصيد(الهدف.id, guild.id);
            return التفاعل.editReply({ content: `💰 ${الهدف.tag} رصيدك: **${الرصيد}** عملة.` });
        }
        if (الفرع === 'يومي') {
            const الان = new Date().toISOString().slice(0, 10);
            const صف = db.prepare("SELECT اليومي FROM الاقتصاد WHERE المستخدم = ? AND السيرفر = ?").get(user.id, guild.id);
            if (صف && صف.اليومي === الان) return التفاعل.editReply({ content: '❌ لقد حصلت على مكافأتك اليومية بالفعل.' });
            const المبلغ = Math.floor(Math.random() * 100) + 50;
            تحديث_الرصيد(user.id, guild.id, المبلغ);
            db.prepare("UPDATE الاقتصاد SET اليومي = ? WHERE المستخدم = ? AND السيرفر = ?").run(الان, user.id, guild.id);
            return التفاعل.editReply({ content: `✅ حصلت على **${المبلغ}** عملة كمكافأة يومية!` });
        }
        if (الفرع === 'عمل') {
            const الان = Date.now();
            const صف = db.prepare("SELECT العمل FROM الاقتصاد WHERE المستخدم = ? AND السيرفر = ?").get(user.id, guild.id);
            if (صف && صف.العمل) {
                const اخر = parseInt(صف.العمل);
                if (الان - اخر < 3600000) {
                    const متبقي = Math.ceil((3600000 - (الان - اخر)) / 1000);
                    return التفاعل.editReply({ content: `⏳ انتظر ${متبقي} ثانية.` });
                }
            }
            const المبلغ = Math.floor(Math.random() * 40) + 10;
            تحديث_الرصيد(user.id, guild.id, المبلغ);
            db.prepare("UPDATE الاقتصاد SET العمل = ? WHERE المستخدم = ? AND السيرفر = ?").run(String(الان), user.id, guild.id);
            return التفاعل.editReply({ content: `💼 عملت وكسبت **${المبلغ}** عملة.` });
        }
        if (الفرع === 'سرقة') {
            const الهدف = options.getUser('عضو');
            const عضو_هدف = guild.members.cache.get(الهدف.id);
            if (!عضو_هدف || الهدف.id === user.id) return التفاعل.editReply({ content: '❌ حدد عضواً آخر.' });
            const رصيد_هدف = جلب_الرصيد(الهدف.id, guild.id);
            if (رصيد_هدف < 10) return التفاعل.editReply({ content: `❌ ${الهدف.tag} ليس لديه ما يكفي.` });
            const نجاح = Math.random() < 0.4;
            if (نجاح) {
                const المبلغ = Math.floor(Math.random() * Math.min(50, رصيد_هدف)) + 1;
                تحديث_الرصيد(user.id, guild.id, المبلغ);
                تحديث_الرصيد(الهدف.id, guild.id, -المبلغ);
                تسجيل_حدث(guild.id, 'سرقة', `${user.tag} سرق ${الهدف.tag} بمبلغ ${المبلغ}`, 0xFF0000);
                return التفاعل.editReply({ content: `✅ سرقت **${المبلغ}** عملة من ${الهدف.tag}.` });
            } else {
                const عقوبة = Math.floor(Math.random() * 20) + 1;
                تحديث_الرصيد(user.id, guild.id, -عقوبة);
                return التفاعل.editReply({ content: `❌ فشلت السرقة وخسرت **${عقوبة}** عملة.` });
            }
        }
        if (الفرع === 'حظ') {
            const رهان = options.getInteger('رهان') || 10;
            const رصيد = جلب_الرصيد(user.id, guild.id);
            if (رهان <= 0 || رصيد < رهان) return التفاعل.editReply({ content: '❌ رصيد غير كافٍ.' });
            const رموز = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣'];
            const نتيجة = [رموز[Math.floor(Math.random() * 6)], رموز[Math.floor(Math.random() * 6)], رموز[Math.floor(Math.random() * 6)]];
            const ايمبد = new EmbedBuilder().setTitle('🎰 ماكينة الحظ').setDescription(`${نتيجة[0]} ${نتيجة[1]} ${نتيجة[2]}`).setColor(0x2F3136);
            if (نتيجة[0] === نتيجة[1] && نتيجة[1] === نتيجة[2]) {
                const فوز = رهان * 10;
                تحديث_الرصيد(user.id, guild.id, فوز);
                ايمبد.addFields({ name: '🎉 فوز', value: `ربحت **${فوز}** عملة!` });
            } else if (نتيجة[0] === نتيجة[1] || نتيجة[1] === نتيجة[2] || نتيجة[0] === نتيجة[2]) {
                const فوز = رهان * 2;
                تحديث_الرصيد(user.id, guild.id, فوز);
                ايمبد.addFields({ name: '🎉 فوز بسيط', value: `ربحت **${فوز}** عملة!` });
            } else {
                تحديث_الرصيد(user.id, guild.id, -رهان);
                ايمبد.addFields({ name: '😔 خسارة', value: `خسرت **${رهان}** عملة.` });
            }
            return التفاعل.editReply({ embeds: [ايمبد] });
        }
        if (الفرع === 'متجر') {
            const ايمبد = new EmbedBuilder().setTitle('🛒 المتجر').setColor(0x00FF00)
                .addFields(
                    { name: '🎁 هدية', value: '100 عملة', inline: true },
                    { name: '⭐ نجمة', value: '500 عملة (لقب)', inline: true },
                    { name: '👑 تاج', value: '1000 عملة (لقب)', inline: true },
                    { name: '🎨 لون مخصص', value: '2000 عملة', inline: true }
                );
            // عرض أدوار المتجر
            const ادوار_المتجر = db.prepare("SELECT الدور, السعر, الوصف FROM متجر_الادوار WHERE السيرفر = ?").all(guild.id);
            if (ادوار_المتجر.length > 0) {
                for (const د of ادوار_المتجر) {
                    ايمبد.addFields({ name: `<@&${د.الدور}>`, value: `${د.السعر} عملة - ${د.الوصف || 'لا يوجد وصف'}`, inline: false });
                }
            }
            return التفاعل.editReply({ embeds: [ايمبد] });
        }
        if (الفرع === 'شراء') {
            const العنصر = options.getString('العنصر');
            const رصيد = جلب_الرصيد(user.id, guild.id);
            if (العنصر === 'هدية') {
                if (رصيد < 100) return التفاعل.editReply({ content: '❌ تحتاج 100 عملة.' });
                تحديث_الرصيد(user.id, guild.id, -100);
                const جوائز = ['🎁', '🍫', '🧸', '🎮', '📱', '💻'];
                return التفاعل.editReply({ content: `✅ اشتريت هدية وحصلت على: ${جوائز[Math.floor(Math.random() * جوائز.length)]}` });
            }
            if (العنصر === 'نجمة') {
                if (رصيد < 500) return التفاعل.editReply({ content: '❌ تحتاج 500 عملة.' });
                تحديث_الرصيد(user.id, guild.id, -500);
                try {
                    await member.setNickname(`⭐ ${member.displayName}`);
                    return التفاعل.editReply({ content: '✅ تم إضافة نجمة إلى اسمك!' });
                } catch (e) {
                    return التفاعل.editReply({ content: '❌ لا أملك صلاحية تغيير اللقب.' });
                }
            }
            if (العنصر === 'تاج') {
                if (رصيد < 1000) return التفاعل.editReply({ content: '❌ تحتاج 1000 عملة.' });
                تحديث_الرصيد(user.id, guild.id, -1000);
                try {
                    await member.setNickname(`👑 ${member.displayName}`);
                    return التفاعل.editReply({ content: '✅ تم إضافة تاج إلى اسمك!' });
                } catch (e) {
                    return التفاعل.editReply({ content: '❌ لا أملك صلاحية تغيير اللقب.' });
                }
            }
        }
    }

    // ================== أمر المستوى ==================
    if (commandName === 'مستوى') {
        const الفرع = options.getSubcommand();
        if (الفرع === 'رتبتي') {
            const الهدف = options.getUser('عضو') || user;
            const { المستوى, الخبرة } = جلب_المستوى(الهدف.id, guild.id);
            const مطلوب = 5 * (المستوى * المستوى) + 50 * المستوى + 100;
            const ايمبد = new EmbedBuilder().setTitle(`📊 مستوى ${الهدف.tag}`).setColor(0x00FF00)
                .addFields(
                    { name: 'المستوى', value: String(المستوى), inline: true },
                    { name: 'الخبرة', value: `${الخبرة} / ${مطلوب}`, inline: true },
                    { name: 'التقدم', value: `${Math.floor((الخبرة / مطلوب) * 100)}%`, inline: true }
                );
            return التفاعل.editReply({ embeds: [ايمبد] });
        }
        if (الفرع === 'المتصدرين') {
            const صفوف = db.prepare("SELECT المستخدم, المستوى, الخبرة FROM الاقتصاد WHERE السيرفر = ? ORDER BY المستوى DESC, الخبرة DESC LIMIT 10").all(guild.id);
            if (!صفوف || صفوف.length === 0) return التفاعل.editReply({ content: '❌ لا توجد بيانات.' });
            const وصف = صفوف.map((ص, i) => `#${i + 1} <@${ص.المستخدم}> - المستوى ${ص.المستوى} (${ص.الخبرة} XP)`).join('\n');
            const ايمبد = new EmbedBuilder().setTitle('🏆 لوحة المتصدرين').setDescription(وصف).setColor(0xFFD700);
            return التفاعل.editReply({ embeds: [ايمبد] });
        }
    }

    // ================== أمر الإدارة ==================
    if (commandName === 'إدارة') {
        const الفرع = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return التفاعل.editReply({ content: '❌ ليس لديك صلاحية.', ephemeral: true });
        }
        if (الفرع === 'طرد') {
            const الهدف = options.getUser('عضو');
            const عضو_هدف = guild.members.cache.get(الهدف.id);
            if (!عضو_هدف) return التفاعل.editReply({ content: '❌ العضو غير موجود.' });
            const سبب = options.getString('سبب') || 'لا يوجد سبب';
            try {
                await عضو_هدف.kick(سبب);
                تسجيل_حدث(guild.id, 'طرد', `${user.tag} طرد ${الهدف.tag} بسبب ${سبب}`, 0xFF0000);
                return التفاعل.editReply({ content: `✅ تم طرد ${الهدف.tag}.` });
            } catch (e) { return التفاعل.editReply({ content: '❌ فشل الطرد.' }); }
        }
        if (الفرع === 'حظر') {
            const الهدف = options.getUser('عضو');
            const عضو_هدف = guild.members.cache.get(الهدف.id);
            if (!عضو_هدف) return التفاعل.editReply({ content: '❌ العضو غير موجود.' });
            const سبب = options.getString('سبب') || 'لا يوجد سبب';
            try {
                await عضو_هدف.ban({ سبب });
                تسجيل_حدث(guild.id, 'حظر', `${user.tag} حظر ${الهدف.tag} بسبب ${سبب}`, 0xFF0000);
                return التفاعل.editReply({ content: `✅ تم حظر ${الهدف.tag}.` });
            } catch (e) { return التفاعل.editReply({ content: '❌ فشل الحظر.' }); }
        }
        if (الفرع === 'رفع_حظر') {
            const الاسم = options.getString('اسم');
            const محظورين = await guild.bans.fetch();
            const محظور = محظورين.find(ح => ح.user.tag.includes(الاسم) || ح.user.id === الاسم);
            if (!محظور) return التفاعل.editReply({ content: '❌ لم يتم العثور على العضو.' });
            try {
                await guild.bans.remove(محظور.user);
                تسجيل_حدث(guild.id, 'رفع_حظر', `${user.tag} رفع الحظر عن ${محظور.user.tag}`, 0x00FF00);
                return التفاعل.editReply({ content: `✅ تم رفع الحظر عن ${محظور.user.tag}.` });
            } catch (e) { return التفاعل.editReply({ content: '❌ فشل رفع الحظر.' }); }
        }
        if (الفرع === 'كتم') {
            const الهدف = options.getUser('عضو');
            const عضو_هدف = guild.members.cache.get(الهدف.id);
            if (!عضو_هدف) return التفاعل.editReply({ content: '❌ العضو غير موجود.' });
            const مدة = options.getInteger('مدة');
            const سبب = options.getString('سبب') || 'لا يوجد سبب';
            try {
                await عضو_هدف.timeout(مدة * 1000, سبب);
                تسجيل_حدث(guild.id, 'كتم', `${user.tag} كتم ${الهدف.tag} لمدة ${مدة} ثانية`, 0xFFA500);
                return التفاعل.editReply({ content: `✅ تم كتم ${الهدف.tag} لمدة ${مدة} ثانية.` });
            } catch (e) { return التفاعل.editReply({ content: '❌ فشل الكتم.' }); }
        }
        if (الفرع === 'رفع_كتم') {
            const الهدف = options.getUser('عضو');
            const عضو_هدف = guild.members.cache.get(الهدف.id);
            if (!عضو_هدف) return التفاعل.editReply({ content: '❌ العضو غير موجود.' });
            try {
                await عضو_هدف.timeout(null);
                تسجيل_حدث(guild.id, 'رفع_كتم', `${user.tag} رفع الكتم عن ${الهدف.tag}`, 0x00FF00);
                return التفاعل.editReply({ content: `✅ تم رفع الكتم عن ${الهدف.tag}.` });
            } catch (e) { return التفاعل.editReply({ content: '❌ فشل رفع الكتم.' }); }
        }
        if (الفرع === 'تحذير') {
            const الهدف = options.getUser('عضو');
            const عضو_هدف = guild.members.cache.get(الهدف.id);
            if (!عضو_هدف) return التفاعل.editReply({ content: '❌ العضو غير موجود.' });
            const سبب = options.getString('سبب') || 'لا يوجد سبب';
            const عدد = اضافة_تحذير(الهدف.id, guild.id, سبب, user.id);
            تسجيل_حدث(guild.id, 'تحذير', `${user.tag} حذر ${الهدف.tag} بسبب ${سبب}`, 0xFFA500);
            return التفاعل.editReply({ content: `⚠️ تم تحذير ${الهدف.tag} (العدد: ${عدد})` });
        }
        if (الفرع === 'تحذيرات') {
            const الهدف = options.getUser('عضو');
            const تحذيرات = جلب_التحذيرات(الهدف.id, guild.id);
            if (!تحذيرات || تحذيرات.length === 0) return التفاعل.editReply({ content: `✅ ${الهدف.tag} ليس لديه تحذيرات.` });
            const وصف = تحذيرات.map((ت, i) => `#${i + 1}: ${ت.السبب} (بواسطة <@${ت.المشرف}>)`).join('\n');
            const ايمبد = new EmbedBuilder().setTitle(`⚠️ تحذيرات ${الهدف.tag}`).setDescription(وصف).setColor(0xFF0000);
            return التفاعل.editReply({ embeds: [ايمبد] });
        }
        if (الفرع === 'مسح_تحذيرات') {
            const الهدف = options.getUser('عضو');
            مسح_التحذيرات(الهدف.id, guild.id);
            تسجيل_حدث(guild.id, 'مسح_تحذيرات', `${user.tag} مسح تحذيرات ${الهدف.tag}`, 0x00FF00);
            return التفاعل.editReply({ content: `✅ تم مسح تحذيرات ${الهدف.tag}.` });
        }
        if (الفرع === 'مسح') {
            const عدد = options.getInteger('عدد');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                return التفاعل.editReply({ content: '❌ ليس لديك صلاحية.', ephemeral: true });
            }
            try {
                await channel.bulkDelete(عدد, true);
                تسجيل_حدث(guild.id, 'مسح', `${user.tag} مسح ${عدد} رسالة`, 0x00BFFF);
                return التفاعل.editReply({ content: `✅ تم حذف ${عدد} رسالة.` });
            } catch (e) { return التفاعل.editReply({ content: '❌ فشل الحذف.' }); }
        }
    }

    // ================== أمر التذاكر ==================
    if (commandName === 'تذكرة') {
        const الفرع = options.getSubcommand();
        if (الفرع === 'إعداد') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return التفاعل.editReply({ content: '❌ تحتاج صلاحية مدير.', ephemeral: true });
            }
            const فئة = options.getChannel('فئة');
            const دور_الدعم = options.getRole('دور_الدعم');
            const قناة_السجلات = options.getChannel('قناة_السجلات');
            db.prepare("INSERT OR REPLACE INTO اعدادات_التذاكر (السيرفر, الفئة, دور_الدعم, قناة_السجلات) VALUES (?, ?, ?, ?)")
                .run(guild.id, فئة.id, دور_الدعم.id, قناة_السجلات.id);
            return التفاعل.editReply({ content: `✅ تم إعداد نظام التذاكر! الفئة: ${فئة.name}، دور الدعم: ${دور_الدعم.name}، قناة السجلات: ${قناة_السجلات.name}` });
        }
        if (الفرع === 'لوحة') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return التفاعل.editReply({ content: '❌ تحتاج صلاحية مدير.', ephemeral: true });
            }
            const ايمبد = new EmbedBuilder()
                .setTitle('🎫 نظام التذاكر')
                .setDescription('اختر القسم المناسب لفتح تذكرة دعم')
                .setColor(0x00BFFF)
                .setImage('https://i.imgur.com/your-image-here.png');
            const قائمة = new StringSelectMenuBuilder()
                .setCustomId('تذكرة_القائمة')
                .setPlaceholder('اختر قسم التذكرة')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('دعم فني').setDescription('مشاكل تقنية').setValue('دعم فني').setEmoji('🛠️'),
                    new StringSelectMenuOptionBuilder().setLabel('شكوى').setDescription('تقديم شكوى').setValue('شكوى').setEmoji('📢'),
                    new StringSelectMenuOptionBuilder().setLabel('اقتراح').setDescription('تقديم اقتراح').setValue('اقتراح').setEmoji('💡'),
                    new StringSelectMenuOptionBuilder().setLabel('طلب عضوية').setDescription('طلب الانضمام').setValue('طلب عضوية').setEmoji('👋'),
                    new StringSelectMenuOptionBuilder().setLabel('أخرى').setDescription('أسباب أخرى').setValue('أخرى').setEmoji('❓')
                );
            const صف = new ActionRowBuilder().addComponents(قائمة);
            await التفاعل.editReply({ content: '✅ تم إنشاء لوحة التذاكر.', ephemeral: true });
            await channel.send({ embeds: [ايمبد], components: [صف] });
        }
        if (الفرع === 'فتح') {
            const الموضوع = options.getString('الموضوع');
            const القسم = options.getString('القسم');
            const اعدادات = db.prepare("SELECT الفئة, دور_الدعم, قناة_السجلات FROM اعدادات_التذاكر WHERE السيرفر = ?").get(guild.id);
            if (!اعدادات) {
                return التفاعل.editReply({ content: '❌ نظام التذاكر غير مضبوط. اطلب من مشرف تنفيذ `/تذكرة إعداد`.', ephemeral: true });
            }
            const فئة = guild.channels.cache.get(اعدادات.الفئة);
            if (!فئة) {
                return التفاعل.editReply({ content: '❌ الفئة غير موجودة. تواصل مع المشرف.', ephemeral: true });
            }
            const صلاحيات = [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ];
            const دور_الدعم = guild.roles.cache.get(اعدادات.دور_الدعم);
            if (دور_الدعم) {
                صلاحيات.push({ id: دور_الدعم.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
            }
            const اسم_القناة = `تذكرة-${user.username}`;
            const قناة_تذكرة = await guild.channels.create({
                name: اسم_القناة,
                type: ChannelType.GuildText,
                parent: فئة,
                permissionOverwrites: صلاحيات,
                topic: `📌 ${القسم} - ${الموضوع}`
            });
            db.prepare("INSERT INTO التذاكر (السيرفر, القناة, المستخدم, الموضوع, الحالة, التاريخ, القسم, الاولوية) VALUES (?, ?, ?, ?, 'مفتوحة', datetime('now'), ?, 'عادية')")
                .run(guild.id, قناة_تذكرة.id, user.id, الموضوع, القسم);
            const ايمبد = new EmbedBuilder()
                .setTitle('🎫 تذكرة جديدة')
                .setDescription(`**الموضوع:** ${الموضوع}\n**القسم:** ${القسم}`)
                .setColor(0x00BFFF)
                .addFields(
                    { name: 'أنشأها', value: user.tag, inline: true },
                    { name: 'الحالة', value: '🟢 مفتوحة', inline: true }
                )
                .setFooter({ text: 'استخدم /تذكرة إغلاق لإغلاق التذكرة' });
            const صف = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('اغلاق_تذكرة').setLabel('🔒 إغلاق التذكرة').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('تولي_تذكرة').setLabel('📌 تولي').setStyle(ButtonStyle.Primary)
                );
            await قناة_تذكرة.send({ content: `<@${user.id}>`, embeds: [ايمبد], components: [صف] });
            تسجيل_حدث(guild.id, 'فتح_تذكرة', `${user.tag} فتح تذكرة: ${الموضوع}`, 0x00BFFF);
            return التفاعل.editReply({ content: `✅ تم فتح تذكرة: ${قناة_تذكرة}` });
        }
        if (الفرع === 'إغلاق') {
            if (!channel.name.startsWith('تذكرة-')) {
                return التفاعل.editReply({ content: '❌ هذه ليست قناة تذكرة.', ephemeral: true });
            }
            db.prepare("UPDATE التذاكر SET الحالة = 'مغلقة' WHERE القناة = ?").run(channel.id);
            تسجيل_حدث(guild.id, 'اغلاق_تذكرة', `${user.tag} أغلق تذكرة ${channel.name}`, 0xFF0000);
            await التفاعل.editReply({ content: '🔒 سيتم حذف التذكرة خلال 5 ثوانٍ.' });
            setTimeout(() => channel.delete().catch(() => {}), 5000);
        }
    }

    // ================== أمر الترحيب ==================
    if (commandName === 'ترحيب') {
        const الفرع = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return التفاعل.editReply({ content: '❌ تحتاج صلاحية مدير.', ephemeral: true });
        }
        if (الفرع === 'تعيين') {
            const القناة = options.getChannel('قناة');
            const الرسالة = options.getString('رسالة') || 'مرحباً {user} في {server}';
            const المرفق = options.getAttachment('صورة');
            const رابط_الصورة = المرفق ? المرفق.url : '';
            db.prepare("INSERT OR REPLACE INTO الترحيب (السيرفر, القناة, الرسالة, الصورة) VALUES (?, ?, ?, ?)")
                .run(guild.id, القناة.id, الرسالة, رابط_الصورة);
            return التفاعل.editReply({ content: `✅ تم تعيين الترحيب في ${القناة} ${رابط_الصورة ? 'مع صورة' : 'بدون صورة'}` });
        }
        if (الفرع === 'وداع') {
            const القناة = options.getChannel('قناة');
            const الرسالة = options.getString('رسالة') || 'وداعاً {user} من {server}';
            const المرفق = options.getAttachment('صورة');
            const رابط_الصورة = المرفق ? المرفق.url : '';
            db.prepare("INSERT OR REPLACE INTO الوداع (السيرفر, القناة, الرسالة, الصورة) VALUES (?, ?, ?, ?)")
                .run(guild.id, القناة.id, الرسالة, رابط_الصورة);
            return التفاعل.editReply({ content: `✅ تم تعيين الوداع في ${القناة} ${رابط_الصورة ? 'مع صورة' : 'بدون صورة'}` });
        }
    }

    // ================== أمر الحماية ==================
    if (commandName === 'حماية') {
        const الفرع = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return التفاعل.editReply({ content: '❌ تحتاج صلاحية مدير.', ephemeral: true });
        }
        if (الفرع === 'تفعيل') {
            const المستوى = options.getInteger('المستوى');
            try {
                await guild.setVerificationLevel(المستوى);
                db.prepare("INSERT OR REPLACE INTO الحماية (السيرفر, مستوى_التحقق) VALUES (?, ?)").run(guild.id, المستوى);
                return التفاعل.editReply({ content: `✅ تم تفعيل الحماية المستوى ${المستوى}.` });
            } catch (e) { return التفاعل.editReply({ content: '❌ فشل التفعيل.' }); }
        }
        if (الفرع === 'تحقق') {
            const دور = options.getRole('دور');
            const القناة = options.getChannel('قناة');
            db.prepare("INSERT OR REPLACE INTO ادوار_التحقق (السيرفر, الدور, القناة) VALUES (?, ?, ?)").run(guild.id, دور.id, القناة.id);
            const ايمبد = new EmbedBuilder()
                .setTitle('✅ التحقق')
                .setDescription('اضغط على الزر أدناه للتحقق من هويتك.')
                .setColor(0x00FF00);
            const صف = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('زر_التحقق').setLabel('✅ تحقق').setStyle(ButtonStyle.Success)
                );
            await القناة.send({ embeds: [ايمبد], components: [صف] });
            return التفاعل.editReply({ content: `✅ تم تعيين دور التحقق ${دور.name} في ${القناة}` });
        }
        if (الفرع === 'مكافحة_سبام') {
            const حد = options.getInteger('الحد');
            db.prepare("INSERT OR REPLACE INTO الحماية (السيرفر, حد_السبام) VALUES (?, ?)").run(guild.id, حد);
            return التفاعل.editReply({ content: `✅ تم تعيين حد السبام إلى ${حد} رسائل في 5 ثوانٍ.` });
        }
        if (الفرع === 'دور_الكتم') {
            const دور = options.getRole('دور');
            db.prepare("INSERT OR REPLACE INTO ادوار_الكتم (السيرفر, الدور) VALUES (?, ?)").run(guild.id, دور.id);
            return التفاعل.editReply({ content: `✅ تم تعيين دور الكتم: ${دور.name}` });
        }
    }

    // ================== أمر السجلات ==================
    if (commandName === 'سجلات') {
        const الفرع = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return التفاعل.editReply({ content: '❌ تحتاج صلاحية مدير.', ephemeral: true });
        }
        if (الفرع === 'تعيين') {
            const القناة = options.getChannel('قناة');
            const النوع = options.getString('النوع');
            db.prepare("INSERT OR REPLACE INTO السجلات (السيرفر, القناة, النوع) VALUES (?, ?, ?)")
                .run(guild.id, القناة.id, النوع);
            return التفاعل.editReply({ content: `✅ تم تعيين سجلات ${النوع} في ${القناة}` });
        }
    }

    // ================== أمر الأدوار ==================
    if (commandName === 'أدوار') {
        const الفرع = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return التفاعل.editReply({ content: '❌ تحتاج صلاحية مدير.', ephemeral: true });
        }
        if (الفرع === 'تلقائي') {
            const دور = options.getRole('دور');
            db.prepare("INSERT OR REPLACE INTO الادوار_التلقائية (السيرفر, الدور) VALUES (?, ?)").run(guild.id, دور.id);
            return التفاعل.editReply({ content: `✅ تم تعيين دور تلقائي: ${دور.name}` });
        }
        if (الفرع === 'تفاعلي') {
            const معرف_الرسالة = options.getString('معرف_الرسالة');
            const دور = options.getRole('دور');
            const ايموجي = options.getString('إيموجي');
            db.prepare("INSERT INTO الادوار_التفاعلية (السيرفر, الرسالة, الدور, الايموجي) VALUES (?, ?, ?, ?)")
                .run(guild.id, معرف_الرسالة, دور.id, ايموجي);
            try {
                const رسالة = await channel.messages.fetch(معرف_الرسالة);
                await رسالة.react(ايموجي);
            } catch (e) {}
            return التفاعل.editReply({ content: `✅ تم ربط الإيموجي ${ايموجي} بالدور ${دور.name}` });
        }
        if (الفرع === 'قائمة') {
            const صفوف = db.prepare("SELECT id, الرسالة, الدور, الايموجي FROM الادوار_التفاعلية WHERE السيرفر = ?").all(guild.id);
            if (!صفوف || صفوف.length === 0) return التفاعل.editReply({ content: '📭 لا توجد أدوار تفاعلية.' });
            const قائمة = صفوف.map(ص => `#${ص.id} - ${ص.الايموجي} -> <@&${ص.الدور}>`).join('\n');
            return التفاعل.editReply({ content: `📋 الأدوار التفاعلية:\n${قائمة}` });
        }
        if (الفرع === 'متجر') {
            const دور = options.getRole('دور');
            const سعر = options.getInteger('سعر');
            const وصف = options.getString('وصف') || 'لا يوجد وصف';
            db.prepare("INSERT INTO متجر_الادوار (السيرفر, الدور, السعر, الوصف) VALUES (?, ?, ?, ?)")
                .run(guild.id, دور.id, سعر, وصف);
            return التفاعل.editReply({ content: `✅ تم إضافة الدور ${دور.name} إلى المتجر بسعر ${سعر} عملة.` });
        }
    }

    // ================== أمر التذكير ==================
    if (commandName === 'تذكير') {
        const الفرع = options.getSubcommand();
        if (الفرع === 'تعيين') {
            const مدة = options.getInteger('مدة');
            const رسالة = options.getString('رسالة');
            const الوقت = Date.now() + مدة * 1000;
            db.prepare("INSERT INTO التذكيرات (المستخدم, القناة, الرسالة, الوقت) VALUES (?, ?, ?, ?)")
                .run(user.id, channel.id, رسالة, String(الوقت));
            return التفاعل.editReply({ content: `✅ تم تعيين تذكير بعد ${مدة} ثانية.` });
        }
        if (الفرع === 'متكرر') {
            const مدة = options.getInteger('مدة');
            const رسالة = options.getString('رسالة');
            const الوقت = Date.now() + مدة * 1000;
            db.prepare("INSERT INTO التذكيرات (المستخدم, القناة, الرسالة, الوقت, التكرار) VALUES (?, ?, ?, ?, ?)")
                .run(user.id, channel.id, رسالة, String(الوقت), مدة);
            return التفاعل.editReply({ content: `✅ سيتم تذكيرك كل ${مدة} ثانية.` });
        }
    }

    // ================== أمر العشيرة ==================
    if (commandName === 'عشيرة') {
        const الفرع = options.getSubcommand();
        if (الفرع === 'إنشاء') {
            const الاسم = options.getString('الاسم');
            const موجود = db.prepare("SELECT * FROM العشائر WHERE السيرفر = ? AND الاسم = ?").get(guild.id, الاسم);
            if (موجود) return التفاعل.editReply({ content: '❌ هذه العشيرة موجودة.' });
            db.prepare("INSERT INTO العشائر (السيرفر, الاسم, المالك, الاعضاء) VALUES (?, ?, ?, ?)")
                .run(guild.id, الاسم, user.id, JSON.stringify([user.id]));
            تسجيل_حدث(guild.id, 'عشيرة', `${user.tag} أنشأ عشيرة ${الاسم}`, 0x00BFFF);
            return التفاعل.editReply({ content: `✅ تم إنشاء عشيرة **${الاسم}**` });
        }
        if (الفرع === 'معلومات') {
            const الاسم = options.getString('الاسم');
            const صف = db.prepare("SELECT * FROM العشائر WHERE السيرفر = ? AND الاسم = ?").get(guild.id, الاسم);
            if (!صف) return التفاعل.editReply({ content: '❌ العشيرة غير موجودة.' });
            const الاعضاء = JSON.parse(صف.الاعضاء);
            const ايمبد = new EmbedBuilder().setTitle(`🏴 عشيرة ${صف.الاسم}`).setColor(0xFF0000)
                .addFields(
                    { name: 'المالك', value: `<@${صف.المالك}>`, inline: true },
                    { name: 'الأعضاء', value: الاعضاء.map(id => `<@${id}>`).join(', ') || 'لا يوجد', inline: false },
                    { name: 'المستوى', value: String(صف.المستوى), inline: true }
                );
            return التفاعل.editReply({ embeds: [ايمبد] });
        }
        if (الفرع === 'دعوة') {
            const عضو = options.getUser('عضو');
            const صف = db.prepare("SELECT المالك, الاعضاء FROM العشائر WHERE السيرفر = ? AND المالك = ?").get(guild.id, user.id);
            if (!صف) return التفاعل.editReply({ content: '❌ أنت لست مالك عشيرة.' });
            const الاعضاء = JSON.parse(صف.الاعضاء);
            if (الاعضاء.includes(عضو.id)) return التفاعل.editReply({ content: `❌ ${عضو.tag} بالفعل في العشيرة.` });
            الاعضاء.push(عضو.id);
            db.prepare("UPDATE العشائر SET الاعضاء = ? WHERE السيرفر = ? AND المالك = ?").run(JSON.stringify(الاعضاء), guild.id, user.id);
            return التفاعل.editReply({ content: `✅ تمت دعوة ${عضو.tag} إلى العشيرة.` });
        }
    }

    // ================== أمر المزرعة ==================
    if (commandName === 'مزرعة') {
        const الفرع = options.getSubcommand();
        if (الفرع === 'زرع') {
            const محصول = options.getString('محصول');
            const اوقات = { قمح: 60, ذرة: 120, طماطم: 180, بطاطس: 240 };
            const الان = Date.now();
            const جاهز = الان + اوقات[محصول] * 1000;
            db.prepare("INSERT INTO المزارع (المستخدم, السيرفر, المحصول, وقت_الزرع, وقت_الحصاد) VALUES (?, ?, ?, ?, ?)")
                .run(user.id, guild.id, محصول, String(الان), String(جاهز));
            return التفاعل.editReply({ content: `🌱 زرعت **${محصول}**، ستكون جاهزة بعد ${اوقات[محصول]} ثانية.` });
        }
        if (الفرع === 'حصاد') {
            const صف = db.prepare("SELECT المحصول, وقت_الحصاد FROM المزارع WHERE المستخدم = ? AND السيرفر = ? AND الحالة = 'نمو'").get(user.id, guild.id);
            if (!صف) return التفاعل.editReply({ content: '❌ ليس لديك أي محصول.' });
            const الان = Date.now();
            if (الان < parseInt(صف.وقت_الحصاد)) {
                const متبقي = Math.ceil((parseInt(صف.وقت_الحصاد) - الان) / 1000);
                return التفاعل.editReply({ content: `⏳ المحصول جاهز بعد ${متبقي} ثانية.` });
            }
            const مكافآت = { قمح: 10, ذرة: 20, طماطم: 30, بطاطس: 40 };
            const المبلغ = مكافآت[صف.المحصول] || 10;
            تحديث_الرصيد(user.id, guild.id, المبلغ);
            db.prepare("UPDATE المزارع SET الحالة = 'محصود' WHERE المستخدم = ? AND السيرفر = ?").run(user.id, guild.id);
            return التفاعل.editReply({ content: `✅ حصدت **${صف.المحصول}** وحصلت على **${المبلغ}** عملة!` });
        }
    }

    // ================== أمر المزاد ==================
    if (commandName === 'مزاد') {
        const الفرع = options.getSubcommand();
        if (الفرع === 'إنشاء') {
            const العنصر = options.getString('عنصر');
            const سعر_بدء = options.getInteger('سعر_بدء');
            const انتهاء = Date.now() + 3600000;
            db.prepare("INSERT INTO المزادات (السيرفر, العنصر, البائع, السعر_البدئي, السعر_الحالي, وقت_الانتهاء) VALUES (?, ?, ?, ?, ?, ?)")
                .run(guild.id, العنصر, user.id, سعر_بدء, سعر_بدء, String(انتهاء));
            تسجيل_حدث(guild.id, 'مزاد', `${user.tag} بدأ مزاداً لـ ${العنصر}`, 0xFFD700);
            return التفاعل.editReply({ content: `🔨 تم بدء مزاد لـ **${العنصر}** بسعر ${سعر_بدء} عملة.` });
        }
        if (الفرع === 'مزايدة') {
            const معرف = options.getInteger('معرف');
            const مبلغ = options.getInteger('مبلغ');
            const صف = db.prepare("SELECT العنصر, السعر_الحالي, البائع FROM المزادات WHERE id = ? AND الحالة = 'نشط'").get(معرف);
            if (!صف) return التفاعل.editReply({ content: '❌ المزاد غير موجود.' });
            if (مبلغ <= صف.السعر_الحالي) return التفاعل.editReply({ content: `❌ المبلغ يجب أن يزيد عن ${صف.السعر_الحالي}.` });
            if (user.id === صف.البائع) return التفاعل.editReply({ content: '❌ لا يمكنك المزايدة على عنصرك.' });
            db.prepare("UPDATE المزادات SET السعر_الحالي = ?, المزايد = ? WHERE id = ?").run(مبلغ, user.id, معرف);
            return التفاعل.editReply({ content: `✅ تم المزايدة بـ **${مبلغ}** عملة على **${صف.العنصر}**.` });
        }
    }

    // ================== أمر الأوامر المخصصة ==================
    if (commandName === 'أوامر') {
        const الفرع = options.getSubcommand();
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return التفاعل.editReply({ content: '❌ تحتاج صلاحية مدير.', ephemeral: true });
        }
        if (الفرع === 'إضافة') {
            const الاسم = options.getString('الاسم');
            const الرد = options.getString('الرد');
            db.prepare("INSERT OR REPLACE INTO الاوامر_المخصصة (السيرفر, الاسم, الرد) VALUES (?, ?, ?)")
                .run(guild.id, الاسم.toLowerCase(), الرد);
            return التفاعل.editReply({ content: `✅ تم إضافة الأمر /${الاسم}` });
        }
        if (الفرع === 'حذف') {
            const الاسم = options.getString('الاسم');
            db.prepare("DELETE FROM الاوامر_المخصصة WHERE السيرفر = ? AND الاسم = ?").run(guild.id, الاسم.toLowerCase());
            return التفاعل.editReply({ content: `✅ تم حذف الأمر /${الاسم}` });
        }
        if (الفرع === 'قائمة') {
            const صفوف = db.prepare("SELECT الاسم, الرد FROM الاوامر_المخصصة WHERE السيرفر = ?").all(guild.id);
            if (!صفوف || صفوف.length === 0) return التفاعل.editReply({ content: '📭 لا توجد أوامر مخصصة.' });
            const قائمة = صفوف.map(ص => `/${ص.الاسم} - ${ص.الرد}`).join('\n');
            return التفاعل.editReply({ content: `📋 الأوامر المخصصة:\n${قائمة}` });
        }
    }

    // ================== أمر المالك ==================
    if (commandName === 'مالك') {
        const معرف_المالك = '464646868953956353';
        if (user.id !== معرف_المالك) {
            return التفاعل.editReply({ content: '❌ هذا الأمر مقيد للمالك فقط.', ephemeral: true });
        }
        const الفرع = options.getSubcommand();
        if (الفرع === 'تقييم') {
            const كود = options.getString('كود');
            try {
                const نتيجة = eval(كود);
                return التفاعل.editReply({ content: `📊 النتيجة: \`\`\`js\n${نتيجة}\n\`\`\`` });
            } catch (خطأ) {
                return التفاعل.editReply({ content: `❌ خطأ: ${خطأ.message}` });
            }
        }
        if (الفرع === 'إعادة_تحميل') {
            await تسجيل_الاوامر();
            return التفاعل.editReply({ content: '✅ تم إعادة تحميل الأوامر.' });
        }
        if (الفرع === 'إحصاءات') {
            const عدد_السيرفرات = client.guilds.cache.size;
            const عدد_الأعضاء = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
            const عدد_الأوامر = الاوامر.length;
            const ايمبد = new EmbedBuilder()
                .setTitle('📊 إحصاءات البوت')
                .setColor(0x00BFFF)
                .addFields(
                    { name: 'عدد السيرفرات', value: String(عدد_السيرفرات), inline: true },
                    { name: 'عدد الأعضاء', value: String(عدد_الأعضاء), inline: true },
                    { name: 'عدد الأوامر', value: String(عدد_الأوامر), inline: true },
                    { name: 'وقت التشغيل', value: moment.duration(process.uptime(), 'seconds').humanize(), inline: true }
                );
            return التفاعل.editReply({ embeds: [ايمبد] });
        }
    }

    // ================== أمر الاستطلاع ==================
    if (commandName === 'استطلاع') {
        const سؤال = options.getString('سؤال');
        const خيارات_نص = options.getString('خيارات');
        const خيارات = خيارات_نص.split(',').map(خ => خ.trim()).filter(خ => خ.length > 0);
        if (خيارات.length < 2) return التفاعل.editReply({ content: '❌ تحتاج إلى خيارين على الأقل.' });
        if (خيارات.length > 10) return التفاعل.editReply({ content: '❌ لا يمكن أن يتجاوز عدد الخيارات 10.' });
        const ايموجيات = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        const وصف = خيارات.map((خ, i) => `${ايموجيات[i]} ${خ}`).join('\n');
        const ايمبد = new EmbedBuilder().setTitle(`📊 استطلاع: ${سؤال}`).setDescription(وصف).setColor(0x00FF00);
        const رسالة = await channel.send({ embeds: [ايمبد] });
        for (let i = 0; i < خيارات.length; i++) {
            await رسالة.react(ايموجيات[i]);
        }
        db.prepare("INSERT INTO الاستطلاعات (السيرفر, القناة, الرسالة, السؤال, الخيارات) VALUES (?, ?, ?, ?, ?)")
            .run(guild.id, channel.id, رسالة.id, سؤال, JSON.stringify(خيارات));
        return التفاعل.editReply({ content: '✅ تم إنشاء الاستطلاع!' });
    }

    // ================== أمر الهدية ==================
    if (commandName === 'هدية') {
        const الفرع = options.getSubcommand();
        if (الفرع === 'إنشاء') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return التفاعل.editReply({ content: '❌ تحتاج صلاحية مدير.', ephemeral: true });
            }
            const مدة = options.getInteger('مدة') * 1000;
            const فائزون = options.getInteger('فائزون');
            const جائزة = options.getString('جائزة');
            const ايمبد = new EmbedBuilder()
                .setTitle('🎁 هدية جديدة!')
                .setDescription(`الجائزة: ${جائزة}\nالفائزون: ${فائزون}`)
                .setColor(0xFFD700)
                .setFooter({ text: 'تفاعل بـ 🎉 للمشاركة' });
            const رسالة = await channel.send({ embeds: [ايمبد] });
            await رسالة.react('🎉');
            const وقت_الانتهاء = Date.now() + مدة;
            db.prepare("INSERT INTO الهدايا (السيرفر, القناة, الرسالة, الجائزة, وقت_الانتهاء, الفائزون, المشاركون) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .run(guild.id, channel.id, رسالة.id, جائزة, String(وقت_الانتهاء), فائزون, '[]');
            setTimeout(async () => {
                const صف = db.prepare("SELECT المشاركون FROM الهدايا WHERE الرسالة = ?").get(رسالة.id);
                if (!صف) return;
                const مشاركون = JSON.parse(صف.المشاركون);
                if (مشاركون.length === 0) return channel.send('❌ لا يوجد مشاركون في الهدية.');
                const مختارون = [];
                const خلط = مشاركون.sort(() => 0.5 - Math.random());
                for (let i = 0; i < Math.min(فائزون, خلط.length); i++) مختارون.push(خلط[i]);
                const منشن = مختارون.map(id => `<@${id}>`).join(', ');
                channel.send(`🎉 الفائزون في هدية ${جائزة}: ${منشن}`);
                db.prepare("DELETE FROM الهدايا WHERE الرسالة = ?").run(رسالة.id);
            }, مدة);
            return التفاعل.editReply({ content: '✅ تم إنشاء الهدية!' });
        }
    }
});

// ================== أحداث العضوية ==================
client.on(Events.GuildMemberAdd, async (عضو) => {
    // الترحيب
    const ترحيب = db.prepare("SELECT القناة, الرسالة, الصورة FROM الترحيب WHERE السيرفر = ?").get(عضو.guild.id);
    if (ترحيب) {
        const قناة = عضو.guild.channels.cache.get(ترحيب.القناة);
        if (قناة) {
            const رسالة = ترحيب.الرسالة.replace(/{user}/g, عضو.toString()).replace(/{server}/g, عضو.guild.name);
            const ايمبد = new EmbedBuilder()
                .setTitle('👋 مرحباً!')
                .setDescription(رسالة)
                .setColor(0x00FF00)
                .setThumbnail(عضو.displayAvatarURL());
            if (ترحيب.الصورة) ايمبد.setImage(ترحيب.الصورة);
            قناة.send({ embeds: [ايمبد] });
        }
    }
    // الأدوار التلقائية
    const ادوار = db.prepare("SELECT الدور FROM الادوار_التلقائية WHERE السيرفر = ?").all(عضو.guild.id);
    for (const د of ادوار) {
        const دور = عضو.guild.roles.cache.get(د.الدور);
        if (دور) عضو.roles.add(دور).catch(() => {});
    }
    // السجلات
    تسجيل_حدث(عضو.guild.id, 'عضوية', `${عضو.user.tag} انضم إلى السيرفر.`, 0x00FF00);
});

client.on(Events.GuildMemberRemove, (عضو) => {
    // الوداع
    const وداع = db.prepare("SELECT القناة, الرسالة, الصورة FROM الوداع WHERE السيرفر = ?").get(عضو.guild.id);
    if (وداع) {
        const قناة = عضو.guild.channels.cache.get(وداع.القناة);
        if (قناة) {
            const رسالة = وداع.الرسالة.replace(/{user}/g, عضو.user.tag).replace(/{server}/g, عضو.guild.name);
            const ايمبد = new EmbedBuilder()
                .setTitle('👋 وداعاً!')
                .setDescription(رسالة)
                .setColor(0xFF0000)
                .setThumbnail(عضو.displayAvatarURL());
            if (وداع.الصورة) ايمبد.setImage(وداع.الصورة);
            قناة.send({ embeds: [ايمبد] });
        }
    }
    // السجلات
    تسجيل_حدث(عضو.guild.id, 'عضوية', `${عضو.user.tag} غادر السيرفر.`, 0xFF0000);
});

// ================== نظام الحماية المتقدم ==================
const ذاكرة_الرسائل = new Collection();

client.on(Events.MessageCreate, async (رسالة) => {
    if (رسالة.author.bot || !رسالة.guild) return;

    // نظام مكافحة السبام
    const اعدادات_السبام = db.prepare("SELECT حد_السبام FROM الحماية WHERE السيرفر = ?").get(رسالة.guild.id);
    const حد = اعدادات_السبام ? اعدادات_السبام.حد_السبام : 5;
    const مفتاح = `${رسالة.author.id}-${رسالة.guild.id}`;
    const الان = Date.now();
    if (!ذاكرة_الرسائل.has(مفتاح)) ذاكرة_الرسائل.set(مفتاح, []);
    const طوابع = ذاكرة_الرسائل.get(مفتاح);
    طوابع.push(الان);
    const حديثة = طوابع.filter(ت => الان - ت < 5000);
    ذاكرة_الرسائل.set(مفتاح, حديثة);
    if (حديثة.length > حد) {
        try {
            await رسالة.author.timeout(60000, 'سبام');
            const دور_الكتم = db.prepare("SELECT الدور FROM ادوار_الكتم WHERE السيرفر = ?").get(رسالة.guild.id);
            if (دور_الكتم) {
                const دور = رسالة.guild.roles.cache.get(دور_الكتم.الدور);
                if (دور) await رسالة.member.roles.add(دور);
            }
            تسجيل_حدث(رسالة.guild.id, 'سبام', `${رسالة.author.tag} تم كتمه بسبب السبام`, 0xFF0000);
            await رسالة.channel.send(`🔇 تم كتم ${رسالة.author} بسبب السبام.`);
        } catch (خطأ) {}
    }

    // نظام المستويات
    if (!رسالة.content.startsWith('/')) {
        const خبرة = Math.floor(Math.random() * 15) + 5;
        اضافة_خبرة(رسالة.author.id, رسالة.guild.id, خبرة);
        تحديث_احصائية(رسالة.author.id, رسالة.guild.id, 'الرسائل', 1);
    }
});

// ================== سجلات الرسائل ==================
client.on(Events.MessageDelete, (رسالة) => {
    if (!رسالة.guild || رسالة.author?.bot) return;
    تسجيل_حدث(رسالة.guild.id, 'حذف_رسالة', `${رسالة.author?.tag} حذف: ${رسالة.content?.slice(0, 100) || '[ميديا]'}`, 0xFF6347);
});

client.on(Events.MessageUpdate, (قديمة, جديدة) => {
    if (!قديمة.guild || قديمة.author?.bot || قديمة.content === جديدة.content) return;
    تسجيل_حدث(قديمة.guild.id, 'تعديل_رسالة', `${قديمة.author?.tag} عدل: ${قديمة.content?.slice(0, 50)} -> ${جديدة.content?.slice(0, 50)}`, 0xFFA500);
});

// ================== أحداث التفاعلات ==================
client.on(Events.InteractionCreate, async (تفاعل) => {
    if (تفاعل.isButton()) {
        if (تفاعل.customId === 'اغلاق_تذكرة') {
            if (!تفاعل.channel.name.startsWith('تذكرة-')) {
                return تفاعل.reply({ content: '❌ هذه ليست قناة تذكرة.', ephemeral: true });
            }
            db.prepare("UPDATE التذاكر SET الحالة = 'مغلقة' WHERE القناة = ?").run(تفاعل.channel.id);
            await تفاعل.reply('🔒 سيتم حذف التذكرة خلال 5 ثوانٍ.');
            setTimeout(() => تفاعل.channel.delete().catch(() => {}), 5000);
        }
        if (تفاعل.customId === 'تولي_تذكرة') {
            await تفاعل.reply({ content: '📌 تم تولي التذكرة.', ephemeral: true });
            await تفاعل.channel.send(`📌 تم تولي التذكرة بواسطة ${تفاعل.user.tag}`);
        }
        if (تفاعل.customId === 'زر_التحقق') {
            const صف = db.prepare("SELECT الدور FROM ادوار_التحقق WHERE السيرفر = ?").get(تفاعل.guild.id);
            if (صف) {
                const دور = تفاعل.guild.roles.cache.get(صف.الدور);
                if (دور) {
                    await تفاعل.member.roles.add(دور);
                    await تفاعل.reply({ content: `✅ تم التحقق ومنحك دور ${دور.name}`, ephemeral: true });
                }
            }
        }
    }

    if (تفاعل.isStringSelectMenu()) {
        if (تفاعل.customId === 'تذكرة_القائمة') {
            const القسم = تفاعل.values[0];
            const الموضوع = `طلب من القائمة - ${القسم}`;
            const اعدادات = db.prepare("SELECT الفئة, دور_الدعم, قناة_السجلات FROM اعدادات_التذاكر WHERE السيرفر = ?").get(تفاعل.guild.id);
            if (!اعدادات) {
                return تفاعل.reply({ content: '❌ نظام التذاكر غير مضبوط.', ephemeral: true });
            }
            const فئة = تفاعل.guild.channels.cache.get(اعدادات.الفئة);
            if (!فئة) {
                return تفاعل.reply({ content: '❌ الفئة غير موجودة.', ephemeral: true });
            }
            const صلاحيات = [
                { id: تفاعل.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: تفاعل.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ];
            const دور_الدعم = تفاعل.guild.roles.cache.get(اعدادات.دور_الدعم);
            if (دور_الدعم) {
                صلاحيات.push({ id: دور_الدعم.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
            }
            const اسم_القناة = `تذكرة-${تفاعل.user.username}`;
            const قناة_تذكرة = await تفاعل.guild.channels.create({
                name: اسم_القناة,
                type: ChannelType.GuildText,
                parent: فئة,
                permissionOverwrites: صلاحيات,
                topic: `📌 ${القسم} - ${الموضوع}`
            });
            db.prepare("INSERT INTO التذاكر (السيرفر, القناة, المستخدم, الموضوع, الحالة, التاريخ, القسم, الاولوية) VALUES (?, ?, ?, ?, 'مفتوحة', datetime('now'), ?, 'عادية')")
                .run(تفاعل.guild.id, قناة_تذكرة.id, تفاعل.user.id, الموضوع, القسم);
            const ايمبد = new EmbedBuilder()
                .setTitle('🎫 تذكرة جديدة')
                .setDescription(`**الموضوع:** ${الموضوع}\n**القسم:** ${القسم}`)
                .setColor(0x00BFFF)
                .addFields(
                    { name: 'أنشأها', value: تفاعل.user.tag, inline: true },
                    { name: 'الحالة', value: '🟢 مفتوحة', inline: true }
                );
            const صف = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('اغلاق_تذكرة').setLabel('🔒 إغلاق التذكرة').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('تولي_تذكرة').setLabel('📌 تولي').setStyle(ButtonStyle.Primary)
                );
            await قناة_تذكرة.send({ content: `<@${تفاعل.user.id}>`, embeds: [ايمبد], components: [صف] });
            await تفاعل.reply({ content: `✅ تم فتح تذكرة: ${قناة_تذكرة}`, ephemeral: true });
        }
    }
});

// ================== التذكيرات ==================
setInterval(() => {
    const الان = Date.now();
    const تذكيرات = db.prepare("SELECT id, المستخدم, القناة, الرسالة, الوقت, التكرار FROM التذكيرات WHERE الوقت <= ?").all(String(الان));
    for (const ت of تذكيرات) {
        const مستخدم = client.users.cache.get(ت.المستخدم);
        const قناة = client.channels.cache.get(ت.القناة);
        if (مستخدم) مستخدم.send(`⏰ تذكير: ${ت.الرسالة}`).catch(() => {});
        if (قناة) قناة.send(`⏰ <@${ت.المستخدم}> تذكير: ${ت.الرسالة}`).catch(() => {});
        if (ت.التكرار > 0) {
            const وقت_جديد = الان + ت.التكرار * 1000;
            db.prepare("UPDATE التذكيرات SET الوقت = ? WHERE id = ?").run(String(وقت_جديد), ت.id);
        } else {
            db.prepare("DELETE FROM التذكيرات WHERE id = ?").run(ت.id);
        }
    }
}, 30000);

// ================== إحصائيات الصوت ==================
setInterval(() => {
    client.guilds.cache.forEach(سيرفر => {
        سيرفر.members.cache.forEach(عضو => {
            if (عضو.voice.channel) {
                تحديث_احصائية(عضو.id, سيرفر.id, 'الصوت', 1);
            }
        });
    });
}, 60000);

// ================== تشغيل البوت ==================
client.login(TOKEN);
