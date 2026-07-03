const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
    guildID: { type: String, required: true, unique: true },
    moderation: {
        warns: [{
            userID: String,
            reason: String,
            moderatorID: String,
            timestamp: { type: Date, default: Date.now }
        }]
    },
    economy: [{
        userID: String,
        coins: { type: Number, default: 0 },
        bank: { type: Number, default: 0 },
        dailyCooldown: { type: Date }
    }],
    levels: [{
        userID: String,
        xp: { type: Number, default: 0 },
        level: { type: Number, default: 0 },
        lastMessageTimestamp: { type: Date }
    }],
    settings: {
        logChannelID: { type: String, default: null },
        welcomeChannelID: { type: String, default: null },
        leaveChannelID: { type: String, default: null }
    }
});

module.exports = mongoose.model('GuildData', guildSchema);
