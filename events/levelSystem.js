const GuildData = require('../models/guildSchema');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        let data = await GuildData.findOne({ guildID: message.guild.id });
        if (!data) {
            data = new GuildData({ guildID: message.guild.id });
        }

        // البحث عن بيانات العضو في نظام المستويات
        let userLevelData = data.levels.find(l => l.userID === message.author.id);
        if (!userLevelData) {
            data.levels.push({ userID: message.author.id, xp: 0, level: 0, lastMessageTimestamp: new Date(0) });
            userLevelData = data.levels.find(l => l.userID === message.author.id);
        }

        const now = new Date();
        // وقت انتظار دقيقة واحدة بين الرسائل للحصول على الـ XP
        if (now - userLevelData.lastMessageTimestamp < 60000) return;

        // إضافة XP عشوائي بين 15 و 25
        const xpGained = Math.floor(Math.random() * 11) + 15;
        userLevelData.xp += xpGained;
        userLevelData.lastMessageTimestamp = now;

        // معادلة حساب الـ XP المطلوب للمستوى التالي: Level 1 يطلب 100 XP، وكل مستوى يزيد
        const xpNeeded = (userLevelData.level + 1) * 100;

        if (userLevelData.xp >= xpNeeded) {
            userLevelData.level += 1;
            userLevelData.xp = 0; // تصفير الـ XP للمستوى الجديد

            // إرسال رسالة التهنئة في نفس الروم
            const levelUpEmbed = new EmbedBuilder()
                .setTitle('🎉 مستوى جديد!')
                .setDescription(`كفو ${message.author}! لقد ارتفع مستواك وأصبحت الآن في **المستوى ${userLevelData.level}**! 🚀`)
                .setColor('#ffcc00')
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

            await message.channel.send({ embeds: [levelUpEmbed] }).catch(() => {});
        }

        await data.save();
    }
};
