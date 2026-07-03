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

// ذاكرة مؤقتة للأنظمة
const antiSpamMap = new Map();
const invitesCache = new Map();

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بقاعدة بيانات MongoDB بنجاح!'))
    .catch((err) => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

// جلب وتخزين روابط الدعوة عند جاهزية البوت وتسجيل الأوامر
client.once('ready', async () => {
    console.log(`🚀 تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
    
    // تجميع الـ 20 أمر إشرافي + الأوامر السابقة كاملة دون تعديل
    const commands = [
        // الأنظمة السابقة
        { name: 'setup-ticket', description: 'إعداد نظام تذاكر الدعم الفني الحديث بالسيرفر' },
        { name: 'setup-logs', description: 'تحديد قناة إرسال لوقات السيرفر المتطورة', options: [{ name: 'channel', description: 'اختر قناة اللوج', type: 7, required: true }] },
        { name: 'rank', description: 'عرض مستواك الحالي ونقاط الخبرة الخاصة بك' },
        { name: 'leaderboard', description: 'عرض قائمة أعلى 10 أعضاء متفاعلين في السيرفر' },
        { name: 'daily', description: 'استلام مكافأتك المالية اليومية' },

        // 20 أمر إشراف متطور جداً
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
        { name: 'reboot', description: '🔄 إعادة تشغيل أنظمة البوت برمجياً (للإدارة العليا فقط)' }
    ];
    
    await client.application.commands.set(commands).catch(console.error);
    console.log('🔹 تم تسجيل كافة الأنظمة و20 أمر إشرافي بنجاح!');

    // كاش روابط الدعوة
    client.guilds.cache.forEach(async (guild) => {
        try {
            const firstInvites = await guild.invites.fetch();
            invitesCache.set(guild.id, new Map(firstInvites.map(invite => [invite.code, invite.uses])));
        } catch { }
    });
});

// دالة مساعدة لإرسال تقارير اللوج
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

        // ---- أوامر الأنظمة السابقة (بدون تعديل) ----
        if (commandName === 'setup-logs') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ للإدارة فقط.', ephemeral: true });
            const logChan = options.getChannel('channel');
            if (logChan.type !== ChannelType.GuildText) return interaction.reply({ content: '❌ اختر قناة نصية.', ephemeral: true });
            let data = await GuildData.findOne({ guildID: guild.id }) || new GuildData({ guildID: guild.id });
            data.settings.logChannelID = logChan.id; await data.save();
            return interaction.reply({ content: `✅ تم تعيين قناة اللوج في: ${logChan}`, ephemeral: true });
        }

        if (commandName === 'setup-ticket') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ للإدارة فقط.', ephemeral: true });
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

        // ==================== مصفوفة أوامر الإشراف الـ 20 الخارقة ====================
        
        // التحقق من صلاحية الإشراف العامة للأوامر التالية للسرعة والحماية
        const modPerms = [ 'ban', 'unban', 'kick', 'mute', 'unmute', 'clear', 'warn', 'clearwarns', 'lock', 'unlock', 'slowmode', 'addrole', 'removerole', 'nick', 'nuke', 'hide', 'show', 'temprole' ];
        if (modPerms.includes(commandName) && !member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '❌ عذراً، لا تمتلك الصلاحيات الإدارية الكافية لتنفيذ هذا الأمر.', ephemeral: true });
        }

        if (commandName === 'ban') {
            const target = options.getMember('user');
            const reason = options.getString('reason') || 'بدون سبب معطى';
            if (!target.bannable) return interaction.reply({ content: '❌ لا يمكنني حظر هذا العضو بسبب رتبته العالية.', ephemeral: true });
            await target.ban({ reason });
            await interaction.reply(`🔨 تم حظر ${target.user.username} بنجاح. السبب: ${reason}`);
            const logEmbed = new EmbedBuilder().setTitle('🔨 حظر عضو').setDescription(`**المشرف:** ${user}\n**المحظور:** ${target.user.tag}\n**السبب:** ${reason}`).setColor('#c0392b').setTimestamp();
            await sendLog(guild, logEmbed);
        }

        if (commandName === 'unban') {
            const targetId = options.getString('id');
            try {
                await guild.members.unban(targetId);
                await interaction.reply(`🔓 تم إلغاء حظر الحساب بنجاح.`);
            } catch { await interaction.reply({ content: '❌ لم يتم العثور على هذا الـ ID في قائمة المحظورين.', ephemeral: true }); }
        }

        if (commandName === 'kick') {
            const target = options.getMember('user');
            const reason = options.getString('reason') || 'بدون سبب معطى';
            if (!target.kickable) return interaction.reply({ content: '❌ رتبة العضو أعلى من رتبة البوت.', ephemeral: true });
            await target.kick(reason);
            await interaction.reply(`👢 تم طرد العضو ${target.user.username}. السبب: ${reason}`);
        }

        if (commandName === 'mute') {
            const target = options.getMember('user');
            const duration = options.getInteger('duration') * 60 * 1000;
            const reason = options.getString('reason') || 'بدون سبب معطى';
            await target.timeout(duration, reason);
            await interaction.reply(`🔇 تم كتم ${target} لـ ${options.getInteger('duration')} دقيقة. السبب: ${reason}`);
        }

        if (commandName === 'unmute') {
            const target = options.getMember('user');
            await target.timeout(null);
            await interaction.reply(`🔊 تم فك الكتم عن ${target} بنجاح.`);
        }

        if (commandName === 'clear') {
            const amount = options.getInteger('amount');
            if (amount < 1 || amount > 100) return interaction.reply({ content: '❌ اختر قيمة بين 1 و 100.', ephemeral: true });
            await channel.bulkDelete(amount, true);
            await interaction.reply({ content: `🧹 تم مسح \`${amount}\` رسالة بنجاح.`, ephemeral: true });
        }

        if (commandName === 'warn') {
            const target = options.getMember('user');
            const reason = options.getString('reason');
            let data = await GuildData.findOne({ guildID: guild.id }) || new GuildData({ guildID: guild.id });
            data.moderation.warns.push({ userID: target.id, reason: reason, moderatorID: user.id });
            await data.save();
            await interaction.reply(`⚠️ تم توجيه تحذير رسمي لـ ${target}. السبب: ${reason}`);
        }

        if (commandName === 'warns') {
            const target = options.getMember('user');
            let data = await GuildData.findOne({ guildID: guild.id });
            const uWarns = data?.moderation.warns.filter(w => w.userID === target.id) || [];
            if (uWarns.length === 0) return interaction.reply(`😇 العضو ${target.user.username} ليس لديه أي تحذيرات مسبقة.`);
            let list = uWarns.map((w, idx) => `**[${idx+1}]** بواسطة <@${w.moderatorID}> | السبب: \`${w.reason}\``).join('\n');
            await interaction.reply(`📋 سجل تحذيرات ${target.user.username}:\n${list}`);
        }

        if (commandName === 'clearwarns') {
            const target = options.getMember('user');
            let data = await GuildData.findOne({ guildID: guild.id });
            if (data) {
                data.moderation.warns = data.moderation.warns.filter(w => w.userID !== target.id);
                await data.save();
            }
            await interaction.reply(`🧼 تم مسح وتصفية سجل تحذيرات ${target} بالكامل.`);
        }

        if (commandName === 'lock') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
            await interaction.reply('🔒 تم قفل الغرفة بنجاح، يمنع إرسال الرسائل حالياً.');
        }

        if (commandName === 'unlock') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true });
            await interaction.reply('🔓 تم فتح الغرفة بنجاح، يمكن للأعضاء التحدث الآن.');
        }

        if (commandName === 'slowmode') {
            const secs = options.getInteger('seconds');
            await channel.setRateLimitPerUser(secs);
            await interaction.reply(`⏳ تم تفعيل وضع التباطؤ في الروم بمقدار \`${secs}\` ثانية بين الرسائل.`);
        }

        if (commandName === 'addrole') {
            const target = options.getMember('user');
            const role = options.getRole('role');
            await target.roles.add(role);
            await interaction.reply(`➕ تم منح الرتبة **${role.name}** للعضو ${target} بنجاح.`);
        }

        if (commandName === 'removerole') {
            const target = options.getMember('user');
            const role = options.getRole('role');
            await target.roles.remove(role);
            await interaction.reply(`➖ تم سحب الرتبة **${role.name}** من العضو ${target} بنجاح.`);
        }

        if (commandName === 'nick') {
            const target = options.getMember('user');
            const newName = options.getString('name');
            await target.setNickname(newName);
            await interaction.reply(`🏷️ تم تغيير اسم ${target.user.username} المستعار إلى: **${newName}**.`);
        }

        if (commandName === 'nuke') {
            await interaction.reply('☢️ جاري إعادة هيكلة وتصفية الروم بالكامل...');
            const position = channel.position;
            const newChan = await channel.clone();
            await channel.delete().catch(() => {});
            await newChan.setPosition(position);
            await newChan.send({ embeds: [new EmbedBuilder().setDescription('☢️ تم إعادة تطهير وتصفية هذا الروم بنجاح بواسطة المشرف!').setColor('#2ecc71')] });
        }

        if (commandName === 'hide') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });
            await interaction.reply('🙈 تم إخفاء الروم الحالي عن أعضاء السيرفر بنجاح.');
        }

        if (commandName === 'show') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true });
            await interaction.reply('👀 تم إظهار الروم الحالي للجميع بنجاح.');
        }

        if (commandName === 'temprole') {
            const target = options.getMember('user');
            const role = options.getRole('role');
            const mins = options.getInteger('minutes');
            await target.roles.add(role);
            await interaction.reply(`⏱️ تم إعطاء الرتبة **${role.name}** لـ ${target} مؤقتاً لـ \`${mins}\` دقيقة.`);
            setTimeout(async () => {
                const checkMember = await guild.members.fetch(target.id).catch(() => null);
                if (checkMember) await checkMember.roles.remove(role).catch(() => {});
            }, mins * 60 * 1000);
        }

        if (commandName === 'reboot') {
            if (user.id !== guild.ownerId) return interaction.reply({ content: '❌ هذا الأمر مخصص لمالك السيرفر الرئيسي فقط لحماية البوت.', ephemeral: true });
            await interaction.reply('🔄 جاري عمل إعادة تشغيل برمجية كاملة لكافة الأنظمة...');
            process.exit(0); // ريلواي ستقوم بإعادة التشغيل تلقائياً في ثانية واحدة
        }
    }

    // === تابع نظام التكت المطور الحديث بالأزرار ===
    if (interaction.isButton()) {
        if (interaction.customId === 'open_ticket') {
            const modal = new ModalBuilder().setCustomId('ticket_modal').setTitle('🎫 فتح تذكرة جديدة');
            const reason = new TextInputBuilder().setCustomId('ticket_reason').setLabel("ما سبب فتح التذكرة؟").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(reason));
            await interaction.showModal(modal);
        }
        if (interaction.customId === 'claim_ticket') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({ content: '❌ للدعم فقط.', ephemeral: true });
            await interaction.reply({ content: `🔒 تم استلام التذكرة وتثبيتها بواسطة المساعد: ${interaction.user}` });
            const disabledRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('claim_ticket').setLabel('تم الاستلام').setStyle(ButtonStyle.Success).setDisabled(true), new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger));
            await interaction.message.edit({ components: [disabledRow] });
            await sendLog(interaction.guild, new EmbedBuilder().setTitle('🙋‍♂️ تذكرة مستلمة').setDescription(`**الروم:** ${interaction.channel.name}\n**المستلم:** ${interaction.user}`).setColor('#f1c40f').setTimestamp());
        }
        if (interaction.customId === 'close_ticket') {
            await interaction.reply('🔒 جاري أرشفة وإغلاق الغرفة خلال 5 ثوانٍ...');
            try {
                const fetched = await interaction.channel.messages.fetch({ limit: 100 });
                let tx = `أرشيف تذكرة: ${interaction.channel.name}\n\n`;
                fetched.reverse().forEach(m => { tx += `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}\n`; });
                const logEmbed = new EmbedBuilder().setTitle('📄 أرشيف تذكرة مغلقة').setDescription(`تم تصفية وحذف **${interaction.channel.name}**\n**بواسطة:** ${interaction.user}`).setColor('#ff3333').setTimestamp();
                await sendLog(interaction.guild, logEmbed, [{ attachment: Buffer.from(tx), name: `${interaction.channel.name}-transcript.txt` }]);
            } catch (err) { console.error(err); }
            setTimeout(async () => { await interaction.channel.delete().catch(() => {}); }, 5000);
        }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
        const reason = interaction.fields.getTextInputValue('ticket_reason');
        const chan = await interaction.guild.channels.create({
            name: `🎫-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });
        const embed = new EmbedBuilder().setTitle('🎫 تذكرة دعم جديدة').setDescription(`السبب المعطى: ${reason}`).setColor('#00ffcc');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger));
        await chan.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ تم فتح تذكرتك في: ${chan}`, ephemeral: true });
        await sendLog(interaction.guild, new EmbedBuilder().setTitle('📩 إنشاء تذكرة').setDescription(`**بواسطة:** ${interaction.user}\n**الروم:** ${chan}\n**السبب:** ${reason}`).setColor('#2ecc71').setTimestamp());
    }
});

