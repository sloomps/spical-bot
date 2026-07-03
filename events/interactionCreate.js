const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextInputBuilder, TextInputStyle, ModalBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // تشغيل أوامر السلاش
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'حدث خطأ أثناء تنفيذ هذا الأمر!', ephemeral: true });
            }
        }

        // تشغيل أزرار التكت
        if (interaction.isButton()) {
            if (interaction.customId === 'open_ticket') {
                const modal = new ModalBuilder().setCustomId('ticket_modal').setTitle('🎫 فتح تذكرة دعم جديدة');
                const ticketReason = new TextInputBuilder().setCustomId('ticket_reason').setLabel("ما هو سبب فتح التذكرة؟").setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(ticketReason));
                await interaction.showModal(modal);
            }
            if (interaction.customId === 'close_ticket') {
                await interaction.reply('🔒 سيتم إغلاق التذكرة خلال 5 ثوانٍ...');
                setTimeout(async () => { await interaction.channel.delete().catch(() => {}); }, 5000);
            }
        }

        // استقبال بيانات نافذة التكت
        if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
            const reason = interaction.fields.getTextInputValue('ticket_reason');
            const channel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });
            const embed = new EmbedBuilder().setTitle('🎫 تذكرة جديدة').setDescription(`السبب: ${reason}`).setColor('#00ffcc');
            const btn = new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger);
            await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
            await interaction.reply({ content: `تم فتح التذكرة: ${channel}`, ephemeral: true });
        }
    }
};
