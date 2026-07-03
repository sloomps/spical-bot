const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-ticket')
        .setDescription('إعداد نظام التذاكر الحديث في السيرفر'),
    async execute(interaction) {
        // التحقق من صلاحيات الإدارة
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: 'لا تملك صلاحيات لاستخدام هذا الأمر.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 مركز الدعم الفني والبطاقات')
            .setDescription('إذا كنت تواجه مشكلة أو ترغب في تقديم استفسار، اضغط على الزر أدناه لفتح تذكرة جديدة وسيقوم فريق الإدارة بالرد عليك فوراً.')
            .setColor('#2f3136')
            .setFooter({ text: 'نظام تذاكر متطور وآمن' });

        const button = new ButtonBuilder()
            .setCustomId('open_ticket')
            .setLabel('فتح تذكرة دعم')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📩');

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.reply({ content: 'تم إرسال نظام التكت بنجاح!', ephemeral: true });
        await interaction.channel.send({ embeds: [embed], components: [row] });
    }
};
