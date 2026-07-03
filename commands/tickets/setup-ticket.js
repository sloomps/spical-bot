const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder().setName('setup-ticket').setDescription('إعداد نظام التذاكر'),
    async execute(interaction) {
        if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'للإدارة فقط', ephemeral: true });
        
        const embed = new EmbedBuilder().setTitle('🎫 مركز الدعم').setDescription('اضغط للفتح').setColor('#2f3136');
        const btn = new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setStyle(ButtonStyle.Primary);
        
        await interaction.reply({ content: 'تم الإرسال', ephemeral: true });
        await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
    }
};
