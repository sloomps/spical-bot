const {
    Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionsBitField,
    ChannelType, SlashCommandBuilder, REST, Routes, Collection, Events, ActivityType
} = require('discord.js');
const Database = require('better-sqlite3');
const moment = require('moment');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember, Partials.Reaction]
});

const TOKEN = process.env.TOKEN;
if (!TOKEN) { console.error('❌ TOKEN missing.'); process.exit(1); }

// ================== قاعدة البيانات ==================
const db = new Database('./bot.db');
db.exec(`
    CREATE TABLE IF NOT EXISTS economy (user_id TEXT, guild_id TEXT, balance INTEGER DEFAULT 0, bank INTEGER DEFAULT 0, daily TEXT, work TEXT, PRIMARY KEY (user_id, guild_id));
    CREATE TABLE IF NOT EXISTS levels (user_id TEXT, guild_id TEXT, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1, PRIMARY KEY (user_id, guild_id));
    CREATE TABLE IF NOT EXISTS warnings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, guild_id TEXT, reason TEXT, date TEXT, moderator TEXT);
    CREATE TABLE IF NOT EXISTS autoroles (guild_id TEXT, role_id TEXT);
    CREATE TABLE IF NOT EXISTS welcome (guild_id TEXT PRIMARY KEY, channel_id TEXT, message TEXT, image_url TEXT, enabled INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS goodbye (guild_id TEXT PRIMARY KEY, channel_id TEXT, message TEXT, image_url TEXT, enabled INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, user_id TEXT, topic TEXT, status TEXT DEFAULT 'open', created_at TEXT, category TEXT);
    CREATE TABLE IF NOT EXISTS ticket_settings (guild_id TEXT PRIMARY KEY, category_id TEXT, support_role_id TEXT, log_channel_id TEXT, enabled INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS logs (guild_id TEXT, channel_id TEXT, type TEXT, enabled INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS security (guild_id TEXT PRIMARY KEY, spam_threshold INTEGER DEFAULT 5, mute_role_id TEXT, verify_role_id TEXT, verify_channel_id TEXT);
    CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, channel_id TEXT, message TEXT, remind_time TEXT, guild_id TEXT);
    CREATE TABLE IF NOT EXISTS clans (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, name TEXT, owner TEXT, members TEXT, level INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS farms (user_id TEXT, guild_id TEXT, crop TEXT, ready_at TEXT, status TEXT DEFAULT 'growing', PRIMARY KEY (user_id, guild_id));
    CREATE TABLE IF NOT EXISTS auctions (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, item TEXT, seller TEXT, current_bid INTEGER, bidder TEXT, end_time TEXT, status TEXT DEFAULT 'active');
    CREATE TABLE IF NOT EXISTS titles (user_id TEXT, guild_id TEXT, title TEXT, PRIMARY KEY (user_id, guild_id));
    CREATE TABLE IF NOT EXISTS auto_responders (guild_id TEXT, trigger TEXT, response TEXT, PRIMARY KEY (guild_id, trigger));
    CREATE TABLE IF NOT EXISTS custom_commands (guild_id TEXT, name TEXT, response TEXT, PRIMARY KEY (guild_id, name));
    CREATE TABLE IF NOT EXISTS polls (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, message_id TEXT, question TEXT, options TEXT, ends_at TEXT);
    CREATE TABLE IF NOT EXISTS giveaways (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, channel_id TEXT, message_id TEXT, prize TEXT, end_time TEXT, winners INTEGER, entries TEXT, status TEXT DEFAULT 'active');
    CREATE TABLE IF NOT EXISTS achievements (user_id TEXT, guild_id TEXT, name TEXT, unlocked_at TEXT, PRIMARY KEY (user_id, guild_id, name));
    CREATE TABLE IF NOT EXISTS loans (user_id TEXT, guild_id TEXT, amount INTEGER, interest INTEGER, due_date TEXT, status TEXT DEFAULT 'active', PRIMARY KEY (user_id, guild_id));
    CREATE TABLE IF NOT EXISTS investments (user_id TEXT, guild_id TEXT, amount INTEGER, profit INTEGER, end_date TEXT, status TEXT DEFAULT 'active', PRIMARY KEY (user_id, guild_id));
    CREATE TABLE IF NOT EXISTS level_rewards (guild_id TEXT, level INTEGER, role_id TEXT, reward_amount INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS reaction_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, message_id TEXT, role_id TEXT, emoji TEXT);
    CREATE TABLE IF NOT EXISTS temp_roles (user_id TEXT, guild_id TEXT, role_id TEXT, expiry_time TEXT);
    CREATE TABLE IF NOT EXISTS backups (id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT, data TEXT, created_at TEXT, created_by TEXT);
`);

