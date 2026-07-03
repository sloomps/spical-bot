require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextInputBuilder, TextInputStyle, ModalBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');
const mongoose = require('mongoose');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('library-ytdl-core'); // أو مكتبة التشغيل الصالحة لديك

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

const GuildData = require('./models/guildSchema');

// 👑 ضع هنا الـ ID الخاص بحسابك الشخصي لتكون المالك المطلق للبوت وتحصل على الحصانة الكاملة
const BOT_OWNER_ID = 'YOUR_DISCORD_USER_ID_HERE'; 

const antiSpamMap = new Map();
const invitesCache = new Map();
let globalAntiRaid = false;
let globalAntiBot = false;

// تخزين مشغلات الصوت الخاصة بنظام الأغاني
const audioPlayers = new Map();

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بقاعدة بيانات MongoDB بنجاح!'))
    .catch((err) => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

client.once('ready', async () => {
    console.log(`🚀 تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
    
    const commands = [
        // أنظمة التذاكر والترحيب والإعدادات السابقة
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
        { name: 'الصدارة', description: 'عرض قائمة أعلى 10 أعضاء متفاعلين in السيرفر' },
        { name: 'يومي', description: 'استلام مكافأتك المالية اليومية' },

        // الـ 40 أمر إشراف وتأمين السابقة كاملة
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
        { name: 'كتم-الرتبة', description: '🔇 منع رتبة معينة من التحدث في هذا الروم فقط', options: [{ name: 'الرتبة', description: 'الرتبة المستهدفة', type: 8, required: true }] },
        { name: 'تحدث-الرتبة', description: '🔊 إعادة السماح للرتبة بالتحدث in هذا الروم', options: [{ name: 'الرتبة', description: 'الرتبة المستهدفة', type: 8, required: true }] },
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

        // الـ 20 أمراً الإدارية والصوتية السابقة
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
        { name: 'إظهار-الصوتي', description: '👀 إظهار الروم الصوتي المخفي للأعضاء in السيرفر', options: [{ name: 'القناة', description: 'الروم الصوتي', type: 7, required: true }] },
        { name: 'تصفير-التحذيرات', description: '🧼 مسح كافة التحذيرات المسجلة لجميع أعضاء السيرفر نهائياً' },
        { name: 'حظر-مؤقت', description: '⏳ حظر مؤقت لعضو من السيرفر يزول تلقائياً بعد الوقت المحدد', options: [{ name: 'العضو', description: 'العضو', type: 6, required: true }, { name: 'المدة', description: 'المدة بالساعات', type: 4, required: true }, { name: 'السبب', description: 'السبب', type: 3 }] },
        { name: 'إلغاء-التباطئة', description: '🛑 إيقاف وضع التباطؤ تماماً في الروم الحالي الحالي دون انتظار' },
        { name: 'رتبة-للجميع', description: '👥 إعطاء رتبة معينة لجميع أعضاء السيرفر دفعة واحدة (للأدمن)', options: [{ name: 'الرتبة', description: 'الرتبة المراد توزيعها', type: 8, required: true }] },
        { name: 'سحب-من-الجميع', description: '🚫 سحب رتبة معينة من جميع أعضاء السيرفر دفعة واحدة بشكل جماعي', options: [{ name: 'الرتبة', description: 'الرتبة المراد سحبها', type: 8, required: true }] },
        { name: 'استنساخ-القناة', description: '📑 استنساخ الروم الحالي بنفس الاسم والإعدادات والصلاحيات تماماً' },
        { name: 'مسح-رسائل-البوتات', description: '🧹 مسح رسائل البوتات فقط في الروم الحالي لحفظ المظهر والترتيب', options: [{ name: 'العدد', description: 'عدد الرسائل (1-100)', type: 4, required: true }] },
        { name: 'منع-البوتات', description: '🛡️ تفعيل جدار حظر ومنع دخول البوتات الخارجية غير الموثقة للسيرفر' },
        { name: 'سماح-البوتات', description: '🟢 إيقاف نظام حظر دخول البوتات الخارجية والسماح بدخولها بشكل عادي' },
        { name: 'مساعدة', description: '💡 عرض قائمة جميع أوامر البوت المتاحة وشرح كامل لوظائفها المتقدمة' },

        // أوامر نظام الرتب والصلاحيات وحماية المالك
        { name: 'تعيين-رتبة-الادارة', description: '⚙️ تعيين رتبة الإدارة العليا المسموح لها بإدارة البوت وسير العمل', options: [{ name: 'الرتبة', description: 'اختر الرتبة', type: 8, required: true }] },
        { name: 'تعيين-رتبة-المشرفين', description: '🛡️ تعيين رتبة المشرفين المسموح لهم بإصدار العقوبات والميوت', options: [{ name: 'الرتبة', description: 'اختر الرتبة', type: 8, required: true }] },
        { name: 'تعيين-رتبة-الدعم', description: '🎫 تعيين رتبة الدعم الفني الخاصة بإدارة واستلام التذاكر', options: [{ name: 'الرتبة', description: 'اختر الرتبة', type: 8, required: true }] },
        { name: 'عرض-رتب-البوت', description: '📋 استعراض رتب الحماية والإدارة الحالية التي تم ضبطها في البوت' },
        { name: 'فحص-الحصانة', description: '👑 فحص وتأكيد تفعيل جدار الحصانة المطلقة الخاص بمالك البوت' },
        { name: 'سجن-الرتبة', description: '⛔ منع رتبة كاملة من الكتابة في جميع رومات السيرفر النصية (بلاك ليست/سجن)', options: [{ name: 'الرتبة', description: 'اختر الرتبة المستهدفة لحظرها من الكتابة', type: 8, required: true }] },

        // 🆕 الأوامر الجديدة المضافة بطلبك
        { name: 'قول', description: '🗣️ تجعل البوت يكرر الكلام الذي تكتبه خلفه بالكامل', options: [{ name: 'النص', description: 'اكتب الرسالة التي تريد من البوت قولها', type: 3, required: true }] },
        { name: 'تثبيت-الاقتراحات', description: '📌 تحديد القناة النصية المخصصة لاستقبال اقتراحات الأعضاء وإعدادها', options: [{ name: 'القناة', description: 'اختر روم الاقتراحات', type: 7, required: true }] },
        { name: 'اقتراح', description: '💡 تقديم اقتراح جديد ليتم إرساله وتصويت الأعضاء عليه بنظام متطور', options: [{ name: 'الاقتراح', description: 'اكتب تفاصيل اقتراحك هنا ليراه الجميع', type: 3, required: true }] },
        { name: 'تشغيل', description: '🎵 تشغيل الأغاني في الروم الصوتي الخاص بك بدون ديفن مع لوحة تحكم متطورة', options: [{ name: 'الرابط_أو_الاسم', description: 'رابط الأغنية من يوتيوب أو اسمها للبحث عنها', type: 3, required: true }] }
    ];
    
    await client.application.commands.set(commands).catch(console.error);
    console.log('🔹 تم تحديث قائمة الأوامر بنجاح وتثبيت الإضافات الجديدة!');

    client.guilds.cache.forEach(async (guild) => {
        try { const firstInvites = await guild.invites.fetch(); invitesCache.set(guild.id, new Map(firstInvites.map(invite => [invite.code, invite.uses]))); } catch { }
    });
});

async function sendLog(guild, embed, files = []) {
    try {
        const data = await GuildData.findOne({ guildID: guild.id });
        if (!data || !data.settings.logChannelID) return;
        const logChannel = guild.channels.cache.get(data.settings.logChannelID);
        if (logChannel) await logChannel.send({ embeds: [embed], files: files });
    } catch (err) { console.error(err); }
}

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options, guild, member, channel, user } = interaction;

        let dbData = await GuildData.findOne({ guildID: guild.id }) || new GuildData({ guildID: guild.id });
        if (!dbData.settings) dbData.settings = {};

        const botAdminRoleID = dbData.settings.botAdminRoleID;
        const botModRoleID = dbData.settings.botModRoleID;
        const botSupportRoleID = dbData.settings.botSupportRoleID;

        const isOwner = (user.id === BOT_OWNER_ID);
        const isAdmin = isOwner || member.roles.cache.has(botAdminRoleID) || member.permissions.has(PermissionFlagsBits.Administrator);
        const isMod = isAdmin || member.roles.cache.has(botModRoleID) || member.permissions.has(PermissionFlagsBits.ManageMessages);
        const isSupport = isMod || member.roles.cache.has(botSupportRoleID);

        const targetUser = options.getMember('العضو') || options.getMember('user');
        if (targetUser && targetUser.id === BOT_OWNER_ID && !isOwner) {
            return interaction.reply({ content: '❌ خطأ أمني: هذا الحساب يمتلك حصانة المالك المطلق، لا يمكنك استخدام أوامر البوت عليه!', ephemeral: true });
        }

        const adminCommands = ['قفل-شامل', 'فتح-شامل', 'رتبة-للجميع', 'سحب-من-الجميع', 'تشغيل-مضاد-الهجمات', 'إيقاف-مضاد-الهجمات', 'منع-البوتات', 'سماح-البوتات', 'تحديث-البوت', 'تعيين-رتبة-الادارة', 'تعيين-رتبة-المشرفين', 'تعيين-رتبة-الدعم', 'تصفير-التحذيرات', 'تثبيت-قناة-المستويات', 'سجن-الرتبة', 'تثبيت-الاقتراحات'];
        const modCommands = ['حظر', 'فك-الحظر', 'طرد', 'كتم', 'فك-الكتم', 'مسح', 'تحذير', 'مسح-التحذيرات', 'قفل', 'فتح', 'الوضع-البطيء', 'إضافة-رتبة', 'إزالة-رتبة', 'اسم-مستعار', 'تطهير', 'إخفاء', 'إظهار', 'رتبة-مؤقتة', 'كتم-الرتبة', 'تحدث-الرتبة', 'تجريد-الرتب', 'حظر-جماعي', 'حظر-ناعم', 'إنشاء-رتبة', 'حذف-رتبة', 'إنشاء-قناة', 'حذف-قناة', 'تبطئة-الكل', 'إلغاء-تبطئة-الكل', 'حجر-صحي', 'فك-الحجر', 'تنظيف-البوتات', 'عرض-صلاحيات', 'قفل-الصوتي', 'فتح-الصوتي', 'كتم-الصوتي', 'فك-كتم-الصوتي', 'تعطيل-السماعة', 'تفعيل-السماعة', 'فصل-الصوتي', 'تبطئة-الصوتي', 'حدد-الصوتي', 'إخفاء-الصوتي', 'إظهار-الصوتي', 'إلغاء-التبطئة', 'مسح-رسائل-البوتات', 'استنساخ-القناة', 'قول'];

        if (adminCommands.includes(commandName) && !isAdmin) {
            return interaction.reply({ content: '❌ هذا الأمر مخصص فقط لرتبة الإدارة العليا (Admin Role) أو مالك البوت.', ephemeral: true });
        }
        if (modCommands.includes(commandName) && !isMod) {
            return interaction.reply({ content: '❌ هذا الأمر مخصص للمشرفين (Mod Role) فما فوق.', ephemeral: true });
        }

        if (commandName === 'تعيين-رتبة-الادارة') {
            const role = options.getRole('الرتبة');
            dbData.settings.botAdminRoleID = role.id; await dbData.save();
            return interaction.reply({ content: `✅ تم تعيين رتبة الإدارة العليا للبوت بنجاح: ${role}`, ephemeral: true });
        }
        if (commandName === 'تعيين-رتبة-المشرفين') {
            const role = options.getRole('الرتبة');
            dbData.settings.botModRoleID = role.id; await dbData.save();
            return interaction.reply({ content: `✅ تم تعيين رتبة المشرفين للبوت بنجاح: ${role}`, ephemeral: true });
        }
        if (commandName === 'تعيين-رتبة-الدعم') {
            const role = options.getRole('الرتبة');
            dbData.settings.botSupportRoleID = role.id; await dbData.save();
            return interaction.reply({ content: `✅ تم تعيين رتبة الدعم الفني للبوت بنجاح: ${role}`, ephemeral: true });
        }
        if (commandName === 'تثبيت-قناة-المستويات') {
            const levelChan = options.getChannel('القناة'); if (levelChan.type !== ChannelType.GuildText) return interaction.reply({ content: '❌ اختر قناة نصية.', ephemeral: true });
            dbData.settings.levelChannelID = levelChan.id; await dbData.save(); return interaction.reply({ content: `✅ تم تحديد قناة إرسال الليفل بنجاح في: ${levelChan}`, ephemeral: true });
        }
        
        if (commandName === 'سجن-الرتبة') {
            const targetRole = options.getRole('الرتبة');
            if (targetRole.id === guild.roles.everyone.id) return interaction.reply({ content: '❌ لا يمكنك تطبيق البلاك ليست على رتبة everyone@ بالكامل.', ephemeral: true });
            await interaction.reply(`⏳ جاري تطبيق نظام البلاك ليست على رتبة ${targetRole} في كافة الرومات النصية...`);
            let successfulChannels = 0;
            guild.channels.cache.forEach(async (ch) => {
                if (ch.type === ChannelType.GuildText) {
                    try {
                        await ch.permissionOverwrites.edit(targetRole, { SendMessages: false, AddReactions: false });
                        successfulChannels++;
                    } catch (err) { }
                }
            });
            return interaction.followUp(`⛔ تم وضع رتبة ${targetRole} في البلاك ليست بنجاح. يمكنهم الآن رؤية الرومات فقط ولكن لا يمكنهم الكتابة أو التفاعل.`);
        }

        // 🆕 تنفيذ الأوامر الجديدة
        if (commandName === 'قول') {
            const text = options.getString('النص');
            await interaction.reply({ content: '✅ تم الإرسال بنجاح.', ephemeral: true });
            return channel.send({ content: text });
        }

        if (commandName === 'تثبيت-الاقتراحات') {
            const sugChan = options.getChannel('القناة');
            if (sugChan.type !== ChannelType.GuildText) return interaction.reply({ content: '❌ يرجى اختيار روم نصي لتثبيت الاقتراحات.', ephemeral: true });
            dbData.settings.suggestionChannelID = sugChan.id; await dbData.save();
            return interaction.reply({ content: `✅ تم تحديد وتثبيت روم الاقتراحات الرسمي بنجاح في: ${sugChan}`, ephemeral: true });
        }

        if (commandName === 'اقتراح') {
            const sugText = options.getString('الاقتراح');
            const sugChannelID = dbData.settings.suggestionChannelID;
            if (!sugChannelID) return interaction.reply({ content: '❌ لم يتم ضبط وتثبيت روم الاقتراحات في هذا السيرفر بعد من قِبل الإدارة.', ephemeral: true });
            const sugChannel = guild.channels.cache.get(sugChannelID);
            if (!sugChannel) return interaction.reply({ content: '❌ روم الاقتراحات المثبت غير موجود حالياً، يرجى إعادة تثبيته.', ephemeral: true });

            await interaction.reply({ content: '✅ تم إرسال اقتراحك لروم الاقتراحات بنجاح، شكراً لك!', ephemeral: true });
            
            const embed = new EmbedBuilder()
                .setTitle('💡 اقتراح جديد واعد')
                .setDescription(`\`\`\`text\n${sugText}\n\`\`\``)
                .addFields({ name: '👤 صاحب الاقتراح:', value: `${user} (${user.tag})` })
                .setColor('#f39c12')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            const msg = await sugChannel.send({ embeds: [embed] });
            await msg.react('👍'); await msg.react('👎');
            return;
        }

        if (commandName === 'تشغيل') {
            const query = options.getString('الرابط_أو_الاسم');
            const voiceChannel = member.voice.channel;
            if (!voiceChannel) return interaction.reply({ content: '❌ يجب أن تكون متصلاً بروم صوتي أولاً لتشغيل الأغاني!', ephemeral: true });

            await interaction.deferReply();

            try {
                // الربط بالروم الصوتي مع ضبط selfDeafen إلى false تماماً كما طلبت
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                    selfDeafen: false 
                });

                const stream = ytdl(query, { filter: 'audioonly', highWaterMark: 1 << 25 });
                const resource = createAudioResource(stream);
                const player = createAudioPlayer();

                player.play(resource);
                connection.subscribe(player);
                audioPlayers.set(guild.id, { player, connection });

                // لوحة تحكم متطورة بالأغاني (Dashboard) بالأزرار التفاعلية
                const embed = new EmbedBuilder()
                    .setTitle('🎵 لوحة التحكم وإدارة الأغاني المباشرة')
                    .setDescription(`🎶 **يتم الآن تشغيل طلبك بنجاح في:** ${voiceChannel}\n📌 **المسار:** \`${query}\``)
                    .setColor('#2ecc71')
                    .setFooter({ text: 'تحكم بالصوت مباشرة من الأزرار بالأسفل' });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('music_pause').setLabel('⏸️ إيقاف مؤقت').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('music_resume').setLabel('▶️ استئناف').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('music_stop').setLabel('⏹️ إيقاف وفصل').setStyle(ButtonStyle.Danger)
                );

                return interaction.editReply({ embeds: [embed], components: [row] });
            } catch (err) {
                console.error(err);
                return interaction.editReply('❌ حدث خطأ أثناء محاولة تشغيل الصوت أو قراءة الرابط.');
            }
        }

        if (commandName === 'عرض-رتب-البوت') {
            const embed = new EmbedBuilder()
                .setTitle('📋 سجل رتب وإعدادات البوت الحالية')
                .setColor('#2b2d31')
                .addFields(
                    { name: '👑 مالك البوت المحصن:', value: `<@${BOT_OWNER_ID}>` },
                    { name: '⚙️ رتبة الإدارة العليا:', value: botAdminRoleID ? `<@&${botAdminRoleID}>` : '`لم يتم التعيين بعد`', inline: true },
                    { name: '🛡️ رتبة المشرفين:', value: botModRoleID ? `<@&${botModRoleID}>` : '`لم يتم التعيين بعد`', inline: true },
                    { name: '🎫 رتبة الدعم الفني:', value: botSupportRoleID ? `<@&${botSupportRoleID}>` : '`لم يتم التعيين بعد`', inline: true }
                );
            return interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'فحص-الحصانة') {
            if (isOwner) {
                return interaction.reply({ content: '👑 مرحباً بك يا مالك البوت! نظام الحصانة المطلقة نشط وفعال بنسبة 100% لحسابك ولا يمكن لأي مشرف استخدام البوت ضدك.', ephemeral: true });
            } else {
                return interaction.reply({ content: 'ℹ️ أنت لست مالك البوت الرئيسي في ملف البرمجة، الحصانة المطلقة غير مفعلة لك.', ephemeral: true });
            }
        }

        // ---- أمر المساعدة الشامل الاحترافي ----
        if (commandName === 'مساعدة') {
            const embed = new EmbedBuilder()
                .setTitle('💡 دليل أوامر النظام الإداري والأمني الشامل')
                .setDescription('مرحباً بك في قائمة المساعدة المنسقة. إليك كافة الأوامر المتاحة بالسيرفر وتفاصيل عملها:')
                .setColor('#2b2d31')
                .addFields(
                    { name: '👑 نظام الرتب والصلاحيات الجديد للمالك', value: '`/تعيين-رتبة-الادارة` - تعيين رتبة الإدارة العليا\n`/تعيين-رتبة-المشرفين` - تعيين رتبة المشرفين\n`/تعيين-رتبة-الدعم` - تعيين رتبة الدعم الفني\n`/عرض-رتب-البوت` - عرض رتب البوت | `/فحص-الحصانة` - فحص حصانة المالك\n`/سجن-الرتبة` - منع رتبة كاملة من الكتابة' },
                    { name: '🎵 الأوامر الترفيهية والتفاعلية الجديدة', value: '`/قول` - تكرار الكلام خلفك\n`/تثبيت-الاقتراحات` - تثبيت روم المقترحات\n`/اقتراح` - تقديم اقتراح للتصويت\n`/تشغيل` - تشغيل الأغاني وبدء لوحة التحكم الصوتية' },
                    { name: '🎫 أنظمة التذاكر المتقدمة والأقسام', value: '`/تثبيت-التذاكر-المتقدمة` - إعداد تكت متطور بالأقسام والصور والخيارات التفاعلية' },
                    { name: '👋 أنظمة الإعدادات والترحيب والتفاعل', value: '`/تثبيت-الترحيب` - تعيين روم الترحيب المطور\n`/تثبيت-السجلات` - تعيين روم السجلات واللوق\n`/تثبيت-قناة-المستويات` - تحديد روم إرسال ترقيات التفاعل\n`/المستوى` - عرض مستواك وتفاعلك الحالي\n`/الصدارة` - قائمة أعلى المتفاعلين\n`/يومي` - استلام المكافأة اليومية' },
                    { name: '🔨 أوامر الإشراف الأساسية', value: '`/حظر` - حظر عضو | `/فك-الحظر` - فك حظر\n`/طرد` - طرد عضو | `/كتم` - كتم مؤقت\n`/فك-الكتم` - فك كتم | `/مسح` - مسح رسائل\n`/تحذير` - تحذير عضو | `/التحذيرات` - سجل التحذيرات\n`/قفل` - قفل الروم | `/فتح` - فتح الروم\n`/تطهير` - تصفية الشات | `/إخفاء` - إخفاء الروم\n`/قفل-شامل` - قفل السيرفر الشامل | `/تشغيل-مضاد-الهجمات` - جدار الحماية' },
                    { name: '🎙️ أوامر التحكم بالرومات الصوتية والإدارة الجماعية', value: '`/قفل-الصوتي` - قفل روم صوتي | `/فتح-الصوتي` - فتح روم صوتي\n`/كتم-الصوتي` - كتم بالصوتي | `/فك-كتم-الصوتي` - فك كتم بالصوتي\n`/تعطيل-السماعة` - سماعة بالصوتي | `/فصل-الصوتي` - طرد من الصوتي\n`/حدد-الصوتي` - تحديد الحد الأقصى | `/تصفير-التحذيرات` - مسح التحذيرات عامة\n`/رتبة-للجميع` - إعطاء رتبة للجميع | `/سحب-من-الجميع` - سحب رتبة من الجميع\n`/منع-البوتات` - منع دخول البوتات الغريبة | `/استنساخ-القناة` - استنساخ الروم الحالي' }
                )
                .setFooter({ text: `تم تنظيم الصلاحيات بنجاح • إجمالي الأوامر: 73 أمراً متاحاً`, iconURL: guild.iconURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // ---- تنفيذ الأوامر الإدارية والصوتية والإشرافية المتبقية ----
        if (commandName === 'قفل-الصوتي') {
            const chan = options.getChannel('القناة'); if (chan.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ اختر روم صوتي فقط.', ephemeral: true });
            await chan.permissionOverwrites.edit(guild.roles.everyone, { Connect: false }); await interaction.reply(`🔒 تم قفل الروم الصوتي بنجاح: ${chan}`);
        }
        if (commandName === 'فتح-الصوتي') {
            const chan = options.getChannel('القناة'); if (chan.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ اختر روم صوتي only.', ephemeral: true });
            await chan.permissionOverwrites.edit(guild.roles.everyone, { Connect: true }); await interaction.reply(`🔓 تم فتح الروم الصوتي بنجاح: ${chan}`);
        }
        if (commandName === 'كتم-الصوتي') {
            const target = options.getMember('العضو'); if (!target.voice.channel) return interaction.reply({ content: '❌ هذا العضو غير متواجد في روم صوتي حالياً.', ephemeral: true });
            await target.voice.setMute(true); await interaction.reply(`🔇 تم كتم صوت العضو ${target} في الروم الصوتي.`);
        }
        if (commandName === 'فك-كتم-الصوتي') {
            const target = options.getMember('العضو'); if (!target.voice.channel) return interaction.reply({ content: '❌ هذا العضو غير متواجد في روم صوتي حالياً.', ephemeral: true });
            await target.voice.setMute(false); await interaction.reply(`🔊 تم فك كتم صوت العضو ${target} بنجاح.`);
        }
        if (commandName === 'تعطيل-السماعة') {
            const target = options.getMember('العضو'); if (!target.voice.channel) return interaction.reply({ content: '❌ العضو ليس في روم صوتي.', ephemeral: true });
            await target.voice.setDeafen(true); await interaction.reply(`🎧 تم تعطيل سماعة العضو ${target} بنجاح.`);
        }
        if (commandName === 'تفعيل-السماعة') {
            const target = options.getMember('العضو'); if (!target.voice.channel) return interaction.reply({ content: '❌ العضو ليس في روم صوتي.', ephemeral: true });
            await target.voice.setDeafen(false); await interaction.reply(`🎵 تم إعادة تفعيل سماعة العضو ${target} بنجاح.`);
        }
        if (commandName === 'فصل-الصوتي') {
            const target = options.getMember('العضو'); if (!target.voice.channel) return interaction.reply({ content: '❌ العضو ليس في روم صوتي لفصله.', ephemeral: true });
            await target.voice.disconnect(); await interaction.reply(`🚫 تم فصل وطرد العضو ${target} من الروم الصوتي فوراً.`);
        }
        if (commandName === 'تبطئة-الصوتي') {
            const chan = options.getChannel('القناة'); const secs = options.getInteger('الثواني'); if (chan.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ اختر روم صوتي فقط.', ephemeral: true });
            await chan.setRateLimitPerUser(secs); await interaction.reply(`⏳ تم تفعيل وضع التباطؤ في الروم الصوتي ${chan} لـ \`${secs}\` ثانية.`);
        }
        if (commandName === 'حدد-الصوتي') {
            const chan = options.getChannel('القناة'); const limit = options.getInteger('الحد'); if (chan.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ اختر روم صوتي فقط.', ephemeral: true });
            await chan.setUserLimit(limit); await interaction.reply(`👥 تم تعديل الحد الأقصى للأعضاء في الروم الصوتي ${chan} إلى \`${limit}\` عضو.`);
        }
        if (commandName === 'إخفاء-الصوتي') {
            const chan = options.getChannel('القناة'); if (chan.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ اختر روم صوتي فقط.', ephemeral: true });
            await chan.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }); await interaction.reply(`🙈 تم إخفاء الروم الصوتي ${chan} عن الجميع بنجاح.`);
        }
        if (commandName === 'إظهار-الصوتي') {
            const chan = options.getChannel('القناة'); if (chan.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ اختر روم صوتي فقط.', ephemeral: true });
            await chan.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true }); await interaction.reply(`👀 تم إظهار الروم الصوتي ${chan} بنجاح.`);
        }
        if (commandName === 'تصفير-التحذيرات') {
            dbData.moderation.warns = []; await dbData.save(); await interaction.reply('🧼 تم مسح جميع التحذيرات المسجلة لكافة أعضاء السيرفر بالكامل بنجاح!');
        }
        if (commandName === 'حظر-مؤقت') {
            const target = options.getMember('العضو'); const hours = options.getInteger('المدة'); const reason = options.getString('السبب') || 'حظر مؤقت';
            if (!target.bannable) return interaction.reply({ content: '❌ لا يمكن حظر هذا العضو.', ephemeral: true });
            await target.ban({ reason }); await interaction.reply(`🔨 تم حظر العضو ${target.user.username} مؤقتاً لمدة \`${hours}\` ساعة. السبب: ${reason}`);
            setTimeout(async () => { await guild.members.unban(target.id).catch(() => {}); }, hours * 60 * 60 * 1000);
        }
        if (commandName === 'إلغاء-التباطئة') { await channel.setRateLimitPerUser(0); await interaction.reply('🛑 تم إلغاء وضع التباطؤ تماماً في الروم الحالي.'); }
        if (commandName === 'رتبة-للجميع') {
            await interaction.reply('👥 جاري بدء عملية توزيع الرتبة على جميع الأعضاء، قد يستغرق هذا بعض الوقت...');
            const role = options.getRole('الرتبة'); guild.members.cache.forEach(async (m) => { if (!m.user.bot) await m.roles.add(role).catch(() => {}); });
            await interaction.followUp(`✅ تم الانتهاء من إعطاء رتبة ${role} لجميع الأعضاء بنجاح.`);
        }
        if (commandName === 'سحب-من-الجميع') {
            await interaction.reply('🚫 جاري بدء عملية سحب الرتبة من الجميع...');
            const role = options.getRole('الرتبة'); guild.members.cache.forEach(async (m) => { if (!m.user.bot) await m.roles.remove(role).catch(() => {}); });
            await interaction.followUp(`✅ تم الانتهاء من سحب رتبة ${role} من جميع الأعضاء بنجاح.`);
        }
        if (commandName === 'استنساخ-القناة') { const cloned = await channel.clone(); await cloned.setPosition(channel.position); await interaction.reply(`📑 تم استنسـاخ الروم الحالي بنجاح في: ${cloned}`); }
        if (commandName === 'مسح-رسائل-البوتات') {
            const amount = options.getInteger('العدد'); const msgs = await channel.messages.fetch({ limit: amount });
            const botMsgs = msgs.filter(m => m.author.bot); await channel.bulkDelete(botMsgs, true);
            await interaction.reply({ content: `🧹 تم مسح رسائل البوتات فقط من أصل آخر \`${amount}\` رسالة مفحوصة.`, ephemeral: true });
        }
        if (commandName === 'منع-البوتات') { globalAntiBot = true; await interaction.reply('🛡️ تم تفعيل جدار حظر ومنع دخول البوتات الغريبة بنجاح.'); }
        if (commandName === 'سماح-البوتات') { globalAntiBot = false; await interaction.reply('🟢 تم إيقاف حظر دخول البوتات والسماح لها بشكل طبيعي.'); }

        if (commandName === 'تثبيت-السجلات') {
            const logChan = options.getChannel('القناة'); if (logChan.type !== ChannelType.GuildText) return interaction.reply({ content: '❌ اختر قناة نصية.', ephemeral: true });
            dbData.settings.logChannelID = logChan.id; await dbData.save(); return interaction.reply({ content: `✅ تم تعيين قناة اللوج في: ${logChan}`, ephemeral: true });
        }
        if (commandName === 'تثبيت-الترحيب') {
            const welcomeChan = options.getChannel('القناة'); if (welcomeChan.type !== ChannelType.GuildText) return interaction.reply({ content: '❌ يرجى اختيار قناة نصية صالحة لإرسال الترحيب.', ephemeral: true });
            dbData.settings.welcomeChannelID = welcomeChan.id; await dbData.save(); return interaction.reply({ content: `✅ تم تفعيل وإعداد نظام الترحيب المطور بنجاح في قناة: ${welcomeChan}`, ephemeral: true });
        }
        if (commandName === 'تثبيت-التذاكر-المتقدمة') {
            const title = options.getString('العنوان'); const description = options.getString('الوصف'); const image = options.getString('الصورة'); const sectionsRaw = options.getString('الأقسام');
            const sections = sectionsRaw.split(',').map(s => s.trim()).filter(s => s.length > 0); if (sections.length === 0) return interaction.reply({ content: '❌ يرجى كتابة قسم واحد على الأقل بشكل صحيح.', ephemeral: true });
            const embed = new EmbedBuilder().setTitle(title).setDescription(`${description}\n\n**📌 الأقسام المتاحة حالياً:**\n${sections.map(s => `• \`${s}\``).join('\n')}`).setColor('#2b2d31').setImage(image);
            const selectMenu = new StringSelectMenuBuilder().setCustomId('advanced_ticket_select').setPlaceholder('📁 اضغط هنا لاختيار القسم المناسب للتذكرة...').addOptions(sections.map(s => ({ label: s, description: `فتح تذكرة جديدة في قسم: ${s}`, value: s, emoji: '🎫' })));
            await interaction.reply({ content: '✅ تم إنشاء نظام التذاكر المتقدم بنجاح!', ephemeral: true }); await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
        }
        if (commandName === 'المستوى') {
            const userLevel = dbData?.levels.find(l => l.userID === user.id); if (!userLevel) return interaction.reply('📊 لا يوجد سجل تفاعل لك بعد.');
            const xpNeeded = (userLevel.level + 1) * 100; const progress = Math.floor((userLevel.xp / xpNeeded) * 100);
            const embed = new EmbedBuilder().setTitle(`📊 بطاقة ليفل | ${user.username}`).addFields({ name: '✨ ليفل:', value: `\`🏅 Level ${userLevel.level}\``, inline: true }, { name: '⭐ نقاط XP:', value: `\`✨ ${userLevel.xp} / ${xpNeeded}\` (${progress}%)`, inline: true }).setColor('#3498db'); return interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'الصدارة') {
            if (!dbData || !dbData.levels || dbData.levels.length === 0) return interaction.reply('❌ لا توجد مستويات بالسيرفر.');
            const sorted = dbData.levels.sort((a, b) => b.level === a.level ? b.xp - a.xp : b.level - a.level).slice(0, 10);
            const embed = new EmbedBuilder().setTitle(`🏆 متصدري شات السيرفر`).setColor('#f1c40f'); let desc = "";
            for (let i = 0; i < sorted.length; i++) { try { const m = await guild.members.fetch(sorted[i].userID); desc += `#${i+1} **${m.user.username}** - ليفل \`${sorted[i].level}\`\n`; } catch { desc += `#${i+1} مستخدم غادر\n`; } }
            embed.setDescription(desc); return interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'يومي') {
            let eco = dbData.economy.find(e => e.userID === user.id); if (!eco) { dbData.economy.push({ userID: user.id, coins: 0 }); eco = dbData.economy.find(e => e.userID === user.id); }
            if (eco.dailyCooldown && (new Date() - eco.dailyCooldown < 86400000)) return interaction.reply({ content: '❌ استلمت جائزتك اليومية بالفعل.', ephemeral: true });
            eco.coins += 500; eco.dailyCooldown = new Date(); await dbData.save(); return interaction.reply(`💰 استلمت **500** عملة بنجاح! رصيدك الحالي: **${eco.coins}**.`);
        }
        if (commandName === 'حظر') {
            const target = options.getMember('العضو'); const reason = options.getString('السبب') || 'بدون سبب معطى'; if (!target.bannable) return interaction.reply({ content: '❌ لا يمكن حظره.', ephemeral: true });
            await target.ban({ reason }); await interaction.reply(`🔨 تم حظر ${target.user.username}. السبب: ${reason}`);
        }
        if (commandName === 'فك-الحظر') { const targetId = options.getString('المعرف'); try { await guild.members.unban(targetId); await interaction.reply(`🔓 تم إلغاء حظر الحساب بنجاح.`); } catch { await interaction.reply({ content: '❌ لم يتم العثور على الـ ID.', ephemeral: true }); } }
        if (commandName === 'طرد') {
            const target = options.getMember('العضو'); const reason = options.getString('السبب') || 'بدون سبب'; if (!target.kickable) return interaction.reply({ content: '❌ لا يمكن طرده.', ephemeral: true });
            await target.kick(reason); await interaction.reply(`👢 تم طرد ${target.user.username}.`);
        }
        if (commandName === 'كتم') { const target = options.getMember('العضو'); const duration = options.getInteger('المدة') * 60 * 1000; await target.timeout(duration, 'أمر إداري'); await interaction.reply(`🔇 تم كتم ${target}.`); }
        if (commandName === 'فك-الكتم') { const target = options.getMember('العضو'); await target.timeout(null); await interaction.reply(`🔊 تم فك كتم ${target}.`); }
        if (commandName === 'مسح') { const amount = options.getInteger('العدد'); await channel.bulkDelete(amount, true); await interaction.reply({ content: `🧹 تم مسح \`${amount}\` رسالة.`, ephemeral: true }); }
        if (commandName === 'تحذير') {
            const target = options.getMember('العضو'); const reason = options.getString('السبب'); dbData.moderation.warns.push({ userID: target.id, reason: reason, moderatorID: user.id }); await dbData.save(); await interaction.reply(`⚠️ تم تحذير ${target}. السبب: ${reason}`);
        }
        if (commandName === 'التحذيرات') {
            const target = options.getMember('العضو'); const uWarns = dbData?.moderation.warns.filter(w => w.userID === target.id) || []; if (uWarns.length === 0) return interaction.reply(`😇 ليس لديه تحذيرات.`);
            let list = uWarns.map((w, i) => `**[${i+1}]** سبب: \`${w.reason}\``).join('\n'); await interaction.reply(`📋 تحذيرات ${target.user.username}:\n${list}`);
        }
        if (commandName === 'مسح-التحذيرات') { const target = options.getMember('العضو'); if (dbData) { dbData.moderation.warns = dbData.moderation.warns.filter(w => w.userID !== target.id); await dbData.save(); } await interaction.reply(`🧼 تم مسح تحذيرات ${target}.`); }
        if (commandName === 'قفل') { await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }); await interaction.reply('🔒 تم قفل الغرفة.'); }
        if (commandName === 'فتح') { await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true }); await interaction.reply('🔓 تم فتح الغرفة.'); }
        if (commandName === 'الوضع-البطيء') { await channel.setRateLimitPerUser(options.getInteger('الثواني')); await interaction.reply(`⏳ تم تفعيل وضع التباطؤ.`); }
        if (commandName === 'إضافة-رتبة') { const target = options.getMember('العضو'); const role = options.getRole('الرتبة'); await target.roles.add(role); await interaction.reply(`➕ تم إعطاء الرتبة.`); }
        if (commandName === 'إزالة-رتبة') { const target = options.getMember('العضو'); const role = options.getRole('الرتبة'); await target.roles.remove(role); await interaction.reply(`➖ تم سحب الرتبة.`); }
        if (commandName === 'اسم-مستعار') { const target = options.getMember('العضو'); await target.setNickname(options.getString('الاسم')); await interaction.reply(`🏷️ تم تغيير الاسم.`); }
        if (commandName === 'تطهير') { const pos = channel.position; const newChan = await channel.clone(); await channel.delete().catch(() => {}); await newChan.setPosition(pos); await newChan.send({ embeds: [new EmbedBuilder().setDescription('☢️ تم نيوك وتطهير الروم!').setColor('#2ecc71')] }); }
        if (commandName === 'إخفاء') { await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }); await interaction.reply('🙈 تم إخفاء الروم.'); }
        if (commandName === 'إظهار') { await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true }); await interaction.reply('👀 تم إظهار الروم.'); }
        if (commandName === 'رتبة-مؤقتة') {
            const target = options.getMember('العضو'); const role = options.getRole('الرتبة'); const mins = options.getInteger('الدقائق'); await target.roles.add(role); await interaction.reply(`⏱️ رتبة مؤقتة لـ ${mins} دقيقة.`);
            setTimeout(async () => { const m = await guild.members.fetch(target.id).catch(() => null); if (m) await m.roles.remove(role).catch(() => {}); }, mins * 60 * 1000);
        }
        if (commandName === 'تحديث-البوت') { await interaction.reply('🔄 جاري إعادة التشغيل...'); process.exit(0); }
        if (commandName === 'قفل-شامل') { await interaction.reply('🚨 جاري فرض حالة إغلاق الطوارئ الشامل...'); guild.channels.cache.forEach(async (ch) => { if (ch.type === ChannelType.GuildText) await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).catch(() => {}); }); await interaction.followUp('🔒 تم إغلاق السيرفر بالكامل.'); }
        if (commandName === 'فتح-شامل') { await interaction.reply('🟢 جاري فك حالة الطوارئ...'); guild.channels.cache.forEach(async (ch) => { if (ch.type === ChannelType.GuildText) await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true }).catch(() => {}); }); await interaction.followUp('🔓 تم إعادة فتح السيرفر.'); }
        if (commandName === 'كتم-الرتبة') { const role = options.getRole('الرتبة'); await channel.permissionOverwrites.edit(role, { SendMessages: false }); await interaction.reply(`🔇 تم منع الرتبة.`); }
        if (commandName === 'تحدث-الرتبة') { const role = options.getRole('الرتبة'); await channel.permissionOverwrites.edit(role, { SendMessages: true }); await interaction.reply(`🔊 تم فك منع الرتبة.`); }
        if (commandName === 'تجريد-الرتب') { const target = options.getMember('العضو'); if (!target.manageable) return interaction.reply({ content: '❌ لا يمكن التحكم برتبه.', ephemeral: true }); const userRoles = target.roles.cache.filter(r => r.id !== guild.id); userRoles.forEach(async (r) => await target.roles.remove(r).catch(() => {})); await interaction.reply(`🛡️ تم تجريد العضو من رتبه.`); }
        if (commandName === 'حظر-جماعي') {
            const idsStr = options.getString('المعرفات'); const reason = options.getString('السبب') || 'حظر جماعي أمني'; const ids = idsStr.split(/\s+/); await interaction.reply(`💥 جاري بدء عملية الحظر الجماعي...`);
            let count = 0; for (const id of ids) { try { await guild.members.ban(id, { reason }); count++; } catch {} } await interaction.followUp(`✅ تم حظر \`${count}\` حساب.`);
        }
        if (commandName === 'حظر-ناعم') {
            const target = options.getMember('العضو'); const reason = options.getString('السبب') || 'سوفت بان لتنظيف الرسائل'; if (!target.bannable) return interaction.reply({ content: '❌ غير قابل للحظر.', ephemeral: true });
            await guild.members.ban(target.id, { deleteMessageSeconds: 7 * 24 * 60 * 60, reason }); await guild.members.unban(target.id); await interaction.reply(`🧹 تم عمل سوفت بان لـ ${target.user.username}.`);
        }
        if (commandName === 'إنشاء-رتبة') { const name = options.getString('الاسم'); const color = options.getString('اللون') || '#95a5a6'; const newRole = await guild.roles.create({ name, color, reason: 'إنشاء سريع' }); await interaction.reply(`🛠️ تم إنشاء الرتبة: ${newRole}`); }
        if (commandName === 'حذف-رتبة') { const role = options.getRole('الرتبة'); if (!role.editable) return interaction.reply({ content: '❌ لا يمكن حذفها.', ephemeral: true }); await role.delete(); await interaction.reply(`🗑️ تم حذف الرتبة.`); }
        if (commandName === 'إنشاء-قناة') { const name = options.getString('الاسم'); const type = options.getInteger('النوع'); const newChan = await guild.channels.create({ name, type }); await interaction.reply(`📁 تم إنشاء القناة: ${newChan}`); }
        if (commandName === 'حذف-قناة') { const ch = options.getChannel('القناة'); await ch.delete(); await interaction.reply(`🗑️ تم حذف القناة.`); }
        if (commandName === 'تبطئة-الكل') { guild.channels.cache.forEach(async (ch) => { if (ch.type === ChannelType.GuildText) await ch.setRateLimitPerUser(5).catch(() => {}); }); await interaction.reply('⏳ تم تفعيل وضع التباطؤ العام.'); }
        if (commandName === 'إلغاء-تبطئة-الكل') { guild.channels.cache.forEach(async (ch) => { if (ch.type === ChannelType.GuildText) await ch.setRateLimitPerUser(0).catch(() => {}); }); await interaction.reply('🛑 تم إلغاء وضع التباطؤ العام.'); }
        if (commandName === 'حجر-صحي') {
            const target = options.getMember('العضو'); let qRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'quarantined');
            if (!qRole) { qRole = await guild.roles.create({ name: 'Quarantined', color: '#555555', permissions: [] }); guild.channels.cache.forEach(async (ch) => { if (ch.type === ChannelType.GuildText) await ch.permissionOverwrites.edit(qRole, { ViewChannel: false }); }); }
            await target.roles.add(qRole); await interaction.reply(`☣️ تم وضع العضو في الحجر الأمني.`);
        }
        if (commandName === 'فك-الحجر') { const target = options.getMember('العضو'); const qRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'quarantined'); if (qRole) await target.roles.remove(qRole); await interaction.reply(`🟢 تم رفع الحجر الأمني.`); }
        if (commandName === 'تنظيف-البوتات') { const amount = options.getInteger('العدد'); const msgs = await channel.messages.fetch({ limit: amount }); const botMsgs = msgs.filter(m => m.author.bot); await channel.bulkDelete(botMsgs, true); await interaction.reply({ content: `🤖 تم تنظيف رسائل البوتات.`, ephemeral: true }); }
        if (commandName === 'عرض-الصلاحيات') {
            const target = options.getMember('العضو'); const perms = target.permissions.toArray().map(p => `\`${p}\``).join(', ');
            const embed = new EmbedBuilder().setTitle(`🔍 فحص أمني للمشرف`).setDescription(`الأعضاء: ${target}\n\n**الصلاحيات:**\n${perms || 'لا يملك صلاحيات'}`).setColor('#e67e22'); await interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'تشغيل-مضاد-الهجمات') { globalAntiRaid = true; await interaction.reply('🚨 تم تفعيل جدار الحماية الأقصى.'); }
        if (commandName === 'إيقاف-مضاد-الهجمات') { globalAntiRaid = false; await interaction.reply('🟢 تم إيقاف وضع الحماية المطلقة.'); }
        if (commandName === 'معلومات-السيرفر') {
            const embed = new EmbedBuilder().setTitle(`📊 التقرير الأمني لـ ${guild.name}`).addFields({ name: '👥 الأعضاء الإجمالي:', value: `\`${guild.memberCount}\``, inline: true }, { name: '🔒 مستوى التحقق:', value: `\`المستوى ${guild.verificationLevel}\``, inline: true }, { name: '🛡️ وضع Anti-Raid:', value: `\`${globalAntiRaid ? '🔴 نشط' : '🟢 مستقر'}\``, inline: true }).setColor('#9b59b6').setTimestamp(); await interaction.reply({ embeds: [embed] });
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'advanced_ticket_select') {
        const selectedSection = interaction.values[0];
        const modal = new ModalBuilder().setCustomId(`advanced_ticket_modal_${selectedSection}`).setTitle(`🎫 تذكرة: ${selectedSection}`);
        const reason = new TextInputBuilder().setCustomId('ticket_reason').setLabel("ما هو سبب/تفاصيل تذكرتك؟").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(reason)); await interaction.showModal(modal);
    }

    if (interaction.isButton()) {
        const musicInstance = audioPlayers.get(interaction.guild.id);
        
        // 🎛️ التفاعل مع أزرار لوحة تحكم الأغاني والـ Dashboard الصوتي
        if (interaction.customId === 'music_pause') {
            if (!musicInstance) return interaction.reply({ content: '❌ لا توجد أغنية تعمل حالياً بالسيرفر لتوقيفها.', ephemeral: true });
            musicInstance.player.pause();
            return interaction.reply({ content: '⏸️ تم إيقاف الأغنية مؤقتاً بنجاح.', ephemeral: true });
        }
        if (interaction.customId === 'music_resume') {
            if (!musicInstance) return interaction.reply({ content: '❌ لا توجد أغنية متوقفة لاستئنافها.', ephemeral: true });
            musicInstance.player.unpause();
            return interaction.reply({ content: '▶️ تم استئناف تشغيل الصوت بنجاح.', ephemeral: true });
        }
        if (interaction.customId === 'music_stop') {
            if (!musicInstance) return interaction.reply({ content: '❌ البوت ليس متصلاً بروم صوتي ليتم فصله.', ephemeral: true });
            musicInstance.player.stop();
            musicInstance.connection.destroy();
            audioPlayers.delete(interaction.guild.id);
            return interaction.reply({ content: '⏹️ تم إيقاف التشغيل وفصل البوت من الروم الصوتي بالكامل.', ephemeral: true });
        }

        if (interaction.customId === 'claim_ticket') {
            let dbData = await GuildData.findOne({ guildID: interaction.guild.id });
            const hasSupport = interaction.member.roles.cache.has(dbData?.settings?.botSupportRoleID) || interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) || interaction.user.id === BOT_OWNER_ID;
            if (!hasSupport) return interaction.reply({ content: '❌ هذا الزر مخصص لطاقم الدعم الفني أو المشرفين فقط.', ephemeral: true });
            
            await interaction.reply({ content: `🔒 تم استلام التذكرة بواسطة المساعد: ${interaction.user}` });
            const disabledRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('claim_ticket').setLabel('تم الاستلام').setStyle(ButtonStyle.Success).setDisabled(true), new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger));
            await interaction.message.edit({ components: [disabledRow] });
            await sendLog(interaction.guild, new EmbedBuilder().setTitle('🙋‍♂️ تذكرة مستلمة').setDescription(`**الروم:** ${interaction.channel.name}\n**المستلم:** ${interaction.user}`).setColor('#f1c40f').setTimestamp());
        }
        if (interaction.customId === 'close_ticket') {
            let dbData = await GuildData.findOne({ guildID: interaction.guild.id });
            const hasSupport = interaction.member.roles.cache.has(dbData?.settings?.botSupportRoleID) || interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) || interaction.user.id === BOT_OWNER_ID;
            if (!hasSupport) return interaction.reply({ content: '❌ لا يمكنك إغلاق التذكرة، للمشرفين والدعم فقط.', ephemeral: true });

            await interaction.reply('🔒 جاري أرشفة وإغلاق الغرفة خلال 5 ثوانٍ...');
            try {
                const fetched = await interaction.channel.messages.fetch({ limit: 100 });
                let tx = `أرشيف تذكرة: ${interaction.channel.name}\n\n`; fetched.reverse().forEach(m => { tx += `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}\n`; });
                const logEmbed = new EmbedBuilder().setTitle('📄 أرشيف تذكرة مغلقة').setDescription(`تم حذف **${interaction.channel.name}**\n**بواسطة:** ${interaction.user}`).setColor('#ff3333').setTimestamp();
                await sendLog(interaction.guild, logEmbed, [{ attachment: Buffer.from(tx), name: `${interaction.channel.name}-transcript.txt` }]);
            } catch (err) { console.error(err); }
            setTimeout(async () => { await interaction.channel.delete().catch(() => {}); }, 5000);
        }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('advanced_ticket_modal_')) {
        const sectionName = interaction.customId.replace('advanced_ticket_modal_', ''); const reason = interaction.fields.getTextInputValue('ticket_reason');
        const chan = await interaction.guild.channels.create({ name: `🎫-${sectionName}-${interaction.user.username}`, type: ChannelType.GuildText, permissionOverwrites: [{ id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }, { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] });
        const embed = new EmbedBuilder().setTitle(`🎫 تذكرة جديدة | قسم ${sectionName}`).setDescription(`مرحباً بك يا ${interaction.user} في تذكرتك المخصصة لقسم **[ ${sectionName} ]**.\n\n**تفاصيل طلبك:**\n\`\`\`text\n${reason}\n\`\`\`\nفريق الدعم سيتواجد معك قريباً.`).setColor('#2b2d31').setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger));
        await chan.send({ embeds: [embed], components: [row] }); await interaction.reply({ content: `✅ تم فتح تذكرتك بقسم **${sectionName}** في: ${chan}`, ephemeral: true });
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
                    return message.channel.send(`🚨 تم كتم ${message.author} تلقائياً 5 دقائق للسبام.`);
                }
                userData.msgCount++;
            } else { userData.msgCount = 1; } userData.lastMessageTime = now;
        } else { antiSpamMap.set(authId, { lastMessageTime: now, msgCount: 1 }); }
    }

    const scamRegex = /(discord\.gg\/|gift|nitro|steam|crypto)/i;
    if (scamRegex.test(message.content) && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        await message.delete().catch(() => {}); await message.member.timeout(600000, 'نشر روابط').catch(() => {});
        return message.channel.send(`⚠️ تم حذف رابط ${message.author} وكتمه لـ 10 دقائق.`);
    }

    let data = await GuildData.findOne({ guildID: message.guild.id }) || new GuildData({ guildID: message.guild.id });
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
    if (globalAntiRaid) { try { await m.send(`❌ تم طردك تلقائياً نظراً لتفعيل وضع الطوارئ والـ Anti-Raid حالياً.`).catch(() => {}); return await m.kick('وضع الـ Anti-Raid مفعل طوارئ'); } catch {} }
    if (Date.now() - m.user.createdTimestamp < 3 * 24 * 60 * 60 * 1000) { await m.send(`❌ تم طردك تلقائياً لأن حسابك وهمي لحماية السيرفر.`).catch(() => {}); return await m.kick('حساب وهمي (Anti-Alt protection)').catch(() => {}); }
    
    let invTxt = "غير معروف";
    try {
        const cached = invitesCache.get(m.guild.id); const current = await m.guild.invites.fetch();
        for (const [code, inv] of current) { if (inv.uses > (cached?.get(code) || 0)) { invTxt = `**${inv.inviter.tag}**\n**الكود:** \`${code}\``; cached.set(code, inv.uses); break; } }
    } catch { }

    const logEmbed = new EmbedBuilder().setTitle('📥 عضو جديد انضم').setDescription(`**العضو:** ${m} (${m.user.tag})\n**دعا بواسطة:** ${invTxt}`).setColor('#2ecc71').setTimestamp(); 
    await sendLog(m.guild, logEmbed);

    const dbData = await GuildData.findOne({ guildID: m.guild.id });
    if (dbData && dbData.settings && dbData.settings.welcomeChannelID) {
        const welcomeChannel = m.guild.channels.cache.get(dbData.settings.welcomeChannelID);
        if (welcomeChannel) {
            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`✨ أهلاً بك في سيرفر ${m.guild.name}!`)
                .setDescription(`مرحباً بك يا ${m} في مجتمعنا! يسعدنا جداً انضمامك إلينا.\n\nنتمنى لك وقتاً ممتعاً، لا تنسَ قراءة القوانين والتفاعل مع الأعضاء في الشات العام. 👋`)
                .addFields(
                    { name: '🆔 حسابك:', value: `${m.user.tag}`, inline: true },
                    { name: '🔢 رقمك بالسيرفر:', value: `#${m.guild.memberCount}`, inline: true },
                    { name: '📅 إنشاء الحساب:', value: `<t:${Math.floor(m.user.createdTimestamp / 1000)}:R>`, inline: false }
                )
                .setThumbnail(m.user.displayAvatarURL({ dynamic: true }))
                .setColor('#2b2d31')
                .setFooter({ text: `استمتع بوقتك معنا • ${m.guild.name}`, iconURL: m.guild.iconURL() })
                .setTimestamp();

            await welcomeChannel.send({ content: `👑 نورت السيرفر يا ${m}!`, embeds: [welcomeEmbed] }).catch(() => {});
        }
    }
});

process.on('unhandledRejection', error => console.error('[خطأ غير معالج]:', error));

client.login(process.env.TOKEN);
