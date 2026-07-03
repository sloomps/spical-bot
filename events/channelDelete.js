const { AuditLogEvent, EmbedBuilder } = require('discord.js');

// مخزن مؤقت لمراقبة عمليات الحذف لكل إداري
const deletionLog = new Map();

module.exports = {
    name: 'channelDelete',
    async execute(channel) {
        const guild = channel.guild;
        if (!guild) return;

        // جلب سجلات الحسابات (Audit Logs) لمعرفة من حذف الروم
        const fetchedLogs = await guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.ChannelDelete,
        });
        
        const deletionLogEntry = fetchedLogs.entries.first();
        if (!deletionLogEntry) return;

        const { executor } = deletionLogEntry;
        if (executor.id === guild.ownerId) return; // استثناء صاحب السيرفر الأساسي

        // إعداد العداد للمشرف
        const now = Date.now();
        if (!deletionLog.has(executor.id)) {
            deletionLog.set(executor.id, []);
        }

        const userLog = deletionLog.get(executor.id);
        // تصفية العمليات القديمة (أكثر من دقيقة)
        const recentDeletions = userLog.filter(time => now - time < 60000);
        recentDeletions.push(now);
        deletionLog.set(executor.id, recentDeletions);

        // إذا حذف الإداري أكثر من 3 رومات في دقيقة واحدة = تخريب!
        if (recentDeletions.length > 3) {
            const member = await guild.members.fetch(executor.id).catch(() => null);
            if (member) {
                // تجريد الإداري من كافة رتبه لحماية السيرفر فوراً
                await member.roles.set([]).catch(() => {});
                
                // إرسال تنبيه في روم السجلات أو لصاحب السيرفر
                console.log(`⚠️ تم رصد محاولة تخريب من ${executor.tag}! تم سحب رتبه تلقائياً.`);
                
                // تصفير العداد بعد اتخاذ الإجراء
                deletionLog.delete(executor.id);
            }
        }
    }
};
