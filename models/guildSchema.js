const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
    // معرف السيرفر الأساسي (فريد لكل سيرفر)
    guildID: { type: String, required: true, unique: true },

    // 1. نظام العقوبات والإشراف (Moderation)
    moderation: {
        warns: [{
            userID: String,
            reason: String,
            moderatorID: String,
            timestamp: { type: Date, default: Date.now }
        }]
    },

    // 2. نظام الاقتصاد والألعاب (Economy)
    economy: [{
        userID: String,
        coins: { type: Number, default: 0 },
        bank: { type: Number, default: 0 },
        dailyCooldown: { type: Date }
    }],

    // 3. نظام المستويات والخبرة (Leveling & XP)
    levels: [{
        userID: String,
        xp: { type: Number, default: 0 },
        level: { type: Number, default: 0 },
        lastMessageTimestamp: { type: Date }
    }],

    // 4. إعدادات القنوات برمجياً (Settings)
    settings: {
        logChannelID: { type: String, default: null },
        welcomeChannelID: { type: String, default: null },
        leaveChannelID: { type: String, default: null }
    }
});

module.exports = mongoose.model('GuildData', guildSchema);