// === أنظمة المراقبة، الحماية، منع السبام وحساب المستويات والروابط ===
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const authId = message.author.id;
    const now = Date.now();

    // منع السبام المتكرر
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        if (antiSpamMap.has(authId)) {
            const userData = antiSpamMap.get(authId);
            if (now - userData.lastMessageTime < 3000) {
                if (userData.msgCount >= 5) {
                    await message.delete().catch(() => {});
                    await message.member.timeout(300000, 'سبام مكثف').catch(() => {});
                    return message.channel.send(`🚨 تم كتم ${message.author} تلقائياً 5 دقائق للسبام.`);
                }
                userData.msgCount++;
            } else { userData.msgCount = 1; }
            userData.lastMessageTime = now;
        } else { antiSpamMap.set(authId, { lastMessageTime: now, msgCount: 1 }); }
    }

    // حماية الروابط المشبوهة
    const scamRegex = /(discord\.gg\/|gift|nitro|steam|crypto)/i;
    if (scamRegex.test(message.content) && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        await message.delete().catch(() => {});
        await message.member.timeout(600000, 'نشر روابط').catch(() => {});
        return message.channel.send(`⚠️ تم حذف رابط ${message.author} وكتمه لـ 10 دقائق.`);
    }

    // نقاط الخبرة ونظام المستويات الأساسي
    let data = await GuildData.findOne({ guildID: message.guild.id }) || new GuildData({ guildID: message.guild.id });
    let userLevel = data.levels.find(l => l.userID === message.author.id);
    if (!userLevel) { data.levels.push({ userID: message.author.id, xp: 0, level: 0, lastMessageTimestamp: new Date(0) }); userLevel = data.levels.find(l => l.userID === message.author.id); }
    if (now - new Date(userLevel.lastMessageTimestamp).getTime() < 60000) return;
    userLevel.xp += Math.floor(Math.random() * 11) + 15; userLevel.lastMessageTimestamp = new Date(now);
    const xpNeeded = (userLevel.level + 1) * 100;
    if (userLevel.xp >= xpNeeded) { userLevel.level += 1; userLevel.xp = 0; await message.channel.send(`🎉 كفو ${message.author}! وصلت لـ ليفل **${userLevel.level}**!`); }
    await data.save();
});

