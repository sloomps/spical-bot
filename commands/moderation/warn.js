const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const GuildData = require('../../models/guildSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('توجيه تحذير رسمي لعضو في السيرفر')
        .addUserOption(option => option.setName('user').setDescription('العضو المراد تحذيره').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('سبب التحذير').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        let data = await GuildData.findOne({ guildID: interaction.guild.id });
        if (!data) {
            data = new GuildData({ guildID: interaction.guild.id });
        }

        // إضافة التحذير لسجلات العضو
        data.moderation.warns.push({
            userID: target.id,
            reason: reason,
            moderatorID: interaction.user.id
        });
        await data.save();

        const embed = new EmbedBuilder()
            .setTitle('⚠️ تم تسجيل تحذير جديد')
            .setColor('#ff9900')
            .addFields(
                { name: 'المستهدف:', value: `${target}`, inline: true },
                { name: 'بواسطة:', value: `${interaction.user}`, inline: true },
                { name: 'السبب:', value: `${reason}` }
            )
            .setTimestamp();

        // إرسال رسالة خاصة للعضو المحذر
        await target.send(`لقد تلقيت تحذيراً في سيرفر **${interaction.guild.name}** بسبب: ${reason}`).catch(() => {});

        await interaction.reply({ embeds: [embed] });
    }
};
