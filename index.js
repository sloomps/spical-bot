require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextInputBuilder, TextInputStyle, ModalBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const GuildData = require('./models/guildSchema');

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بقاعدة بيانات MongoDB بنجاح!'))
    .catch((err) => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

client.once('ready', () => {
    console.log(`🚀 تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
    
    // تحديث الأوامر المتاحة وتشمل نظام الرانك المطور (Rank + Leaderboard)
    const commands = [
        { name: 'setup-ticket', description: 'إعداد نظام تذاكر الدعم الفني الحديث بالسيرفر' },
        { name: 'rank', description: 'عرض مستواك الحالي ونقاط الخبرة الخاصة بك' },
        { name: 'leaderboard', description: 'عرض قائمة أعلى 10 أعضاء متفاعلين في السيرفر' },
        { name: 'daily', description: 'استلام مكافأتك المالية اليومية' }
    ];
    
    client.application.commands.set(commands)
        .then(() => console.log('🔹 تم تسجيل جميع أوامر السلاش بنجاح!'))
        .catch(console.error);
});

// === معالج أوامر السلاش والتفاعلات ===
client.on('interactionCreate', async (interaction) => {
    
    if (interaction.isChatInputCommand()) {
        // [أمر التكت - بدون تغيير]
        if (interaction.commandName === 'setup-ticket') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص للإدارة فقط.', ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setTitle('🎫 مركز الدعم الفني والبطاقات')
                .setDescription('إذا كنت تواجه مشكلة أو تحتاج إلى مساعدة من الإدارة، اضغط على الزر أدناه لفتح تذكرة جديدة.')
                .setColor('#2f3136');
                
            const btn = new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة دعم').setStyle(ButtonStyle.Primary).setEmoji('📩');
            await interaction.reply({ content: '✅ تم إرسال نظام التكت بنجاح!', ephemeral: true });
            await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
        }

        // [أمر الرانك الحالي المطور - يعرض النسبة المئوية للتقدم أيضاً]
        if (interaction.commandName === 'rank') {
            const data = await GuildData.findOne({ guildID: interaction.guild.id });
            const userLevel = data?.levels.find(l => l.userID === interaction.user.id);
            if (!userLevel) return interaction.reply('📊 لم تقم بالدردشة بعد لكسب مستويات.');
            
            const xpNeeded = (userLevel.level + 1) * 100;
            const progressPercent = Math.floor((userLevel.xp / xpNeeded) * 100);

            const embed = new EmbedBuilder()
                .setTitle(`📊 بطاقة المستوى | ${interaction.user.username}`)
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '✨ المستوى الحالي:', value: `\`🏅 Level ${userLevel.level}\``, inline: true },
                    { name: '⭐ نقاط الخبرة (XP):', value: `\`✨ ${userLevel.xp} / ${xpNeeded}\` (${progressPercent}%)`, inline: true }
                ).setColor('#3498db')
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
        }

        // [الأمر الجديد: لوحة الصدارة لأفضل المتفاعلين - Leaderboard]
        if (interaction.commandName === 'leaderboard') {
            const data = await GuildData.findOne({ guildID: interaction.guild.id });
            if (!data || !data.levels || data.levels.length === 0) {
                return interaction.reply('❌ لا توجد بيانات مستويات مسجلة في هذا السيرفر حالياً.');
            }

            // ترتيب الأعضاء بناءً على المستوى ثم الـ XP الأعلى تنازلياً وجلب توب 10
            const sortedLevels = data.levels
                .sort((a, b) => {
                    if (b.level === a.level) return b.xp - a.xp;
                    return b.level - a.level;
                })
                .slice(0, 10);

            const leaderboardEmbed = new EmbedBuilder()
                .setTitle(`🏆 قائمة متصدري التفاعل في السيرفر`)
                .setColor('#f1c40f')
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setTimestamp();

            let description = "";
            for (let i = 0; i < sortedLevels.length; i++) {
                const uData = sortedLevels[i];
                try {
                    const member = await interaction.guild.members.fetch(uData.userID);
                    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `\`#${i + 1}\``;
                    description += `${medal} **${member.user.username}** - ليفل \`${uData.level}\` (XP: \`${uData.xp}\`)\n`;
                } catch {
                    description += `\`#${i + 1}\` مستخدم غادر السيرفر - ليفل \`${uData.level}\`\n`;
                }
            }

            leaderboardEmbed.setDescription(description || "لا يوجد تفاعل كافٍ لعرض القائمة بعد.");
            await interaction.reply({ embeds: [leaderboardEmbed] });
        }

        // [أمر الهدية اليومية - بدون تغيير]
        if (interaction.commandName === 'daily') {
            let data = await GuildData.findOne({ guildID: interaction.guild.id }) || new GuildData({ guildID: interaction.guild.id });
            let userEco = data.economy.find(e => e.userID === interaction.user.id);
            if (!userEco) {
                data.economy.push({ userID: interaction.user.id, coins: 0 });
                userEco = data.economy.find(e => e.userID === interaction.user.id);
            }
            const now = new Date();
            if (userEco.dailyCooldown && (now - userEco.dailyCooldown < 86400000)) {
                return interaction.reply({ content: '❌ لقد استلمت مكافأتك اليومية بالفعل، عد لاحقاً!', ephemeral: true });
            }
            userEco.coins += 500;
            userEco.dailyCooldown = now;
            await data.save();
            await interaction.reply(`💰 تهانينا! استلمت **500** عملة يومية. رصيدك الحالي: **${userEco.coins}**.`);
        }
    }

    // === تابع نظام التكت المطور الحديث بالأزرار وقفل واستلام المحادثات والـ Transcript ===
    if (interaction.isButton()) {
        if (interaction.customId === 'open_ticket') {
            const modal = new ModalBuilder().setCustomId('ticket_modal').setTitle('🎫 فتح تذكرة جديدة');
            const reason = new TextInputBuilder().setCustomId('ticket_reason').setLabel("ما سبب فتح التذكرة؟").setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('اكتب تفاصيل مشكلتك هنا...');
            modal.addComponents(new ActionRowBuilder().addComponents(reason));
            await interaction.showModal(modal);
        }
        
        if (interaction.customId === 'claim_ticket') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: '❌ هذا الإجراء مخصص لفريق الدعم فقط.', ephemeral: true });
            }
            await interaction.reply({ content: `🔒 تم استلام التذكرة وتثبيتها بواسطة المساعد: ${interaction.user}` });
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('تم الاستلام').setStyle(ButtonStyle.Success).setDisabled(true).setEmoji('🙋‍♂️'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );
            await interaction.message.edit({ components: [disabledRow] });
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.reply('🔒 يتم الآن أرشفة المحادثة وإغلاق الغرفة خلال 5 ثوانٍ...');
            try {
                const fetchedMessages = await interaction.channel.messages.fetch({ limit: 100 });
                let transcriptText = `سجل تذكرة: ${interaction.channel.name}\nأُغلقت بواسطة: ${interaction.user.tag}\n\n`;
                fetchedMessages.reverse().forEach(msg => {
                    transcriptText += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
                });
                const data = await GuildData.findOne({ guildID: interaction.guild.id });
                const logChannel = interaction.guild.channels.cache.get(data?.settings?.logChannelID);
                const logEmbed = new EmbedBuilder().setTitle('📄 أرشيف تذكرة مغلقة').setDescription(`تم إغلاق تذكرة **${interaction.channel.name}**\n**بواسطة:** ${interaction.user}`).setColor('#ff3333').setTimestamp();
                if (logChannel) {
                    await logChannel.send({ embeds: [logEmbed], files: [{ attachment: Buffer.from(transcriptText), name: `${interaction.channel.name}-transcript.txt` }] });
                }
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
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });
        const embed = new EmbedBuilder().setTitle('🎫 تذكرة دعم جديدة').setDescription(`مرحباً بك ${interaction.user} في تذكرتك.\n\n**السبب المكتوب:**\n\`\`\`${reason}\`\`\`\nيرجى انتظار فريق الدعم.`).setColor('#00ffcc').setTimestamp();
        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );
        await channel.send({ content: `${interaction.user} | فريق الدعم`, embeds: [embed], components: [controlRow] });
        await interaction.reply({ content: `✅ تم فتح تذكرتك بنجاح في: ${channel}`, ephemeral: true });
    }
});

