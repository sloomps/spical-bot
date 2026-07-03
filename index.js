const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

client.commands = new Collection();

// الاتصال بقاعدة بيانات MongoDB (أساسي للأنظمة الضخمة)
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ تم الاتصال بقاعدة البيانات بنجاح!'))
    .catch((err) => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

// تشغيل معالجات الأوامر والأحداث (Handlers)
['commands', 'events'].forEach(handler => {
    require(`./handlers/${handler}`)(client);
});

// التعامل مع الأخطاء لضمان عدم توقف البوت على Railway
process.on('unhandledRejection', error => {
    console.error('[خطأ غير معالج]:', error);
});

client.login(process.env.TOKEN);
