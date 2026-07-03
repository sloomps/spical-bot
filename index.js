require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextInputBuilder, TextInputStyle, ModalBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildInvites
    ]
});

const GuildData = require('./models/guildSchema');

// ذاكرة مؤقتة للأنظمة والحماية
const antiSpamMap = new Map();
const invitesCache = new Map();
let globalAntiRaid = false; // متغير وضع الحماية القصوى

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بقاعدة بيانات MongoDB بنجاح!'))
    .catch((err) => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

client.once('ready', async () => {
    console.log(`🚀 تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
    
    const commands = [
        // الأنظمة السابقة
        { name: 'setup-ticket', description: 'إعداد نظام تذاكر الدعم الفني الحديث بالسيرفر' },
        { name: 'setup-logs', description: 'تحديد قناة إرسال لوقات السيرفر المتطورة', options: [{ name: 'channel', description: 'اختر قناة اللوج', type: 7, required: true }] },
        { name: 'rank', description: 'عرض مستواك الحالي ونقاط الخبرة الخاصة بك' },
        { name: 'leaderboard', description: 'عرض قائمة أعلى 10 أعضاء متفاعلين في السيرفر' },
        { name: 'daily', description: 'استلام مكافأتك المالية اليومية' },

        // الـ 20 أمر إشراف السابقة
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

        // الـ 20 أمر حماية وإشراف الجديدة كلياً (إدارية متطورة)
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
        { name: 'server-info', description: '📊 عرض تقرير أمني وتقني كامل وشامل عن إحصائيات وحماية السيرفر' }
    ];
    
    await client.application.commands.set(commands).catch(console.error);
    console.log('🔹 تم تسجيل كافة الأنظمة و 40 أمراً إدارياً وتأمينياً بنجاح!');

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

// === معالج التفاعلات الكبرى وأوامر الإشراف والأنظمة ===
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options, guild, member, channel, user } = interaction;

        // الصلاحية الإدارية العامة للـ 40 أمر إشراف وتأمين
        const allModCommands = [
            'ban', 'unban', 'kick', 'mute', 'unmute', 'clear', 'warn', 'clearwarns', 'lock', 'unlock', 'slowmode', 'addrole', 'removerole', 'nick', 'nuke', 'hide', 'show', 'temprole',
            'lockdown', 'unlockdown', 'mute-channel', 'unmute-channel', 'strip-roles', 'massban', 'softban', 'role-create', 'role-delete', 'channel-create', 'channel-delete', 'slowmode-all', 'slowmode-off-all', 'quarantine', 'unquarantine', 'purge-bot', 'view-permissions', 'anti-raid-on', 'anti-raid-off'
        ];
        
        if (allModCommands.includes(commandName) && !member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '❌ عذراً، لا تمتلك الصلاحيات الإدارية الكافية لتنفيذ هذه الأوامر الأمنية.', ephemeral: true });
        }

        // ---- الأوامر السابقة ----
        if (commandName === 'setup-logs') {
            const logChan = options.getChannel('channel');
            if (logChan.type !== ChannelType.GuildText) return interaction.reply({ content: '❌ اختر قناة نصية.', ephemeral: true });
            let data = await GuildData.findOne({ guildID: guild.id }) || new GuildData({ guildID: guild.id });
            data.settings.logChannelID = logChan.id; await data.save();
            return interaction.reply({ content: `✅ تم تعيين قناة اللوج في: ${logChan}`, ephemeral: true });
        }

        if (commandName === 'setup-ticket') {
            const embed = new EmbedBuilder().setTitle('🎫 مركز الدعم الفني').setDescription('اضغط على الزر أدناه لفتح تذكرة جديدة.').setColor('#2f3136');
            const btn = new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة دعم').setStyle(ButtonStyle.Primary).setEmoji('📩');
            await interaction.reply({ content: '✅ تم الإرسال بنجاح!', ephemeral: true });
            await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
        }

        if (commandName === 'rank') {
            const data = await GuildData.findOne({ guildID: guild.id });
            const userLevel = data?.levels.find(l => l.userID === user.id);
            if (!userLevel) return interaction.reply('📊 لا يوجد سجل تفاعل لك بعد.');
            const xpNeeded = (userLevel.level + 1) * 100;
            const progress = Math.floor((userLevel.xp / xpNeeded) * 100);
            const embed = new EmbedBuilder().setTitle(`📊 بطاقة ليفل | ${user.username}`).addFields({ name: '✨ ليفل:', value: `\`🏅 Level ${userLevel.level}\``, inline: true }, { name: '⭐ نقاط XP:', value: `\`✨ ${userLevel.xp} / ${xpNeeded}\` (${progress}%)`, inline: true }).setColor('#3498db');
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'leaderboard') {
            const data = await GuildData.findOne({ guildID: guild.id });
            if (!data || !data.levels || data.levels.length === 0) return interaction.reply('❌ لا توجد مستويات بالسيرفر.');
            const sorted = data.levels.sort((a, b) => b.level === a.level ? b.xp - a.xp : b.level - a.level).slice(0, 10);
            const embed = new EmbedBuilder().setTitle(`🏆 متصدري شات السيرفر`).setColor('#f1c40f');
            let desc = "";
            for (let i = 0; i < sorted.length; i++) {
                try { const m = await guild.members.fetch(sorted[i].userID); desc += `#${i+1} **${m.user.username}** - ليفل \`${sorted[i].level}\`\n`; } catch { desc += `#${i+1} مستخدم غادر - ليفل \`${sorted[i].level}\`\n`; }
            }
            embed.setDescription(desc); return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'daily') {
            let data = await GuildData.findOne({ guildID: guild.id }) || new GuildData({ guildID: guild.id });
            let eco = data.economy.find(e => e.userID === user.id);
            if (!eco) { data.economy.push({ userID: user.id, coins: 0 }); eco = data.economy.find(e => e.userID === user.id); }
            if (eco.dailyCooldown && (new Date() - eco.dailyCooldown < 86400000)) return interaction.reply({ content: '❌ استلمت جائزتك اليومية بالفعل.', ephemeral: true });
            eco.coins += 500; eco.dailyCooldown = new Date(); await data.save();
            return interaction.reply(`💰 استلمت **500** عملة بنجاح! رصيدك الحالي: **${eco.coins}**.`);
        }

        // ==================== مصفوفة الـ 20 أمراً الإدارية السابقة ====================
        if (commandName === 'ban') {
            const target = options.getMember('user'); const reason = options.getString('reason') || 'بدون سبب معطى';
            if (!target.bannable) return interaction.reply({ content: '❌ لا يمكن حظره.', ephemeral: true });
            await target.ban({ reason }); await interaction.reply(`🔨 تم حظر ${target.user.username}. السبب: ${reason}`);
        }
        if (commandName === 'unban') {
            const targetId = options.getString('id');
            try { await guild.members.unban(targetId); await interaction.reply(`🔓 تم إلغاء حظر الحساب بنجاح.`); } catch { await interaction.reply({ content: '❌ لم يتم العثور على الـ ID.', ephemeral: true }); }
        }
        if (commandName === 'kick') {
            const target = options.getMember('user'); const reason = options.getString('reason') || 'بدون سبب';
            if (!target.kickable) return interaction.reply({ content: '❌ لا يمكن طرده.', ephemeral: true });
            await target.kick(reason); await interaction.reply(`👢 تم طرد ${target.user.username}.`);
        }
        if (commandName === 'mute') {
            const target = options.getMember('user'); const duration = options.getInteger('duration') * 60 * 1000;
            await target.timeout(duration, 'أمر إداري'); await interaction.reply(`🔇 تم كتم ${target}.`);
        }
        if (commandName === 'unmute') {
            const target = options.getMember('user'); await target.timeout(null); await interaction.reply(`🔊 تم فك كتم ${target}.`);
        }
        if (commandName === 'clear') {
            const amount = options.getInteger('amount'); await channel.bulkDelete(amount, true);
            await interaction.reply({ content: `🧹 تم مسح \`${amount}\` رسالة.`, ephemeral: true });
        }
        if (commandName === 'warn') {
            const target = options.getMember('user'); const reason = options.getString('reason');
            let data = await GuildData.findOne({ guildID: guild.id }) || new GuildData({ guildID: guild.id });
            data.moderation.warns.push({ userID: target.id, reason: reason, moderatorID: user.id });
            await data.save(); await interaction.reply(`⚠️ تم تحذير ${target}. السبب: ${reason}`);
        }
        if (commandName === 'warns') {
            const target = options.getMember('user'); let data = await GuildData.findOne({ guildID: guild.id });
            const uWarns = data?.moderation.warns.filter(w => w.userID === target.id) || [];
            if (uWarns.length === 0) return interaction.reply(`😇 ليس لديه تحذيرات.`);
            let list = uWarns.map((w, i) => `**[${i+1}]** سبب: \`${w.reason}\``).join('\n');
            await interaction.reply(`📋 تحذيرات ${target.user.username}:\n${list}`);
        }
        if (commandName === 'clearwarns') {
            const target = options.getMember('user'); let data = await GuildData.findOne({ guildID: guild.id });
            if (data) { data.moderation.warns = data.moderation.warns.filter(w => w.userID !== target.id); await data.save(); }
            await interaction.reply(`🧼 تم مسح تحذيرات ${target}.`);
        }
        if (commandName === 'lock') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }); await interaction.reply('🔒 تم قفل الغرفة.');
        }
        if (commandName === 'unlock') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true }); await interaction.reply('🔓 تم فتح الغرفة.');
        }
        if (commandName === 'slowmode') {
            await channel.setRateLimitPerUser(options.getInteger('seconds')); await interaction.reply(`⏳ تم تفعيل وضع التباطؤ.`);
        }
        if (commandName === 'addrole') {
            const target = options.getMember('user'); const role = options.getRole('role');
            await target.roles.add(role); await interaction.reply(`➕ تم إعطاء الرتبة.`);
        }
        if (commandName === 'removerole') {
            const target = options.getMember('user'); const role = options.getRole('role');
            await target.roles.remove(role); await interaction.reply(`➖ تم سحب الرتبة.`);
        }
        if (commandName === 'nick') {
            const target = options.getMember('user'); await target.setNickname(options.getString('name'));
            await interaction.reply(`🏷️ تم تغيير الاسم.`);
        }
        if (commandName === 'nuke') {
            const pos = channel.position; const newChan = await channel.clone();
            await channel.delete().catch(() => {}); await newChan.setPosition(pos);
            await newChan.send({ embeds: [new EmbedBuilder().setDescription('☢️ تم نيوك وتطهير الروم!').setColor('#2ecc71')] });
        }
        if (commandName === 'hide') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }); await interaction.reply('🙈 تم إخفاء الروم.');
        }
        if (commandName === 'show') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true }); await interaction.reply('👀 تم إظهار الروم.');
        }
        if (commandName === 'temprole') {
            const target = options.getMember('user'); const role = options.getRole('role'); const mins = options.getInteger('minutes');
            await target.roles.add(role); await interaction.reply(`⏱️ رتبة مؤقتة لـ ${mins} دقيقة.`);
            setTimeout(async () => { const m = await guild.members.fetch(target.id).catch(() => null); if (m) await m.roles.remove(role).catch(() => {}); }, mins * 60 * 1000);
        }
        if (commandName === 'reboot') {
            if (user.id !== guild.ownerId) return interaction.reply({ content: '❌ لمالك السيرفر فقط.', ephemeral: true });
            await interaction.reply('🔄 جاري إعادة التشغيل...'); process.exit(0);
        }

        // ==================== مصفوفة الـ 20 أمراً التأمينية والإدارية الجديدة ====================
        
        if (commandName === 'lockdown') {
            await interaction.reply('🚨 جاري فرض حالة إغلاق الطوارئ الشامل لكافة قنوات السيرفر...');
            guild.channels.cache.forEach(async (ch) => {
                if (ch.type === ChannelType.GuildText) {
                    await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).catch(() => {});
                }
            });
            await interaction.followUp('🔒 تم إغلاق السيرفر بالكامل بنجاح وحمايته من التخريب الخارجي.');
        }

        if (commandName === 'unlockdown') {
            await interaction.reply('🟢 جاري فك حالة الطوارئ وإعادة فتح قنوات السيرفر...');
            guild.channels.cache.forEach(async (ch) => {
                if (ch.type === ChannelType.GuildText) {
                    await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true }).catch(() => {});
                }
            });
            await interaction.followUp('🔓 تم إعادة فتح السيرفر بشكل طبيعي للجميع.');
        }

        if (commandName === 'mute-channel') {
            const role = options.getRole('role');
            await channel.permissionOverwrites.edit(role, { SendMessages: false });
            await interaction.reply(`🔇 تم منع أصحاب رتبة **${role.name}** من التحدث داخل هذا الروم.`);
        }

        if (commandName === 'unmute-channel') {
            const role = options.getRole('role');
            await channel.permissionOverwrites.edit(role, { SendMessages: true });
            await interaction.reply(`🔊 تم فك منع التحدث عن رتبة **${role.name}** داخل هذا الروم.`);
        }

        if (commandName === 'strip-roles') {
            const target = options.getMember('user');
            if (!target.manageable) return interaction.reply({ content: '❌ لا يمكنني التحكم برتب هذا العضو بسبب صلاحياته.', ephemeral: true });
            const userRoles = target.roles.cache.filter(r => r.id !== guild.id);
            userRoles.forEach(async (r) => await target.roles.remove(r).catch(() => {}));
            await interaction.reply(`🛡️ تم تجريد ${target} من كافة رتبه فوراً كإجراء أمني احترازي.`);
        }

        if (commandName === 'massban') {
            const idsStr = options.getString('ids');
            const reason = options.getString('reason') || 'حظر جماعي أمني';
            const ids = idsStr.split(/\s+/);
            await interaction.reply(`💥 جاري بدء عملية الحظر الجماعي لـ \`${ids.length}\` حساب مشبوه...`);
            let count = 0;
            for (const id of ids) {
                try { await guild.members.ban(id, { reason }); count++; } catch {}
            }
            await interaction.followUp(`✅ اكتمل الحظر الجماعي. تم بنجاح حظر \`${count}\` حساب من السيرفر.`);
        }

        if (commandName === 'softban') {
            const target = options.getMember('user');
            const reason = options.getString('reason') || 'سوفت بان لتنظيف الرسائل';
            if (!target.bannable) return interaction.reply({ content: '❌ الحساب غير قابل للحظر.', ephemeral: true });
            await guild.members.ban(target.id, { deleteMessageSeconds: 7 * 24 * 60 * 60, reason });
            await guild.members.unban(target.id);
            await interaction.reply(`🧹 تم عمل سوفت بان لـ ${target.user.username} بنجاح (طرد وتم مسح كافة رسائله لآخر 7 أيام).`);
        }

        if (commandName === 'role-create') {
            const name = options.getString('name');
            const color = options.getString('color') || '#95a5a6';
            const newRole = await guild.roles.create({ name, color, reason: 'إنشاء سريع عبر البوت' });
            await interaction.reply(`🛠️ تم إنشاء الرتبة الجديدة بنجاح: ${newRole}`);
        }

        if (commandName === 'role-delete') {
            const role = options.getRole('role');
            if (!role.editable) return interaction.reply({ content: '❌ رتبة أعلى من البوت ولا يمكن حذفها.', ephemeral: true });
            await role.delete();
            await interaction.reply(`🗑️ تم حذف الرتبة المستهدفة من السيرفر نهائياً.`);
        }

        if (commandName === 'channel-create') {
            const name = options.getString('name');
            const type = options.getInteger('type');
            const newChan = await guild.channels.create({ name, type });
            await interaction.reply(`📁 تم إنشاء القناة الجديدة بنجاح: ${newChan}`);
        }

        if (commandName === 'channel-delete') {
            const ch = options.getChannel('channel');
            await ch.delete();
            await interaction.reply(`🗑️ تم حذف القناة المستهدفة بنجاح من السيرفر.`);
        }

        if (commandName === 'slowmode-all') {
            guild.channels.cache.forEach(async (ch) => {
                if (ch.type === ChannelType.GuildText) await ch.setRateLimitPerUser(5).catch(() => {});
            });
            await interaction.reply('⏳ تم تفعيل وضع التباطؤ (5 ثوانٍ) في كافة قنوات السيرفر للسيطرة على الأوضاع.');
        }

        if (commandName === 'slowmode-off-all') {
            guild.channels.cache.forEach(async (ch) => {
                if (ch.type === ChannelType.GuildText) await ch.setRateLimitPerUser(0).catch(() => {});
            });
            await interaction.reply('🛑 تم إلغاء وضع التباطؤ بالكامل من جميع قنوات السيرفر.');
        }

        if (commandName === 'quarantine') {
            const target = options.getMember('user');
            let qRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'quarantined');
            if (!qRole) {
                qRole = await guild.roles.create({ name: 'Quarantined', color: '#555555', permissions: [] });
                guild.channels.cache.forEach(async (ch) => {
                    if (ch.type === ChannelType.GuildText) await ch.permissionOverwrites.edit(qRole, { ViewChannel: false });
                });
            }
            await target.roles.add(qRole);
            await interaction.reply(`☣️ تم وضع ${target} في الحجر الأمني وسحب أهليته في التواصل مؤقتاً.`);
        }

        if (commandName === 'unquarantine') {
            const target = options.getMember('user');
            const qRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'quarantined');
            if (qRole) await target.roles.remove(qRole);
            await interaction.reply(`🟢 تم رفع الحجر الأمني عن ${target} بنجاح.`);
        }

        if (commandName === 'purge-bot') {
            const amount = options.getInteger('amount');
            const msgs = await channel.messages.fetch({ limit: amount });
            const botMsgs = msgs.filter(m => m.author.bot);
            await channel.bulkDelete(botMsgs, true);
            await interaction.reply({ content: `🤖 تم تنظيف الشات وحذف \`${botMsgs.size}\` رسالة تابعة للبوتات.`, ephemeral: true });
        }

        if (commandName === 'view-permissions') {
            const target = options.getMember('user');
            const perms = target.permissions.toArray().map(p => `\`${p}\``).join(', ');
            const embed = new EmbedBuilder()
                .setTitle(`🔍 فحص أمني لصلاحيات العضو`)
                .setDescription(`الأعضاء: ${target}\n\n**الصلاحيات الممتلكة:**\n${perms || 'لا يملك أي صلاحيات إدارية'}`)
                .setColor('#e67e22');
            await interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'anti-raid-on') {
            globalAntiRaid = true;
            await interaction.reply('🚨 [وضع حظر الهجمات مفعل]: تم تفعيل جدار الحماية الأقصى، سيتم طرد أي شخص يحاول الدخول فوراً.');
        }

        if (commandName === 'anti-raid-off') {
            globalAntiRaid = false;
            await interaction.reply('🟢 [وضع حظر الهجمات ملغى]: تم إعادة جدار الحماية للوضع العادي والسماح بالدخول.');
        }

        if (commandName === 'server-info') {
            const embed = new EmbedBuilder()
                .setTitle(`📊 التقرير الأمني والفني لـ ${guild.name}`)
                .addFields(
                    { name: '👥 الأعضاء الإجمالي:', value: `\`${guild.memberCount}\``, inline: true },
                    { name: '🔒 مستوى التحقق بالسيرفر:', value: `\`المستوى ${guild.verificationLevel}\``, inline: true },
                    { name: '🛡️ وضع الحماية الفجائية (Anti-Raid):', value: `\`${globalAntiRaid ? '🔴 نشط وصارم' : '🟢 مستقر وعادي'}\``, inline: true }
                ).setColor('#9b59b6').setTimestamp();
            await interaction.reply({ embeds: [embed] });
        }
    }

    // === تابع نظام التكت المطور الحديث بالأزرار ===
    if (interaction.isButton()) {
        if (interaction.customId === 'open_ticket') {
            const modal = new ModalBuilder().setCustomId('ticket_modal').setTitle('🎫 فتح تذكرة جديدة');
            const reason = new TextInputBuilder().setCustomId('ticket_reason').setLabel("ما سبب فتح التذكرة؟").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(reason)); await interaction.showModal(modal);
        }
        if (interaction.customId === 'claim_ticket') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({ content: '❌ للدعم فقط.', ephemeral: true });
            await interaction.reply({ content: `🔒 تم استلام التذكرة بواسطة المساعد: ${interaction.user}` });
            const disabledRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('claim_ticket').setLabel('تم الاستلام').setStyle(ButtonStyle.Success).setDisabled(true), new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger));
            await interaction.message.edit({ components: [disabledRow] });
            await sendLog(interaction.guild, new EmbedBuilder().setTitle('🙋‍♂️ تذكرة مستلمة').setDescription(`**الروم:** ${interaction.channel.name}\n**المستلم:** ${interaction.user}`).setColor('#f1c40f').setTimestamp());
        }
        if (interaction.customId === 'close_ticket') {
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

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
        const reason = interaction.fields.getTextInputValue('ticket_reason');
        const chan = await interaction.guild.channels.create({
            name: `🎫-${interaction.user.username}`, type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });
        const embed = new EmbedBuilder().setTitle('🎫 تذكرة دعم جديدة').setDescription(`السبب: ${reason}`).setColor('#00ffcc');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger));
        await chan.send({ embeds: [embed], components: [row] }); await interaction.reply({ content: `✅ تم فتح تذكرتك في: ${chan}`, ephemeral: true });
    }
});