// === نظام المستويات وحماية الروابط (Anti-Scam & Levels) ===
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // حماية الروابط
    const scamRegex = /(discord\.gg\/|gift|nitro|steam|crypto)/i;
    if (scamRegex.test(message.content) && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        await message.delete().catch(() => {});
        return message.channel.send(`⚠️ تم حذف رسالة ${message.author} تلقائياً لمنع الروابط غير المصرح بها.`);
    }

    // احتساب نقاط الـ XP
    let data = await GuildData.findOne({ guildID: message.guild.id }) || new GuildData({ guildID: message.guild.id });
    let userLevel = data.levels.find(l => l.userID === message.author.id);
    if (!userLevel) {
        data.levels.push({ userID: message.author.id, xp: 0, level: 0, lastMessageTimestamp: new Date(0) });
        userLevel = data.levels.find(l => l.userID === message.author.id);
    }

    const now = new Date();
    if (now - userLevel.lastMessageTimestamp < 60000) return;

    userLevel.xp += Math.floor(Math.random() * 11) + 15;
    userLevel.lastMessageTimestamp = now;

    const xpNeeded = (userLevel.level + 1) * 100;
    if (userLevel.xp >= xpNeeded) {
        userLevel.level += 1;
        userLevel.xp = 0;
        await message.channel.send(`🎉 كفو ${message.author}! ارتفع مستواك وأصبحت في المستوى **${userLevel.level}**!`);
    }
    await data.save();
});

process.on('unhandledRejection', error => console.error('[خطأ غير معالج]:', error));

client.login(process.env.TOKEN);
