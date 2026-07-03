const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // 1. نظام مكافحة روابط السبام والاحتيال (Anti-Scam Links)
        const scamRegex = /(discord\.gg\/|gift|nitro|steam|crypto|free-nitro)/i;
        if (scamRegex.test(message.content)) {
            // استثناء الإداريين من الحظر تلقائياً
            if (message.member.permissions.has('ManageMessages')) return;

            await message.delete().catch(() => {});
            
            // حظر مؤقت أو تحذير تلقائي للعضو
            await message.member.timeout(600000, 'إرسال روابط مشبوهة أو إعلانات').catch(() => {});

            const warnEmbed = new EmbedBuilder()
                .setTitle('🛡️ نظام الحماية التلقائي')
                .setDescription(`تم كتم العضو ${message.author} لمدة 10 دقائق بسبب إرسال روابط غير مسموح بها.`)
                .setColor('#ff0000');

            return message.channel.send({ embeds: [warnEmbed] });
        }
    }
};
