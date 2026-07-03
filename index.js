require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextInputBuilder, TextInputStyle, ModalBuilder, ChannelType, PermissionFlagsBits, AuditLogEvent } = require('discord.js');
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

// ذاكرة مؤقتة لتعقب السبام والدعوات
const antiSpamMap = new Map();
const invitesCache = new Map();

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بقاعدة بيانات MongoDB بنجاح!'))
    .catch((err) => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

// جلب وتخزين روابط الدعوة عند جاهزية البوت
client.once('ready', async () => {
    console.log(`🚀 تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
    
    // تحديث الأوامر لتشمل أمر إعداد اللوج
    const commands = [
        { name: 'setup-ticket', description: 'إعداد نظام تذاكر الدعم الفني الحديث بالسيرفر' },
        { name: 'setup-logs', description: 'تحديد قناة إرسال لوقات السيرفر المتطورة', options: [{ name: 'channel', description: 'اختر قناة اللوج', type: 7, required: true }] },
        { name: 'rank', description: 'عرض مستواك الحالي ونقاط الخبرة الخاصة بك' },
        { name: 'leaderboard', description: 'عرض قائمة أعلى 10 أعضاء متفاعلين في السيرفر' },
        { name: 'daily', description: 'استلام مكافأتك المالية اليومية' }
    ];
    
    await client.application.commands.set(commands).catch(console.error);

    // كاش روابط الدعوة
    client.guilds.cache.forEach(async (guild) => {
        try {
            const firstInvites = await guild.invites.fetch();
            invitesCache.set(guild.id, new Map(firstInvites.map(invite => [invite.code, invite.uses])));
        } catch (err) { console.log(`فشل كاش دعوات لسيرفر: ${guild.name}`); }
    });
});

// دالة مساعدة لإرسال اللوج
async function sendLog(guild, embed, files = []) {
    try {
        const data = await GuildData.findOne({ guildID: guild.id });
        if (!data || !data.settings.logChannelID) return;
        const logChannel = guild.channels.cache.get(data.settings.logChannelID);
        if (logChannel) await logChannel.send({ embeds: [embed], files: files });
    } catch (err) { console.error('خطأ أثناء إرسال اللوج:', err); }
}

// === معالج أوامر السلاش والتفاعلات ===
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        
        // [أمر إعداد اللوج الجديد]
        if (interaction.commandName === 'setup-logs') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص للإدارة فقط.', ephemeral: true });
            }
            const channel = interaction.options.getChannel('channel');
            if (channel.type !== ChannelType.GuildText) return interaction.reply({ content: '❌ يجب اختيار قناة نصية فقط.', ephemeral: true });

            let data = await GuildData.findOne({ guildID: interaction.guild.id }) || new GuildData({ guildID: interaction.guild.id });
            data.settings.logChannelID = channel.id;
            await data.save();

            return interaction.reply({ content: `✅ تم تعيين قناة اللوج بنجاح في: ${channel}`, ephemeral: true });
        }

        // [أمر التكت - بدون تغيير]
        if (interaction.commandName === 'setup-ticket') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ هذا الأمر مخصص للإدارة فقط.', ephemeral: true });
            const embed = new EmbedBuilder().setTitle('🎫 مركز الدعم الفني والبطاقات').setDescription('إذا كنت تواجه مشكلة، اضغط على الزر أدناه لفتح تذكرة جديدة.').setColor('#2f3136');
            const btn = new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة دعم').setStyle(ButtonStyle.Primary).setEmoji('📩');
            await interaction.reply({ content: '✅ تم إرسال نظام التكت بنجاح!', ephemeral: true });
            await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
        }

        // [أمر الرانك - بدون تغيير]
        if (interaction.commandName === 'rank') {
            const data = await GuildData.findOne({ guildID: interaction.guild.id });
            const userLevel = data?.levels.find(l => l.userID === interaction.user.id);
            if (!userLevel) return interaction.reply('📊 لم تقم بالدردشة بعد لكسب مستويات.');
            const xpNeeded = (userLevel.level + 1) * 100;
            const progressPercent = Math.floor((userLevel.xp / xpNeeded) * 100);
            const embed = new EmbedBuilder().setTitle(`📊 بطاقة المستوى | ${interaction.user.username}`).addFields({ name: '✨ المستوى الحالي:', value: `\`🏅 Level ${userLevel.level}\``, inline: true }, { name: '⭐ نقاط الخبرة:', value: `\`✨ ${userLevel.xp} / ${xpNeeded}\` (${progressPercent}%)`, inline: true }).setColor('#3498db');
            await interaction.reply({ embeds: [embed] });
        }

        // [أمر لوحة الصدارة - بدون تغيير]
        if (interaction.commandName === 'leaderboard') {
            const data = await GuildData.findOne({ guildID: interaction.guild.id });
            if (!data || !data.levels || data.levels.length === 0) return interaction.reply('❌ لا توجد بيانات مستويات.');
            const sortedLevels = data.levels.sort((a, b) => b.level === a.level ? b.xp - a.xp : b.level - a.level).slice(0, 10);
            const embed = new EmbedBuilder().setTitle(`🏆 قائمة متصدري التفاعل`).setColor('#f1c40f');
            let desc = "";
            for (let i = 0; i < sortedLevels.length; i++) {
                try {
                    const member = await interaction.guild.members.fetch(sortedLevels[i].userID);
                    desc += `${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`} **${member.user.username}** - ليفل \`${sortedLevels[i].level}\`\n`;
                } catch { desc += `#${i+1} مستخدم غادر - ليفل \`${sortedLevels[i].level}\`\n`; }
            }
            embed.setDescription(desc || "لا يوجد بيانات بعد.");
            await interaction.reply({ embeds: [embed] });
        }

        // [أمر الهدية اليومية - بدون تغيير]
        if (interaction.commandName === 'daily') {
            let data = await GuildData.findOne({ guildID: interaction.guild.id }) || new GuildData({ guildID: interaction.guild.id });
            let userEco = data.economy.find(e => e.userID === interaction.user.id);
            if (!userEco) { data.economy.push({ userID: interaction.user.id, coins: 0 }); userEco = data.economy.find(e => e.userID === interaction.user.id); }
            const now = new Date();
            if (userEco.dailyCooldown && (now - userEco.dailyCooldown < 86400000)) return interaction.reply({ content: '❌ استلمت مكافأتك بالفعل!', ephemeral: true });
            userEco.coins += 500; userEco.dailyCooldown = now; await data.save();
            await interaction.reply(`💰 استلمت **500** عملة يومية. رصيدك: **${userEco.coins}**.`);
        }
    }

    // === لوقات ونظام التكت المطور الحديث ===
    if (interaction.isButton()) {
        if (interaction.customId === 'open_ticket') {
            const modal = new ModalBuilder().setCustomId('ticket_modal').setTitle('🎫 فتح تذكرة جديدة');
            const reason = new TextInputBuilder().setCustomId('ticket_reason').setLabel("ما سبب فتح التذكرة؟").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(reason));
            await interaction.showModal(modal);
        }
        
        if (interaction.customId === 'claim_ticket') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({ content: '❌ للدعم فقط.', ephemeral: true });
            await interaction.reply({ content: `🔒 تم استلام التذكرة بواسطة: ${interaction.user}` });
            const disabledRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('claim_ticket').setLabel('تم الاستلام').setStyle(ButtonStyle.Success).setDisabled(true), new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger));
            await interaction.message.edit({ components: [disabledRow] });

            // لوق استلام التذكرة
            const logEmbed = new EmbedBuilder().setTitle('🙋‍♂️ تذكرة تم استلامها').setDescription(`**التذكرة:** ${interaction.channel.name}\n**المستلم:** ${interaction.user}`).setColor('#f1c40f').setTimestamp();
            await sendLog(interaction.guild, logEmbed);
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.reply('🔒 يتم الآن أرشفة وإغلاق التذكرة خلال 5 ثوانٍ...');
            
            try {
                const fetchedMessages = await interaction.channel.messages.fetch({ limit: 100 });
                let transcriptText = `سجل تذكرة: ${interaction.channel.name}\nأُغلقت بواسطة: ${interaction.user.tag}\n\n`;
                fetchedMessages.reverse().forEach(msg => { transcriptText += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`; });

                const logEmbed = new EmbedBuilder().setTitle('📄 أرشيف تذكرة مغلقة').setDescription(`تم إغلاق وحذف تذكرة **${interaction.channel.name}**\n**بواسطة:** ${interaction.user}`).setColor('#ff3333').setTimestamp();
                await sendLog(interaction.guild, logEmbed, [{ attachment: Buffer.from(transcriptText), name: `${interaction.channel.name}-transcript.txt` }]);
            } catch (err) { console.error(err); }

            setTimeout(async () => { await interaction.channel.delete().catch(() => {}); }, 5000);
        }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
        const reason = interaction.fields.getTextInputValue('ticket_reason');
        const channel = await interaction.guild.channels.create({
            name: `🎫-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });
        const embed = new EmbedBuilder().setTitle('🎫 تذكرة دعم جديدة').setDescription(`السبب: ${reason}`).setColor('#00ffcc');
        const controlRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger));
        await channel.send({ embeds: [embed], components: [controlRow] });
        await interaction.reply({ content: `✅ تم فتح تذكرتك في: ${channel}`, ephemeral: true });

        // لوق إنشاء تذكرة
        const logEmbed = new EmbedBuilder().setTitle('📩 إنشاء تذكرة دعم').setDescription(`**العضو:** ${interaction.user}\n**الروم:** ${channel}\n**السبب:** ${reason}`).setColor('#2ecc71').setTimestamp();
        await sendLog(interaction.guild, logEmbed);
    }
});

