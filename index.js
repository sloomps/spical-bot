const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextInputBuilder, TextInputStyle, ModalBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config();

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
    
    // تسجيل أوامر السلاش تلقائياً عند التشغيل
    const commands = [
        { name: 'setup-ticket', description: 'إعداد نظام تذاكر الدعم الفني الحديث بالسيرفر' },
        { name: 'rank', description: 'عرض مستواك الحالي ونقاط الخبرة الخاصة بك' },
        { name: 'daily', description: 'استلام مكافأتك المالية اليومية' }
    ];
    
    client.application.commands.set(commands)
        .then(() => console.log('🔹 تم تسجيل جميع أوامر السلاش بنجاح!'))
        .catch(console.error);
});

// === 1. معالج أوامر السلاش والتفاعلات (الأزرار والنوافذ) ===
client.on('interactionCreate', async (interaction) => {
    // تشغيل الأوامر
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup-ticket') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص للإدارة فقط.', ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setTitle('🎫 مركز الدعم الفني')
                .setDescription('إذا كنت تواجه مشكلة، اضغط على الزر أدناه لفتح تذكرة دعم جديدة وسيتواصل معك الفريق.')
                .setColor('#2f3136');
            const btn = new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة دعم').setStyle(ButtonStyle.Primary).setEmoji('📩');
            await interaction.reply({ content: '✅ تم إرسال نظام التكت بنجاح!', ephemeral: true });
            await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
        }

        if (interaction.commandName === 'rank') {
            const data = await GuildData.findOne({ guildID: interaction.guild.id });
            const userLevel = data?.levels.find(l => l.userID === interaction.user.id);
            if (!userLevel) return interaction.reply('📊 لم تقم بالدردشة بعد لكسب مستويات.');
            
            const embed = new EmbedBuilder()
                .setTitle(`📊 بطاقة مستوى | ${interaction.user.username}`)
                .addFields(
                    { name: '✨ المستوى الحالي:', value: `\`${userLevel.level}\``, inline: true },
                    { name: '⭐ نقاط الخبرة XP:', value: `\`${userLevel.xp} / ${(userLevel.level + 1) * 100}\``, inline: true }
                ).setColor('#3498db');
            await interaction.reply({ embeds: [embed] });
        }

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

    // تشغيل أزرار التكت
    if (interaction.isButton()) {
        if (interaction.customId === 'open_ticket') {
            const modal = new ModalBuilder().setCustomId('ticket_modal').setTitle('🎫 فتح تذكرة جديدة');
            const reason = new TextInputBuilder().setCustomId('ticket_reason').setLabel("ما سبب فتح التذكرة؟").setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(reason));
            await interaction.showModal(modal);
        }
        if (interaction.customId === 'close_ticket') {
            await interaction.reply('🔒 سيتم إغلاق وتصفية التذكرة خلال 5 ثوانٍ...');
            setTimeout(async () => { await interaction.channel.delete().catch(() => {}); }, 5000);
        }
    }

    // استقبال بيانات التكت المنبثقة
    if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
        const reason = interaction.fields.getTextInputValue('ticket_reason');
        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });
        const embed = new EmbedBuilder().setTitle('🎫 تذكرة دعم جديدة').setDescription(`صاحب التذكرة: ${interaction.user}\n**السبب المعطى:** ${reason}`).setColor('#00ffcc');
        const closeBtn = new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒');
        await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(closeBtn)] });
        await interaction.reply({ content: `✅ تم فتح تذكرتك بنجاح في: ${channel}`, ephemeral: true });
    }
});

// === 2. نظام المستويات وحماية الروابط (Anti-Scam & Levels) ===
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
    if (now - userLevel.lastMessageTimestamp < 60000) return; // دقيقة انتظار

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

// معالجة الأخطاء
process.on('unhandledRejection', error => console.error('[خطأ غير معالج]:', error));

client.login(process.env.TOKEN);