// ================== دوال مساعدة ==================
function getBalance(userId, guildId) {
    const row = db.prepare("SELECT balance FROM economy WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    return row ? row.balance : 0;
}
function updateBalance(userId, guildId, amount) {
    const existing = db.prepare("SELECT balance FROM economy WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    if (existing) db.prepare("UPDATE economy SET balance = balance + ? WHERE user_id = ? AND guild_id = ?").run(amount, userId, guildId);
    else db.prepare("INSERT INTO economy (user_id, guild_id, balance) VALUES (?, ?, ?)").run(userId, guildId, amount);
}
function getBank(userId, guildId) {
    const row = db.prepare("SELECT bank FROM economy WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    return row ? row.bank : 0;
}
function updateBank(userId, guildId, amount) {
    const existing = db.prepare("SELECT bank FROM economy WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    if (existing) db.prepare("UPDATE economy SET bank = bank + ? WHERE user_id = ? AND guild_id = ?").run(amount, userId, guildId);
    else db.prepare("INSERT INTO economy (user_id, guild_id, bank) VALUES (?, ?, ?)").run(userId, guildId, amount);
}
function getLevel(userId, guildId) {
    const row = db.prepare("SELECT xp, level FROM levels WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    if (!row) { db.prepare("INSERT INTO levels (user_id, guild_id, xp, level) VALUES (?, ?, 0, 1)").run(userId, guildId); return { xp: 0, level: 1 }; }
    return { xp: row.xp, level: row.level };
}
function addXp(userId, guildId, amount) {
    const existing = db.prepare("SELECT xp, level FROM levels WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    if (!existing) { db.prepare("INSERT INTO levels (user_id, guild_id, xp, level) VALUES (?, ?, ?, 1)").run(userId, guildId, amount); return; }
    let xp = existing.xp + amount, level = existing.level, needed = 5 * level * level + 50 * level + 100;
    while (xp >= needed) { xp -= needed; level++; needed = 5 * level * level + 50 * level + 100; }
    db.prepare("UPDATE levels SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ?").run(xp, level, userId, guildId);
}
function getWarnings(userId, guildId) {
    return db.prepare("SELECT reason, date, moderator FROM warnings WHERE user_id = ? AND guild_id = ? ORDER BY date DESC").all(userId, guildId);
}
function addWarning(userId, guildId, reason, moderator) {
    db.prepare("INSERT INTO warnings (user_id, guild_id, reason, date, moderator) VALUES (?, ?, ?, datetime('now'), ?)").run(userId, guildId, reason, moderator);
    const count = db.prepare("SELECT COUNT(*) FROM warnings WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
    return count['COUNT(*)'];
}
function clearWarnings(userId, guildId) {
    db.prepare("DELETE FROM warnings WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
}
function logEvent(guildId, type, description, color = 0x2F3136, userId = null) {
    const row = db.prepare("SELECT channel_id FROM logs WHERE guild_id = ? AND (type = ? OR type = 'all') AND enabled = 1").get(guildId, type);
    if (!row) return;
    const channel = client.channels.cache.get(row.channel_id);
    if (channel) {
        const embed = new EmbedBuilder().setTitle(`📋 ${type}`).setDescription(description).setColor(color).setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    }
}

// ================== تسجيل الأوامر ==================
const commands = [];
const ownerId = '464646868953956353';

// إضافة الأوامر الأساسية (تم اختصارها للتوضيح، يمكنك إضافة المزيد)
commands.push(new SlashCommandBuilder().setName('help').setDescription('Show all commands').addStringOption(o => o.setName('cmd').setDescription('Command name')));
commands.push(new SlashCommandBuilder().setName('ping').setDescription('Check bot ping'));
commands.push(new SlashCommandBuilder().setName('economy').setDescription('Economy commands').addSubcommand(s => s.setName('balance').setDescription('Check balance').addUserOption(o => o.setName('user'))).addSubcommand(s => s.setName('daily')).addSubcommand(s => s.setName('work')).addSubcommand(s => s.setName('rob').addUserOption(o => o.setName('user').setRequired(true))).addSubcommand(s => s.setName('slot').addIntegerOption(o => o.setName('bet'))).addSubcommand(s => s.setName('shop')).addSubcommand(s => s.setName('buy').addStringOption(o => o.setName('item').setRequired(true))).addSubcommand(s => s.setName('bank').addStringOption(o => o.setName('action').setRequired(true)).addIntegerOption(o => o.setName('amount'))));
commands.push(new SlashCommandBuilder().setName('level').setDescription('Level commands').addSubcommand(s => s.setName('rank').addUserOption(o => o.setName('user'))).addSubcommand(s => s.setName('leaderboard')));
commands.push(new SlashCommandBuilder().setName('moderation').setDescription('Moderation').addSubcommand(s => s.setName('kick').addUserOption(o => o.setName('user').setRequired(true)).addStringOption(o => o.setName('reason'))).addSubcommand(s => s.setName('ban').addUserOption(o => o.setName('user').setRequired(true)).addStringOption(o => o.setName('reason'))).addSubcommand(s => s.setName('unban').addStringOption(o => o.setName('user').setRequired(true))).addSubcommand(s => s.setName('timeout').addUserOption(o => o.setName('user').setRequired(true)).addIntegerOption(o => o.setName('duration').setRequired(true)).addStringOption(o => o.setName('reason'))).addSubcommand(s => s.setName('warn').addUserOption(o => o.setName('user').setRequired(true)).addStringOption(o => o.setName('reason'))).addSubcommand(s => s.setName('warnings').addUserOption(o => o.setName('user').setRequired(true))).addSubcommand(s => s.setName('clearwarnings').addUserOption(o => o.setName('user').setRequired(true))).addSubcommand(s => s.setName('purge').addIntegerOption(o => o.setName('count').setRequired(true))));
commands.push(new SlashCommandBuilder().setName('ticket').setDescription('Ticket system').addSubcommand(s => s.setName('setup').addChannelOption(o => o.setName('category').setRequired(true)).addRoleOption(o => o.setName('support_role').setRequired(true)).addChannelOption(o => o.setName('log_channel').setRequired(true))).addSubcommand(s => s.setName('panel')).addSubcommand(s => s.setName('create').addStringOption(o => o.setName('topic').setRequired(true)).addStringOption(o => o.setName('category').setRequired(true))).addSubcommand(s => s.setName('close')));
commands.push(new SlashCommandBuilder().setName('welcome').setDescription('Welcome system').addSubcommand(s => s.setName('set').addChannelOption(o => o.setName('channel').setRequired(true)).addStringOption(o => o.setName('message')).addAttachmentOption(o => o.setName('image'))).addSubcommand(s => s.setName('goodbye').addChannelOption(o => o.setName('channel').setRequired(true)).addStringOption(o => o.setName('message')).addAttachmentOption(o => o.setName('image'))).addSubcommand(s => s.setName('toggle').addBooleanOption(o => o.setName('enabled').setRequired(true))));
commands.push(new SlashCommandBuilder().setName('security').setDescription('Security').addSubcommand(s => s.setName('verification').addRoleOption(o => o.setName('role').setRequired(true)).addChannelOption(o => o.setName('channel').setRequired(true))).addSubcommand(s => s.setName('antispam').addIntegerOption(o => o.setName('limit').setRequired(true))).addSubcommand(s => s.setName('mute_role').addRoleOption(o => o.setName('role').setRequired(true))));
commands.push(new SlashCommandBuilder().setName('logs').setDescription('Logs').addSubcommand(s => s.setName('set').addChannelOption(o => o.setName('channel').setRequired(true)).addStringOption(o => o.setName('type').setRequired(true))));
commands.push(new SlashCommandBuilder().setName('roles').setDescription('Roles').addSubcommand(s => s.setName('autorole').addRoleOption(o => o.setName('role').setRequired(true))).addSubcommand(s => s.setName('reaction').addStringOption(o => o.setName('message_id').setRequired(true)).addRoleOption(o => o.setName('role').setRequired(true)).addStringOption(o => o.setName('emoji').setRequired(true))).addSubcommand(s => s.setName('list')).addSubcommand(s => s.setName('temprole').addUserOption(o => o.setName('user').setRequired(true)).addRoleOption(o => o.setName('role').setRequired(true)).addIntegerOption(o => o.setName('duration').setRequired(true))));
commands.push(new SlashCommandBuilder().setName('reminder').setDescription('Reminders').addSubcommand(s => s.setName('set').addIntegerOption(o => o.setName('duration').setRequired(true)).addStringOption(o => o.setName('message').setRequired(true))).addSubcommand(s => s.setName('list')).addSubcommand(s => s.setName('cancel').addIntegerOption(o => o.setName('id').setRequired(true))));
commands.push(new SlashCommandBuilder().setName('clan').setDescription('Clans').addSubcommand(s => s.setName('create').addStringOption(o => o.setName('name').setRequired(true))).addSubcommand(s => s.setName('info').addStringOption(o => o.setName('name').setRequired(true))).addSubcommand(s => s.setName('invite').addUserOption(o => o.setName('user').setRequired(true))).addSubcommand(s => s.setName('join').addStringOption(o => o.setName('name').setRequired(true))).addSubcommand(s => s.setName('leave')).addSubcommand(s => s.setName('leaderboard')));
commands.push(new SlashCommandBuilder().setName('farm').setDescription('Farm').addSubcommand(s => s.setName('plant').addStringOption(o => o.setName('crop').setRequired(true))).addSubcommand(s => s.setName('harvest')));
commands.push(new SlashCommandBuilder().setName('auction').setDescription('Auction').addSubcommand(s => s.setName('create').addStringOption(o => o.setName('item').setRequired(true)).addIntegerOption(o => o.setName('starting_bid').setRequired(true))).addSubcommand(s => s.setName('bid').addIntegerOption(o => o.setName('id').setRequired(true)).addIntegerOption(o => o.setName('amount').setRequired(true))).addSubcommand(s => s.setName('list')).addSubcommand(s => s.setName('end').addIntegerOption(o => o.setName('id').setRequired(true))));
commands.push(new SlashCommandBuilder().setName('game').setDescription('Games').addSubcommand(s => s.setName('dice').addIntegerOption(o => o.setName('bet'))).addSubcommand(s => s.setName('coinflip').addStringOption(o => o.setName('choice').setRequired(true).addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })).addIntegerOption(o => o.setName('bet'))).addSubcommand(s => s.setName('rps').addStringOption(o => o.setName('choice').setRequired(true).addChoices({ name: 'Rock', value: 'rock' }, { name: 'Paper', value: 'paper' }, { name: 'Scissors', value: 'scissors' })).addIntegerOption(o => o.setName('bet'))));
commands.push(new SlashCommandBuilder().setName('custom').setDescription('Custom commands').addSubcommand(s => s.setName('add').addStringOption(o => o.setName('name').setRequired(true)).addStringOption(o => o.setName('response').setRequired(true))).addSubcommand(s => s.setName('remove').addStringOption(o => o.setName('name').setRequired(true))).addSubcommand(s => s.setName('list')));
commands.push(new SlashCommandBuilder().setName('poll').setDescription('Poll').addStringOption(o => o.setName('question').setRequired(true)).addStringOption(o => o.setName('options').setRequired(true)));
commands.push(new SlashCommandBuilder().setName('giveaway').setDescription('Giveaway').addSubcommand(s => s.setName('create').addIntegerOption(o => o.setName('duration').setRequired(true)).addIntegerOption(o => o.setName('winners').setRequired(true)).addStringOption(o => o.setName('prize').setRequired(true))).addSubcommand(s => s.setName('reroll').addStringOption(o => o.setName('message_id').setRequired(true))).addSubcommand(s => s.setName('end').addStringOption(o => o.setName('message_id').setRequired(true))));
commands.push(new SlashCommandBuilder().setName('title').setDescription('Title').addSubcommand(s => s.setName('set').addStringOption(o => o.setName('title').setRequired(true))).addSubcommand(s => s.setName('remove')).addSubcommand(s => s.setName('shop')).addSubcommand(s => s.setName('buy').addStringOption(o => o.setName('title').setRequired(true))));
commands.push(new SlashCommandBuilder().setName('achievement').setDescription('Achievement').addSubcommand(s => s.setName('list')).addSubcommand(s => s.setName('create').addStringOption(o => o.setName('name').setRequired(true)).addStringOption(o => o.setName('description').setRequired(true)).addIntegerOption(o => o.setName('reward'))));
commands.push(new SlashCommandBuilder().setName('owner').setDescription('Owner').addSubcommand(s => s.setName('reload')).addSubcommand(s => s.setName('stats')).addSubcommand(s => s.setName('eval').addStringOption(o => o.setName('code').setRequired(true))));
commands.push(new SlashCommandBuilder().setName('vote').setDescription('Vote for bot'));
commands.push(new SlashCommandBuilder().setName('auto').setDescription('Auto responses').addSubcommand(s => s.setName('add').addStringOption(o => o.setName('trigger').setRequired(true)).addStringOption(o => o.setName('response').setRequired(true))).addSubcommand(s => s.setName('remove').addStringOption(o => o.setName('trigger').setRequired(true))).addSubcommand(s => s.setName('list')));
commands.push(new SlashCommandBuilder().setName('mood').setDescription('Set mood').addStringOption(o => o.setName('status').setRequired(true)));
commands.push(new SlashCommandBuilder().setName('verify').setDescription('Verify yourself'));
commands.push(new SlashCommandBuilder().setName('report').setDescription('Report a user').addUserOption(o => o.setName('user').setRequired(true)).addStringOption(o => o.setName('reason').setRequired(true)));

const rest = new REST({ version: '10' }).setToken(TOKEN);
async function registerCommands() {
    try {
        console.log('🔄 Registering commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`✅ Registered ${commands.length} commands.`);
    } catch (error) { console.error('❌ Failed to register commands:', error); }
}

// ================== أحداث البوت ==================
const messageCache = new Collection();
const joinCache = new Collection();
const musicQueues = new Map();

client.once('ready', async () => {
    console.log(`✅ Bot ${client.user.tag} is ready!`);
    await registerCommands();
    client.user.setPresence({ activities: [{ name: '/help', type: ActivityType.Watching }], status: 'online' });
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, user, guild, member, channel } = interaction;
    await interaction.deferReply({ ephemeral: false }).catch(() => {});

    // ===== HELP =====
    if (commandName === 'help') {
        const cmd = options.getString('cmd');
        if (cmd) {
            const helpMap = {
                help: 'Show all commands',
                ping: 'Check bot ping',
                economy: 'Balance, daily, work, rob, slot, shop, buy, bank',
                level: 'Rank and leaderboard',
                moderation: 'Kick, ban, timeout, warn, purge',
                ticket: 'Setup, panel, create, close',
                welcome: 'Set welcome/goodbye with images',
                security: 'Verification, antispam, mute role',
                logs: 'Set log channel',
                roles: 'Autorole, reaction roles, temprole',
                reminder: 'Set, list, cancel reminders',
                clan: 'Create, info, invite, join, leave, leaderboard',
                farm: 'Plant and harvest crops',
                auction: 'Create, bid, list, end auctions',
                game: 'Dice, coinflip, rps',
                custom: 'Add, remove, list custom commands',
                poll: 'Create a poll',
                giveaway: 'Create, reroll, end giveaways',
                title: 'Set, remove, shop, buy titles',
                achievement: 'List, create achievements',
                owner: 'Reload, stats, eval (owner only)',
                vote: 'Vote for the bot',
                auto: 'Add, remove, list auto responses',
                mood: 'Set mood nickname',
                verify: 'Verify yourself',
                report: 'Report a user'
            };
            const desc = helpMap[cmd] || 'Command not found.';
            return interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`📖 /${cmd}`).setDescription(desc).setColor(0x00FF00)] });
        }
        const embed = new EmbedBuilder().setTitle('📚 Commands').setDescription('Use `/help <command>` for details.').setColor(0x00BFFF);
        const categories = {
            'ℹ️': ['help', 'ping', 'vote'],
            '💰': ['economy', 'level'],
            '🛠️': ['moderation', 'ticket', 'welcome', 'security', 'logs', 'roles'],
            '⏰': ['reminder'],
            '🏴': ['clan', 'farm', 'auction'],
            '🎮': ['game'],
            '📋': ['custom', 'auto', 'poll', 'giveaway', 'title', 'achievement'],
            '🔐': ['owner'],
            '📌': ['mood', 'verify', 'report']
        };
        let desc = '';
        for (const [cat, cmds] of Object.entries(categories)) {
            desc += `**${cat}** ${cmds.map(c => `\`/${c}\``).join(' ')}\n`;
        }
        embed.setDescription(desc);
        return interaction.editReply({ embeds: [embed] });
    }

    // ===== PING =====
    if (commandName === 'ping') {
        return interaction.editReply({ content: `🏓 Pong! ${client.ws.ping}ms` });
    }

    // ===== ECONOMY =====
    if (commandName === 'economy') {
        const sub = options.getSubcommand();
        if (sub === 'balance') {
            const target = options.getUser('user') || user;
            const bal = getBalance(target.id, guild.id);
            const bank = getBank(target.id, guild.id);
            return interaction.editReply({ content: `💰 ${target.tag} balance: **${bal}** | Bank: **${bank}**` });
        }
        if (sub === 'daily') {
            const now = new Date().toISOString().slice(0, 10);
            const row = db.prepare("SELECT daily FROM economy WHERE user_id = ? AND guild_id = ?").get(user.id, guild.id);
            if (row && row.daily === now) return interaction.editReply({ content: '❌ Already claimed today.' });
            const amount = Math.floor(Math.random() * 150) + 50;
            updateBalance(user.id, guild.id, amount);
            db.prepare("UPDATE economy SET daily = ? WHERE user_id = ? AND guild_id = ?").run(now, user.id, guild.id);
            return interaction.editReply({ content: `✅ Claimed **${amount}** daily coins!` });
        }
        if (sub === 'work') {
            const now = Date.now();
            const row = db.prepare("SELECT work FROM economy WHERE user_id = ? AND guild_id = ?").get(user.id, guild.id);
            if (row && row.work) {
                const last = parseInt(row.work);
                if (now - last < 3600000) {
                    const remain = Math.ceil((3600000 - (now - last)) / 1000);
                    return interaction.editReply({ content: `⏳ Wait ${remain} seconds.` });
                }
            }
            const amount = Math.floor(Math.random() * 50) + 10;
            updateBalance(user.id, guild.id, amount);
            db.prepare("UPDATE economy SET work = ? WHERE user_id = ? AND guild_id = ?").run(String(now), user.id, guild.id);
            return interaction.editReply({ content: `💼 Worked and earned **${amount}** coins!` });
        }
        if (sub === 'rob') {
            const target = options.getUser('user');
            if (!target || target.id === user.id) return interaction.editReply({ content: '❌ Choose another member.' });
            const targetBal = getBalance(target.id, guild.id);
            if (targetBal < 10) return interaction.editReply({ content: `❌ ${target.tag} doesn't have enough.` });
            const success = Math.random() < 0.35;
            if (success) {
                const amount = Math.floor(Math.random() * Math.min(50, targetBal)) + 1;
                updateBalance(user.id, guild.id, amount);
                updateBalance(target.id, guild.id, -amount);
                logEvent(guild.id, 'rob', `${user.tag} robbed ${target.tag} for ${amount}`, 0xFF0000, user.id);
                return interaction.editReply({ content: `✅ Robbed **${amount}** coins from ${target.tag}!` });
            } else {
                const penalty = Math.floor(Math.random() * 25) + 1;
                updateBalance(user.id, guild.id, -penalty);
                return interaction.editReply({ content: `❌ Robbery failed! Lost **${penalty}** coins.` });
            }
        }
        if (sub === 'slot') {
            const bet = options.getInteger('bet') || 10;
            const bal = getBalance(user.id, guild.id);
            if (bet <= 0 || bal < bet) return interaction.editReply({ content: '❌ Insufficient balance.' });
            const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣'];
            const res = [symbols[Math.floor(Math.random() * 6)], symbols[Math.floor(Math.random() * 6)], symbols[Math.floor(Math.random() * 6)]];
            const embed = new EmbedBuilder().setTitle('🎰 Slot').setDescription(`${res[0]} ${res[1]} ${res[2]}`).setColor(0x2F3136);
            if (res[0] === res[1] && res[1] === res[2]) {
                const win = bet * 10;
                updateBalance(user.id, guild.id, win);
                embed.addFields({ name: '🎉 JACKPOT!', value: `Won **${win}** coins!` });
            } else if (res[0] === res[1] || res[1] === res[2] || res[0] === res[2]) {
                const win = bet * 2;
                updateBalance(user.id, guild.id, win);
                embed.addFields({ name: '🎉 You won!', value: `Won **${win}** coins!` });
            } else {
                updateBalance(user.id, guild.id, -bet);
                embed.addFields({ name: '😔 You lost', value: `Lost **${bet}** coins.` });
            }
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'shop') {
            const embed = new EmbedBuilder().setTitle('🛒 Shop').setColor(0x00FF00).setDescription('Use `/economy buy gift/star/crown`');
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'buy') {
            const item = options.getString('item');
            const bal = getBalance(user.id, guild.id);
            if (item === 'gift') {
                if (bal < 100) return interaction.editReply({ content: '❌ Need 100 coins.' });
                updateBalance(user.id, guild.id, -100);
                const prizes = ['🎁', '🍫', '🧸', '🎮', '📱', '💻'];
                return interaction.editReply({ content: `✅ Got ${prizes[Math.floor(Math.random() * prizes.length)]}` });
            }
            if (item === 'star') {
                if (bal < 500) return interaction.editReply({ content: '❌ Need 500 coins.' });
                updateBalance(user.id, guild.id, -500);
                try { await member.setNickname(`⭐ ${member.displayName}`); return interaction.editReply({ content: '✅ Star added!' }); } catch (e) { return interaction.editReply({ content: '❌ Missing permissions.' }); }
            }
            if (item === 'crown') {
                if (bal < 1000) return interaction.editReply({ content: '❌ Need 1000 coins.' });
                updateBalance(user.id, guild.id, -1000);
                try { await member.setNickname(`👑 ${member.displayName}`); return interaction.editReply({ content: '✅ Crown added!' }); } catch (e) { return interaction.editReply({ content: '❌ Missing permissions.' }); }
            }
            return interaction.editReply({ content: '❌ Item not found. Available: gift, star, crown' });
        }
        if (sub === 'bank') {
            const action = options.getString('action');
            const amount = options.getInteger('amount') || 0;
            if (action === 'deposit') {
                if (amount <= 0) return interaction.editReply({ content: '❌ Enter positive amount.' });
                const bal = getBalance(user.id, guild.id);
                if (bal < amount) return interaction.editReply({ content: '❌ Insufficient balance.' });
                updateBalance(user.id, guild.id, -amount);
                updateBank(user.id, guild.id, amount);
                return interaction.editReply({ content: `💰 Deposited **${amount}** to bank.` });
            }
            if (action === 'withdraw') {
                if (amount <= 0) return interaction.editReply({ content: '❌ Enter positive amount.' });
                const bank = getBank(user.id, guild.id);
                if (bank < amount) return interaction.editReply({ content: '❌ Insufficient bank balance.' });
                updateBank(user.id, guild.id, -amount);
                updateBalance(user.id, guild.id, amount);
                return interaction.editReply({ content: `💰 Withdrew **${amount}** from bank.` });
            }
            if (action === 'loan') {
                if (amount < 100 || amount > 5000) return interaction.editReply({ content: '❌ Loan 100-5000.' });
                const existing = db.prepare("SELECT * FROM loans WHERE user_id = ? AND guild_id = ? AND status = 'active'").get(user.id, guild.id);
                if (existing) return interaction.editReply({ content: '❌ Already have loan.' });
                const interest = Math.floor(amount * 0.1);
                const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                db.prepare("INSERT INTO loans (user_id, guild_id, amount, interest, due_date) VALUES (?, ?, ?, ?, ?)").run(user.id, guild.id, amount, interest, due);
                updateBalance(user.id, guild.id, amount);
                return interaction.editReply({ content: `🏦 Loan of **${amount}** coins (${interest} interest, due in 7 days).` });
            }
        }
    }

    // ===== LEVEL =====
    if (commandName === 'level') {
        const sub = options.getSubcommand();
        if (sub === 'rank') {
            const target = options.getUser('user') || user;
            const { level, xp } = getLevel(target.id, guild.id);
            const needed = 5 * level * level + 50 * level + 100;
            const embed = new EmbedBuilder().setTitle(`📊 ${target.tag}`).addFields({ name: 'Level', value: String(level), inline: true }, { name: 'XP', value: `${xp}/${needed}`, inline: true }, { name: 'Progress', value: `${Math.floor((xp/needed)*100)}%`, inline: true }).setColor(0x00FF00);
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'leaderboard') {
            const rows = db.prepare("SELECT user_id, level, xp FROM levels WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '❌ No data.' });
            const desc = rows.map((r, i) => `#${i+1} <@${r.user_id}> - Level ${r.level} (${r.xp} XP)`).join('\n');
            return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🏆 Leaderboard').setDescription(desc).setColor(0xFFD700)] });
        }
    }

    // ===== MODERATION =====
    if (commandName === 'moderation') {
        if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return interaction.editReply({ content: '❌ No permissions.', ephemeral: true });
        const sub = options.getSubcommand();
        if (sub === 'kick') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ Member not found.' });
            const reason = options.getString('reason') || 'No reason';
            try { await targetMember.kick(reason); logEvent(guild.id, 'kick', `${user.tag} kicked ${target.tag}`, 0xFF0000, user.id); return interaction.editReply({ content: `✅ Kicked ${target.tag}.` }); } catch (e) { return interaction.editReply({ content: '❌ Kick failed.' }); }
        }
        if (sub === 'ban') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ Member not found.' });
            const reason = options.getString('reason') || 'No reason';
            try { await targetMember.ban({ reason }); logEvent(guild.id, 'ban', `${user.tag} banned ${target.tag}`, 0xFF0000, user.id); return interaction.editReply({ content: `✅ Banned ${target.tag}.` }); } catch (e) { return interaction.editReply({ content: '❌ Ban failed.' }); }
        }
        if (sub === 'unban') {
            const name = options.getString('user');
            const bans = await guild.bans.fetch();
            const banned = bans.find(b => b.user.tag.includes(name) || b.user.id === name);
            if (!banned) return interaction.editReply({ content: '❌ User not found.' });
            try { await guild.bans.remove(banned.user); logEvent(guild.id, 'unban', `${user.tag} unbanned ${banned.user.tag}`, 0x00FF00, user.id); return interaction.editReply({ content: `✅ Unbanned ${banned.user.tag}.` }); } catch (e) { return interaction.editReply({ content: '❌ Unban failed.' }); }
        }
        if (sub === 'timeout') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ Member not found.' });
            const duration = options.getInteger('duration');
            const reason = options.getString('reason') || 'No reason';
            try { await targetMember.timeout(duration * 1000, reason); logEvent(guild.id, 'timeout', `${user.tag} timed out ${target.tag}`, 0xFFA500, user.id); return interaction.editReply({ content: `✅ Timed out ${target.tag} for ${duration}s.` }); } catch (e) { return interaction.editReply({ content: '❌ Timeout failed.' }); }
        }
        if (sub === 'warn') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ Member not found.' });
            const reason = options.getString('reason') || 'No reason';
            const count = addWarning(target.id, guild.id, reason, user.id);
            logEvent(guild.id, 'warn', `${user.tag} warned ${target.tag}`, 0xFFA500, user.id);
            return interaction.editReply({ content: `⚠️ Warned ${target.tag} (Total: ${count})` });
        }
        if (sub === 'warnings') {
            const target = options.getUser('user');
            const warns = getWarnings(target.id, guild.id);
            if (!warns || warns.length === 0) return interaction.editReply({ content: `✅ ${target.tag} has no warnings.` });
            const desc = warns.map((w, i) => `#${i+1}: ${w.reason} (by <@${w.moderator}>)`).join('\n');
            return interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`⚠️ ${target.tag}`).setDescription(desc).setColor(0xFF0000)] });
        }
        if (sub === 'clearwarnings') {
            const target = options.getUser('user');
            clearWarnings(target.id, guild.id);
            logEvent(guild.id, 'clearwarnings', `${user.tag} cleared warnings of ${target.tag}`, 0x00FF00, user.id);
            return interaction.editReply({ content: `✅ Cleared warnings for ${target.tag}.` });
        }
        if (sub === 'purge') {
            const count = options.getInteger('count');
            if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return interaction.editReply({ content: '❌ No permissions.', ephemeral: true });
            try { await channel.bulkDelete(count, true); logEvent(guild.id, 'purge', `${user.tag} purged ${count} messages`, 0x00BFFF, user.id); return interaction.editReply({ content: `✅ Deleted ${count} messages.` }); } catch (e) { return interaction.editReply({ content: '❌ Purge failed.' }); }
        }
    }

    // ===== TICKET (مختصر) =====
    if (commandName === 'ticket') {
        const sub = options.getSubcommand();
        if (sub === 'setup') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Admin required.', ephemeral: true });
            const cat = options.getChannel('category');
            const role = options.getRole('support_role');
            const log = options.getChannel('log_channel');
            db.prepare("INSERT OR REPLACE INTO ticket_settings (guild_id, category_id, support_role_id, log_channel_id, enabled) VALUES (?, ?, ?, ?, 1)").run(guild.id, cat.id, role.id, log.id);
            return interaction.editReply({ content: `✅ Ticket setup: Category ${cat.name}, Support ${role.name}, Log ${log.name}` });
        }
        if (sub === 'panel') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Admin required.', ephemeral: true });
            const embed = new EmbedBuilder().setTitle('🎫 Ticket System').setDescription('Click below to create a ticket.').setColor(0x00BFFF);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('create_ticket').setLabel('🎫 Create Ticket').setStyle(ButtonStyle.Primary));
            await interaction.editReply({ content: '✅ Panel created!', ephemeral: true });
            await channel.send({ embeds: [embed], components: [row] });
        }
        if (sub === 'create') {
            const topic = options.getString('topic');
            const category = options.getString('category');
            const settings = db.prepare("SELECT category_id, support_role_id FROM ticket_settings WHERE guild_id = ? AND enabled = 1").get(guild.id);
            if (!settings) return interaction.editReply({ content: '❌ Ticket system not set up.', ephemeral: true });
            const cat = guild.channels.cache.get(settings.category_id);
            if (!cat) return interaction.editReply({ content: '❌ Category not found.', ephemeral: true });
            const overwrites = [{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }];
            const supportRole = guild.roles.cache.get(settings.support_role_id);
            if (supportRole) overwrites.push({ id: supportRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
            const ticketChannel = await guild.channels.create({ name: `ticket-${user.username}`, type: ChannelType.GuildText, parent: cat, permissionOverwrites: overwrites, topic: `📌 ${category} - ${topic}` });
            db.prepare("INSERT INTO tickets (guild_id, channel_id, user_id, topic, status, created_at, category) VALUES (?, ?, ?, ?, 'open', datetime('now'), ?)").run(guild.id, ticketChannel.id, user.id, topic, category);
            const embed = new EmbedBuilder().setTitle('🎫 Ticket Created').setDescription(`Topic: ${topic}\nCategory: ${category}`).setColor(0x00BFFF).addFields({ name: 'Created by', value: user.tag }, { name: 'Status', value: '🟢 Open' });
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger));
            await ticketChannel.send({ content: `<@${user.id}>`, embeds: [embed], components: [row] });
            logEvent(guild.id, 'ticket_open', `${user.tag} opened ticket`, 0x00BFFF, user.id);
            return interaction.editReply({ content: `✅ Ticket created: ${ticketChannel}` });
        }
        if (sub === 'close') {
            if (!channel.name.startsWith('ticket-')) return interaction.editReply({ content: '❌ Not a ticket.', ephemeral: true });
            const ticket = db.prepare("SELECT id FROM tickets WHERE channel_id = ? AND status = 'open'").get(channel.id);
            if (!ticket) return interaction.editReply({ content: '❌ Ticket not found.', ephemeral: true });
            db.prepare("UPDATE tickets SET status = 'closed' WHERE channel_id = ?").run(channel.id);
            logEvent(guild.id, 'ticket_close', `${user.tag} closed ticket`, 0xFF0000, user.id);
            await interaction.editReply({ content: '🔒 Ticket will be deleted in 5s.' });
            setTimeout(() => channel.delete().catch(() => {}), 5000);
        }
    }

    // ===== WELCOME =====
    if (commandName === 'welcome') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Admin required.', ephemeral: true });
        const sub = options.getSubcommand();
        if (sub === 'set') {
            const ch = options.getChannel('channel');
            const msg = options.getString('message') || 'Welcome {user} to {server}!';
            const img = options.getAttachment('image')?.url || '';
            db.prepare("INSERT OR REPLACE INTO welcome (guild_id, channel_id, message, image_url, enabled) VALUES (?, ?, ?, ?, 1)").run(guild.id, ch.id, msg, img);
            return interaction.editReply({ content: `✅ Welcome set in ${ch} ${img ? 'with image' : ''}` });
        }
        if (sub === 'goodbye') {
            const ch = options.getChannel('channel');
            const msg = options.getString('message') || 'Goodbye {user} from {server}!';
            const img = options.getAttachment('image')?.url || '';
            db.prepare("INSERT OR REPLACE INTO goodbye (guild_id, channel_id, message, image_url, enabled) VALUES (?, ?, ?, ?, 1)").run(guild.id, ch.id, msg, img);
            return interaction.editReply({ content: `✅ Goodbye set in ${ch} ${img ? 'with image' : ''}` });
        }
        if (sub === 'toggle') {
            const enabled = options.getBoolean('enabled');
            db.prepare("UPDATE welcome SET enabled = ? WHERE guild_id = ?").run(enabled ? 1 : 0, guild.id);
            return interaction.editReply({ content: `✅ Welcome ${enabled ? 'enabled' : 'disabled'}.` });
        }
    }

    // ===== SECURITY =====
    if (commandName === 'security') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Admin required.', ephemeral: true });
        const sub = options.getSubcommand();
        if (sub === 'verification') {
            const role = options.getRole('role');
            const ch = options.getChannel('channel');
            db.prepare("INSERT OR REPLACE INTO security (guild_id, verify_role_id, verify_channel_id) VALUES (?, ?, ?)").run(guild.id, role.id, ch.id);
            const embed = new EmbedBuilder().setTitle('✅ Verification').setDescription('Click to verify.').setColor(0x00FF00);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verify_button').setLabel('✅ Verify').setStyle(ButtonStyle.Success));
            await ch.send({ embeds: [embed], components: [row] });
            return interaction.editReply({ content: `✅ Verification setup: Role ${role.name}, Channel ${ch}` });
        }
        if (sub === 'antispam') {
            const limit = options.getInteger('limit');
            db.prepare("INSERT OR REPLACE INTO security (guild_id, spam_threshold) VALUES (?, ?)").run(guild.id, limit);
            return interaction.editReply({ content: `✅ Spam threshold set to ${limit} messages/5s.` });
        }
        if (sub === 'mute_role') {
            const role = options.getRole('role');
            db.prepare("INSERT OR REPLACE INTO security (guild_id, mute_role_id) VALUES (?, ?)").run(guild.id, role.id);
            return interaction.editReply({ content: `✅ Mute role set to ${role.name}` });
        }
    }

    // ===== LOGS =====
    if (commandName === 'logs') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Admin required.', ephemeral: true });
        const sub = options.getSubcommand();
        if (sub === 'set') {
            const ch = options.getChannel('channel');
            const type = options.getString('type');
            db.prepare("INSERT OR REPLACE INTO logs (guild_id, channel_id, type, enabled) VALUES (?, ?, ?, 1)").run(guild.id, ch.id, type);
            return interaction.editReply({ content: `✅ Log channel set for ${type} to ${ch}` });
        }
    }

    // ===== ROLES =====
    if (commandName === 'roles') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Admin required.', ephemeral: true });
        const sub = options.getSubcommand();
        if (sub === 'autorole') {
            const role = options.getRole('role');
            db.prepare("INSERT OR REPLACE INTO autoroles (guild_id, role_id) VALUES (?, ?)").run(guild.id, role.id);
            return interaction.editReply({ content: `✅ Auto role set to ${role.name}` });
        }
        if (sub === 'reaction') {
            const msgId = options.getString('message_id');
            const role = options.getRole('role');
            const emoji = options.getString('emoji');
            db.prepare("INSERT INTO reaction_roles (guild_id, message_id, role_id, emoji) VALUES (?, ?, ?, ?)").run(guild.id, msgId, role.id, emoji);
            try { const msg = await channel.messages.fetch(msgId); await msg.react(emoji); } catch (e) {}
            return interaction.editReply({ content: `✅ Reaction role: ${emoji} -> ${role.name}` });
        }
        if (sub === 'list') {
            const rows = db.prepare("SELECT id, message_id, role_id, emoji FROM reaction_roles WHERE guild_id = ?").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 No reaction roles.' });
            const list = rows.map(r => `#${r.id} - ${r.emoji} -> <@&${r.role_id}>`).join('\n');
            return interaction.editReply({ content: `📋 Reaction roles:\n${list}` });
        }
        if (sub === 'temprole') {
            const target = options.getUser('user');
            const targetMember = guild.members.cache.get(target.id);
            if (!targetMember) return interaction.editReply({ content: '❌ User not found.' });
            const role = options.getRole('role');
            const duration = options.getInteger('duration');
            try { await targetMember.roles.add(role); const expiry = new Date(Date.now() + duration * 1000).toISOString(); db.prepare("INSERT INTO temp_roles (user_id, guild_id, role_id, expiry_time) VALUES (?, ?, ?, ?)").run(target.id, guild.id, role.id, expiry); return interaction.editReply({ content: `✅ Gave ${role.name} to ${target.tag} for ${duration}s.` }); } catch (e) { return interaction.editReply({ content: '❌ Failed to give role.' }); }
        }
    }

    // ===== REMINDER =====
    if (commandName === 'reminder') {
        const sub = options.getSubcommand();
        if (sub === 'set') {
            const duration = options.getInteger('duration');
            const msg = options.getString('message');
            const remindTime = new Date(Date.now() + duration * 1000).toISOString();
            db.prepare("INSERT INTO reminders (user_id, channel_id, message, remind_time, guild_id) VALUES (?, ?, ?, ?, ?)").run(user.id, channel.id, msg, remindTime, guild.id);
            return interaction.editReply({ content: `✅ Reminder set for ${duration}s.` });
        }
        if (sub === 'list') {
            const rows = db.prepare("SELECT id, message, remind_time FROM reminders WHERE user_id = ? AND guild_id = ?").all(user.id, guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 No reminders.' });
            const list = rows.map(r => `#${r.id}: ${r.message} (${moment(r.remind_time).fromNow()})`).join('\n');
            return interaction.editReply({ content: `📋 Your reminders:\n${list}` });
        }
        if (sub === 'cancel') {
            const id = options.getInteger('id');
            db.prepare("DELETE FROM reminders WHERE id = ? AND user_id = ?").run(id, user.id);
            return interaction.editReply({ content: `✅ Reminder #${id} cancelled.` });
        }
    }

    // ===== CLAN (مختصر) =====
    if (commandName === 'clan') {
        const sub = options.getSubcommand();
        if (sub === 'create') {
            const name = options.getString('name');
            const existing = db.prepare("SELECT * FROM clans WHERE guild_id = ? AND name = ?").get(guild.id, name);
            if (existing) return interaction.editReply({ content: '❌ Clan exists.' });
            db.prepare("INSERT INTO clans (guild_id, name, owner, members) VALUES (?, ?, ?, ?)").run(guild.id, name, user.id, JSON.stringify([user.id]));
            logEvent(guild.id, 'clan_create', `${user.tag} created clan ${name}`, 0x00BFFF, user.id);
            return interaction.editReply({ content: `✅ Clan **${name}** created!` });
        }
        if (sub === 'info') {
            const name = options.getString('name');
            const clan = db.prepare("SELECT * FROM clans WHERE guild_id = ? AND name = ?").get(guild.id, name);
            if (!clan) return interaction.editReply({ content: '❌ Clan not found.' });
            const members = JSON.parse(clan.members);
            const embed = new EmbedBuilder().setTitle(`🏴 ${clan.name}`).setColor(0xFF0000).addFields({ name: 'Owner', value: `<@${clan.owner}>`, inline: true }, { name: 'Members', value: members.map(id => `<@${id}>`).join(', ') || 'None' });
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'invite') {
            const target = options.getUser('user');
            const clan = db.prepare("SELECT * FROM clans WHERE guild_id = ? AND owner = ?").get(guild.id, user.id);
            if (!clan) return interaction.editReply({ content: '❌ You are not owner.' });
            const members = JSON.parse(clan.members);
            if (members.includes(target.id)) return interaction.editReply({ content: `❌ Already in clan.` });
            members.push(target.id);
            db.prepare("UPDATE clans SET members = ? WHERE guild_id = ? AND owner = ?").run(JSON.stringify(members), guild.id, user.id);
            return interaction.editReply({ content: `✅ Invited ${target.tag}` });
        }
        if (sub === 'join') {
            const name = options.getString('name');
            const clan = db.prepare("SELECT * FROM clans WHERE guild_id = ? AND name = ?").get(guild.id, name);
            if (!clan) return interaction.editReply({ content: '❌ Clan not found.' });
            const members = JSON.parse(clan.members);
            if (members.includes(user.id)) return interaction.editReply({ content: '❌ Already in clan.' });
            members.push(user.id);
            db.prepare("UPDATE clans SET members = ? WHERE guild_id = ? AND name = ?").run(JSON.stringify(members), guild.id, name);
            return interaction.editReply({ content: `✅ Joined **${name}**!` });
        }
        if (sub === 'leave') {
            const clan = db.prepare("SELECT * FROM clans WHERE guild_id = ? AND members LIKE ?").get(guild.id, `%${user.id}%`);
            if (!clan) return interaction.editReply({ content: '❌ Not in a clan.' });
            if (clan.owner === user.id) return interaction.editReply({ content: '❌ Owner cannot leave.' });
            const members = JSON.parse(clan.members).filter(id => id !== user.id);
            db.prepare("UPDATE clans SET members = ? WHERE guild_id = ? AND name = ?").run(JSON.stringify(members), guild.id, clan.name);
            return interaction.editReply({ content: `✅ Left **${clan.name}**.` });
        }
        if (sub === 'leaderboard') {
            const rows = db.prepare("SELECT name, level FROM clans WHERE guild_id = ? ORDER BY level DESC LIMIT 10").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 No clans.' });
            const desc = rows.map((r, i) => `#${i+1} **${r.name}** - Level ${r.level}`).join('\n');
            return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🏆 Clan Leaderboard').setDescription(desc).setColor(0xFFD700)] });
        }
    }

    // ===== FARM =====
    if (commandName === 'farm') {
        const sub = options.getSubcommand();
        if (sub === 'plant') {
            const crop = options.getString('crop');
            const times = { wheat: 60, corn: 120, tomato: 180, potato: 240 };
            const now = Date.now();
            const ready = now + times[crop] * 1000;
            const existing = db.prepare("SELECT * FROM farms WHERE user_id = ? AND guild_id = ? AND status = 'growing'").get(user.id, guild.id);
            if (existing) return interaction.editReply({ content: '❌ Already growing.' });
            db.prepare("INSERT INTO farms (user_id, guild_id, crop, ready_at) VALUES (?, ?, ?, ?)").run(user.id, guild.id, crop, String(ready));
            return interaction.editReply({ content: `🌱 Planted **${crop}**! Ready in ${times[crop]}s.` });
        }
        if (sub === 'harvest') {
            const row = db.prepare("SELECT crop, ready_at FROM farms WHERE user_id = ? AND guild_id = ? AND status = 'growing'").get(user.id, guild.id);
            if (!row) return interaction.editReply({ content: '❌ No crop.' });
            const now = Date.now();
            if (now < parseInt(row.ready_at)) {
                const remain = Math.ceil((parseInt(row.ready_at) - now) / 1000);
                return interaction.editReply({ content: `⏳ ${remain}s left.` });
            }
            const rewards = { wheat: 10, corn: 20, tomato: 30, potato: 40 };
            const amount = rewards[row.crop] || 10;
            updateBalance(user.id, guild.id, amount);
            db.prepare("UPDATE farms SET status = 'harvested' WHERE user_id = ? AND guild_id = ?").run(user.id, guild.id);
            return interaction.editReply({ content: `✅ Harvested **${row.crop}** and earned **${amount}** coins!` });
        }
    }

    // ===== AUCTION (مختصر) =====
    if (commandName === 'auction') {
        const sub = options.getSubcommand();
        if (sub === 'create') {
            const item = options.getString('item');
            const starting = options.getInteger('starting_bid');
            const endTime = new Date(Date.now() + 3600000).toISOString();
            db.prepare("INSERT INTO auctions (guild_id, item, seller, current_bid, end_time) VALUES (?, ?, ?, ?, ?)").run(guild.id, item, user.id, starting, endTime);
            logEvent(guild.id, 'auction_create', `${user.tag} created auction for ${item}`, 0xFFD700, user.id);
            return interaction.editReply({ content: `🔨 Auction for **${item}** starting at ${starting} coins!` });
        }
        if (sub === 'bid') {
            const id = options.getInteger('id');
            const amount = options.getInteger('amount');
            const auction = db.prepare("SELECT * FROM auctions WHERE id = ? AND status = 'active'").get(id);
            if (!auction) return interaction.editReply({ content: '❌ Not found or ended.' });
            if (amount <= auction.current_bid) return interaction.editReply({ content: `❌ Must be > ${auction.current_bid}.` });
            if (user.id === auction.seller) return interaction.editReply({ content: '❌ Cannot bid own item.' });
            db.prepare("UPDATE auctions SET current_bid = ?, bidder = ? WHERE id = ?").run(amount, user.id, id);
            return interaction.editReply({ content: `✅ Bid **${amount}** on **${auction.item}**!` });
        }
        if (sub === 'list') {
            const rows = db.prepare("SELECT id, item, current_bid, seller FROM auctions WHERE guild_id = ? AND status = 'active'").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 No auctions.' });
            const desc = rows.map(r => `#${r.id} - **${r.item}** - ${r.current_bid} coins (by <@${r.seller}>)`).join('\n');
            return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🔨 Auctions').setDescription(desc).setColor(0xFFD700)] });
        }
        if (sub === 'end') {
            const id = options.getInteger('id');
            const auction = db.prepare("SELECT * FROM auctions WHERE id = ? AND status = 'active'").get(id);
            if (!auction) return interaction.editReply({ content: '❌ Not found.' });
            if (auction.seller !== user.id && !member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Not seller or admin.', ephemeral: true });
            if (auction.bidder) {
                updateBalance(auction.bidder, guild.id, -auction.current_bid);
                updateBalance(auction.seller, guild.id, auction.current_bid);
                db.prepare("UPDATE auctions SET status = 'ended' WHERE id = ?").run(id);
                return interaction.editReply({ content: `🏆 <@${auction.bidder}> won **${auction.item}** for ${auction.current_bid} coins!` });
            } else {
                db.prepare("UPDATE auctions SET status = 'ended' WHERE id = ?").run(id);
                return interaction.editReply({ content: `❌ No bids. Auction cancelled.` });
            }
        }
    }

    // ===== GAME =====
    if (commandName === 'game') {
        const sub = options.getSubcommand();
        if (sub === 'dice') {
            const bet = options.getInteger('bet') || 0;
            const bal = getBalance(user.id, guild.id);
            if (bet > 0 && bal < bet) return interaction.editReply({ content: '❌ Insufficient balance.' });
            const total = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
            let embed = new EmbedBuilder().setTitle('🎲 Dice').setDescription(`You rolled **${total}**`).setColor(0x00BFFF);
            if (bet > 0) {
                if (total >= 7) { updateBalance(user.id, guild.id, bet); embed.addFields({ name: '🎉', value: `Won **${bet}** coins!` }); }
                else { updateBalance(user.id, guild.id, -bet); embed.addFields({ name: '😔', value: `Lost **${bet}** coins.` }); }
            }
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'coinflip') {
            const choice = options.getString('choice');
            const bet = options.getInteger('bet') || 0;
            const bal = getBalance(user.id, guild.id);
            if (bet > 0 && bal < bet) return interaction.editReply({ content: '❌ Insufficient balance.' });
            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const won = choice === result;
            const emoji = result === 'heads' ? '🪙 Heads' : '🪙 Tails';
            let embed = new EmbedBuilder().setTitle('🪙 Coin Flip').setDescription(`Result: **${emoji}**`).setColor(0x00BFFF);
            if (bet > 0) {
                if (won) { updateBalance(user.id, guild.id, bet); embed.addFields({ name: '🎉', value: `Won **${bet}** coins!` }); }
                else { updateBalance(user.id, guild.id, -bet); embed.addFields({ name: '😔', value: `Lost **${bet}** coins.` }); }
            }
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'rps') {
            const choice = options.getString('choice');
            const bet = options.getInteger('bet') || 0;
            const bal = getBalance(user.id, guild.id);
            if (bet > 0 && bal < bet) return interaction.editReply({ content: '❌ Insufficient balance.' });
            const botChoice = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
            const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
            const won = beats[choice] === botChoice;
            const emojis = { rock: '🪨', paper: '📄', scissors: '✂️' };
            const resultText = won ? '🎉 You won!' : (choice === botChoice ? '🤝 Draw' : '😔 You lost');
            let embed = new EmbedBuilder().setTitle('🎮 RPS').setDescription(`You: ${emojis[choice]}\nBot: ${emojis[botChoice]}`).setColor(0x00BFFF);
            if (bet > 0 && resultText !== '🤝 Draw') {
                if (won) { updateBalance(user.id, guild.id, bet); embed.addFields({ name: '🎉', value: `Won **${bet}** coins!` }); }
                else { updateBalance(user.id, guild.id, -bet); embed.addFields({ name: '😔', value: `Lost **${bet}** coins.` }); }
            }
            embed.addFields({ name: 'Result', value: resultText });
            return interaction.editReply({ embeds: [embed] });
        }
    }

    // ===== CUSTOM COMMANDS =====
    if (commandName === 'custom') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Admin required.', ephemeral: true });
        const sub = options.getSubcommand();
        if (sub === 'add') {
            const name = options.getString('name');
            const response = options.getString('response');
            db.prepare("INSERT OR REPLACE INTO custom_commands (guild_id, name, response) VALUES (?, ?, ?)").run(guild.id, name.toLowerCase(), response);
            return interaction.editReply({ content: `✅ Custom command /${name} added.` });
        }
        if (sub === 'remove') {
            const name = options.getString('name');
            db.prepare("DELETE FROM custom_commands WHERE guild_id = ? AND name = ?").run(guild.id, name.toLowerCase());
            return interaction.editReply({ content: `✅ Removed /${name}.` });
        }
        if (sub === 'list') {
            const rows = db.prepare("SELECT name, response FROM custom_commands WHERE guild_id = ?").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 No custom commands.' });
            const list = rows.map(r => `/${r.name} - ${r.response}`).join('\n');
            return interaction.editReply({ content: `📋 Custom commands:\n${list}` });
        }
    }

    // ===== POLL =====
    if (commandName === 'poll') {
        const question = options.getString('question');
        const optionsStr = options.getString('options');
        const opts = optionsStr.split(',').map(o => o.trim()).filter(o => o.length > 0);
        if (opts.length < 2) return interaction.editReply({ content: '❌ Need at least 2 options.' });
        if (opts.length > 10) return interaction.editReply({ content: '❌ Max 10 options.' });
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        const desc = opts.map((o, i) => `${emojis[i]} ${o}`).join('\n');
        const embed = new EmbedBuilder().setTitle(`📊 ${question}`).setDescription(desc).setColor(0x00FF00);
        const msg = await channel.send({ embeds: [embed] });
        for (let i = 0; i < opts.length; i++) await msg.react(emojis[i]);
        return interaction.editReply({ content: '✅ Poll created!' });
    }

    // ===== GIVEAWAY =====
    if (commandName === 'giveaway') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Admin required.', ephemeral: true });
        const sub = options.getSubcommand();
        if (sub === 'create') {
            const duration = options.getInteger('duration');
            const winners = options.getInteger('winners');
            const prize = options.getString('prize');
            const embed = new EmbedBuilder().setTitle('🎁 Giveaway').setDescription(`Prize: **${prize}**\nWinners: ${winners}\nReact 🎉`).setColor(0xFFD700);
            const msg = await channel.send({ embeds: [embed] });
            await msg.react('🎉');
            const endTime = new Date(Date.now() + duration * 1000).toISOString();
            db.prepare("INSERT INTO giveaways (guild_id, channel_id, message_id, prize, end_time, winners, entries) VALUES (?, ?, ?, ?, ?, ?, ?)").run(guild.id, channel.id, msg.id, prize, endTime, winners, JSON.stringify([]));
            return interaction.editReply({ content: `✅ Giveaway created! Ends in ${duration}s.` });
        }
        if (sub === 'reroll') {
            const msgId = options.getString('message_id');
            const gw = db.prepare("SELECT prize, winners, entries FROM giveaways WHERE message_id = ? AND status = 'ended'").get(msgId);
            if (!gw) return interaction.editReply({ content: '❌ Not found or not ended.' });
            const entries = JSON.parse(gw.entries);
            if (entries.length === 0) return interaction.editReply({ content: '❌ No entries.' });
            const shuffled = entries.sort(() => 0.5 - Math.random());
            const newWinners = shuffled.slice(0, Math.min(gw.winners, shuffled.length));
            const mentions = newWinners.map(id => `<@${id}>`).join(', ');
            await channel.send(`🎉 Rerolled! Winners for **${gw.prize}**: ${mentions}`);
            return interaction.editReply({ content: '✅ Rerolled!' });
        }
        if (sub === 'end') {
            const msgId = options.getString('message_id');
            const gw = db.prepare("SELECT id, prize, winners, entries FROM giveaways WHERE message_id = ? AND status = 'active'").get(msgId);
            if (!gw) return interaction.editReply({ content: '❌ Not found or already ended.' });
            const entries = JSON.parse(gw.entries);
            if (entries.length === 0) {
                await channel.send(`❌ No entries for **${gw.prize}**. Giveaway cancelled.`);
            } else {
                const shuffled = entries.sort(() => 0.5 - Math.random());
                const winners = shuffled.slice(0, Math.min(gw.winners, shuffled.length));
                const mentions = winners.map(id => `<@${id}>`).join(', ');
                await channel.send(`🎉 Giveaway ended! Winners of **${gw.prize}**: ${mentions}`);
            }
            db.prepare("UPDATE giveaways SET status = 'ended' WHERE id = ?").run(gw.id);
            return interaction.editReply({ content: '✅ Giveaway ended!' });
        }
    }

    // ===== TITLE =====
    if (commandName === 'title') {
        const sub = options.getSubcommand();
        if (sub === 'set') {
            const title = options.getString('title');
            db.prepare("INSERT OR REPLACE INTO titles (user_id, guild_id, title) VALUES (?, ?, ?)").run(user.id, guild.id, title);
            return interaction.editReply({ content: `✅ Title set to **${title}**` });
        }
        if (sub === 'remove') {
            db.prepare("DELETE FROM titles WHERE user_id = ? AND guild_id = ?").run(user.id, guild.id);
            return interaction.editReply({ content: '✅ Title removed.' });
        }
        if (sub === 'shop') {
            const titles = db.prepare("SELECT title, price FROM title_shop WHERE guild_id = ?").all(guild.id);
            const embed = new EmbedBuilder().setTitle('🏷️ Title Shop').setColor(0x00BFFF);
            if (titles.length === 0) embed.setDescription('No titles. Ask admin to add.');
            else titles.forEach(t => embed.addFields({ name: t.title, value: `${t.price} coins`, inline: true }));
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'buy') {
            const title = options.getString('title');
            const shopItem = db.prepare("SELECT price FROM title_shop WHERE guild_id = ? AND title = ?").get(guild.id, title);
            if (!shopItem) return interaction.editReply({ content: '❌ Title not found.' });
            const bal = getBalance(user.id, guild.id);
            if (bal < shopItem.price) return interaction.editReply({ content: `❌ Need ${shopItem.price} coins.` });
            updateBalance(user.id, guild.id, -shopItem.price);
            db.prepare("INSERT OR REPLACE INTO titles (user_id, guild_id, title) VALUES (?, ?, ?)").run(user.id, guild.id, title);
            return interaction.editReply({ content: `✅ Bought **${title}**!` });
        }
    }

    // ===== ACHIEVEMENT =====
    if (commandName === 'achievement') {
        const sub = options.getSubcommand();
        if (sub === 'list') {
            const rows = db.prepare("SELECT name, unlocked_at FROM achievements WHERE user_id = ? AND guild_id = ?").all(user.id, guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 No achievements.' });
            const list = rows.map(r => `${r.name} (${r.unlocked_at})`).join('\n');
            return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🏅 Achievements').setDescription(list).setColor(0xFFD700)] });
        }
        if (sub === 'create') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Admin required.', ephemeral: true });
            const name = options.getString('name');
            const description = options.getString('description');
            const reward = options.getInteger('reward') || 0;
            db.prepare("INSERT OR REPLACE INTO achievement_defs (guild_id, name, description, reward) VALUES (?, ?, ?, ?)").run(guild.id, name, description, reward);
            return interaction.editReply({ content: `✅ Achievement **${name}** created!` });
        }
    }

    // ===== AUTO RESPONSES =====
    if (commandName === 'auto') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply({ content: '❌ Admin required.', ephemeral: true });
        const sub = options.getSubcommand();
        if (sub === 'add') {
            const trigger = options.getString('trigger');
            const response = options.getString('response');
            db.prepare("INSERT OR REPLACE INTO auto_responders (guild_id, trigger, response) VALUES (?, ?, ?)").run(guild.id, trigger.toLowerCase(), response);
            return interaction.editReply({ content: `✅ Auto response added for "${trigger}"` });
        }
        if (sub === 'remove') {
            const trigger = options.getString('trigger');
            db.prepare("DELETE FROM auto_responders WHERE guild_id = ? AND trigger = ?").run(guild.id, trigger.toLowerCase());
            return interaction.editReply({ content: `✅ Removed for "${trigger}"` });
        }
        if (sub === 'list') {
            const rows = db.prepare("SELECT trigger, response FROM auto_responders WHERE guild_id = ?").all(guild.id);
            if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 No auto responses.' });
            const list = rows.map(r => `"${r.trigger}" -> ${r.response}`).join('\n');
            return interaction.editReply({ content: `📋 Auto responses:\n${list}` });
        }
    }

    // ===== VOTE =====
    if (commandName === 'vote') {
        const embed = new EmbedBuilder().setTitle('🗳️ Vote!').setDescription('Support the bot: [Top.gg](https://top.gg)').setColor(0x00BFFF);
        return interaction.editReply({ embeds: [embed] });
    }

    // ===== MOOD =====
    if (commandName === 'mood') {
        const status = options.getString('status');
        try { await member.setNickname(`🎭 ${status}`); return interaction.editReply({ content: `✅ Mood set to **${status}**` }); } catch (e) { return interaction.editReply({ content: '❌ Failed to set mood.' }); }
    }

    // ===== VERIFY =====
    if (commandName === 'verify') {
        const settings = db.prepare("SELECT verify_role_id FROM security WHERE guild_id = ?").get(guild.id);
        if (!settings) return interaction.editReply({ content: '❌ Verification not set up.' });
        const role = guild.roles.cache.get(settings.verify_role_id);
        if (!role) return interaction.editReply({ content: '❌ Role not found.' });
        try { await member.roles.add(role); return interaction.editReply({ content: `✅ Verified! Received ${role.name}.` }); } catch (e) { return interaction.editReply({ content: '❌ Failed to verify.' }); }
    }

    // ===== REPORT =====
    if (commandName === 'report') {
        const target = options.getUser('user');
        const reason = options.getString('reason');
        const reportsChannel = guild.channels.cache.find(c => c.name === 'reports') || guild.channels.cache.find(c => c.name === 'mod-logs');
        if (reportsChannel) {
            const embed = new EmbedBuilder().setTitle('📢 Report').setDescription(`**User:** ${target.tag}\n**Reason:** ${reason}\n**Reporter:** ${user.tag}`).setColor(0xFF0000).setTimestamp();
            await reportsChannel.send({ embeds: [embed] });
            logEvent(guild.id, 'report', `${user.tag} reported ${target.tag}`, 0xFF0000, user.id);
            return interaction.editReply({ content: '✅ Report submitted.' });
        } else {
            return interaction.editReply({ content: '❌ No reports channel found.' });
        }
    }

    // ===== OWNER =====
    if (commandName === 'owner') {
        if (user.id !== ownerId) return interaction.editReply({ content: '❌ Owner only.', ephemeral: true });
        const sub = options.getSubcommand();
        if (sub === 'reload') {
            await registerCommands();
            return interaction.editReply({ content: '✅ Commands reloaded.' });
        }
        if (sub === 'stats') {
            const totalUsers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
            const embed = new EmbedBuilder().setTitle('📊 Stats').addFields({ name: 'Servers', value: String(client.guilds.cache.size), inline: true }, { name: 'Users', value: String(totalUsers), inline: true }, { name: 'Commands', value: String(commands.length), inline: true }, { name: 'Uptime', value: moment.duration(process.uptime(), 'seconds').humanize(), inline: true }).setColor(0x00BFFF);
            return interaction.editReply({ embeds: [embed] });
        }
        if (sub === 'eval') {
            const code = options.getString('code');
            try { const result = eval(code); return interaction.editReply({ content: `📊 \`\`\`js\n${result}\n\`\`\`` }); } catch (e) { return interaction.editReply({ content: `❌ ${e.message}` }); }
        }
    }
});

