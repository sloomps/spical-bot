require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Collection, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    TextInputBuilder, 
    TextInputStyle, 
    ModalBuilder, 
    ChannelType, 
    PermissionFlagsBits, 
    StringSelectMenuBuilder 
} = require('discord.js');
const mongoose = require('mongoose');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    StreamType 
} = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// استيراد موديل قاعدة البيانات
const GuildData = require('./models/guildSchema');

// 👑 معرّف المالك المطلق ذو الحصانة الكاملة
const BOT_OWNER_ID = '1507841424186675220'; 

const antiSpamMap = new Map();
const invitesCache = new Map();
let globalAntiRaid = false;
let globalAntiBot = false;

// خريطة لتخزين مشغلات الصوت للرومات
const audioPlayers = new Map();

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بقاعدة بيانات MongoDB بنجاح!'))
    .catch((err) => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

client.once('ready', async () => {
    console.log(`🚀 تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
    
    const commands = [
        { 
            name: 'تثبيت-التذاكر-المتقدمة', 
            description: '⚙️ إعداد نظام تذاكر متطور بأقسام وصور مخصصة من اختيارك',
            options: [
                { name: 'العنوان', description: 'عنوان الإمبيد الرئيسي', type: 3, required: true },
                { name: 'الوصف', description: 'وصف أو إرشادات التكت', type: 3, required: true },
                { name: 'الصورة', description: 'رابط صورة أو بنر للتكت (رابط URL)', type: 3, required: true },
                { name: 'الأقسام', description: 'الأقسام مفصولة بفاصلة (مثال: دعم فني, شكاوى)', type: 3, required: true }
            ]
        },
        { name: 'تثبيت-الترحيب', description: '👋 تحديد قناة إرسال رسائل الترحيب المتطورة بالأعضاء الجدد', options: [{ name: 'القناة', description: 'اختر روم الترحيب', type: 7, required: true }] },
        { name: 'تثبيت-السجلات', description: 'تحديد قناة إرسال لوقات السيرفر المتطورة', options: [{ name: 'القناة', description: 'اختر قناة اللوج', type: 7, required: true }] },
        { name: 'تثبيت-قناة-المستويات', description: '📊 تحديد القناة المخصصة لإرسال رسائل ترقية ليفل الأعضاء', options: [{ name: 'القناة', description: 'اختر روم ليفل الأعضاء', type: 7, required: true }] },
        { name: 'المستوى', description: 'عرض مستواك الحالي ونقاط الخبرة الخاصة بك' },
        { name: 'الصدارة', description: 'عرض قائمة أعلى 10 أعضاء متفاعلين في السيرفر' },
        { name: 'يومي', description: 'استلام مكافأتك المالية اليومية' },
        { name: 'حظر', description: '🔨 حظر عضو من السيرفر', options: [{ name: 'العضو', description: 'العضو المراد حظره', type: 6, required: true }, { name: 'السبب', description: 'السبب', type: 3 }] },
        { name: 'فك-الحظر', description: '🔓 فك الحظر عن عضو', options: [{ name: 'المعرف', description: 'ID الشخص المحظور', type: 3, required: true }] },
        { name: 'طرد', description: '👢 طرد عضو من السيرفر', options: [{ name: 'العضو', description: 'العضو المراد طرده', type: 6, required: true }, { name: 'السبب', description: 'السبب', type: 3 }] },
        { name: 'كتم', description: '🔇 كتم عضو (Timeout)', options: [{ name: 'العضو', description: 'العضو', type: 6, required: true }, { name: 'المدة', description: 'المدة بالدقائق', type: 4, required: true }, { name: 'السبب', description: 'السبب', type: 3 }] },
        { name: 'فك-الكتم', description: '🔊 فك الكتم عن عضو', options: [{ name: 'العضو', description: 'العضو', type: 6, required: true }] },
        { name: 'مسح', description: '🧹 مسح عدد معين من الرسائل', options: [{ name: 'العدد', description: 'عدد الرسائل (1-100)', type: 4, required: true }] },
        { name: 'تحذير', description: '⚠️ تحذير عضو وتسجيله بقاعدة البيانات', options: [{ name: 'العضو', description: 'العضو', type: 6, required: true }, { name: 'السبب', description: 'السبب', type: 3, required: true }] },
        { name: 'التحذيرات', description: '📋 عرض سجل تحذيرات عضو', options: [{ name: 'العضو', description: 'العضو', type: 6, required: true }] },
        { name: 'مسح-التحذيرات', description: '🧼 مسح جميع تحذيرات عضو', options: [{ name: 'العضو', description: 'العضو', type: 6, required: true }] },
        { name: 'قفل', description: '🔒 قفل الروم الحالي لمنع الكتابة' },
        { name: 'فتح', description: '🔓 فتح الروم الحالي للسماح بالكتابة' },
        { name: 'الوضع-البطيء', description: '⏳ وضع وقت انتظار للرسائل في الروم', options: [{ name: 'الثواني', description: 'عدد الثواني', type: 4, required: true }] },
        { name: 'إضافة-رتبة', description: '➕ إعطاء رتبة لعضو', options: [{ name: 'العضو', description: 'العضو', type: 6, required: true }, { name: 'الرتبة', description: 'الرتبة', type: 8, required: true }] },
        { name: 'إزالة-رتبة', description: '➖ سحب رتبة من عضو', options: [{ name: 'العضو', description: 'العضو', type: 6, required: true }, { name: 'الرتبة', description: 'الرتبة', type: 8, required: true }] },
        { name: 'اسم-مستعار', description: '🏷️ تغيير اسم عضو مستعار بقناة الشات', options: [{ name: 'العضو', description: 'العضو', type: 6, required: true }, { name: 'الاسم', description: 'الاسم الجديد', type: 3, required: true }] },
        { name: 'تطهير', description: '☢️ تصفية الروم الحالي وإعادة إنشائه نظيفاً تماماً' },
        { name: 'إخفاء', description: '🙈 إخفاء الروم الحالي عن الأعضاء' },
        { name: 'إظهار', description: '👀 إظهار الروم الحالي للأعضاء' },
        { name: 'رتبة-مؤقتة', description: '⏱️ إعطاء رتبة مؤقتة لعضو تزول تلقائياً', options: [{ name: 'العضو', description: 'العضو', type: 6, required: true }, { name: 'الرتبة', description: 'الرتبة', type: 8, required: true }, { name: 'الدقائق', description: 'المدة بالدقائق', type: 4, required: true }] },
        { name: 'تحديث-البوت', description: '🔄 إعادة تشغيل أنظمة البوت برمجياً (للإدارة العليا فقط)' },
        { name: 'قفل-شامل', description: '🚨 قفل اضطراري شامل لكافة رومات السيرفر لحمايته من التخريب' },
        { name: 'فتح-شامل', description: '🟢 إلغاء القفل الاضطراري وإعادة فتح رومات السيرفر بالكامل' },
        { name: 'كتم-الرتبة', description: '🔇 منع رتبة معينة من التحدث in هذا الروم فقط', options: [{ name: 'الرتبة', description: 'الرتبة المستهدفة', type: 8, required: true }] },
        { name: 'تحدث-الرتبة', description: '🔊 إعادة السماح للرتبة بالتحدث في هذا الروم', options: [{ name: 'الرتبة', description: 'الرتبة المستهدفة', type: 8, required: true }] },
        { name: 'تجريد-الرتب', description: '🛡️ سحب كافة رتب العضو فوراً في حال الاشتباه باختراقه', options: [{ name: 'العضو', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'حظر-جماعي', description: '💥 حظر جماعي لعدة حسابات بواسطة الـ IDs يفصل بينهم مسافة', options: [{ name: 'المعرفات', description: 'قائمة المعرفات متبوعة بمسافات', type: 3, required: true }, { name: 'السبب', description: 'السبب', type: 3 }] },
        { name: 'حظر-ناعم', description: '🧹 حظر العضو ومسح رسائله لآخر 7 أيام ثم فك الحظر تلقائياً', options: [{ name: 'العضو', description: 'العضو', type: 6, required: true }, { name: 'السبب', description: 'السبب', type: 3 }] },
        { name: 'إنشاء-رتبة', description: '🛠️ إنشاء رتبة جديدة بالسيرفر سريعاً', options: [{ name: 'الاسم', description: 'اسم الرتبة', type: 3, required: true }, { name: 'اللون', description: 'لون الرتبة بالهكس مثل #ff0000', type: 3 }] },
        { name: 'حذف-رتبة', description: '🗑️ حذف رتبة من السيرفر نهائياً', options: [{ name: 'الرتبة', description: 'الرتبة المراد حذفها', type: 8, required: true }] },
        { name: 'إنشاء-قناة', description: '📁 إنشاء قناة نصية أو صوتية جديدة', options: [{ name: 'الاسم', description: 'اسم القناة', type: 3, required: true }, { name: 'النوع', description: 'نوع القناة', type: 4, required: true, choices: [{ name: 'Text Channel', value: 0 }, { name: 'Voice Channel', value: 2 }] }] },
        { name: 'حذف-قناة', description: '🗑️ حذف قناة حالية من السيرفر', options: [{ name: 'القناة', description: 'اختر القناة', type: 7, required: true }] },
        { name: 'تبطئة-الكل', description: '⏳ تفعيل وضع التباطؤ (5 ثوانٍ) في كافة رومات السيرفر دفعة واحدة' },
        { name: 'إلغاء-تبطئة-الكل', description: '🛑 إلغاء وضع التباطؤ تماماً من جميع رومات السيرفر' },
        { name: 'حجر-صحي', description: '☣️ نقل العضو إلى حجر أمني (سحب رتبه ومنعه من القنوات إلا روم التحقيق)', options: [{ name: 'العضو', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'فك-الحجر', description: '🟢 إخراج العضو من الحجر الأمني وإعادة رتبه', options: [{ name: 'العضو', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'تنظيف-البوتات', description: '🤖 تنظيف الشات وحذف رسائل البوتات فقط للحفاظ على المظهر العام', options: [{ name: 'العدد', description: 'عدد الرسائل للفحص (1-100)', type: 4, required: true }] },
        { name: 'عرض-الصلاحيات', description: '🔍 كشف وفحص كامل صلاحيات عضو معين داخل هذا السيرفر لأسباب أمنية', options: [{ name: 'العضو', description: 'العضو', type: 6, required: true }] },
        { name: 'تشغيل-مضاد-الهجمات', description: '🔴 تفعيل الحماية المطلقة (منع دخول أي عضو جديد للسيرفر نهائياً حالياً)' },
        { name: 'إيقاف-مضاد-الهجمات', description: '🟢 إيقاف وضع الحماية المطلقة والسماح بدخول الأعضاء بشكل طبيعي' },
        { name: 'معلومات-السيرفر', description: '📊 عرض تقرير أمني وتقني كامل وشامل عن إحصائيات وحماية السيرفر' },
        { name: 'قفل-الصوتي', description: '🔒 قفل الروم الصوتي الحالي ومنع الدخول إليه', options: [{ name: 'القناة', description: 'اختر الروم الصوتي', type: 7, required: true }] },
        { name: 'فتح-الصوتي', description: '🔓 فتح الروم الصوتي الحالي للسماح بالدخول', options: [{ name: 'القناة', description: 'اختر الروم الصوتي', type: 7, required: true }] },
        { name: 'كتم-الصوتي', description: '🔇 كتم صوت العضو داخل الروم الصوتي بالكامل', options: [{ name: 'العضو', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'فك-كتم-الصوتي', description: '🔊 إلغاء كتم صوت العضو داخل الروم الصوتي', options: [{ name: 'العضو', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'تعطيل-السماعة', description: '🎧 تعطيل سماع العضو (Deafen) في الرومات الصوتية', options: [{ name: 'العضو', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'تفعيل-السماعة', description: '🎵 إعادة تفعيل سماع العضو في الروم الصوتي', options: [{ name: 'العضو', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'فصل-الصوتي', description: '🚫 طرد عضو محدد وفصله من الروم الصوتي الحالي فوراً', options: [{ name: 'العضو', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'تبطئة-الصوتي', description: '⏳ تفعيل وضع التباطؤ لإرسال الكلمات بالروم الصوتي', options: [{ name: 'القناة', description: 'الروم الصوتي', type: 7, required: true }, { name: 'الثواني', description: 'عدد الثواني', type: 4, required: true }] },
        { name: 'حدد-الصوتي', description: '👥 تحديد الحد الأقصى للأعضاء المسموح بدخولهم للروم الصوتي', options: [{ name: 'القناة', description: 'الروم الصوتي', type: 7, required: true }, { name: 'الحد', description: 'العدد الأقصى (0 لإلغاء الحد)', type: 4, required: true }] },
        { name: 'إخفاء-الصوتي', description: '🙈 إخفاء الروم الصوتي المكتوب عن الأعضاء في السيرفر', options: [{ name: 'القناة', description: 'الروم الصوتي', type: 7, required: true }] },
        { name: 'إظهار-الصوتي', description: '👀 إظهار الروم الصوتي المخفي للأعضاء في السيرفر', options: [{ name: 'القناة', description: 'الروم الصوتي', type: 7, required: true }] },
        { name: 'تصفير-التحذيرات', description: '🧼 مسح كافة التحذيرات المسجلة لجميع أعضاء السيرفر نهائياً' },
        { name: 'حظر-مؤقت', description: '⏳ حظر مؤقت لعضو من السيرفر يزول تلقائياً بعد الوقت المحدد', options: [{ name: 'العضو', description: 'العضو', type: 6, required: true }, { name: 'المدة', description: 'المدة بالساعات', type: 4, required: true }, { name: 'السبب', description: 'السبب', type: 3 }] },
        { name: 'إلغاء-التباطئة', description: '🛑 إيقاف وضع التباطؤ تماماً في الروم الحالي دون انتظار' },
        { name: 'رتبة-للجميع', description: '👥 إعطاء رتبة معينة لجميع أعضاء السيرفر دفعة واحدة (للأدمن)', options: [{ name: 'الرتبة', description: 'الرتبة المراد توزيعها', type: 8, required: true }] },
        { name: 'سحب-من-الجميع', description: '🚫 سحب رتبة معينة من جميع أعضاء السيرفر دفعة واحدة بشكل جماعي', options: [{ name: 'الرتبة', description: 'الرتبة المراد سحبها', type: 8, required: true }] },
        { name: 'استنساخ-القناة', description: '📑 استنساخ الروم الحالي بنفس الاسم والإعدادات والصلاحيات تماماً' },
        { name: 'مسح-رسائل-البوتات', description: '🧹 مسح رسائل البوتات فقط في الروم الحالي لحفظ المظهر والترتيب', options: [{ name: 'العدد', description: 'عدد الرسائل (1-100)', type: 4, required: true }] },
        { name: 'منع-البوتات', description: '🛡️ تفعيل جدار حظر ومنع دخول البوتات الخارجية غير الموثقة للسيرفر' },
        { name: 'سماح-البوتات', description: '🟢 إيقاف نظام حظر دخول البوتات الخارجية والسماح بدخولها بشكل عادي' },
        { name: 'مساعدة', description: '💡 عرض قائمة جميع أوامر البوت المتاحة وشرح كامل لوظائفها المتقدمة' },
        { name: 'تعيين-رتبة-الادارة', description: '⚙️ تعيين رتبة الإدارة العليا المسموح لها بإدارة البوت وسير العمل', options: [{ name: 'الرتبة', description: 'اختر الرتبة', type: 8, required: true }] },
        { name: 'تعيين-رتبة-المشرفين', description: '🛡️ تعيين رتبة المشرفين المسموح لهم بإصدار العقوبات والميوت', options: [{ name: 'الرتبة', description: 'اختر الرتبة', type: 8, required: true }] },
        { name: 'تعيين-رتبة-الدعم', description: '🎫 تعيين رتبة الدعم الفني الخاصة بإدارة واستلام التذاكر', options: [{ name: 'الرتبة', description: 'اختر الرتبة', type: 8, required: true }] },
        { name: 'عرض-رتب-البوت', description: '📋 استعراض رتب الحماية والإدارة الحالية التي تم ضبطها في البوت' },
        { name: 'فحص-الحصانة', description: '👑 فحص وتأكيد تفعيل جدار الحصانة المطلقة الخاص بمالك البوت' },
        { name: 'سجن-الرتبة', description: '⛔ منع رتبة كاملة من الكتابة في جميع رومات السيرفر النصية (بلاك ليست/سجن)', options: [{ name: 'الرتبة', description: 'اختر الرتبة المستهدفة لحظرها من الكتابة', type: 8, required: true }] },
        { name: 'قول', description: '🗣️ تجعل البوت يكرر الكلام الذي تكتبه خلفه بالكامل', options: [{ name: 'النص', description: 'اكتب الرسالة التي تريد من البوت قولها', type: 3, required: true }] },
        { name: 'تثبيت-الاقتراحات', description: '📌 تحديد القناة النصية المخصصة لاستقبال اقتراحات الأعضاء وإعدادها', options: [{ name: 'القناة', description: 'اختر روم الاقتراحات', type: 7, required: true }] },
        { name: 'اقتراح', description: '💡 تقديم اقتراح جديد ليتم إرساله وتصويت الأعضاء عليه بنظام متطور', options: [{ name: 'الاقتراح', description: 'اكتب تفاصيل اقتراحك هنا ليراه الجميع', type: 3, required: true }] },
        { name: 'تشغيل', description: '🎵 تشغيل الأغاني في الروم الصوتي الخاص بك بدون ديفن مع لوحة تحكم متطورة', options: [{ name: 'الرابط_أو_الاسم', description: 'رابط الأغنية من يوتيوب أو اسمها للبحث عنها', type: 3, required: true }] },
        { name: 'إرسال-إمبيد-الاقتراحات', description: '📌 إرسال الرسالة الثابتة التي تحتوي على زر كتابة الاقتراحات في الروم' },
        { 
            name: 'إرسال-إمبيد', 
            description: '📢 إرسال إمبيد مخصص ومنسق من اختيارك إلى قناة معينة',
            options: [
                { name: 'القناة', description: 'اختر الروم المراد إرسال الإمبيد بداخلها', type: 7, required: true },
                { name: 'العنوان', description: 'اكتب عنوان الإمبيد الرئيسي', type: 3, required: true },
                { name: 'الوصف', description: 'اكتب نص أو محتوى الإمبيد الكامل', type: 3, required: true },
                { name: 'اللون', description: 'كود اللون بالهكس (مثال: #ff0000) أو اتركه للافتراضي', type: 3, required: false }
            ]
        }
    ];
    
    await client.application.commands.set(commands).catch(console.error);
    console.log('🔹 تم تحديث قائمة الأوامر وتثبيتها بنجاح!');

    client.guilds.cache.forEach(async (guild) => {
        try { const firstInvites = await guild.invites.fetch(); invitesCache.set(guild.id, new Map(firstInvites.map(invite => [invite.code, invite.uses]))); } catch { }
    });
});

async function sendLog(guild, embed, files = []) {
    try {
        const data = await GuildData.findOne({ guildID: guild.id });
        if (!data || !data.settings || !data.settings.logChannelID) return;
        const logChannel = guild.channels.cache.get(data.settings.logChannelID);
        if (logChannel) await logChannel.send({ embeds: [embed], files: files });
    } catch (err) { console.error(err); }
}

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options, guild, member, channel, user } = interaction;

        // 🌟 تعديل أمني برمجى هام جداً: التحقق والإنشاء التلقائي لبيانات السيرفر إذا لم تكن موجودة
        let dbData = await GuildData.findOne({ guildID: guild.id });
        if (!dbData) {
            dbData = new GuildData({ 
                guildID: guild.id, 
                settings: {}, 
                moderation: { warns: [] }, 
                levels: [] 
            });
            await dbData.save();
        }
        if (!dbData.settings) {
            dbData.settings = {};
            dbData.markModified('settings');
            await dbData.save();
        }

        const botAdminRoleID = dbData.settings.botAdminRoleID;
        const botModRoleID = dbData.settings.botModRoleID;
        const botSupportRoleID = dbData.settings.botSupportRoleID;

        const isOwner = (user.id === BOT_OWNER_ID);
        const isAdmin = isOwner || member.roles.cache.has(botAdminRoleID) || member.permissions.has(PermissionFlagsBits.Administrator);
        const isMod = isAdmin || member.roles.cache.has(botModRoleID) || member.permissions.has(PermissionFlagsBits.ManageMessages);

        const targetUser = options.getMember('العضو') || options.getMember('user');
        if (targetUser && targetUser.id === BOT_OWNER_ID && !isOwner) {
            return interaction.reply({ content: '❌ خطأ أمني: هذا الحساب يمتلك حصانة المالك المطلق، لا يمكنك استخدام أوامر البوت عليه!', ephemeral: true });
        }

        const adminCommands = ['تثبيت-التذاكر-المتقدمة', 'تثبيت-الترحيب', 'تثبيت-السجلات', 'قفل-شامل', 'فتح-شامل', 'رتبة-للجميع', 'سحب-من-الجميع', 'تشغيل-مضاد-الهجمات', 'إيقاف-مضاد-الهجمات', 'منع-البوتات', 'سماح-البوتات', 'تحديث-البوت', 'تعيين-رتبة-الادارة', 'تعيين-رتبة-المشرفين', 'تعيين-رتبة-الدعم', 'تصفير-التحذيرات', 'تثبيت-قناة-المستويات', 'سجن-الرتبة', 'تثبيت-الاقتراحات', 'إرسال-إمبيد-الاقتراحات', 'إرسال-إمبيد'];
        const modCommands = ['حظر', 'فك-الحظر', 'طرد', 'كتم', 'فك-الكتم', 'مسح', 'تحذير', 'التحذيرات', 'مسح-التحذيرات', 'قفل', 'فتح', 'الوضع-البطيء', 'إضافة-رتبة', 'إزالة-رتبة', 'اسم-مستعار', 'تطهير', 'إخفاء', 'إظهار', 'رتبة-مؤقتة', 'كتم-الرتبة', 'تحدث-الرتبة', 'تجريد-الرتب', 'حظر-جماعي', 'حظر-ناعم', 'إنشاء-رتبة', 'حذف-رتبة', 'إنشاء-قناة', 'حذف-قناة', 'تبطئة-الكل', 'إلغاء-تبطئة-الكل', 'حجر-صحي', 'فك-الحجر', 'تنظيف-البوتات', 'عرض-صلاحيات', 'قفل-الصوتي', 'فتح-الصوتي', 'كتم-الصوتي', 'فك-كتم-الصوتي', 'تعطيل-السماعة', 'تفعيل-السماعة', 'فصل-الصوتي', 'تبطئة-الصوتي', 'حدد-الصوتي', 'إخفاء-الصوتي', 'إظهار-الصوتي', 'إلغاء-التباطئة', 'مسح-رسائل-البوتات', 'استنساخ-القناة', 'قول'];

        if (adminCommands.includes(commandName) && !isAdmin) {
            return interaction.reply({ content: '❌ هذا الأمر مخصص فقط لرتبة الإدارة العليا (Admin Role) أو للأشخاص المالكين لصلاحية Administrator بالسيرفر.', ephemeral: true });
        }
        if (modCommands.includes(commandName) && !isMod) {
            return interaction.reply({ content: '❌ هذا الأمر مخصص للمشرفين (Mod Role) فما فوق.', ephemeral: true });
        }

        if (commandName === 'تثبيت-الترحيب') {
            const channelOpt = options.getChannel('القناة');
            dbData.settings.welcomeChannelID = channelOpt.id;
            dbData.markModified('settings');
            await dbData.save();
            return interaction.reply({ content: `✅ تم تثبيت وتحديد روم الترحيب بنجاح في القناة: ${channelOpt}`, ephemeral: true });
        }

        if (commandName === 'تثبيت-السجلات') {
            const channelOpt = options.getChannel('القناة');
            dbData.settings.logChannelID = channelOpt.id;
            dbData.markModified('settings');
            await dbData.save();
            return interaction.reply({ content: `✅ تم تثبيت وتحديد روم سجلات اللوج بنجاح في القناة: ${channelOpt}`, ephemeral: true });
        }

        if (commandName === 'تثبيت-التذاكر-المتقدمة') {
            const title = options.getString('العنوان');
            const desc = options.getString('الوصف');
            const image = options.getString('الصورة');
            const sectionsStr = options.getString('الأقسام');
            const sections = sectionsStr.split(',').map(s => s.trim());

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(desc)
                .setImage(image)
                .setColor('#2b2d31');

            const menu = new StringSelectMenuBuilder()
                .setCustomId('advanced_ticket_select')
                .setPlaceholder('اختر القسم المناسب لفتح تذكرة واصلة الدعم')
                .addOptions(sections.map(s => ({ label: s, value: s, description: `فتح تذكرة جديدة داخل قسم ${s}` })));

            const row = new ActionRowBuilder().addComponents(menu);
            await channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '✅ تم تثبيت نظام التذاكر المتقدمة وإرساله بنجاح في هذا الروم!', ephemeral: true });
        }

        if (commandName === 'إرسال-إمبيد') {
            const targetChan = options.getChannel('القناة');
            const embTitle = options.getString('العنوان');
            const embDesc = options.getString('الوصف');
            const embColor = options.getString('اللون') || '#2b2d31';

            if (targetChan.type !== ChannelType.GuildText) {
                return interaction.reply({ content: '❌ يرجى اختيار روم نصي صالح لإرسال الإمبيد بداخله.', ephemeral: true });
            }

            const customEmbed = new EmbedBuilder()
                .setTitle(embTitle)
                .setDescription(embDesc)
                .setColor(embColor.startsWith('#') ? embColor : `#${embColor}`)
                .setTimestamp()
                .setFooter({ text: guild.name, iconURL: guild.iconURL() });

            try {
                await targetChan.send({ embeds: [customEmbed] });
                return interaction.reply({ content: `✅ تم إرسال الإمبيد المخصص بنجاح إلى القناة: ${targetChan}`, ephemeral: true });
            } catch (err) {
                return interaction.reply({ content: '❌ تعذر إرسال الإمبيد. يرجى التحقق من صلاحيات البوت في الروم أو كود اللون المدخل.', ephemeral: true });
            }
        }

        if (commandName === 'تثبيت-الاقتراحات') {
            const sugChan = options.getChannel('القناة');
            if (sugChan.type !== ChannelType.GuildText) return interaction.reply({ content: '❌ يرجى اختيار روم نصي.', ephemeral: true });
            
            dbData.settings.suggestionChannelID = sugChan.id;
            dbData.markModified('settings');
            await dbData.save();

            return interaction.reply({ content: `✅ تم تثبيت روم الاقتراحات بنجاح في: ${sugChan}`, ephemeral: true });
        }

        if (commandName === 'إرسال-إمبيد-الاقتراحات') {
            if (!dbData.settings.suggestionChannelID) {
                return interaction.reply({ content: '❌ يجب عليك تثبيت وتحديد روم الاقتراحات أولاً باستخدام أمر `/تثبيت-الاقتراحات`.', ephemeral: true });
            }
            
            const sugChannelID = dbData.settings.suggestionChannelID;
            const sugChannel = guild.channels.cache.get(sugChannelID);
            if (!sugChannel) return interaction.reply({ content: '❌ روم الاقتراحات المحدد غير موجود بالسيرفر حالياً أو صلاحيات البوت ناقصة.', ephemeral: true });

            const sugEmbed = new EmbedBuilder()
                .setTitle('💡 صندوق اقتراحات السيرفر المطور')
                .setDescription('مرحباً بك عزيزنا العضو! إذا كانت لديك فكرة أو اقتراح لتطوير السيرفر وتحسين جودة التجربة، يمكنك الضغط على الزر المرفق أدناه وتعبئة النموذج لتقديمه للتصويت العام.')
                .setColor('#2b2d31')
                .setFooter({ text: guild.name, iconURL: guild.iconURL() });

            const sugRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_suggestion_modal')
                    .setLabel('اضغط لكتابة اقتراحك 📝')
                    .setStyle(ButtonStyle.Secondary)
            );

            await sugChannel.send({ embeds: [sugEmbed], components: [sugRow] });
            return interaction.reply({ content: `✅ تم إرسال إمبيد الاقتراحات بنجاح داخل الروم: ${sugChannel}`, ephemeral: true });
        }

        if (commandName === 'اقتراح') {
            const sugText = options.getString('الاقتراح');
            if (!dbData.settings.suggestionChannelID) {
                return interaction.reply({ content: '❌ لم يتم ضبط وتثبيت روم الاقتراحات بعد. يرجى استخدام أمر `/تثبيت-الاقتراحات` أولاً.', ephemeral: true });
            }

            const sugChannelID = dbData.settings.suggestionChannelID;
            const sugChannel = guild.channels.cache.get(sugChannelID);
            if (!sugChannel) return interaction.reply({ content: '❌ روم الاقتراحات غير موجود أو صلاحيات البوت ناقصة لتعديله.', ephemeral: true });

            await interaction.reply({ content: '✅ تم إرسال اقتراحك بنجاح!', ephemeral: true });
            const embed = new EmbedBuilder().setTitle('💡 اقتراح جديد واعد').setDescription(`\`\`\`text\n${sugText}\n\`\`\``).addFields({ name: '👤 الصاحب:', value: `${user}` }).setColor('#f39c12').setTimestamp();
            const msg = await sugChannel.send({ embeds: [embed] });
            await msg.react('👍'); await msg.react('👎');
            return;
        }

        if (commandName === 'تعيين-رتبة-الادارة') {
            const role = options.getRole('الرتبة');
            dbData.settings.botAdminRoleID = role.id; 
            dbData.markModified('settings'); await dbData.save();
            return interaction.reply({ content: `✅ تم تعيين رتبة الإدارة العليا للبوت بنجاح: ${role}`, ephemeral: true });
        }
        if (commandName === 'تعيين-رتبة-المشرفين') {
            const role = options.getRole('الرتبة');
            dbData.settings.botModRoleID = role.id; 
            dbData.markModified('settings'); await dbData.save();
            return interaction.reply({ content: `✅ تم تعيين رتبة المشرفين للبوت بنجاح: ${role}`, ephemeral: true });
        }
        if (commandName === 'تعيين-رتبة-الدعم') {
            const role = options.getRole('الرتبة');
            dbData.settings.botSupportRoleID = role.id; 
            dbData.markModified('settings'); await dbData.save();
            return interaction.reply({ content: `✅ تم تعيين رتبة الدعم الفني للبوت بنجاح: ${role}`, ephemeral: true });
        }
        if (commandName === 'تثبيت-قناة-المستويات') {
            const levelChan = options.getChannel('القناة'); if (levelChan.type !== ChannelType.GuildText) return interaction.reply({ content: '❌ اختر قناة نصية.', ephemeral: true });
            dbData.settings.levelChannelID = levelChan.id; 
            dbData.markModified('settings'); await dbData.save(); 
            return interaction.reply({ content: `✅ تم تحديد قناة إرسال الليفل بنجاح في: ${levelChan}`, ephemeral: true });
        }
        
        if (commandName === 'سجن-الرتبة') {
            const targetRole = options.getRole('الرتبة');
            if (targetRole.id === guild.roles.everyone.id) return interaction.reply({ content: '❌ لا يمكنك تطبيق البلاك ليست على رتبة everyone@ بالكامل.', ephemeral: true });
            await interaction.reply(`⏳ جاري تطبيق نظام البلاك ليست...`);
            guild.channels.cache.forEach(async (ch) => {
                if (ch.type === ChannelType.GuildText) {
                    try { await ch.permissionOverwrites.edit(targetRole, { SendMessages: false, AddReactions: false }); } catch (err) { }
                }
            });
            return interaction.followUp(`⛔ تم وضع رتبة ${targetRole} في البلاك ليست بنجاح.`);
        }

        if (commandName === 'قول') {
            const text = options.getString('النص');
            await interaction.reply({ content: '✅ تم الإرسال بنجاح.', ephemeral: true });
            return channel.send({ content: text });
        }

        if (commandName === 'تشغيل') {
            const query = options.getString('الرابط_أو_الاسم');
            const voiceChannel = member.voice.channel;
            if (!voiceChannel) return interaction.reply({ content: '❌ يجب أن تكون متصلاً بروم صوتي أولاً لكي أتمكن من الدخول والتشغيل!', ephemeral: true });

            await interaction.deferReply();

            try {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                    selfDeafen: false
                });

                const stream = ytdl(query, { 
                    filter: 'audioonly',
                    highWaterMark: 1 << 25,
                    dlChunkSize: 0,
                    requestOptions: {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': '*/*',
                            'Accept-Language': 'en-US,en;q=0.9'
                        }
                    }
                });

                const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
                const player = createAudioPlayer();
                player.play(resource);
                connection.subscribe(player);
                
                audioPlayers.set(guild.id, { player, connection });

                const embed = new EmbedBuilder()
                    .setTitle('🎵 لوحة تحكم وإدارة الصوت والموسيقى المباشرة')
                    .setDescription(`🎶 **يتم الآن بث الأغنية بنجاح في:** ${voiceChannel}\n📌 **المسار المطلوب:** \`${query}\``)
                    .setColor('#2ecc71')
                    .setFooter({ text: 'تحكم بالبث المباشر عبر الأزرار أدناه' });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('music_pause').setLabel('⏸️ إيقاف مؤقت').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('music_resume').setLabel('▶️ استئناف').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('music_stop').setLabel('⏹️ إيقاف وفصل').setStyle(ButtonStyle.Secondary)
                );

                return interaction.editReply({ embeds: [embed], components: [row] });
            } catch (err) {
                console.error(err);
                return interaction.editReply('❌ تعذر تشغيل الصوت. قد يكون هذا الرابط غير مدعوم أو أن جودة الاتصال ضعيفة حالياً.');
            }
        }

        if (commandName === 'عرض-رتب-البوت') {
            const embed = new EmbedBuilder()
                .setTitle('📋 سجل رتب وإعدادات البوت')
                .setColor('#2b2d31')
                .addFields(
                    { name: '👑 المالك الحصين:', value: `<@${BOT_OWNER_ID}>` },
                    { name: '⚙️ الإدارة العليا:', value: botAdminRoleID ? `<@&${botAdminRoleID}>` : '`لم تعين`', inline: true },
                    { name: '🛡️ رتبة المشرفين:', value: botModRoleID ? `<@&${botModRoleID}>` : '`لم تعين`', inline: true }
                );
            return interaction.reply({ embeds: [embed] });
        }
        
        if (commandName === 'فحص-الحصانة') {
            return interaction.reply({ content: isOwner ? '👑 نظام الحصانة المطلقة نشط وفعال بنسبة 100% لحسابك!' : 'ℹ️ أنت لست مالك البوت.', ephemeral: true });
        }

        if (commandName === 'مساعدة') {
            const embed1 = new EmbedBuilder()
                .setTitle('💡 دليل الأوامر العامة والترفيه والمستويات (الجزء 1)')
                .setColor('#2b2d31')
                .setDescription(
                    '`/مساعدة` - فتح هذا الدليل الإرشادي الشامل\n' +
                    '`/المستوى` - عرض مستواك الحالي ونقاط الخبرة الخاصة بك\n' +
                    '`/الصدارة` - عرض قائمة أعلى 10 أعضاء متفاعلين في السيرفر\n' +
                    '`/يومي` - استلام مكافأتك المالية اليومية\n' +
                    '`/قول` - تجعل البوت يكرر الكلام الذي تكتبه خلفه بالكامل\n' +
                    '`/اقتراح` - تقديم اقتراح جديد ليتم إرساله وتصويت الأعضاء عليه\n' +
                    '`/إرسال-إمبيد-الاقتراحات` - إرسال الرسالة الثابتة بـ زر لكتابة الاقتراحات\n' +
                    '`/إرسال-إمبيد` - إرسال رسالة إمبيد مخصصة ومنسقة بالكامل لروم معينة\n' +
                    '`/تشغيل` - تشغيل الأغاني في الروم الصوتي مع لوحة تحكم متطورة\n' +
                    '`/معلومات-السيرفر` - عرض تقرير أمني وتقني كامل وشامل عن إحصائيات السيرفر\n' +
                    '`/عرض-رتب-البوت` - استعراض رتب الحماية والإدارة الحالية للبوت\n' +
                    '`/فحص-الحصانة` - فحص وتأكيد تفعيل جدار الحصانة لمالك البوت'
                );

            const embed2 = new EmbedBuilder()
                .setTitle('🛠️ دليل أوامر الإشراف والمودريشن (الجزء 2)')
                .setColor('#2b2d31')
                .setDescription(
                    '`/حظر` - حظر عضو من السيرفر نهائياً\n' +
                    '`/فك-الحظر` - فك الحظر عن عضو بواسطة الـ ID\n' +
                    '`/طرد` - طرد عضو من السيرفر فوراً\n' +
                    '`/كتم` - كتم عضو ومنعه من الكتابة (Timeout)\n' +
                    '`/فك-الكتم` - فك الكتم والتايم أوت عن العضو\n' +
                    '`/مسح` - مسح عدد معين من الرسائل لتنظيف الشات\n' +
                    '`/تحذير` - تحذير عضو وتسجيله بقاعدة البيانات\n' +
                    '`/التحذيرات` - عرض سجل تحذيرات عضو معين\n' +
                    '`/مسح-التحذيرات` - مسح جميع تحذيرات عضو محدد\n' +
                    '`/تصفير-التحذيرات` - مسح كافة التحذيرات المسجلة لجميع أعضاء السيرفر\n' +
                    '`/حظر-مؤقت` - حظر مؤقت لعضو من السيرفر يزول تلقائياً بعد الوقت\n' +
                    '`/حظر-ناعم` - حظر العضو ومسح رسائله لآخر 7 أيام وفكه تلقائياً\n' +
                    '`/حظر-جماعي` - حظر جماعي لعدة حسابات بواسطة الـ IDs دفعة واحدة'
                );

            return interaction.reply({ embeds: [embed1, embed2] });
        }

        if (commandName === 'قفل-الصوتي') {
            const chan = options.getChannel('القناة');
            await chan.permissionOverwrites.edit(guild.roles.everyone, { Connect: false }); await interaction.reply(`🔒 تم قفل الروم: ${chan}`);
        }
        if (commandName === 'فتح-الصوتي') {
            const chan = options.getChannel('القناة');
            await chan.permissionOverwrites.edit(guild.roles.everyone, { Connect: true }); await interaction.reply(`🔓 تم فتح الروم: ${chan}`);
        }
        if (commandName === 'كتم-الصوتي') {
            const target = options.getMember('العضو'); if (!target.voice.channel) return interaction.reply({ content: '❌ غير متصل بفويس.', ephemeral: true });
            await target.voice.setMute(true); await interaction.reply(`🔇 تم كتم صوت العضو ${target}.`);
        }
        if (commandName === 'فك-كتم-الصوتي') {
            const target = options.getMember('العضو'); if (!target.voice.channel) return interaction.reply({ content: '❌ غير متصل بالفويس.', ephemeral: true });
            await target.voice.setMute(false); await interaction.reply(`🔊 تم فك كتم صوت العضو ${target}.`);
        }
        if (commandName === 'تعطيل-السماعة') {
            const target = options.getMember('العضو'); if (!target.voice.channel) return interaction.reply({ content: '❌ العضو ليس في روم صوتي.', ephemeral: true });
            await target.voice.setDeafen(true); await interaction.reply(`🎧 تم تعطيل سماعة العضو ${target}.`);
        }
        if (commandName === 'تفعيل-السماعة') {
            const target = options.getMember('العضو'); if (!target.voice.channel) return interaction.reply({ content: '❌ العضو ليس in روم صوتي.', ephemeral: true });
            await target.voice.setDeafen(false); await interaction.reply(`🎵 تم إعادة تفعيل سماعة العضو ${target}.`);
        }
        if (commandName === 'فصل-الصوتي') {
            const target = options.getMember('العضو'); if (!target.voice.channel) return interaction.reply({ content: '❌ العضو ليس في روم صوتي.', ephemeral: true });
            await target.voice.disconnect(); await interaction.reply(`🚫 تم فصل وطرد العضو ${target} من الفويس.`);
        }
        if (commandName === 'تبطئة-الصوتي') {
            const chan = options.getChannel('القناة'); const secs = options.getInteger('الثواني');
            await chan.setRateLimitPerUser(secs); await interaction.reply(`⏳ تم تفعيل وضع التباطؤ بالفويس.`);
        }
        if (commandName === 'حدد-الصوتي') {
            const chan = options.getChannel('القناة'); const limit = options.getInteger('الحد');
            await chan.setUserLimit(limit); await interaction.reply(`👥 تم تعديل الحد الأقصى للفويس.`);
        }
        if (commandName === 'إخفاء-الصوتي') {
            const chan = options.getChannel('القناة'); await chan.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }); await interaction.reply(`🙈 تم إخفاء الفويس.`);
        }
        if (commandName === 'إظهار-الصوتي') {
            const chan = options.getChannel('القناة'); await chan.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true }); await interaction.reply(`👀 تم إظهار الفويس.`);
        }
        if (commandName === 'تصفير-التحذيرات') { dbData.moderation.warns = []; await dbData.save(); await interaction.reply('🧼 تم مسح جميع التحذيرات بنجاح!'); }
        if (commandName === 'حظر-مؤقت') {
            const target = options.getMember('العضو'); const hours = options.getInteger('المدة'); const reason = options.getString('السبب') || 'حظر مؤقت';
            if (!target.bannable) return interaction.reply({ content: '❌ لا يمكن حظره.', ephemeral: true });
            await target.ban({ reason }); await interaction.reply(`🔨 تم حظر ${target.user.username} مؤقتاً لمدة \`${hours}\` ساعة.`);
            setTimeout(async () => { await guild.members.unban(target.id).catch(() => {}); }, hours * 60 * 60 * 1000);
        }
        if (commandName === 'إلغاء-التباطئة') { await channel.setRateLimitPerUser(0); await interaction.reply('🛑 تم إلغاء وضع التباطؤ بالروم الحالي.'); }
        if (commandName === 'رتبة-للجميع') {
            await interaction.reply('👥 جاري بدء عملية توزيع الرتبة...');
            const role = options.getRole('الرتبة'); guild.members.cache.forEach(async (m) => { if (!m.user.bot) await m.roles.add(role).catch(() => {}); });
            await interaction.followUp(`✅ تم الانتهاء من إعطاء رتبة لجميع الأعضاء.`);
        }
        if (commandName === 'سحب-من-الجميع') {
            await interaction.reply('🚫 جاري بدء عملية سحب الرتبة...');
            const role = options.getRole('الرتبة'); guild.members.cache.forEach(async (m) => { if (!m.user.bot) await m.roles.remove(role).catch(() => {}); });
            await interaction.followUp(`✅ تم الانتهاء من سحب الرتبة من الجميع.`);
        }
        if (commandName === 'استنساخ-القناة') { const cloned = await channel.clone(); await cloned.setPosition(channel.position); await interaction.reply(`📑 تم استنساخ الروم في: ${cloned}`); }
        if (commandName === 'مسح-رسائل-البوتات') {
            const amount = options.getInteger('العدد'); const msgs = await channel.messages.fetch({ limit: amount });
            const botMsgs = msgs.filter(m => m.author.bot); await channel.bulkDelete(botMsgs, true);
            await interaction.reply({ content: `🧹 تم تنظيف الشات من رسائل البوتات.`, ephemeral: true });
        }
        if (commandName === 'منع-البوتات') { globalAntiBot = true; await interaction.reply('🛡️ تم تفعيل نظام منع البوتات الخارجية.'); }
        if (commandName === 'سماح-البوتات') { globalAntiBot = false; await interaction.reply('🟢 تم السماح بدخول البوتات.'); }

        if (commandName === 'حظر') {
            const target = options.getMember('العضو'); const reason = options.getString('السبب') || 'بدون سبب'; if (!target.bannable) return interaction.reply({ content: '❌ لا يمكن حظره.', ephemeral: true });
            await target.ban({ reason }); await interaction.reply(`🔨 تم حظر ${target.user.username}.`);
        }
        if (commandName === 'فك-الحظر') { const targetId = options.getString('المعرف'); try { await guild.members.unban(targetId); await interaction.reply(`🔓 تم إلغاء حظر الحساب.`); } catch { await interaction.reply({ content: '❌ خطأ بالـ ID.', ephemeral: true }); } }
        if (commandName === 'طرد') {
            const target = options.getMember('العضو'); const reason = options.getString('السبب') || 'بدون سبب'; if (!target.kickable) return interaction.reply({ content: '❌ لا يمكن طرده.', ephemeral: true });
            await target.kick(reason); await interaction.reply(`👢 تم طرد العضو بنجاح.`);
        }
        if (commandName === 'كتم') { const target = options.getMember('العضو'); const duration = options.getInteger('المدة') * 60 * 1000; await target.timeout(duration, 'أمر إداري'); await interaction.reply(`🔇 تم كتم العضو.`); }
        if (commandName === 'فك-الكتم') { const target = options.getMember('العضو'); await target.timeout(null); await interaction.reply(`🔊 تم فك كتم العضو.`); }
        if (commandName === 'مسح') { const amount = options.getInteger('العدد'); await channel.bulkDelete(amount, true); await interaction.reply({ content: `🧹 تم مسح الرسائل.`, ephemeral: true }); }
        if (commandName === 'تحذير') {
            const target = options.getMember('العضو'); const reason = options.getString('السبب'); dbData.moderation.warns.push({ userID: target.id, reason: reason, moderatorID: user.id }); await dbData.save(); await interaction.reply(`⚠️ تم تحذير العضو.`);
        }
        if (commandName === 'التحذيرات') {
            const target = options.getMember('العضو'); const uWarns = dbData?.moderation.warns.filter(w => w.userID === target.id) || []; if (uWarns.length === 0) return interaction.reply(`😇 نظيف تماماً.`);
            let list = uWarns.map((w, i) => `**[${i+1}]** سبب: \`${w.reason}\``).join('\n'); await interaction.reply(`📋 سجل التحذيرات:\n${list}`);
        }
        if (commandName === 'مسح-التحذيرات') { const target = options.getMember('العضو'); if (dbData) { dbData.moderation.warns = dbData.moderation.warns.filter(w => w.userID !== target.id); await dbData.save(); } await interaction.reply(`🧼 تم تصفير سجل تحذيراته.`); }
        if (commandName === 'قفل') { await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }); await interaction.reply('🔒 تم قفل الغرفة.'); }
        if (commandName === 'فتح') { await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true }); await interaction.reply('🔓 تم فتح الغرفة.'); }
        if (commandName === 'الوضع-البطيء') { await channel.setRateLimitPerUser(options.getInteger('الثواني')); await interaction.reply(`⏳ تم تفعيل وضع الانتظار البطيء.`); }
        if (commandName === 'إضافة-رتبة') { const target = options.getMember('العضو'); const role = options.getRole('الرتبة'); await target.roles.add(role); await interaction.reply(`➕ تم إعطاء الرتبة للمستخدم.`); }
        if (commandName === 'إزالة-رتبة') { const target = options.getMember('العضو'); const role = options.getRole('الرتبة'); await target.roles.remove(role); await interaction.reply(`➖ تم سحب الرتبة بنجاح.`); }
        if (commandName === 'اسم-مستعار') { const target = options.getMember('العضو'); await target.setNickname(options.getString('الاسم')); await interaction.reply(`🏷️ تم تحديث الاسم المستعار.`); }
        if (commandName === 'تطهير') { const pos = channel.position; const newChan = await channel.clone(); await channel.delete().catch(() => {}); await newChan.setPosition(pos); await newChan.send({ embeds: [new EmbedBuilder().setDescription('☢️ تم نيوك وتطهير الروم بالكامل!').setColor('#2ecc71')] }); }
        if (commandName === 'إخفاء') { await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }); await interaction.reply('🙈 تم إخفاء الروم عن العامة.'); }
        if (commandName === 'إظهار') { await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true }); await interaction.reply('👀 تم إظهار الروم.'); }
        if (commandName === 'رتبة-مؤقتة') {
            const target = options.getMember('العضو'); const role = options.getRole('الرتبة'); const mins = options.getInteger('الدقائق'); await target.roles.add(role); await interaction.reply(`⏱️ رتبة مؤقتة لمدة ${mins} دقيقة.`);
            setTimeout(async () => { const m = await guild.members.fetch(target.id).catch(() => null); if (m) await m.roles.remove(role).catch(() => {}); }, mins * 60 * 1000);
        }
        if (commandName === 'تحديث-البوت') { await interaction.reply('🔄 جاري إعادة تشغيل العمليات برمجياً...'); process.exit(0); }
        if (commandName === 'قفل-شامل') { await interaction.reply('🚨 جاري فرض حالة إغلاق الطوارئ الشامل لكافة الرومات...'); guild.channels.cache.forEach(async (ch) => { if (ch.type === ChannelType.GuildText) await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).catch(() => {}); }); await interaction.followUp('🔒 تم إغلاق السيرفر بالكامل بنجاح.'); }
        if (commandName === 'فتح-شامل') { await interaction.reply('🟢 جاري فك الإغلاق العام...'); guild.channels.cache.forEach(async (ch) => { if (ch.type === ChannelType.GuildText) await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true }).catch(() => {}); }); await interaction.followUp('🔓 تم إعادة فتح السيرفر بشكل طبيعي.'); }
        if (commandName === 'كتم-الرتبة') { const role = options.getRole('الرتبة'); await channel.permissionOverwrites.edit(role, { SendMessages: false }); await interaction.reply(`🔇 تم منع الرتبة من الكتابة هنا.`); }
        if (commandName === 'تحدث-الرتبة') { const role = options.getRole('الرتبة'); await channel.permissionOverwrites.edit(role, { SendMessages: true }); await interaction.reply(`🔊 تم السماح للرتبة بالكتابة.`); }
        if (commandName === 'تجريد-الرتب') { const target = options.getMember('العضو'); if (!target.manageable) return interaction.reply({ content: '❌ الصلاحيات غير كافية للتحكم برتبه.', ephemeral: true }); const userRoles = target.roles.cache.filter(r => r.id !== guild.id); userRoles.forEach(async (r) => await target.roles.remove(r).catch(() => {})); await interaction.reply(`🛡️ تم تجريد رتب العضو فوراً.`); }
        if (commandName === 'حظر-جماعي') {
            const idsStr = options.getString('المعرفات'); const reason = options.getString('السبب') || 'حظر جماعي أمني'; const ids = idsStr.split(/\s+/); await interaction.reply(`💥 جاري حظر المعرفات المكتوبة...`);
            let count = 0; for (const id of ids) { try { await guild.members.ban(id, { reason }); count++; } catch {} } await interaction.followUp(`✅ تم حظر \`${count}\` حساب بنجاح تام.`);
        }
        if (commandName === 'حظر-ناعم') {
            const target = options.getMember('العضو'); const reason = options.getString('السبب') || 'سوفت بان لتنظيف الرسائل'; if (!target.bannable) return interaction.reply({ content: '❌ غير قابل للحظر.', ephemeral: true });
            await guild.members.ban(target.id, { deleteMessageSeconds: 7 * 24 * 60 * 60, reason }); await guild.members.unban(target.id); await interaction.reply(`🧹 تم عمل سوفت بان للعضو وجاري تنظيف الشات.`);
        }
        if (commandName === 'إنشاء-رتبة') { const name = options.getString('الاسم'); const color = options.getString('اللون') || '#95a5a6'; const newRole = await guild.roles.create({ name, color, reason: 'إنشاء سريع' }); await interaction.reply(`🛠️ تم إنشاء الرتبة: ${newRole}`); }
        if (commandName === 'حذف-رتبة') { const role = options.getRole('الرتبة'); if (!role.editable) return interaction.reply({ content: '❌ لا يمكن حذف الرتبة.', ephemeral: true }); await role.delete(); await interaction.reply(`🗑️ تم حذف الرتبة نهائياً.`); }
        if (commandName === 'إنشاء-قناة') { const name = options.getString('الاسم'); const type = options.getInteger('النوع'); const newChan = await guild.channels.create({ name, type }); await interaction.reply(`📁 تم إنشاء القناة بنجاح: ${newChan}`); }
        if (commandName === 'حذف-قناة') { const ch = options.getChannel('القناة'); await ch.delete(); await interaction.reply(`🗑️ تم حذف القناة من السيرفر.`); }
        if (commandName === 'تبطئة-الكل') { guild.channels.cache.forEach(async (ch) => { if (ch.type === ChannelType.GuildText) await ch.setRateLimitPerUser(5).catch(() => {}); }); await interaction.reply('⏳ تم تفعيل وضع التباطؤ العام في السيرفر.'); }
        if (commandName === 'إلغاء-تبطئة-الكل') { guild.channels.cache.forEach(async (ch) => { if (ch.type === ChannelType.GuildText) await ch.setRateLimitPerUser(0).catch(() => {}); }); await interaction.reply('🛑 تم إلغاء وضع التباطؤ العام.'); }
        if (commandName === 'حجر-صحي') {
            const target = options.getMember('العضو'); let qRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'quarantined');
            if (!qRole) { qRole = await guild.roles.create({ name: 'Quarantined', color: '#555555', permissions: [] }); guild.channels.cache.forEach(async (ch) => { if (ch.type === ChannelType.GuildText) await ch.permissionOverwrites.edit(qRole, { ViewChannel: false }); }); }
            await target.roles.add(qRole); await interaction.reply(`☣️ تم عزل ونقل العضو إلى الحجر الصحي بنجاح.`);
        }
        if (commandName === 'فك-الحجر') { const target = options.getMember('العضو'); const qRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'quarantined'); if (qRole) await target.roles.remove(qRole); await interaction.reply(`🟢 تم إخراج العضو من الحجر الأمني والعزل.`); }
        if (commandName === 'تنظيف-البوتات') { const amount = options.getInteger('العدد'); const msgs = await channel.messages.fetch({ limit: amount }); const botMsgs = msgs.filter(m => m.author.bot); await channel.bulkDelete(botMsgs, true); await interaction.reply({ content: `🤖 تم تنظيف رسائل البوتات العشوائية.`, ephemeral: true }); }
        if (commandName === 'عرض-الصلاحيات') {
            const target = options.getMember('العضو'); const perms = target.permissions.toArray().map(p => `\`${p}\``).join(', ');
            const embed = new EmbedBuilder().setTitle(`🔍 فحص أمني للمشرف`).setDescription(`الأعضاء: ${target}\n\n**الصلاحيات:**\n${perms || 'لا يملك صلاحيات'}`).setColor('#e67e22'); await interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'تشغيل-مضاد-الهجمات') { globalAntiRaid = true; await interaction.reply('🚨 تم تفعيل جدار الحماية الأقصى ومنع الزوار الجدد.'); }
        if (commandName === 'إيقاف-مضاد-الهجمات') { globalAntiRaid = false; await interaction.reply('🟢 تم إيقاف وضع الحماية المطلقة والعودة للوضع المستقر.'); }
        if (commandName === 'معلومات-السيرفر') {
            const embed = new EmbedBuilder().setTitle(`📊 التقرير الأمني لـ ${guild.name}`).addFields({ name: '👥 الأعضاء الإجمالي:', value: `\`${guild.memberCount}\``, inline: true }, { name: '🔒 مستوى التحقق:', value: `\`المستوى ${guild.verificationLevel}\``, inline: true }, { name: '🛡️ وضع Anti-Raid:', value: `\`${globalAntiRaid ? '🔴 active' : '🟢 مستقر'}\``, inline: true }).setColor('#9b59b6').setTimestamp(); await interaction.reply({ embeds: [embed] });
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'advanced_ticket_select') {
        const selectedSection = interaction.values[0];
        const modal = new ModalBuilder().setCustomId(`advanced_ticket_modal_${selectedSection}`).setTitle(`🎫 تذكرة: ${selectedSection}`);
        const reason = new TextInputBuilder().setCustomId('ticket_reason').setLabel("تفاصيل التذكرة").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(reason)); await interaction.showModal(modal);
    }

    if (interaction.isButton()) {
        const musicInstance = audioPlayers.get(interaction.guild.id);
        
        if (interaction.customId === 'open_suggestion_modal') {
            const modal = new ModalBuilder().setCustomId('submit_suggestion_modal').setTitle('💡 نموذج تقديم اقتراح جديد');
            const userInput = new TextInputBuilder()
                .setCustomId('suggestion_field')
                .setLabel('اكتب تفاصيل اقتراحك هنا بدقة:')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('مثال: إضافة رومات ألعاب جديدة أو تعديل القوانين...')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(userInput));
            return interaction.showModal(modal);
        }

        if (interaction.customId === 'music_pause') {
            if (musicInstance) musicInstance.player.pause();
            return interaction.reply({ content: '⏸️ تم إيقاف البث مؤقتاً بنجاح.', ephemeral: true });
        }
        if (interaction.customId === 'music_resume') {
            if (musicInstance) musicInstance.player.unpause();
            return interaction.reply({ content: '▶️ تم استئناف تشغيل الصوت بنجاح.', ephemeral: true });
        }
        if (interaction.customId === 'music_stop') {
            if (musicInstance) {
                musicInstance.player.stop();
                musicInstance.connection.destroy();
                audioPlayers.delete(interaction.guild.id);
            }
            return interaction.reply({ content: '⏹️ تم إيقاف التشغيل بالكامل وفصل البوت.', ephemeral: true });
        }

        if (interaction.customId === 'claim_ticket') {
            let dbData = await GuildData.findOne({ guildID: interaction.guild.id });
            const hasSupport = dbData?.settings && interaction.member.roles.cache.has(dbData.settings.botSupportRoleID) || interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) || interaction.user.id === BOT_OWNER_ID;
            if (!hasSupport) return interaction.reply({ content: '❌ هذا الزر مخصص لطاقم الدعم الفني فقط.', ephemeral: true });
            
            await interaction.reply({ content: `🔒 تم استلام التذكرة بواسطة المساعد: ${interaction.user}` });
            
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('تم الاستلام').setStyle(ButtonStyle.Secondary).setDisabled(true), 
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Secondary)
            );
            await interaction.message.edit({ components: [disabledRow] });
        }
        if (interaction.customId === 'close_ticket') {
            let dbData = await GuildData.findOne({ guildID: interaction.guild.id });
            const hasSupport = dbData?.settings && interaction.member.roles.cache.has(dbData.settings.botSupportRoleID) || interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) || interaction.user.id === BOT_OWNER_ID;
            if (!hasSupport) return interaction.reply({ content: '❌ لا يمكنك إغلاق التذكرة، للمشرفين فقط.', ephemeral: true });

            await interaction.reply('🔒 جاري أرشفة وإغلاق التذكرة خلال 5 ثوانٍ...');
            setTimeout(async () => { await interaction.channel.delete().catch(() => {}); }, 5000);
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'submit_suggestion_modal') {
            const sugText = interaction.fields.getTextInputValue('suggestion_field');
            let freshData = await GuildData.findOne({ guildID: interaction.guild.id });
            
            if (!freshData || !freshData.settings || !freshData.settings.suggestionChannelID) {
                return interaction.reply({ content: '❌ لم يتم العثور على روم الاقتراحات في النظام. يرجى تثبيتها أولاً.', ephemeral: true });
            }

            const sugChannelID = freshData.settings.suggestionChannelID;
            const sugChannel = interaction.guild.channels.cache.get(sugChannelID);
            if (!sugChannel) return interaction.reply({ content: '❌ روم الاقتراحات المعتمد غير موجود بالسيرفر أو تم حذفه، وصلاحيات البوت بحاجة لفحص.', ephemeral: true });

            await interaction.reply({ content: '✅ تم استلام اقتراحك ونشره في روم الاقتراحات بنجاح لتصويت الأعضاء عليه!', ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle('💡 اقتراح جديد فخم للسيرفر')
                .setDescription(`\`\`\`text\n${sugText}\n\`\`\``)
                .addFields({ name: '👤 صاحب الاقتراح:', value: `${interaction.user} (\`${interaction.user.id}\`)` })
                .setColor('#f1c40f')
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            const msg = await sugChannel.send({ embeds: [embed] });
            await msg.react('👍');
            await msg.react('👎');
            return;
        }

        if (interaction.customId.startsWith('advanced_ticket_modal_')) {
            const sectionName = interaction.customId.replace('advanced_ticket_modal_', ''); const reason = interaction.fields.getTextInputValue('ticket_reason');
            const chan = await interaction.guild.channels.create({ name: `🎫-${sectionName}-${interaction.user.username}`, type: ChannelType.GuildText, permissionOverwrites: [{ id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }, { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] });
            const embed = new EmbedBuilder().setTitle(`🎫 تذكرة جديدة | قسم ${sectionName}`).setDescription(`مرحباً بك يا ${interaction.user} في تذكرتك المخصصة لقسم **[ ${sectionName} ]**.\n\n**تفاصيل طلبك:**\n\`\`\`text\n${reason}\n\`\`\``).setColor('#2b2d31').setTimestamp();
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة').setStyle(ButtonStyle.Secondary), 
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Secondary)
            );
            await chan.send({ embeds: [embed], components: [row] }); await interaction.reply({ content: `✅ تم فتح تذكرتك بنجاح في: ${chan}`, ephemeral: true });
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const authId = message.author.id; const now = Date.now();

    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        if (antiSpamMap.has(authId)) {
            const userData = antiSpamMap.get(authId);
            if (now - userData.lastMessageTime < 3000) {
                if (userData.msgCount >= 5) {
                    await message.delete().catch(() => {}); await message.member.timeout(300000, 'سبام مكثف').catch(() => {});
                    return message.channel.send(`🚨 تم كتم ${message.author} تلقائياً للسبام.`);
                }
                userData.msgCount++;
            } else { userData.msgCount = 1; } userData.lastMessageTime = now;
        } else { antiSpamMap.set(authId, { lastMessageTime: now, msgCount: 1 }); }
    }

    let data = await GuildData.findOne({ guildID: message.guild.id }) || new GuildData({ guildID: message.guild.id });
    if (!data.levels) data.levels = [];
    let userLevel = data.levels.find(l => l.userID === message.author.id);
    if (!userLevel) { data.levels.push({ userID: message.author.id, xp: 0, level: 0, lastMessageTimestamp: new Date(0) }); userLevel = data.levels.find(l => l.userID === message.author.id); }
    if (now - new Date(userLevel.lastMessageTimestamp).getTime() < 60000) return;
    userLevel.xp += Math.floor(Math.random() * 11) + 15; userLevel.lastMessageTimestamp = new Date(now);
    const xpNeeded = (userLevel.level + 1) * 100;
    
    if (userLevel.xp >= xpNeeded) { 
        userLevel.level += 1; userLevel.xp = 0; 
        const levelChannelID = data.settings?.levelChannelID;
        const targetChannel = message.guild.channels.cache.get(levelChannelID) || message.channel;
        if (targetChannel) { await targetChannel.send(`🎉 كفو ${message.author}! وصلت لـ ليفل **${userLevel.level}**!`); }
    }
    data.markModified('levels');
    await data.save();
});

client.on('messageDelete', async (m) => {
    if (!m.guild || m.author?.bot) return;
    await sendLog(m.guild, new EmbedBuilder().setTitle('🗑️ رسالة محذوفة').setDescription(`**الكاتب:** ${m.author}\n**الروم:** ${m.channel}\n**المحتوى:**\n\`\`\`${m.content || 'محتوى غير نصي'}\`\`\``).setColor('#e74c3c').setTimestamp());
});

client.on('messageUpdate', async (o, n) => {
    if (!o.guild || o.author?.bot || o.content === n.content) return;
    await sendLog(o.guild, new EmbedBuilder().setTitle('📝 رسالة معدلة').setDescription(`**الكاتب:** ${o.author}\n**الروم:** ${o.channel}\n**القديمة:**\n\`\`\`${o.content}\`\`\`\n**الجديدة:**\n\`\`\`${n.content}\`\`\``).setColor('#3498db').setTimestamp());
});

client.on('guildMemberAdd', async (m) => {
    if (m.user.bot && globalAntiBot) { return await m.kick('حماية البوتات الخارجية مفعلة تلقائياً').catch(() => {}); }
    if (globalAntiRaid) { try { return await m.kick('وضع الـ Anti-Raid مفعل طوارئ'); } catch {} }
    
    const dbData = await GuildData.findOne({ guildID: m.guild.id });
    if (dbData && dbData.settings && dbData.settings.welcomeChannelID) {
        const welcomeChannel = m.guild.channels.cache.get(dbData.settings.welcomeChannelID);
        if (welcomeChannel) {
            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`✨ أهلاً بك في سيرفر ${m.guild.name}!`)
                .setDescription(`مرحباً بك يا ${m} في مجتمعنا! يسعدنا جداً انضمامك إلينا نتمنى لك وقتاً ممتعاً. 👋`)
                .setColor('#2b2d31')
                .setTimestamp();
            await welcomeChannel.send({ content: `👑 نورت السيرفر يا ${m}!`, embeds: [welcomeEmbed] }).catch(() => {});
        }
    }
});

process.on('unhandledRejection', error => console.error('[خطأ غير معالج]:', error));
client.login(process.env.TOKEN);
