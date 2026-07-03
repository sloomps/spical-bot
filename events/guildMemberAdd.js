const { EmbedBuilder } = require('discord.js');
const GuildData = require('../../models/guildSchema');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        const data = await GuildData.findOne({ guildID: member.guild.id });
        if (!data || !data.settings.welcomeChannelID) return;

        const welcomeChannel = member.guild.channels.cache.get(data.settings.welcomeChannelID);
        if (!welcomeChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('✨ عضو جديد انضم إلينا!')
            .setDescription(`أهلاً بك ${member} في سيرفر **${member.guild.name}**!\nنتمنى لك وقتاً ممتعاً معنا.`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setColor('#00ffaa')
            .addFields(
                { name: 'حسابك أُنشئ في:', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: 'ترتيبك في السيرفر:', value: `${member.guild.memberCount}`, inline: true }
            )
            .setTimestamp();

        await welcomeChannel.send({ content: `مرحباً بك ${member}`, embeds: [embed] }).catch(() => {});
    }
};