// ================== أحداث العضوية ==================
client.on(Events.GuildMemberAdd, async (member) => {
    const welcome = db.prepare("SELECT channel_id, message, image_url, enabled FROM welcome WHERE guild_id = ? AND enabled = 1").get(member.guild.id);
    if (welcome) {
        const ch = member.guild.channels.cache.get(welcome.channel_id);
        if (ch) {
            const msg = welcome.message.replace(/{user}/g, member.toString()).replace(/{server}/g, member.guild.name);
            const embed = new EmbedBuilder().setTitle('👋 Welcome').setDescription(msg).setColor(0x00FF00).setThumbnail(member.displayAvatarURL());
            if (welcome.image_url) embed.setImage(welcome.image_url);
            ch.send({ embeds: [embed] });
        }
    }
    const autoroles = db.prepare("SELECT role_id FROM autoroles WHERE guild_id = ?").all(member.guild.id);
    for (const r of autoroles) { const role = member.guild.roles.cache.get(r.role_id); if (role) member.roles.add(role).catch(() => {}); }
    logEvent(member.guild.id, 'member_join', `${member.user.tag} joined.`, 0x00FF00, member.id);
});

client.on(Events.GuildMemberRemove, (member) => {
    const goodbye = db.prepare("SELECT channel_id, message, image_url FROM goodbye WHERE guild_id = ?").get(member.guild.id);
    if (goodbye) {
        const ch = member.guild.channels.cache.get(goodbye.channel_id);
        if (ch) {
            const msg = goodbye.message.replace(/{user}/g, member.user.tag).replace(/{server}/g, member.guild.name);
            const embed = new EmbedBuilder().setTitle('👋 Goodbye').setDescription(msg).setColor(0xFF0000).setThumbnail(member.displayAvatarURL());
            if (goodbye.image_url) embed.setImage(goodbye.image_url);
            ch.send({ embeds: [embed] });
        }
    }
    logEvent(member.guild.id, 'member_leave', `${member.user.tag} left.`, 0xFF0000, member.id);
});

