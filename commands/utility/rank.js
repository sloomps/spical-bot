const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const GuildData = require('../../models/guildSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('عرض مستواك الحالي ونقاط الخبرة الخاصة بك')
        .addUserOption(option => option.setName('user').setDescription('العضو المراد رؤية مستواه (اختياري)')),
    
    async execute(interaction) {
        const target = interaction.options.getUser('user') || interaction.user;
        
        const data = await GuildData.findOne({ guildID: interaction.guild.id });
        if (!data) {
            return interaction.reply({ content: '❌ لا توجد بيانات مستويات مسجلة في هذا السيرفر بعد.', ephemeral: true });
        }

        const userLevelData = data.levels.find(l => l.userID === target.id);
        if (!userLevelData) {
            return interaction.reply({ content: `${target.id === interaction.user.id ? 'أنت لم تتفاعل' : 'هذا العضو لم يتفاعل'} بعد في الشات لكسب مستويات.`, ephemeral: true });
        }

        const xpNeeded = (userLevelData.level + 1) * 100;

        const embed = new EmbedBuilder()
            .setTitle(`📊 بطاقة المستوى لـ ${target.username}`)
            .setColor('#3498db')
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '✨ المستوى الحالي:', value: `\`${userLevelData.level}\``, inline: true },
                { name: '⭐ نقاط الخبرة (XP):', value: `\`${userLevelData.xp} / ${xpNeeded}\``, inline: true }
            )
            .setFooter({ text: 'استمر في التفاعل لرفع مستواك!' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