// === لوقات الرسائل + حماية وحساب المستويات ===
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const authorId = message.author.id;
    const now = Date.now();

    // منع السبام
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        if (antiSpamMap.has(authorId)) {
            const userData = antiSpamMap.get(authorId);
            if (now - userData.lastMessageTime < 3000) {
                if (userData.msgCount >= 5) {
                    await message.delete().catch(() => {});
                    await message.member.timeout(300000, 'إرسال سبام').catch(() => {});
                    return message.channel.send(`🚨 تم كتم ${message.author} لـ 5 دقائق بسبب السبام.`);
                }
                userData.msgCount++;
            } else { userData.msgCount = 1; }
            userData.lastMessageTime = now;
        } else { antiSpamMap.set(authorId, { lastMessageTime: now, msgCount: 1 }); }
    }

    // حماية الروابط
    const scamRegex = /(discord\.gg\/|gift|nitro|steam|crypto)/i;
    if (scamRegex.test(message.content) && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        await message.delete().catch(() => {});
        await message.member.timeout(600000, 'نشر روابط مشبوهة').catch(() => {});
        return message.channel.send(`⚠️ تم حذف رسالة ${message.author} وكتمه لـ 10 دقائق.`);
    }

    // نقاط المستويات
    let data = await GuildData.findOne({ guildID: message.guild.id }) || new GuildData({ guildID: message.guild.id });
    let userLevel = data.levels.find(l => l.userID === message.author.id);
    if (!userLevel) { data.levels.push({ userID: message.author.id, xp: 0, level: 0, lastMessageTimestamp: new Date(0) }); userLevel = data.levels.find(l => l.userID === message.author.id); }
    if (now - new Date(userLevel.lastMessageTimestamp).getTime() < 60000) return;
    userLevel.xp += Math.floor(Math.random() * 11) + 15; userLevel.lastMessageTimestamp = new Date(now);
    const xpNeeded = (userLevel.level + 1) * 100;
    if (userLevel.xp >= xpNeeded) { userLevel.level += 1; userLevel.xp = 0; await message.channel.send(`🎉 كفو ${message.author}! وصلت لـ ليفل **${userLevel.level}**!`); }
    await data.save();
});