// ================== نظام الحماية ==================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    const security = db.prepare("SELECT spam_threshold FROM security WHERE guild_id = ?").get(message.guild.id);
    const threshold = security ? security.spam_threshold : 5;
    const key = `${message.author.id}-${message.guild.id}`;
    const now = Date.now();
    if (!messageCache.has(key)) messageCache.set(key, []);
    const timestamps = messageCache.get(key);
    timestamps.push(now);
    const recent = timestamps.filter(t => now - t < 5000);
    messageCache.set(key, recent);
    if (recent.length > threshold) {
        try {
            await message.author.timeout(60000, 'Spam');
            const muteRole = db.prepare("SELECT mute_role_id FROM security WHERE guild_id = ?").get(message.guild.id);
            if (muteRole && muteRole.mute_role_id) { const role = message.guild.roles.cache.get(muteRole.mute_role_id); if (role) await message.member.roles.add(role); }
            logEvent(message.guild.id, 'spam', `${message.author.tag} timed out.`, 0xFF0000, message.author.id);
            await message.channel.send(`🔇 ${message.author} timed out for spam.`);
        } catch (e) {}
    }
    if (!message.content.startsWith('/')) {
        const xpGain = Math.floor(Math.random() * 15) + 5;
        addXp(message.author.id, message.guild.id, xpGain);
    }
    const autoResponses = db.prepare("SELECT trigger, response FROM auto_responders WHERE guild_id = ?").all(message.guild.id);
    for (const ar of autoResponses) { if (message.content.toLowerCase().includes(ar.trigger)) { message.channel.send(ar.response).catch(() => {}); break; } }
    if (message.content.startsWith('!')) {
        const cmd = message.content.slice(1).split(' ')[0].toLowerCase();
        const custom = db.prepare("SELECT response FROM custom_commands WHERE guild_id = ? AND name = ?").get(message.guild.id, cmd);
        if (custom) message.channel.send(custom.response).catch(() => {});
    }
});

