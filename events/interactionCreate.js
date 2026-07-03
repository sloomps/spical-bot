const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextInputBuilder, TextInputStyle, ModalBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // 1. التعامل مع الضغط على الأزرار
        if (interaction.isButton()) {
            if (interaction.customId === 'open_ticket') {
                // إنشاء النافذة المنبثقة (Modal)
                const modal = new ModalBuilder()
                    .setCustomId('ticket_modal')
                    .setTitle('🎫 فتح تذكرة دعم جديدة');

                const ticketReason = new TextInputBuilder()
                    .setCustomId('ticket_reason')
                    .setLabel("ما هو سبب فتح التذكرة؟")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('اكتب تفاصيل مشكلتك هنا...')
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(ticketReason);
                modal.addComponents(row);

                await interaction.showModal(modal);
            }

            // زر إغلاق التكت من داخل الغرفة
            if (interaction.customId === 'close_ticket') {
                await interaction.reply('🔒 سيتم إغلاق التذكرة خلال 5 ثوانٍ...');
                setTimeout(async () => {
                    await interaction.channel.delete().catch(() => {});
                }, 5000);
            }
        }

        // 2. التعامل مع إرسال البيانات من النافذة المنبثقة (Modal Submit)
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'ticket_modal') {
                const reason = interaction.fields.getTextInputValue('ticket_reason');
                
                // إنشاء غرفة التكت وتحديد الصلاحيات (أحدث نظام)
                const channel = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: interaction.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                        },
                    ],
                });

                const ticketEmbed = new EmbedBuilder()
                    .setTitle('🎫 تذكرة جديدة')
                    .setDescription(`أهلاً بك ${interaction.user}، تم فتح التذكرة بنجاح.\n\n**السبب المقدم:**\n${reason}`)
                    .setColor('#00ffcc')
                    .setTimestamp();

                const closeButton = new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('إغلاق التذكرة')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                const row = new ActionRowBuilder().addComponents(closeButton);

                await channel.send({ embeds: [ticketEmbed], components: [row] });
                await interaction.reply({ content: `تم فتح تذكرتك بنجاح في الروم التالي: ${channel}`, ephemeral: true });
            }
        }
    }
};