// لوق حذف وتعديل الرسائل
client.on('messageDelete', async (m) => {
    if (!m.guild || m.author?.bot) return;
    await sendLog(m.guild, new EmbedBuilder().setTitle('🗑️ رسالة محذوفة').setDescription(`**الكاتب:** ${m.author}\n**الروم:** ${m.channel}\n**المحتوى:**\n\`\`\`${m.content || 'محتوى غير نصي'}\`\`\``).setColor('#e74c3c').setTimestamp());
});

client.on('messageUpdate', async (o, n) => {
    if (!o.guild || o.author?.bot || o.content === n.content) return;
    await sendLog(o.guild, new EmbedBuilder().setTitle('📝 رسالة معدلة').setDescription(`**الكاتب:** ${o.author}\n**الروم:** ${o.channel}\n**القديمة:**\n\`\`\`${o.content}\`\`\`\n**الجديدة:**\n\`\`\`${n.content}\`\`\``).setColor('#3498db').setTimestamp());
});

// لوق دخول الأعضاء وتتبع رابط الدعوة + طرد الحسابات الوهمية
client.on('guildMemberAdd', async (m) => {
    if (Date.now() - m.user.createdTimestamp < 3 * 24 * 60 * 60 * 1000) {
        await m.send(`❌ تم طردك تلقائياً لأن حسابك وهمي وجديد جداً لحماية السيرفر.`).catch(() => {});
        return await m.kick('حساب وهمي (Anti-Alt protection)').catch(() => {});
    }

    let invTxt = "غير معروف";
    try {
        const cached = invitesCache.get(m.guild.id);
        const current = await m.guild.invites.fetch();
        for (const [code, inv] of current) {
            if (inv.uses > (cached?.get(code) || 0)) {
                invTxt = `**${inv.inviter.tag}**\n**الكود:** \`${code}\` (\`${inv.uses}\` استخدام)`;
                cached.set(code, inv.uses); break;
            }
        }
    } catch { }

    const embed = new EmbedBuilder().setTitle('📥 عضو جديد انضم').setThumbnail(m.user.displayAvatarURL({ dynamic: true })).setDescription(`**العضو:** ${m} (${m.user.tag})\n**دعا بواسطة:** ${invTxt}`).setColor('#2ecc71').setTimestamp();
    await sendLog(m.guild, embed);
});

process.on('unhandledRejection', error => console.error('[خطأ غير معالج]:', error));

client.login(process.env.TOKEN);
