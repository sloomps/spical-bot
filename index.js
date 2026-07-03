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

// ذاكرة مؤقتة لتعقب السبام (مكافحة التكرار السريع)
const antiSpamMap = new Map();

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بقاعدة بيانات MongoDB بنجاح!'))
    .catch((err) => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

client.once('ready', () => {
    console.log(`🚀 تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
    
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
        // [أمر التكت]
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

        // [أمر الرانك]
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
                ).setColor('#3498db');
            await interaction.reply({ embeds: [embed] });
        }

        // [أمر لوحة الصدارة]
        if (interaction.commandName === 'leaderboard') {
            const data = await GuildData.findOne({ guildID: interaction.guild.id });
            if (!data || !data.levels || data.levels.length === 0) {
                return interaction.reply('❌ لا توجد بيانات مستويات مسجلة في هذا السيرفر حالياً.');
            }

            const sortedLevels = data.levels
                .sort((a, b) => {
                    if (b.level === a.level) return b.xp - a.xp;
                    return b.level - a.level;
                })
                .slice(0, 10);

            const leaderboardEmbed = new EmbedBuilder()
                .setTitle(`🏆 قائمة متصدري التفاعل في السيرفر`)
                .setColor('#f1c40f')
                .setTimestamp();

            let description = "";
            for (let i = 0; i < sortedLevels.length; i++) {
                const uData = sortedLevels[i];
                try {
                    const member = await interaction.guild.members.fetch(uData.userID);
                    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `\`#${i + 1}\``;
                    description += `${medal} **${member.user.username}** - ليفل \`${uData.level}\` (XP: \`${uData.xp}\`)\n`;
                } catch {
                    description += `\`#${i + 1}\` مستخدم غادر - ليفل \`${uData.level}\`\n`;
                }
            }

            leaderboardEmbed.setDescription(description || "لا يوجد تفاعل كافٍ لعرض القائمة بعد.");
            await interaction.reply({ embeds: [leaderboardEmbed] });
        }

        // [أمر الهدية اليومية]
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

    // === تابع نظام التكت المطور ===
    if (interaction.isButton()) {
        if (interaction.customId === 'open_ticket') {
            const modal = new ModalBuilder().setCustomId('ticket_modal').setTitle('🎫 فتح تذكرة جديدة');
            const reason = new TextInputBuilder().setCustomId('ticket_reason').setLabel("ما سبب فتح التذكرة؟").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(reason));
            await interaction.showModal(modal);
        }
        
        if (interaction.customId === 'claim_ticket') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: '❌ هذا الإجراء مخصص لفريق الدعم فقط.', ephemeral: true });
            }
            await interaction.reply({ content: `🔒 تم استلام التذكرة بواسطة: ${interaction.user}` });
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('تم الاستلام').setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger)
            );
            await interaction.message.edit({ components: [disabledRow] });
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.reply('🔒 يتم الآن إغلاق الغرفة خلال 5 ثوانٍ...');
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
        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger)
        );
        await channel.send({ embeds: [embed], components: [controlRow] });
        await interaction.reply({ content: `✅ تم فتح تذكرتك في: ${channel}`, ephemeral: true });
    }
});

// === نظام الحماية الذكي والمستويات وعقوبات السبام ===
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // 1. نظام الحماية من السبام الكثيف (Anti-Spam)
    const authorId = message.author.id;
    const now = Date.now();
    
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        if (antiSpamMap.has(authorId)) {
            const userData = antiSpamMap.get(authorId);
            const { lastMessageTime, msgCount } = userData;
            
            // إذا أرسل أكثر من 5 رسائل في أقل من 3 ثوانٍ
            if (now - lastMessageTime < 3000) {
                if (msgCount >= 5) {
                    await message.delete().catch(() => {});
                    await message.member.timeout(300000, 'إرسال سبام وتكرار مكثف').catch(() => {}); // كتم 5 دقائق
                    return message.channel.send(`🚨 تم كتم ${message.author} لمدة 5 دقائق بسبب إرسال السبام المتكرر.`);
                }
                userData.msgCount++;
            } else {
                userData.msgCount = 1;
            }
            userData.lastMessageTime = now;
        } else {
            antiSpamMap.set(authorId, { lastMessageTime: now, msgCount: 1 });
        }
    }

    // 2. حماية الروابط والـ Anti-Scam المطور
    const scamRegex = /(discord\.gg\/|gift|nitro|steam|crypto|free-nitro|opensea)/i;
    if (scamRegex.test(message.content) && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        await message.delete().catch(() => {});
        await message.member.timeout(600000, 'نشر روابط مشبوهة أو سيرفرات').catch(() => {});
        return message.channel.send(`⚠️ تم حذف رسالة ${message.author} وكتمه لـ 10 دقائق لمنع انتشار الروابط المشبوهة.`);
    }

    // 3. احتساب نقاط الـ XP والمستويات (بدون تغيير)
    let data = await GuildData.findOne({ guildID: message.guild.id }) || new GuildData({ guildID: message.guild.id });
    let userLevel = data.levels.find(l => l.userID === message.author.id);
    if (!userLevel) {
        data.levels.push({ userID: message.author.id, xp: 0, level: 0, lastMessageTimestamp: new Date(0) });
        userLevel = data.levels.find(l => l.userID === message.author.id);
    }

    if (now - new Date(userLevel.lastMessageTimestamp).getTime() < 60000) return;

    userLevel.xp += Math.floor(Math.random() * 11) + 15;
    userLevel.lastMessageTimestamp = new Date(now);

    const xpNeeded = (userLevel.level + 1) * 100;
    if (userLevel.xp >= xpNeeded) {
        userLevel.level += 1;
        userLevel.xp = 0;
        await message.channel.send(`🎉 كفو ${message.author}! ارتفع مستواك وأصبحت في المستوى **${userLevel.level}**!`);
    }
    await data.save();
});

// 4. نظام الحماية ضد الحسابات الوهمية (Anti-Alt Accounts / Raid)
client.on('guildMemberAdd', async (member) => {
    // التحقق من عمر الحساب (إذا كان أقل من 3 أيام)
    const minAge = 3 * 24 * 60 * 60 * 1000; 
    const accountAge = Date.now() - member.user.createdTimestamp;

    if (accountAge < minAge) {
        try {
            await member.send(`❌ تم طردك تلقائياً من سيرفر **${member.guild.name}** لأن حسابك جديد جداً (حساب وهمي) لحماية السيرفر.`).catch(() => {});
            await member.kick('حساب وهمي (Anti-Alt protection)');
        } catch (err) {
            console.error('فشل طرد الحساب الوهمي:', err);
        }
    }
});

process.on('unhandledRejection', error => console.error('[خطأ غير معالج]:', error));

client.login(process.env.TOKEN);
