require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextInputBuilder, TextInputStyle, ModalBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');
const mongoose = require('mongoose');

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
const BOT_OWNER_ID = '1507841424186675220'; 

const antiSpamMap = new Map();
const invitesCache = new Map();
let globalAntiRaid = false;
let globalAntiBot = false;

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بقاعدة بيانات MongoDB بنجاح!'))
    .catch((err) => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

client.once('ready', async () => {
    console.log(`🚀 تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
    
    const commands = [
        // أنظمة التذاكر والترحيب والإعدادات السابقة
        { name: 'setup-ticket', description: 'إعداد نظام تذاكر الدعم الفني الحديث بالسيرفر' },
        { 
            name: 'setup-advanced-ticket', 
            description: '⚙️ إعداد نظام تذاكر متطور بأقسام وصور مخصصة من اختيارك',
            options: [
                { name: 'title', description: 'عنوان الإمبيد الرئيسي', type: 3, required: true },
                { name: 'description', description: 'وصف أو إرشادات التكت', type: 3, required: true },
                { name: 'image', description: 'رابط صورة أو بنر للتكت (رابط URL)', type: 3, required: true },
                { name: 'sections', description: 'الأقسام مفصولة بفاصلة (مثال: دعم فني, شكاوى)', type: 3, required: true }
            ]
        },
        { name: 'setup-welcome', description: '👋 تحديد قناة إرسال رسائل الترحيب المتطورة بالأعضاء الجدد', options: [{ name: 'channel', description: 'اختر روم الترحيب', type: 7, required: true }] },
        { name: 'setup-logs', description: 'تحديد قناة إرسال لوقات السيرفر المتطورة', options: [{ name: 'channel', description: 'اختر قناة اللوج', type: 7, required: true }] },
        { name: 'rank', description: 'عرض مستواك الحالي ونقاط الخبرة الخاصة بك' },
        { name: 'leaderboard', description: 'عرض قائمة أعلى 10 أعضاء متفاعلين في السيرفر' },
        { name: 'daily', description: 'استلام مكافأتك المالية اليومية' },

        // الـ 40 أمر إشراف وتأمين السابقة كاملة بدون أي تعديل
        { name: 'ban', description: '🔨 حظر عضو من السيرفر', options: [{ name: 'user', description: 'العضو المراد حظره', type: 6, required: true }, { name: 'reason', description: 'السبب', type: 3 }] },
        { name: 'unban', description: '🔓 فك الحظر عن عضو', options: [{ name: 'id', description: 'ID الشخص المحظور', type: 3, required: true }] },
        { name: 'kick', description: '👢 طرد عضو من السيرفر', options: [{ name: 'user', description: 'العضو المراد طرده', type: 6, required: true }, { name: 'reason', description: 'السبب', type: 3 }] },
        { name: 'mute', description: '🔇 كتم عضو (Timeout)', options: [{ name: 'user', description: 'العضو', type: 6, required: true }, { name: 'duration', description: 'المدة بالدقائق', type: 4, required: true }, { name: 'reason', description: 'السبب', type: 3 }] },
        { name: 'unmute', description: '🔊 فك الكتم عن عضو', options: [{ name: 'user', description: 'العضو', type: 6, required: true }] },
        { name: 'clear', description: '🧹 مسح عدد معين من الرسائل', options: [{ name: 'amount', description: 'عدد الرسائل (1-100)', type: 4, required: true }] },
        { name: 'warn', description: '⚠️ تحذير عضو وتسجيله بقاعدة البيانات', options: [{ name: 'user', description: 'العضو', type: 6, required: true }, { name: 'reason', description: 'السبب', type: 3, required: true }] },
        { name: 'warns', description: '📋 عرض سجل تحذيرات عضو', options: [{ name: 'user', description: 'العضو', type: 6, required: true }] },
        { name: 'clearwarns', description: '🧼 مسح جميع تحذيرات عضو', options: [{ name: 'user', description: 'العضو', type: 6, required: true }] },
        { name: 'lock', description: '🔒 قفل الروم الحالي لمنع الكتابة' },
        { name: 'unlock', description: '🔓 فتح الروم الحالي للسماح بالكتابة' },
        { name: 'slowmode', description: '⏳ وضع وقت انتظار للرسائل في الروم', options: [{ name: 'seconds', description: 'عدد الثواني', type: 4, required: true }] },
        { name: 'addrole', description: '➕ إعطاء رتبة لعضو', options: [{ name: 'user', description: 'العضو', type: 6, required: true }, { name: 'role', description: 'الرتبة', type: 8, required: true }] },
        { name: 'removerole', description: '➖ سحب رتبة من عضو', options: [{ name: 'user', description: 'العضو', type: 6, required: true }, { name: 'role', description: 'الرتبة', type: 8, required: true }] },
        { name: 'nick', description: '🏷️ تغيير اسم عضو مستعار بقناة الشات', options: [{ name: 'user', description: 'العضو', type: 6, required: true }, { name: 'name', description: 'الاسم الجديد', type: 3, required: true }] },
        { name: 'nuke', description: '☢️ تصفية الروم الحالي وإعادة إنشائه نظيفاً تماماً' },
        { name: 'hide', description: '🙈 إخفاء الروم الحالي عن الأعضاء' },
        { name: 'show', description: '👀 إظهار الروم الحالي للأعضاء' },
        { name: 'temprole', description: '⏱️ إعطاء رتبة مؤقتة لعضو تزول تلقائياً', options: [{ name: 'user', description: 'العضو', type: 6, required: true }, { name: 'role', description: 'الرتبة', type: 8, required: true }, { name: 'minutes', description: 'المدة بالدقائق', type: 4, required: true }] },
        { name: 'reboot', description: '🔄 إعادة تشغيل أنظمة البوت برمجياً (للإدارة العليا فقط)' },
        { name: 'lockdown', description: '🚨 قفل اضطراري شامل لكافة رومات السيرفر لحمايته من التخريب' },
        { name: 'unlockdown', description: '🟢 إلغاء القفل الاضطراري وإعادة فتح رومات السيرفر بالكامل' },
        { name: 'mute-channel', description: '🔇 منع رتبة معينة من التحدث في هذا الروم فقط', options: [{ name: 'role', description: 'الرتبة المستهدفة', type: 8, required: true }] },
        { name: 'unmute-channel', description: '🔊 إعادة السماح للرتبة بالتحدث في هذا الروم', options: [{ name: 'role', description: 'الرتبة المستهدفة', type: 8, required: true }] },
        { name: 'strip-roles', description: '🛡️ سحب كافة رتب العضو فوراً في حال الاشتباه باختراقه', options: [{ name: 'user', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'massban', description: '💥 حظر جماعي لعدة حسابات بواسطة الـ IDs يفصل بينهم مسافة', options: [{ name: 'ids', description: 'قائمة المعرفات متبوعة بمسافات', type: 3, required: true }, { name: 'reason', description: 'السبب', type: 3 }] },
        { name: 'softban', description: '🧹 حظر العضو ومسح رسائله لآخر 7 أيام ثم فك الحظر تلقائياً', options: [{ name: 'user', description: 'العضو', type: 6, required: true }, { name: 'reason', description: 'السبب', type: 3 }] },
        { name: 'role-create', description: '🛠️ إنشاء رتبة جديدة بالسيرفر سريعاً', options: [{ name: 'name', description: 'اسم الرتبة', type: 3, required: true }, { name: 'color', description: 'لون الرتبة بالهكس مثل #ff0000', type: 3 }] },
        { name: 'role-delete', description: '🗑️ حذف رتبة من السيرفر نهائياً', options: [{ name: 'role', description: 'الرتبة المراد حذفها', type: 8, required: true }] },
        { name: 'channel-create', description: '📁 إنشاء قناة نصية أو صوتية جديدة', options: [{ name: 'name', description: 'اسم القناة', type: 3, required: true }, { name: 'type', description: 'نوع القناة', type: 4, required: true, choices: [{ name: 'Text Channel', value: 0 }, { name: 'Voice Channel', value: 2 }] }] },
        { name: 'channel-delete', description: '🗑️ حذف قناة حالية من السيرفر', options: [{ name: 'channel', description: 'اختر القناة', type: 7, required: true }] },
        { name: 'slowmode-all', description: '⏳ تفعيل وضع التباطؤ (5 ثوانٍ) في كافة رومات السيرفر دفعة واحدة' },
        { name: 'slowmode-off-all', description: '🛑 إلغاء وضع التباطؤ تماماً من جميع رومات السيرفر' },
        { name: 'quarantine', description: '☣️ نقل العضو إلى حجر أمني (سحب رتبه ومنعه من القنوات إلا روم التحقيق)', options: [{ name: 'user', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'unquarantine', description: '🟢 إخراج العضو من الحجر الأمني وإعادة رتبه', options: [{ name: 'user', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'purge-bot', description: '🤖 تنظيف الشات وحذف رسائل البوتات فقط للحفاظ على المظهر العام', options: [{ name: 'amount', description: 'عدد الرسائل للفحص (1-100)', type: 4, required: true }] },
        { name: 'view-permissions', description: '🔍 كشف وفحص كامل صلاحيات عضو معين داخل هذا السيرفر لأسباب أمنية', options: [{ name: 'user', description: 'العضو', type: 6, required: true }] },
        { name: 'anti-raid-on', description: '🔴 تفعيل الحماية المطلقة (منع دخول أي عضو جديد للسيرفر نهائياً حالياً)' },
        { name: 'anti-raid-off', description: '🟢 إيقاف وضع الحماية المطلقة والسماح بدخول الأعضاء بشكل طبيعي' },
        { name: 'server-info', description: '📊 عرض تقرير أمني وتقني كامل وشامل عن إحصائيات وحماية السيرفر' },

        // الـ 20 أمراً الإدارية والصوتية السابقة كاملة بدون أي تعديل
        { name: 'lock-voice', description: '🔒 قفل الروم الصوتي الحالي ومنع الدخول إليه', options: [{ name: 'channel', description: 'اختر الروم الصوتي', type: 7, required: true }] },
        { name: 'unlock-voice', description: '🔓 فتح الروم الصوتي الحالي للسماح بالدخول', options: [{ name: 'channel', description: 'اختر الروم الصوتي', type: 7, required: true }] },
        { name: 'mute-voice', description: '🔇 كتم صوت العضو داخل الروم الصوتي بالكامل', options: [{ name: 'user', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'unmute-voice', description: '🔊 إلغاء كتم صوت العضو داخل الروم الصوتي', options: [{ name: 'user', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'deafen-voice', description: '🎧 تعطيل سماع العضو (Deafen) في الرومات الصوتية', options: [{ name: 'user', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'undeafen-voice', description: '🎵 إعادة تفعيل سماع العضو في الروم الصوتي', options: [{ name: 'user', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'disconnect-voice', description: '🚫 طرد عضو محدد وفصله من الروم الصوتي الحالي فوراً', options: [{ name: 'user', description: 'العضو المستهدف', type: 6, required: true }] },
        { name: 'slowmode-voice', description: '⏳ تفعيل وضع التباطؤ لإرسال الكلمات بالروم الصوتي', options: [{ name: 'channel', description: 'الروم الصوتي', type: 7, required: true }, { name: 'seconds', description: 'عدد الثواني', type: 4, required: true }] },
        { name: 'limit-voice', description: '👥 تحديد الحد الأقصى للأعضاء المسموح بدخولهم للروم الصوتي', options: [{ name: 'channel', description: 'الروم الصوتي', type: 7, required: true }, { name: 'limit', description: 'العدد الأقصى (0 لإلغاء الحد)', type: 4, required: true }] },
        { name: 'hide-voice', description: '🙈 إخفاء الروم الصوتي المكتوب عن الأعضاء في السيرفر', options: [{ name: 'channel', description: 'الروم الصوتي', type: 7, required: true }] },
        { name: 'show-voice', description: '👀 إظهار الروم الصوتي المخفي للأعضاء في السيرفر', options: [{ name: 'channel', description: 'الروم الصوتي', type: 7, required: true }] },
        { name: 'clear-warns-all', description: '🧼 مسح كافة التحذيرات المسجلة لجميع أعضاء السيرفر نهائياً' },
        { name: 'temp-ban', description: '⏳ حظر مؤقت لعضو من السيرفر يزول تلقائياً بعد الوقت المحدد', options: [{ name: 'user', description: 'العضو', type: 6, required: true }, { name: 'duration', description: 'المدة بالساعات', type: 4, required: true }, { name: 'reason', description: 'السبب', type: 3 }] },
        { name: 'slowmode-off', description: '🛑 إيقاف وضع التباطؤ تماماً في الروم الحالي الحالي دون انتظار' },
        { name: 'role-all', description: '👥 إعطاء رتبة معينة لجميع أعضاء السيرفر دفعة واحدة (للأدمن)', options: [{ name: 'role', description: 'الرتبة المراد توزيعها', type: 8, required: true }] },
        { name: 'role-remove-all', description: '🚫 سحب رتبة معينة من جميع أعضاء السيرفر دفعة واحدة بشكل جماعي', options: [{ name: 'role', description: 'الرتبة المراد سحبها', type: 8, required: true }] },
        { name: 'clone-channel', description: '📑 استنساخ الروم الحالي بنفس الاسم والإعدادات والصلاحيات تماماً' },
        { name: 'clear-bot-messages', description: '🧹 مسح رسائل البوتات فقط في الروم الحالي لحفظ المظهر والترتيب', options: [{ name: 'amount', description: 'عدد الرسائل (1-100)', type: 4, required: true }] },
        { name: 'anti-bot-on', description: '🛡️ تفعيل جدار حظر ومنع دخول البوتات الخارجية غير الموثقة للسيرفر' },
        { name: 'anti-bot-off', description: '🟢 إيقاف نظام حظر دخول البوتات الخارجية والسماح بدخولها بشكل عادي' },
        { name: 'help', description: '💡 عرض قائمة جميع أوامر البوت المتاحة وشرح كامل لوظائفها المتقدمة' },

        // 🌟 أوامر نظام الرتب والصلاحيات وحماية المالك الجديدة بالكامل 🌟
        { name: 'set-admin-role', description: '⚙️ تعيين رتبة الإدارة العليا المسموح لها بإدارة البوت وسير العمل', options: [{ name: 'role', description: 'اختر الرتبة', type: 8, required: true }] },
        { name: 'set-mod-role', description: '🛡️ تعيين رتبة المشرفين المسموح لهم بإصدار العقوبات والميوت', options: [{ name: 'role', description: 'اختر الرتبة', type: 8, required: true }] },
        { name: 'set-support-role', description: '🎫 تعيين رتبة الدعم الفني الخاصة بإدارة واستلام التذاكر', options: [{ name: 'role', description: 'اختر الرتبة', type: 8, required: true }] },
        { name: 'view-bot-roles', description: '📋 استعراض رتب الحماية والإدارة الحالية التي تم ضبطها في البوت' },
        { name: 'check-immunity', description: '👑 فحص وتأكيد تفعيل جدار الحصانة المطلقة الخاص بمالك البوت' }
    ];
    
    await client.application.commands.set(commands).catch(console.error);
    console.log('🔹 تم تشغيل نظام الرتب والصلاحيات المتقدم وتأمين المالك بنجاح!');

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

        // جلب إعدادات الرتب من قاعدة البيانات
        let dbData = await GuildData.findOne({ guildID: guild.id }) || new GuildData({ guildID: guild.id });
        if (!dbData.settings) dbData.settings = {};

        const botAdminRoleID = dbData.settings.botAdminRoleID;
        const botModRoleID = dbData.settings.botModRoleID;
        const botSupportRoleID = dbData.settings.botSupportRoleID;

        // التحقق من الصلاحيات حسب رتب البوت الجديدة أو الصلاحيات الأصلية (مع استثناء المالك دائماً)
        const isOwner = (user.id === BOT_OWNER_ID);
        const isAdmin = isOwner || member.roles.cache.has(botAdminRoleID) || member.permissions.has(PermissionFlagsBits.Administrator);
        const isMod = isAdmin || member.roles.cache.has(botModRoleID) || member.permissions.has(PermissionFlagsBits.ManageMessages);
        const isSupport = isMod || member.roles.cache.has(botSupportRoleID);

        // 🛡️ حماية المالك المطلق: منع استخدام أي أمر عقابي ضد مالك البوت نهائياً
        const targetUser = options.getMember('user');
        if (targetUser && targetUser.id === BOT_OWNER_ID && !isOwner) {
            return interaction.reply({ content: '❌ خطأ أمني: هذا الحساب يمتلك حصانة المالك المطلق، لا يمكنك استخدام أوامر البوت عليه!', ephemeral: true });
        }

        // تقسيم حماية الأوامر بناءً على الرتب الجديدة المخصصة
        const adminCommands = ['lockdown', 'unlockdown', 'role-all', 'role-remove-all', 'anti-raid-on', 'anti-raid-off', 'anti-bot-on', 'anti-bot-off', 'reboot', 'set-admin-role', 'set-mod-role', 'set-support-role', 'clear-warns-all'];
        const modCommands = ['ban', 'unban', 'kick', 'mute', 'unmute', 'clear', 'warn', 'clearwarns', 'lock', 'unlock', 'slowmode', 'addrole', 'removerole', 'nick', 'nuke', 'hide', 'show', 'temprole', 'mute-channel', 'unmute-channel', 'strip-roles', 'massban', 'softban', 'role-create', 'role-delete', 'channel-create', 'channel-delete', 'slowmode-all', 'slowmode-off-all', 'quarantine', 'unquarantine', 'purge-bot', 'view-permissions', 'lock-voice', 'unlock-voice', 'mute-voice', 'unmute-voice', 'deafen-voice', 'undeafen-voice', 'disconnect-voice', 'slowmode-voice', 'limit-voice', 'hide-voice', 'show-voice', 'slowmode-off', 'clear-bot-messages', 'clone-channel'];

        if (adminCommands.includes(commandName) && !isAdmin) {
            return interaction.reply({ content: '❌ هذا الأمر مخصص فقط لرتبة الإدارة العليا (Admin Role) أو مالك البوت.', ephemeral: true });
        }
        if (modCommands.includes(commandName) && !isMod) {
            return interaction.reply({ content: '❌ هذا الأمر مخصص للمشرفين (Mod Role) فما فوق.', ephemeral: true });
        }

        // 🌟 تنفيذ أوامر إدارة الرتب الجديدة 🌟
        if (commandName === 'set-admin-role') {
            const role = options.getRole('role');
            dbData.settings.botAdminRoleID = role.id; await dbData.save();
            return interaction.reply({ content: `✅ تم تعيين رتبة الإدارة العليا للبوت بنجاح: ${role}`, ephemeral: true });
        }
        if (commandName === 'set-mod-role') {
            const role = options.getRole('role');
            dbData.settings.botModRoleID = role.id; await dbData.save();
            return interaction.reply({ content: `✅ تم تعيين رتبة المشرفين للبوت بنجاح: ${role}`, ephemeral: true });
        }
        if (commandName === 'set-support-role') {
            const role = options.getRole('role');
            dbData.settings.botSupportRoleID = role.id; await dbData.save();
            return interaction.reply({ content: `✅ تم تعيين رتبة الدعم الفني للبوت بنجاح: ${role}`, ephemeral: true });
        }
        if (commandName === 'view-bot-roles') {
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
        if (commandName === 'check-immunity') {
            if (isOwner) {
                return interaction.reply({ content: '👑 مرحباً بك يا مالك البوت! نظام الحصانة المطلقة نشط وفعال بنسبة 100% لحسابك ولا يمكن لأي مشرف استخدام البوت ضدك.', ephemeral: true });
            } else {
                return interaction.reply({ content: 'ℹ️ أنت لست مالك البوت الرئيسي في ملف البرمجة، الحصانة المطلقة غير مفعلة لك.', ephemeral: true });
            }
        }

        // ---- أمر المساعدة الشامل الاحترافي المتناسق مع الرتب والـ 68 أمراً المتاحة ----
        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('💡 دليل أوامر النظام الإداري والأمني الشامل')
                .setDescription('مرحباً بك في قائمة المساعدة المنسقة. إليك كافة الأوامر المتاحة بالسيرفر وتفاصيل عملها:')
                .setColor('#2b2d31')
                .addFields(
                    { name: '👑 نظام الرتب والصلاحيات الجديد للمالك', value: '`/set-admin-role` - تعيين رتبة الإدارة العليا\n`/set-mod-role` - تعيين رتبة المشرفين\n`/set-support-role` - تعيين رتبة الدعم الفني\n`/view-bot-roles` - عرض رتب البوت | `/check-immunity` - فحص حصانة المالك' },
                    { name: '🎫 أنظمة البطاقات والتذاكر المتقدمة', value: '`/setup-ticket` - إعداد التكت العادي\n`/setup-advanced-ticket` - إعداد تكت متطور بالأقسام والصور' },
                    { name: '👋 أنظمة الإعدادات والترحيب والتفاعل', value: '`/setup-welcome` - تعيين روم الترحيب المطور\n`/setup-logs` - تعيين روم السجلات واللوق\n`/rank` - عرض مستواك وتفاعلك الحالي\n`/leaderboard` - قائمة أعلى المتفاعلين\n`/daily` - استلام المكافأة اليومية' },
                    { name: '🔨 أوامر الإشراف الأساسية (40 أمراً سابقاً)', value: '`/ban` - حظر عضو | `/unban` - فك حظر\n`/kick` - طرد عضو | `/mute` - كتم مؤقت\n`/unmute` - فك كتم | `/clear` - مسح رسائل\n`/warn` - تحذير عضو | `/warns` - سجل التحذيرات\n`/lock` - قفل الروم | `/unlock` - فتح الروم\n`/nuke` - تصفية الشات | `/hide` - إخفاء الروم\n`/lockdown` - قفل السيرفر الشامل | `/anti-raid-on` - جدار الحماية' },
                    { name: '🎙️ أوامر التحكم بالرومات الصوتية والإدارة الجماعية', value: '`/lock-voice` - قفل روم صوتي | `/unlock-voice` - فتح روم صوتي\n`/mute-voice` - كتم بالصوتي | `/unmute-voice` - فك كتم بالصوتي\n`/deafen-voice` - سماعة بالصوتي | `/disconnect-voice` - طرد من الصوتي\n`/limit-voice` - تحديد الحد الأقصى | `/clear-warns-all` - مسح التحذيرات عامة\n`/role-all` - إعطاء رتبة للجميع | `/role-remove-all` - سحب رتبة من الجميع\n`/anti-bot-on` - منع دخول البوتات الغريبة | `/clone-channel` - استنساخ الروم الحالي' }
                )
                .setFooter({ text: `تم تنظيم الصلاحيات بنجاح • إجمالي الأوامر: 68 أمراً متاحاً`, iconURL: guild.iconURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // ---- تنفيذ الـ 20 أمراً الإدارية والصوتية السابقة ----
        if (commandName === 'lock-voice') {
            const chan = options.getChannel('channel'); if (chan.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ اختر روم صوتي فقط.', ephemeral: true });
            await chan.permissionOverwrites.edit(guild.roles.everyone, { Connect: false }); await interaction.reply(`🔒 تم قفل الروم الصوتي بنجاح: ${chan}`);
        }
        if (commandName === 'unlock-voice') {
            const chan = options.getChannel('channel'); if (chan.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ اختر روم صوتي فقط.', ephemeral: true });
            await chan.permissionOverwrites.edit(guild.roles.everyone, { Connect: true }); await interaction.reply(`🔓 تم فتح الروم الصوتي بنجاح: ${chan}`);
        }
        if (commandName === 'mute-voice') {
            const target = options.getMember('user'); if (!target.voice.channel) return interaction.reply({ content: '❌ هذا العضو غير متواجد في روم صوتي حالياً.', ephemeral: true });
            await target.voice.setMute(true); await interaction.reply(`🔇 تم كتم صوت العضو ${target} في الروم الصوتي.`);
        }
        if (commandName === 'unmute-voice') {
            const target = options.getMember('user'); if (!target.voice.channel) return interaction.reply({ content: '❌ هذا العضو غير متواجد في روم صوتي حالياً.', ephemeral: true });
            await target.voice.setMute(false); await interaction.reply(`🔊 تم فك كتم صوت العضو ${target} بنجاح.`);
        }
        if (commandName === 'deafen-voice') {
            const target = options.getMember('user'); if (!target.voice.channel) return interaction.reply({ content: '❌ العضو ليس في روم صوتي.', ephemeral: true });
            await target.voice.setDeafen(true); await interaction.reply(`🎧 تم تعطيل سماعة العضو ${target} بنجاح.`);
        }
        if (commandName === 'undeafen-voice') {
            const target = options.getMember('user'); if (!target.voice.channel) return interaction.reply({ content: '❌ العضو ليس في روم صوتي.', ephemeral: true });
            await target.voice.setDeafen(false); await interaction.reply(`🎵 تم إعادة تفعيل سماعة العضو ${target} بنجاح.`);
        }
        if (commandName === 'disconnect-voice') {
            const target = options.getMember('user'); if (!target.voice.channel) return interaction.reply({ content: '❌ العضو ليس في روم صوتي لفصله.', ephemeral: true });
            await target.voice.disconnect(); await interaction.reply(`🚫 تم فصل وطرد العضو ${target} من الروم الصوتي فوراً.`);
        }
        if (commandName === 'slowmode-voice') {
            const chan = options.getChannel('channel'); const secs = options.getInteger('seconds'); if (chan.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ اختر روم صوتي فقط.', ephemeral: true });
            await chan.setRateLimitPerUser(secs); await interaction.reply(`⏳ تم تفعيل وضع التباطؤ في الروم الصوتي ${chan} لـ \`${secs}\` ثانية.`);
        }
        if (commandName === 'limit-voice') {
            const chan = options.getChannel('channel'); const limit = options.getInteger('limit'); if (chan.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ اختر روم صوتي فقط.', ephemeral: true });
            await chan.setUserLimit(limit); await interaction.reply(`👥 تم تعديل الحد الأقصى للأعضاء في الروم الصوتي ${chan} إلى \`${limit}\` عضو.`);
        }
        if (commandName === 'hide-voice') {
            const chan = options.getChannel('channel'); if (chan.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ اختر روم صوتي فقط.', ephemeral: true });
            await chan.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }); await interaction.reply(`🙈 تم إخفاء الروم الصوتي ${chan} عن الجميع بنجاح.`);
        }
        if (commandName === 'show-voice') {
            const chan = options.getChannel('channel'); if (chan.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ اختر روم صوتي فقط.', ephemeral: true });
            await chan.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true }); await interaction.reply(`👀 تم إظهار الروم الصوتي ${chan} بنجاح.`);
        }
        if (commandName === 'clear-warns-all') {
            dbData.moderation.warns = []; await dbData.save(); await interaction.reply('🧼 تم مسح جميع التحذيرات المسجلة لكافة أعضاء السيرفر بالكامل بنجاح!');
        }
        if (commandName === 'temp-ban') {
            const target = options.getMember('user'); const hours = options.getInteger('duration'); const reason = options.getString('reason') || 'حظر مؤقت';
            if (!target.bannable) return interaction.reply({ content: '❌ لا يمكن حظر هذا العضو.', ephemeral: true });
            await target.ban({ reason }); await interaction.reply(`🔨 تم حظر العضو ${target.user.username} مؤقتاً لمدة \`${hours}\` ساعة. السبب: ${reason}`);
            setTimeout(async () => { await guild.members.unban(target.id).catch(() => {}); }, hours * 60 * 60 * 1000);
        }
        if (commandName === 'slowmode-off') { await channel.setRateLimitPerUser(0); await interaction.reply('🛑 تم إلغاء وضع التباطؤ تماماً في الروم الحالي.'); }
        if (commandName === 'role-all') {
            await interaction.reply('👥 جاري بدء عملية توزيع الرتبة على جميع الأعضاء، قد يستغرق هذا بعض الوقت...');
            const role = options.getRole('role'); guild.members.cache.forEach(async (m) => { if (!m.user.bot) await m.roles.add(role).catch(() => {}); });
            await interaction.followUp(`✅ تم الانتهاء من إعطاء رتبة ${role} لجميع الأعضاء بنجاح.`);
        }
        if (commandName === 'role-remove-all') {
            await interaction.reply('🚫 جاري بدء عملية سحب الرتبة من الجميع...');
            const role = options.getRole('role'); guild.members.cache.forEach(async (m) => { if (!m.user.bot) await m.roles.remove(role).catch(() => {}); });
            await interaction.followUp(`✅ تم الانتهاء من سحب رتبة ${role} من جميع الأعضاء بنجاح.`);
        }
        if (commandName === 'clone-channel') { const cloned = await channel.clone(); await cloned.setPosition(channel.position); await interaction.reply(`📑 تم استنسـاخ الروم الحالي بنجاح في: ${cloned}`); }
        if (commandName === 'clear-bot-messages') {
            const amount = options.getInteger('amount'); const msgs = await channel.messages.fetch({ limit: amount });
            const botMsgs = msgs.filter(m => m.author.bot); await channel.bulkDelete(botMsgs, true);
            await interaction.reply({ content: `🧹 تم مسح رسائل البوتات فقط من أصل آخر \`${amount}\` رسالة مفحوصة.`, ephemeral: true });
        }
        if (commandName === 'anti-bot-on') { globalAntiBot = true; await interaction.reply('🛡️ تم تفعيل جدار حظر ومنع دخول البوتات الغريبة بنجاح.'); }
        if (commandName === 'anti-bot-off') { globalAntiBot = false; await interaction.reply('🟢 تم إيقاف حظر دخول البوتات والسماح لها بشكل طبيعي.'); }

        // ---- تنفيذ الـ 40 أمراً الإشرافية السابقة بدون أي تعديل ----
        if (commandName === 'setup-logs') {
            const logChan = options.getChannel('channel'); if (logChan.type !== ChannelType.GuildText) return interaction.reply({ content: '❌ اختر قناة نصية.', ephemeral: true });
            dbData.settings.logChannelID = logChan.id; await dbData.save(); return interaction.reply({ content: `✅ تم تعيين قناة اللوج في: ${logChan}`, ephemeral: true });
        }
        if (commandName === 'setup-welcome') {
            const welcomeChan = options.getChannel('channel'); if (welcomeChan.type !== ChannelType.GuildText) return interaction.reply({ content: '❌ يرجى اختيار قناة نصية صالحة لإرسال الترحيب.', ephemeral: true });
            dbData.settings.welcomeChannelID = welcomeChan.id; await dbData.save(); return interaction.reply({ content: `✅ تم تفعيل وإعداد نظام الترحيب المطور بنجاح في قناة: ${welcomeChan}`, ephemeral: true });
        }
        if (commandName === 'setup-ticket') {
            const embed = new EmbedBuilder().setTitle('🎫 مركز الدعم الفني والبطاقات').setDescription('مرحباً بك! اضغط على الزر أدناه لفتح تذكرة جديدة.').setColor('#2b2d31');
            const btn = new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة دعم').setStyle(ButtonStyle.Secondary).setEmoji('📩');
            await interaction.reply({ content: '✅ تم إرسال نظام التكت بنجاح!', ephemeral: true }); await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
        }
        if (commandName === 'setup-advanced-ticket') {
            const title = options.getString('title'); const description = options.getString('description'); const image = options.getString('image'); const sectionsRaw = options.getString('sections');
            const sections = sectionsRaw.split(',').map(s => s.trim()).filter(s => s.length > 0); if (sections.length === 0) return interaction.reply({ content: '❌ يرجى كتابة قسم واحد على الأقل بشكل صحيح.', ephemeral: true });
            const embed = new EmbedBuilder().setTitle(title).setDescription(`${description}\n\n**📌 الأقسام المتاحة حالياً:**\n${sections.map(s => `• \`${s}\``).join('\n')}`).setColor('#2b2d31').setImage(image);
            const selectMenu = new StringSelectMenuBuilder().setCustomId('advanced_ticket_select').setPlaceholder('📁 اضغط هنا لاختيار القسم المناسب للتذكرة...').addOptions(sections.map(s => ({ label: s, description: `فتح تذكرة جديدة في قسم: ${s}`, value: s, emoji: '🎫' })));
            await interaction.reply({ content: '✅ تم إنشاء نظام التذاكر المتقدم بنجاح!', ephemeral: true }); await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
        }
        if (commandName === 'rank') {
            const userLevel = dbData?.levels.find(l => l.userID === user.id); if (!userLevel) return interaction.reply('📊 لا يوجد سجل تفاعل لك بعد.');
            const xpNeeded = (userLevel.level + 1) * 100; const progress = Math.floor((userLevel.xp / xpNeeded) * 100);
            const embed = new EmbedBuilder().setTitle(`📊 بطاقة ليفل | ${user.username}`).addFields({ name: '✨ ليفل:', value: `\`🏅 Level ${userLevel.level}\``, inline: true }, { name: '⭐ نقاط XP:', value: `\`✨ ${userLevel.xp} / ${xpNeeded}\` (${progress}%)`, inline: true }).setColor('#3498db'); return interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'leaderboard') {
            if (!dbData || !dbData.levels || dbData.levels.length === 0) return interaction.reply('❌ لا توجد مستويات بالسيرفر.');
            const sorted = dbData.levels.sort((a, b) => b.level === a.level ? b.xp - a.xp : b.level - a.level).slice(0, 10);
            const embed = new EmbedBuilder().setTitle(`🏆 متصدري شات السيرفر`).setColor('#f1c40f'); let desc = "";
            for (let i = 0; i < sorted.length; i++) { try { const m = await guild.members.fetch(sorted[i].userID); desc += `#${i+1} **${m.user.username}** - ليفل \`${sorted[i].level}\`\n`; } catch { desc += `#${i+1} مستخدم غادر\n`; } }
            embed.setDescription(desc); return interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'daily') {
            let eco = dbData.economy.find(e => e.userID === user.id); if (!eco) { dbData.economy.push({ userID: user.id, coins: 0 }); eco = dbData.economy.find(e => e.userID === user.id); }
            if (eco.dailyCooldown && (new Date() - eco.dailyCooldown < 86400000)) return interaction.reply({ content: '❌ استلمت جائزتك اليومية بالفعل.', ephemeral: true });
            eco.coins += 500; eco.dailyCooldown = new Date(); await dbData.save(); return interaction.reply(`💰 استلمت **500** عملة بنجاح! رصيدك الحالي: **${eco.coins}**.`);
        }
        if (commandName === 'ban') {
            const target = options.getMember('user'); const reason = options.getString('reason') || 'بدون سبب معطى'; if (!target.bannable) return interaction.reply({ content: '❌ لا يمكن حظره.', ephemeral: true });
            await target.ban({ reason }); await interaction.reply(`🔨 تم حظر ${target.user.username}. السبب: ${reason}`);
        }
        if (commandName === 'unban') { const targetId = options.getString('id'); try { await guild.members.unban(targetId); await interaction.reply(`🔓 تم إلغاء حظر الحساب بنجاح.`); } catch { await interaction.reply({ content: '❌ لم يتم العثور على الـ ID.', ephemeral: true }); } }
        if (commandName === 'kick') {
            const target = options.getMember('user'); const reason = options.getString('reason') || 'بدون سبب'; if (!target.kickable) return interaction.reply({ content: '❌ لا يمكن طرده.', ephemeral: true });
            await target.kick(reason); await interaction.reply(`👢 تم طرد ${target.user.username}.`);
        }
        if (commandName === 'mute') { const target = options.getMember('user'); const duration = options.getInteger('duration') * 60 * 1000; await target.timeout(duration, 'أمر إداري'); await interaction.reply(`🔇 تم كتم ${target}.`); }
        if (commandName === 'unmute') { const target = options.getMember('user'); await target.timeout(null); await interaction.reply(`🔊 تم فك كتم ${target}.`); }
        if (commandName === 'clear') { const amount = options.getInteger('amount'); await channel.bulkDelete(amount, true); await interaction.reply({ content: `🧹 تم مسح \`${amount}\` رسالة.`, ephemeral: true }); }
        if (commandName === 'warn') {
            const target = options.getMember('user'); const reason = options.getString('reason'); dbData.moderation.warns.push({ userID: target.id, reason: reason, moderatorID: user.id }); await dbData.save(); await interaction.reply(`⚠️ تم تحذير ${target}. السبب: ${reason}`);
        }
        if (commandName === 'warns') {
            const target = options.getMember('user'); const uWarns = dbData?.moderation.warns.filter(w => w.userID === target.id) || []; if (uWarns.length === 0) return interaction.reply(`😇 ليس لديه تحذيرات.`);
            let list = uWarns.map((w, i) => `**[${i+1}]** سبب: \`${w.reason}\``).join('\n'); await interaction.reply(`📋 تحذيرات ${target.user.username}:\n${list}`);
        }
        if (commandName === 'clearwarns') { const target = options.getMember('user'); if (dbData) { dbData.moderation.warns = dbData.moderation.warns.filter(w => w.userID !== target.id); await dbData.save(); } await interaction.reply(`🧼 تم مسح تحذيرات ${target}.`); }
        if (commandName === 'lock') { await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }); await interaction.reply('🔒 تم قفل الغرفة.'); }
        if (commandName === 'unlock') { await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true }); await interaction.reply('🔓 تم فتح الغرفة.'); }
        if (commandName === 'slowmode') { await channel.setRateLimitPerUser(options.getInteger('seconds')); await interaction.reply(`⏳ تم تفعيل وضع التباطؤ.`); }
        if (commandName === 'addrole') { const target = options.getMember('user'); const role = options.getRole('role'); await target.roles.add(role); await interaction.reply(`➕ تم إعطاء الرتبة.`); }
        if (commandName === 'removerole') { const target = options.getMember('user'); const role = options.getRole('role'); await target.roles.remove(role); await interaction.reply(`➖ تم سحب الرتبة.`); }
        if (commandName === 'nick') { const target = options.getMember('user'); await target.setNickname(options.getString('name')); await interaction.reply(`🏷️ تم تغيير الاسم.`); }
        if (commandName === 'nuke') { const pos = channel.position; const newChan = await channel.clone(); await channel.delete().catch(() => {}); await newChan.setPosition(pos); await newChan.send({ embeds: [new EmbedBuilder().setDescription('☢️ تم نيوك وتطهير الروم!').setColor('#2ecc71')] }); }
        if (commandName === 'hide') { await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }); await interaction.reply('🙈 تم إخفاء الروم.'); }
        if (commandName === 'show') { await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true }); await interaction.reply('👀 تم إظهار الروم.'); }
        if (commandName === 'temprole') {
            const target = options.getMember('user'); const role = options.getRole('role'); const mins = options.getInteger('minutes'); await target.roles.add(role); await interaction.reply(`⏱️ رتبة مؤقتة لـ ${mins} دقيقة.`);
            setTimeout(async () => { const m = await guild.members.fetch(target.id).catch(() => null); if (m) await m.roles.remove(role).catch(() => {}); }, mins * 60 * 1000);
        }
        if (commandName === 'reboot') { await interaction.reply('🔄 جاري إعادة التشغيل...'); process.exit(0); }
        if (commandName === 'lockdown') { await interaction.reply('🚨 جاري فرض حالة إغلاق الطوارئ الشامل...'); guild.channels.cache.forEach(async (ch) => { if (ch.type === ChannelType.GuildText) await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).catch(() => {}); }); await interaction.followUp('🔒 تم إغلاق السيرفر بالكامل.'); }
        if (commandName === 'unlockdown') { await interaction.reply('🟢 جاري فك حالة الطوارئ...'); guild.channels.cache.forEach(async (ch) => { if (ch.type === ChannelType.GuildText) await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true }).catch(() => {}); }); await interaction.followUp('🔓 تم إعادة فتح السيرفر.'); }
        if (commandName === 'mute-channel') { const role = options.getRole('role'); await channel.permissionOverwrites.edit(role, { SendMessages: false }); await interaction.reply(`🔇 تم منع الرتبة.`); }
        if (commandName === 'unmute-channel') { const role = options.getRole('role'); await channel.permissionOverwrites.edit(role, { SendMessages: true }); await interaction.reply(`🔊 تم فك منع الرتبة.`); }
        if (commandName === 'strip-roles') { const target = options.getMember('user'); if (!target.manageable) return interaction.reply({ content: '❌ لا يمكن التحكم برتبه.', ephemeral: true }); const userRoles = target.roles.cache.filter(r => r.id !== guild.id); userRoles.forEach(async (r) => await target.roles.remove(r).catch(() => {})); await interaction.reply(`🛡️ تم تجريد العضو من رتبه.`); }
        if (commandName === 'massban') {
            const idsStr = options.getString('ids'); const reason = options.getString('reason') || 'حظر جماعي أمني'; const ids = idsStr.split(/\s+/); await interaction.reply(`💥 جاري بدء عملية الحظر الجماعي...`);
            let count = 0; for (const id of ids) { try { await guild.members.ban(id, { reason }); count++; } catch {} } await interaction.followUp(`✅ تم حظر \`${count}\` حساب.`);
        }
        if (commandName === 'softban') {
            const target = options.getMember('user'); const reason = options.getString('reason') || 'سوفت بان لتنظيف الرسائل'; if (!target.bannable) return interaction.reply({ content: '❌ غير قابل للحظر.', ephemeral: true });
            await guild.members.ban(target.id, { deleteMessageSeconds: 7 * 24 * 60 * 60, reason }); await guild.members.unban(target.id); await interaction.reply(`🧹 تم عمل سوفت بان لـ ${target.user.username}.`);
        }
        if (commandName === 'role-create') { const name = options.getString('name'); const color = options.getString('color') || '#95a5a6'; const newRole = await guild.roles.create({ name, color, reason: 'إنشاء سريع' }); await interaction.reply(`🛠️ تم إنشاء الرتبة: ${newRole}`); }
        if (commandName === 'role-delete') { const role = options.getRole('role'); if (!role.editable) return interaction.reply({ content: '❌ لا يمكن حذفها.', ephemeral: true }); await role.delete(); await interaction.reply(`🗑️ تم حذف الرتبة.`); }
        if (commandName === 'channel-create') { const name = options.getString('name'); const type = options.getInteger('type'); const newChan = await guild.channels.create({ name, type }); await interaction.reply(`📁 تم إنشاء القناة: ${newChan}`); }
        if (commandName === 'channel-delete') { const ch = options.getChannel('channel'); await ch.delete(); await interaction.reply(`🗑️ تم حذف القناة.`); }
        if (commandName === 'slowmode-all') { guild.channels.cache.forEach(async (ch) => { if (ch.type === ChannelType.GuildText) await ch.setRateLimitPerUser(5).catch(() => {}); }); await interaction.reply('⏳ تم تفعيل وضع التباطؤ العام.'); }
        if (commandName === 'slowmode-off-all') { guild.channels.cache.forEach(async (ch) => { if (ch.type === ChannelType.GuildText) await ch.setRateLimitPerUser(0).catch(() => {}); }); await interaction.reply('🛑 تم إلغاء وضع التباطؤ العام.'); }
        if (commandName === 'quarantine') {
            const target = options.getMember('user'); let qRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'quarantined');
            if (!qRole) { qRole = await guild.roles.create({ name: 'Quarantined', color: '#555555', permissions: [] }); guild.channels.cache.forEach(async (ch) => { if (ch.type === ChannelType.GuildText) await ch.permissionOverwrites.edit(qRole, { ViewChannel: false }); }); }
            await target.roles.add(qRole); await interaction.reply(`☣️ تم وضع العضو في الحجر الأمني.`);
        }
        if (commandName === 'unquarantine') { const target = options.getMember('user'); const qRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'quarantined'); if (qRole) await target.roles.remove(qRole); await interaction.reply(`🟢 تم رفع الحجر الأمني.`); }
        if (commandName === 'purge-bot') { const amount = options.getInteger('amount'); const msgs = await channel.messages.fetch({ limit: amount }); const botMsgs = msgs.filter(m => m.author.bot); await channel.bulkDelete(botMsgs, true); await interaction.reply({ content: `🤖 تم تنظيف رسائل البوتات.`, ephemeral: true }); }
        if (commandName === 'view-permissions') {
            const target = options.getMember('user'); const perms = target.permissions.toArray().map(p => `\`${p}\``).join(', ');
            const embed = new EmbedBuilder().setTitle(`🔍 فحص أمني للمشرف`).setDescription(`الأعضاء: ${target}\n\n**الصلاحيات:**\n${perms || 'لا يملك صلاحيات'}`).setColor('#e67e22'); await interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'anti-raid-on') { globalAntiRaid = true; await interaction.reply('🚨 تم تفعيل جدار الحماية الأقصى.'); }
        if (commandName === 'anti-raid-off') { globalAntiRaid = false; await interaction.reply('🟢 تم إيقاف وضع الحماية المطلقة.'); }
        if (commandName === 'server-info') {
            const embed = new EmbedBuilder().setTitle(`📊 التقرير الأمني لـ ${guild.name}`).addFields({ name: '👥 الأعضاء الإجمالي:', value: `\`${guild.memberCount}\``, inline: true }, { name: '🔒 مستوى التحقق:', value: `\`المستوى ${guild.verificationLevel}\``, inline: true }, { name: '🛡️ وضع Anti-Raid:', value: `\`${globalAntiRaid ? '🔴 نشط' : '🟢 مستقر'}\``, inline: true }).setColor('#9b59b6').setTimestamp(); await interaction.reply({ embeds: [embed] });
        }
    }

    // === تفاعلات المودال والأزرار وقوائم اختيار التكت المتقدمة ===
    if (interaction.isStringSelectMenu() && interaction.customId === 'advanced_ticket_select') {
        const selectedSection = interaction.values[0];
        const modal = new ModalBuilder().setCustomId(`advanced_ticket_modal_${selectedSection}`).setTitle(`🎫 تذكرة: ${selectedSection}`);
        const reason = new TextInputBuilder().setCustomId('ticket_reason').setLabel("ما هو سبب/تفاصيل تذكرتك؟").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(reason)); await interaction.showModal(modal);
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'open_ticket') {
            const modal = new ModalBuilder().setCustomId('ticket_modal_일반').setTitle('🎫 فتح تذكرة جديدة');
            const reason = new TextInputBuilder().setCustomId('ticket_reason').setLabel("ما سبب فتح التذكرة؟").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(reason)); await interaction.showModal(modal);
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

// === مراقبة حماية السبام، المستويات، وحظر البوتات التلقائي (Anti-Bot) ===
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
    if (userLevel.xp >= xpNeeded) { userLevel.level += 1; userLevel.xp = 0; await message.channel.send(`🎉 كفو ${message.author}! وصلت لـ ليفل **${userLevel.level}**!`); }
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
