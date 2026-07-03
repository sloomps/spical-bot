const { EmbedBuilder } = require('discord.js');
const GuildData = require('../../models/guildSchema');

module.exports = {
    name: 'messageDelete',
    async execute(message) {
        if (message.author?.bot || !message.guild) return;

        const data = await GuildData.findOne({ guildID: message.guild.id });
        if (!data || !data.settings.logChannelID) return;

        const logChannel = message.guild.channels.cache.get(data.settings.logChannelID);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('🗑️ رسالة محذوفة')
            .setColor('#ff3333')
            .addFields(
                { name: 'الكاتب:', value: `${message.author} (${message.author.id})`, inline: true },
                { name: 'الركام/الروم:', value: `${message.channel}`, inline: true },
                { name: 'المحتوى المحذوف:', value: message.content || '_محتوى غير نصي (صورة أو إيموجي)_' }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
};