// [لوق الرسائل المحذوفة]
client.on('messageDelete', async (message) => {
    if (!message.guild || message.author?.bot) return;
    const logEmbed = new EmbedBuilder()
        .setTitle('🗑️ رسالة محذوفة')
        .setDescription(`**الكاتب:** ${message.author}\n**الروم:** ${message.channel}\n**المحتوى المحذوف:**\n\`\`\`${message.content || 'لا يوجد نص (صورة أو إيموجي)'}\`\`\``)
        .setColor('#e74c3c').setTimestamp();
    await sendLog(message.guild, logEmbed);
});

// [لوق الرسائل المعدلة]
client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
    const logEmbed = new EmbedBuilder()
        .setTitle('📝 رسالة معدلة')
        .setDescription(`**الكاتب:** ${oldMessage.author}\n**الروم:** ${oldMessage.channel}\n**الرسالة القديمة:**\n\`\`\`${oldMessage.content}\`\`\`\n**الرسالة الجديدة:**\n\`\`\`${newMessage.content}\`\`\``)
        .setColor('#3498db').setTimestamp();
    await sendLog(oldMessage.guild, logEmbed);
});

// [لوق روابط الدعوة ومعرفة من قام بدعوة العضو الجديد]
client.on('guildMemberAdd', async (member) => {
    // 1. حماية الحسابات الوهمية
    const minAge = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() - member.user.createdTimestamp < minAge) {
        await member.send(`❌ تم طردك تلقائياً لأن حسابك جديد جداً لحماية السيرفر.`).catch(() => {});
        return await member.kick('حساب وهمي (Anti-Alt protection)').catch(() => {});
    }

    // 2. تتبع رابط الدعوة
    let inviterText = "غير معروف (ربما عبر رابط مخصص أو دمج)";
    try {
        const cachedInvites = invitesCache.get(member.guild.id);
        const currentInvites = await member.guild.invites.fetch();
        
        for (const [code, invite] of currentInvites) {
            const cachedUses = cachedInvites?.get(code) || 0;
            if (invite.uses > cachedUses) {
                inviterText = `**${invite.inviter.tag}** (${invite.inviter.id})\n**الكود المستخدم:** \`${code}\` (استخدمت \`${invite.uses}\` مرة)`;
                cachedInvites.set(code, invite.uses); // تحديث الكاش لقادم المرات
                break;
            }
        }
    } catch (err) { console.error('خطأ بتتبع الدعوة:', err); }

    const logEmbed = new EmbedBuilder()
        .setTitle('📥 عضو جديد انضم')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setDescription(`**العضو:** ${member} (${member.user.tag})\n**عمر الحساب:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n**تمت دعوته بواسطة:**\n${inviterText}`)
        .setColor('#2ecc71').setTimestamp();
        
    await sendLog(member.guild, logEmbed);
});

process.on('unhandledRejection', error => console.error('[خطأ غير معالج]:', error));

client.login(process.env.TOKEN);
