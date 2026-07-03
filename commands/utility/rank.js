const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const GuildData = require('../../models/guildSchema');

module.exports = {
    data: new SlashCommandBuilder().setName('rank').setDescription('عرض مستواك الحالي'),
    async execute(interaction) {
        const data = await GuildData.findOne({ guildID: interaction.guild.id });
        const userLevel = data?.levels.find(l => l.userID === interaction.user.id);
        
        if (!userLevel) return interaction.reply('لم تتفاعل بعد شات لكسب مستويات.');
        
        const embed = new EmbedBuilder()
            .setTitle(`📊 رتبة ${interaction.user.username}`)
            .addFields(
                { name: 'المستوى:', value: `${userLevel.level}`, inline: true },
                { name: 'الـ XP:', value: `${userLevel.xp}`, inline: true }
            ).setColor('#3498db');
            
        await interaction.reply({ embeds: [embed] });
    }
};
