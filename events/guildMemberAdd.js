const { EmbedBuilder } = require('discord.js');
const GuildData = require('../models/guildSchema');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        const data = await GuildData.findOne({ guildID: member.guild.id });
        if (!data || !data.settings.welcomeChannelID) return;

        const welcomeChannel = member.guild.channels.cache.get(data.settings.welcomeChannelID);
        if (!welcomeChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('✨ عضو جديد انضم إلينا!')
            .setDescription(`مرحباً بك ${member} في السيرفر!`)
            .setColor('#00ffaa')
            .setTimestamp();

        await welcomeChannel.send({ embeds: [embed] }).catch(() => {});
    }
};
