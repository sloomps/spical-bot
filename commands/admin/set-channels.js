const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const GuildData = require('../../models/guildSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setchannel')
        .setDescription('إعداد غرف الأنظمة (اللوج، الترحيب)')
        .addStringOption(option => 
            option.setName('type')
                .setDescription('نوع النظام المراد ضبط روم له')
                .setRequired(true)
                .addChoices(
                    { name: 'سجلات السيرفر (Logs)', value: 'log' },
                    { name: 'الترحيب (Welcome)', value: 'welcome' }
                ))
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('اختر الروم المخصص')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const type = interaction.options.getString('type');
        const channel = interaction.options.getChannel('channel');

        let data = await GuildData.findOne({ guildID: interaction.guild.id });
        if (!data) data = new GuildData({ guildID: interaction.guild.id });

        if (type === 'log') {
            data.settings.logChannelID = channel.id;
        } else if (type === 'welcome') {
            data.settings.welcomeChannelID = channel.id;
        }

        await data.save();
        await interaction.reply({ content: `✅ تم ضبط روم الـ ${type === 'log' ? 'سجلات' : 'ترحيب'} بنجاح على: ${channel}`, ephemeral: true });
    }
};
