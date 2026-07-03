const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const GuildData = require('../../models/guildSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('استلام المكافأة اليومية من العملات'),
    
    async execute(interaction) {
        const userID = interaction.user.id;
        let data = await GuildData.findOne({ guildID: interaction.guild.id });
        
        if (!data) {
            data = new GuildData({ guildID: interaction.guild.id });
        }

        // البحث عن حساب العضو في نظام الاقتصاد الخاص بالسيرفر
        let userEco = data.economy.find(e => e.userID === userID);
        if (!userEco) {
            data.economy.push({ userID: userID, coins: 0, bank: 0 });
            userEco = data.economy.find(e => e.userID === userID);
        }

        const dailyAmount = 500; // قيمة الجائزة اليومية
        const now = new Date();

        // التحقق من مرور 24 ساعة
        if (userEco.dailyCooldown && (now - userEco.dailyCooldown < 24 * 60 * 60 * 1000)) {
            const timeLeft = new Date(userEco.dailyCooldown.getTime() + 24 * 60 * 60 * 1000) - now;
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            
            return interaction.reply({ 
                content: `❌ لقد استلمت مكافأتك اليومية بالفعل! يرجى الانتظار \`${hours} ساعة و ${minutes} دقيقة\`.`, 
                ephemeral: true 
            });
        }

        // تحديث العملات ووقت الانتظار
        userEco.coins += dailyAmount;
        userEco.dailyCooldown = now;
        await data.save();

        const embed = new EmbedBuilder()
            .setTitle('💰 مكافأة يومية')
            .setDescription(`تهانينا ${interaction.user}! لقد استلمت **${dailyAmount}** عملة بنجاح.\nرصيدك الحالي: **${userEco.coins}** عملة.`)
            .setColor('#00ff00')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