// === أنظمة المراقبة، الحماية، منع السبام وحساب المستويات والروابط ===
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

// تتبع الانضمام + مكافحة الهجمات والحسابات الوهمية
client.on('guildMemberAdd', async (m) => {
    // 1. نظام الحماية ضد الهجمات الفجائية النشط (Anti-Raid Mode)
    if (globalAntiRaid) {
        try {
            await m.send(`❌ تم طردك تلقائياً من سيرفر **${m.guild.name}** نظراً لتفعيل وضع الطوارئ والحماية القصوى حالياً ضد الهجمات.`).catch(() => {});
            return await m.kick('وضع الـ Anti-Raid مفعل طوارئ');
        } catch {}
    }

    // 2. فحص الحسابات الوهمية
    if (Date.now() - m.user.createdTimestamp < 3 * 24 * 60 * 60 * 1000) {
        await m.send(`❌ تم طردك تلقائياً لأن حسابك وهمي وجديد جداً لحماية السيرفر.`).catch(() => {});
        return await m.kick('حساب وهمي (Anti-Alt protection)').catch(() => {});
    }

    let invTxt = "غير معروف";
    try {
        const cached = invitesCache.get(m.guild.id); const current = await m.guild.invites.fetch();
        for (const [code, inv] of current) {
            if (inv.uses > (cached?.get(code) || 0)) { invTxt = `**${inv.inviter.tag}**\n**الكود:** \`${code}\``; cached.set(code, inv.uses); break; }
        }
    } catch { }

    const embed = new EmbedBuilder().setTitle('📥 عضو جديد انضم').setDescription(`**العضو:** ${m} (${m.user.tag})\n**دعا بواسطة:** ${invTxt}`).setColor('#2ecc71').setTimestamp();
    await sendLog(m.guild, embed);
});

process.on('unhandledRejection', error => console.error('[خطأ غير معالج]:', error));

client.login(process.env.TOKEN);
