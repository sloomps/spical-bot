const GuildData = require('../models/guildSchema');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        // 1. نظام حماية الروابط
        const scamRegex = /(discord\.gg\/|gift|nitro|steam|crypto)/i;
        if (scamRegex.test(message.content) && !message.member.permissions.has('ManageMessages')) {
            await message.delete().catch(() => {});
            await message.member.timeout(600000, 'إرسال روابط مشبوهة').catch(() => {});
            return message.channel.send(`⚠️ تم كتم ${message.author} لـ 10 دقائق بسبب الروابط.`);
        }

        // 2. نظام المستويات والـ XP
        let data = await GuildData.findOne({ guildID: message.guild.id });
        if (!data) data = new GuildData({ guildID: message.guild.id });

        let userLevel = data.levels.find(l => l.userID === message.author.id);
        if (!userLevel) {
            data.levels.push({ userID: message.author.id, xp: 0, level: 0, lastMessageTimestamp: new Date(0) });
            userLevel = data.levels.find(l => l.userID === message.author.id);
        }

        const now = new Date();
        if (now - userLevel.lastMessageTimestamp < 60000) return;

        userLevel.xp += Math.floor(Math.random() * 11) + 15;
        userLevel.lastMessageTimestamp = now;

        const xpNeeded = (userLevel.level + 1) * 100;
        if (userLevel.xp >= xpNeeded) {
            userLevel.level += 1;
            userLevel.xp = 0;
            message.channel.send(`🎉 كفو ${message.author}! وصلت للمستوى **${userLevel.level}**!`);
        }
        await data.save();
    }
};
