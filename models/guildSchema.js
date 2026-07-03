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
    }]
});

module.exports = mongoose.model('GuildData', guildSchema);
