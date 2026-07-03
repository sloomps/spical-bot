const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
    guildID: { type: String, required: true, unique: true },
    // تأكد أن الـ settings معرفة كـ Object يحتوي على القنوات والروتب
    settings: {
        suggestionChannelID: { type: String, default: null },
        welcomeChannelID: { type: String, default: null },
        logChannelID: { type: String, default: null },
        levelChannelID: { type: String, default: null },
        botAdminRoleID: { type: String, default: null },
        botModRoleID: { type: String, default: null },
        botSupportRoleID: { type: String, default: null }
    },
    moderation: {
        warns: { type: Array, default: [] }
    },
    levels: { type: Array, default: [] }
});

module.exports = mongoose.model('GuildData', guildSchema);
