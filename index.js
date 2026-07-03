const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح!'))
    .catch((err) => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

// تشغيل الـ Handlers
['commands', 'events'].forEach(handler => {
    require(`./handlers/${handler}`)(client);
});

// منع انهيار البوت عند حدوث خطأ غير متوقع
process.on('unhandledRejection', error => {
    console.error('[خطأ غير معالج]:', error);
});

client.login(process.env.TOKEN);