client.on(Events.GuildMemberAdd, (member) => {
    const now = Date.now();
    if (!joinCache.has(member.guild.id)) joinCache.set(member.guild.id, []);
    const joins = joinCache.get(member.guild.id);
    joins.push(now);
    const recent = joins.filter(t => now - t < 10000);
    joinCache.set(member.guild.id, recent);
    if (recent.length > 10) {
        logEvent(member.guild.id, 'raid', `Possible raid! ${recent.length} joins in 10s.`, 0xFF0000);
        member.guild.channels.cache.forEach(async ch => { try { await ch.permissionOverwrites.edit(member.guild.id, { SendMessages: false }); } catch (e) {} });
    }
});

client.on(Events.MessageDelete, (message) => {
    if (!message.guild || message.author?.bot) return;
    logEvent(message.guild.id, 'message_delete', `${message.author?.tag} deleted: ${message.content?.slice(0, 100) || '[Media]'}`, 0xFF6347, message.author?.id);
});

client.on(Events.MessageUpdate, (oldMsg, newMsg) => {
    if (!oldMsg.guild || oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
    logEvent(oldMsg.guild.id, 'message_edit', `${oldMsg.author?.tag} edited: ${oldMsg.content?.slice(0, 50)} -> ${newMsg.content?.slice(0, 50)}`, 0xFFA500, oldMsg.author?.id);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
        if (interaction.customId === 'create_ticket') {
            const settings = db.prepare("SELECT category_id, support_role_id FROM ticket_settings WHERE guild_id = ? AND enabled = 1").get(interaction.guild.id);
            if (!settings) return interaction.reply({ content: '❌ Ticket system not set up.', ephemeral: true });
            const cat = interaction.guild.channels.cache.get(settings.category_id);
            if (!cat) return interaction.reply({ content: '❌ Category not found.', ephemeral: true });
            const overwrites = [{ id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }];
            const supportRole = interaction.guild.roles.cache.get(settings.support_role_id);
            if (supportRole) overwrites.push({ id: supportRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
            const ticketChannel = await interaction.guild.channels.create({ name: `ticket-${interaction.user.username}`, type: ChannelType.GuildText, parent: cat, permissionOverwrites: overwrites, topic: `Ticket for ${interaction.user.tag}` });
            db.prepare("INSERT INTO tickets (guild_id, channel_id, user_id, topic, status, created_at, category) VALUES (?, ?, ?, ?, 'open', datetime('now'), ?)").run(interaction.guild.id, ticketChannel.id, interaction.user.id, 'General support', 'General');
            const embed = new EmbedBuilder().setTitle('🎫 Ticket Created').setDescription(`Hello ${interaction.user.tag}! Support will assist you.`).setColor(0x00BFFF).addFields({ name: 'Created by', value: interaction.user.tag }).setFooter({ text: 'Click Close Ticket when done.' });
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger));
            await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
            await interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });
            logEvent(interaction.guild.id, 'ticket_open', `${interaction.user.tag} opened ticket.`, 0x00BFFF, interaction.user.id);
        }
        if (interaction.customId === 'close_ticket') {
            if (!interaction.channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Not a ticket.', ephemeral: true });
            const ticket = db.prepare("SELECT id FROM tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channel.id);
            if (!ticket) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
            db.prepare("UPDATE tickets SET status = 'closed' WHERE channel_id = ?").run(interaction.channel.id);
            await interaction.reply({ content: '🔒 Ticket will be deleted in 5s.', ephemeral: true });
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
        if (interaction.customId === 'verify_button') {
            const settings = db.prepare("SELECT verify_role_id FROM security WHERE guild_id = ?").get(interaction.guild.id);
            if (settings && settings.verify_role_id) {
                const role = interaction.guild.roles.cache.get(settings.verify_role_id);
                if (role) { await interaction.member.roles.add(role); await interaction.reply({ content: `✅ Verified! Received ${role.name}`, ephemeral: true }); }
            }
        }
    }
});

// ================== التذكيرات ==================
setInterval(() => {
    const now = new Date().toISOString();
    const reminders = db.prepare("SELECT id, user_id, channel_id, message, remind_time FROM reminders WHERE remind_time <= ?").all(now);
    for (const row of reminders) {
        const user = client.users.cache.get(row.user_id);
        const channel = client.channels.cache.get(row.channel_id);
        if (user) user.send(`⏰ Reminder: ${row.message}`).catch(() => {});
        if (channel) channel.send(`⏰ <@${row.user_id}> Reminder: ${row.message}`).catch(() => {});
        db.prepare("DELETE FROM reminders WHERE id = ?").run(row.id);
    }
}, 30000);

// ================== تشغيل البوت ==================
client.login(TOKEN);
