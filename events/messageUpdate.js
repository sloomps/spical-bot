const { EmbedBuilder } = require('discord.js');
const GuildData = require('../../models/guildSchema');

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage) {
        if (oldMessage.author?.bot || !oldMessage.guild) return;
        if (oldMessage.content === newMessage.content) return; // إذا تم تعديل شيء آخر غير النص

        const data = await GuildData.findOne({ guildID: oldMessage.guild.id });
        if (!data || !data.settings.logChannelID) return;

        const logChannel = oldMessage.guild.channels.cache.get(data.settings.logChannelID);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('📝 تعديل رسالة')
            .setColor('#ffaa00')
            .addFields(
                { name: 'الكاتب:', value: `${oldMessage.author}`, inline: true },
                { name: 'الروم:', value: `${oldMessage.channel}`, inline: true },
                { name: 'الرسالة القديمة:', value: oldMessage.content || '_فارغ_' },
                { name: 'الرسالة الجديدة:', value: newMessage.content || '_فارغ_' }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
};
