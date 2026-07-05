import discord
from discord.ext import commands
from discord import app_commands
import os
import random
import asyncio
import sqlite3
import json
import re
import aiohttp
from datetime import datetime, timedelta

# ====================== المتغيرات البيئية (فقط هذين الاثنين) ======================
TOKEN = os.getenv("DISCORD_TOKEN")
if not TOKEN:
    raise ValueError("DISCORD_TOKEN غير موجود في البيئة")

PREFIX = os.getenv("PREFIX", "!")
OWNER_ID = int(os.getenv("OWNER_ID", "0"))  # اختياري، لمنع أي شخص من إيقاف البوت

# ====================== قاعدة البيانات (إعدادات لكل سيرفر) ======================
DB_PATH = "database.db"

def get_connection():
    return sqlite3.connect(DB_PATH)

def init_db():
    conn = get_connection()
    c = conn.cursor()
    # جداول البيانات الأساسية
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER,
        guild_id INTEGER,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        messages INTEGER DEFAULT 0,
        voice_time INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS economy (
        user_id INTEGER,
        guild_id INTEGER,
        balance INTEGER DEFAULT 0,
        bank INTEGER DEFAULT 0,
        daily_last TEXT,
        daily_streak INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS warns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        guild_id INTEGER,
        reason TEXT,
        moderator_id INTEGER,
        date TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id INTEGER,
        guild_id INTEGER,
        user_id INTEGER,
        status TEXT,
        created_at TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS reaction_roles (
        message_id INTEGER,
        guild_id INTEGER,
        role_id INTEGER,
        emoji TEXT,
        PRIMARY KEY (message_id, emoji)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS giveaways (
        message_id INTEGER PRIMARY KEY,
        guild_id INTEGER,
        channel_id INTEGER,
        prize TEXT,
        winner_count INTEGER,
        end_time TEXT,
        participants TEXT,
        ended INTEGER DEFAULT 0
    )''')
    
    # ========== جدول إعدادات السيرفر (هذا هو الحل السحري) ==========
    c.execute('''CREATE TABLE IF NOT EXISTS guild_config (
        guild_id INTEGER PRIMARY KEY,
        log_channel INTEGER,
        welcome_channel INTEGER,
        welcome_message TEXT,
        welcome_image_url TEXT,
        mute_role_id INTEGER,
        warn_mute_threshold INTEGER DEFAULT 3,
        warn_kick_threshold INTEGER DEFAULT 5,
        join_role_id INTEGER
    )''')
    
    # ========== جدول أدوار المستويات التلقائية ==========
    c.execute('''CREATE TABLE IF NOT EXISTS level_roles (
        guild_id INTEGER,
        level INTEGER,
        role_id INTEGER,
        PRIMARY KEY (guild_id, level)
    )''')
    
    conn.commit()
    conn.close()

init_db()

# ====================== دوال قاعدة البيانات المساعدة ======================
def execute_query(query, params=()):
    conn = get_connection()
    c = conn.cursor()
    c.execute(query, params)
    conn.commit()
    last_id = c.lastrowid
    conn.close()
    return last_id

def fetch_one(query, params=()):
    conn = get_connection()
    c = conn.cursor()
    c.execute(query, params)
    row = c.fetchone()
    conn.close()
    return row

def fetch_all(query, params=()):
    conn = get_connection()
    c = conn.cursor()
    c.execute(query, params)
    rows = c.fetchall()
    conn.close()
    return rows

# ====================== دوال الإعدادات ======================
def get_guild_config(guild_id):
    row = fetch_one("SELECT * FROM guild_config WHERE guild_id = ?", (guild_id,))
    if not row:
        # إنشاء إعدادات افتراضية فارغة
        execute_query("INSERT INTO guild_config (guild_id) VALUES (?)", (guild_id,))
        return {"guild_id": guild_id, "log_channel": None, "welcome_channel": None, "welcome_message": None, "welcome_image_url": None, "mute_role_id": None, "warn_mute_threshold": 3, "warn_kick_threshold": 5, "join_role_id": None}
    return {
        "guild_id": row[0],
        "log_channel": row[1],
        "welcome_channel": row[2],
        "welcome_message": row[3],
        "welcome_image_url": row[4],
        "mute_role_id": row[5],
        "warn_mute_threshold": row[6],
        "warn_kick_threshold": row[7],
        "join_role_id": row[8]
    }

def update_guild_config(guild_id, **kwargs):
    for key, value in kwargs.items():
        execute_query(f"UPDATE guild_config SET {key} = ? WHERE guild_id = ?", (value, guild_id))

# ====================== دوال مساعدة عامة ======================
def format_time(seconds):
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"

def get_level_xp(level):
    return (level + 1) * 100

def parse_duration(text):
    pattern = r'(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?'
    match = re.match(pattern, text)
    if not match:
        return None
    days, hours, minutes, seconds = map(lambda x: int(x) if x else 0, match.groups())
    return days*86400 + hours*3600 + minutes*60 + seconds

def embed_template(title, color=0x00ff00, description=None):
    embed = discord.Embed(title=title, color=color, description=description, timestamp=datetime.utcnow())
    return embed

# ====================== البوت ======================
intents = discord.Intents.all()
bot = commands.Bot(command_prefix=PREFIX, intents=intents, help_command=None)

# ====================== الكوجات المدمجة ======================

# --- 1. الإدارة والعقوبات ---
class Moderation(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command(name="حظر")
    @commands.has_permissions(ban_members=True)
    async def ban(self, ctx, member: discord.Member, *, reason="لا يوجد سبب"):
        await member.ban(reason=reason)
        embed = embed_template("✅ تم الحظر", 0xff0000, f"{member.mention} تم حظره بسبب: {reason}")
        await ctx.send(embed=embed)

    @commands.command(name="طرد")
    @commands.has_permissions(kick_members=True)
    async def kick(self, ctx, member: discord.Member, *, reason="لا يوجد سبب"):
        await member.kick(reason=reason)
        embed = embed_template("✅ تم الطرد", 0xff8800, f"{member.mention} تم طرده بسبب: {reason}")
        await ctx.send(embed=embed)

    @commands.command(name="كتم")
    @commands.has_permissions(manage_roles=True)
    async def mute(self, ctx, member: discord.Member, duration: str = "10m", *, reason="لا يوجد سبب"):
        secs = parse_duration(duration)
        if not secs:
            await ctx.send("⚠️ صيغة الوقت غير صحيحة. مثال: 1d2h30m")
            return
        config = get_guild_config(ctx.guild.id)
        mute_role = None
        if config["mute_role_id"]:
            mute_role = ctx.guild.get_role(config["mute_role_id"])
        if not mute_role:
            mute_role = discord.utils.get(ctx.guild.roles, name="Muted")
            if not mute_role:
                mute_role = await ctx.guild.create_role(name="Muted", permissions=discord.Permissions(send_messages=False))
                for channel in ctx.guild.channels:
                    await channel.set_permissions(mute_role, send_messages=False)
            update_guild_config(ctx.guild.id, mute_role_id=mute_role.id)
        await member.add_roles(mute_role, reason=reason)
        embed = embed_template("🔇 تم الكتم", 0xffaa00, f"{member.mention} كتم لمدة {duration} بسبب: {reason}")
        await ctx.send(embed=embed)
        await asyncio.sleep(secs)
        await member.remove_roles(mute_role)
        await ctx.send(f"🔊 {member.mention} تم فك الكتم تلقائياً.")

    @commands.command(name="تحذير")
    @commands.has_permissions(kick_members=True)
    async def warn(self, ctx, member: discord.Member, *, reason="لا يوجد سبب"):
        execute_query("INSERT INTO warns (user_id, guild_id, reason, moderator_id, date) VALUES (?, ?, ?, ?, ?)",
                      (member.id, ctx.guild.id, reason, ctx.author.id, str(ctx.message.created_at)))
        warns = fetch_one("SELECT COUNT(*) FROM warns WHERE user_id = ? AND guild_id = ?", (member.id, ctx.guild.id))[0]
        embed = embed_template("⚠️ تحذير", 0xffdd00, f"{member.mention} تم تحذيره بسبب: {reason}\nإجمالي التحذيرات: {warns}")
        await ctx.send(embed=embed)
        
        config = get_guild_config(ctx.guild.id)
        # عقوبات تلقائية
        if warns >= config["warn_kick_threshold"]:
            await member.kick(reason="تجاوز عدد التحذيرات المسموح")
            await ctx.send(f"🚫 {member.mention} تم طرده تلقائياً لتجاوز حد التحذيرات ({config['warn_kick_threshold']}).")
        elif warns >= config["warn_mute_threshold"]:
            mute_role = ctx.guild.get_role(config["mute_role_id"]) if config["mute_role_id"] else None
            if mute_role:
                await member.add_roles(mute_role, reason="تجاوز حد التحذيرات")
                await ctx.send(f"🔇 {member.mention} تم كتمه تلقائياً لتجاوز حد التحذيرات ({config['warn_mute_threshold']}).")

    @commands.command(name="مسح")
    @commands.has_permissions(manage_messages=True)
    async def clear(self, ctx, amount: int = 5):
        if amount > 1000:
            amount = 1000
        deleted = await ctx.channel.purge(limit=amount + 1)
        embed = embed_template("🗑️ مسح", 0x00ccff, f"تم مسح {len(deleted)-1} رسالة.")
        msg = await ctx.send(embed=embed)
        await asyncio.sleep(5)
        await msg.delete()

    @commands.command(name="قفل")
    @commands.has_permissions(manage_channels=True)
    async def lock(self, ctx, channel: discord.TextChannel = None):
        channel = channel or ctx.channel
        await channel.set_permissions(ctx.guild.default_role, send_messages=False)
        embed = embed_template("🔒 تم قفل القناة", 0xff0000, f"{channel.mention} مقفلة الآن.")
        await ctx.send(embed=embed)

    @commands.command(name="فتح")
    @commands.has_permissions(manage_channels=True)
    async def unlock(self, ctx, channel: discord.TextChannel = None):
        channel = channel or ctx.channel
        await channel.set_permissions(ctx.guild.default_role, send_messages=True)
        embed = embed_template("🔓 تم فتح القناة", 0x00ff00, f"{channel.mention} مفتوحة الآن.")
        await ctx.send(embed=embed)

# --- 2. الاقتصاد ---
class Economy(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    def get_economy(self, user_id, guild_id):
        row = fetch_one("SELECT balance, bank, daily_last, daily_streak FROM economy WHERE user_id = ? AND guild_id = ?", (user_id, guild_id))
        if not row:
            execute_query("INSERT INTO economy (user_id, guild_id) VALUES (?, ?)", (user_id, guild_id))
            return {"balance": 0, "bank": 0, "daily_last": None, "daily_streak": 0}
        return {"balance": row[0], "bank": row[1], "daily_last": row[2], "daily_streak": row[3]}

    def save_economy(self, user_id, guild_id, data):
        execute_query("UPDATE economy SET balance=?, bank=?, daily_last=?, daily_streak=? WHERE user_id=? AND guild_id=?",
                      (data["balance"], data["bank"], data["daily_last"], data["daily_streak"], user_id, guild_id))

    @commands.command(name="رصيد")
    async def balance(self, ctx, member: discord.Member = None):
        member = member or ctx.author
        eco = self.get_economy(member.id, ctx.guild.id)
        embed = embed_template(f"💰 رصيد {member.display_name}", 0xffd700, f"الرصيد: {eco['balance']}\nالمصرف: {eco['bank']}")
        await ctx.send(embed=embed)

    @commands.command(name="يومية")
    async def daily(self, ctx):
        eco = self.get_economy(ctx.author.id, ctx.guild.id)
        if eco["daily_last"]:
            last_time = datetime.fromisoformat(eco["daily_last"])
            if datetime.now() - last_time < timedelta(hours=24):
                remaining = timedelta(hours=24) - (datetime.now() - last_time)
                await ctx.send(f"⏳ متبقي: {str(remaining).split('.')[0]}")
                return
        reward = random.randint(200, 800)
        eco["balance"] += reward
        eco["daily_streak"] = (eco.get("daily_streak") or 0) + 1
        if eco["daily_streak"] % 7 == 0:
            eco["balance"] += 300
        eco["daily_last"] = str(datetime.now())
        self.save_economy(ctx.author.id, ctx.guild.id, eco)
        await ctx.send(f"🎁 حصلت على {reward} دولار! (تتابع: {eco['daily_streak']} يوم)")

    @commands.command(name="تحويل")
    async def transfer(self, ctx, member: discord.Member, amount: int):
        if amount <= 0:
            await ctx.send("⚠️ المبلغ موجب.")
            return
        sender = self.get_economy(ctx.author.id, ctx.guild.id)
        if sender["balance"] < amount:
            await ctx.send("⚠️ رصيدك غير كاف.")
            return
        receiver = self.get_economy(member.id, ctx.guild.id)
        sender["balance"] -= amount
        receiver["balance"] += amount
        self.save_economy(ctx.author.id, ctx.guild.id, sender)
        self.save_economy(member.id, ctx.guild.id, receiver)
        await ctx.send(f"✅ حولت {amount} دولار إلى {member.mention}")

    @commands.command(name="سرقة")
    async def rob(self, ctx, member: discord.Member):
        if member.id == ctx.author.id:
            await ctx.send("⚠️ لا تسرق نفسك!")
            return
        robber = self.get_economy(ctx.author.id, ctx.guild.id)
        victim = self.get_economy(member.id, ctx.guild.id)
        if victim["balance"] < 50:
            await ctx.send("👎 الضحية فقير، لا يستحق.")
            return
        if random.randint(1, 100) <= 35:
            stolen = random.randint(50, int(victim["balance"] * 0.3))
            robber["balance"] += stolen
            victim["balance"] -= stolen
            self.save_economy(ctx.author.id, ctx.guild.id, robber)
            self.save_economy(member.id, ctx.guild.id, victim)
            await ctx.send(f"😈 سرقت {stolen} دولار من {member.mention}!")
        else:
            fine = random.randint(20, 100)
            robber["balance"] -= fine
            self.save_economy(ctx.author.id, ctx.guild.id, robber)
            await ctx.send(f"😠 فشلت السرقة وغرّمك {fine} دولار.")

    @commands.command(name="مصرف")
    async def bank(self, ctx, amount: int):
        eco = self.get_economy(ctx.author.id, ctx.guild.id)
        if amount > eco["balance"] or amount < 0:
            await ctx.send("⚠️ رصيد غير كاف.")
            return
        eco["balance"] -= amount
        eco["bank"] += amount
        self.save_economy(ctx.author.id, ctx.guild.id, eco)
        await ctx.send(f"🏦 أودعت {amount} دولار في المصرف.")

    @commands.command(name="سحب")
    async def withdraw(self, ctx, amount: int):
        eco = self.get_economy(ctx.author.id, ctx.guild.id)
        if amount > eco["bank"] or amount < 0:
            await ctx.send("⚠️ رصيد مصرفي غير كاف.")
            return
        eco["balance"] += amount
        eco["bank"] -= amount
        self.save_economy(ctx.author.id, ctx.guild.id, eco)
        await ctx.send(f"🏦 سحبت {amount} دولار من المصرف.")

    @commands.command(name="متجر")
    async def shop(self, ctx):
        embed = embed_template("🛒 المتجر", 0x00ffaa, "قائمة المنتجات (افتراضية):")
        embed.add_field(name="🎖️ دور VIP", value="1000 دولار - `!شراء vip`", inline=False)
        embed.add_field(name="🎨 لون مخصص", value="500 دولار - `!شراء لون #FF00FF`", inline=False)
        await ctx.send(embed=embed)

    @commands.command(name="شراء")
    async def buy(self, ctx, item: str, *, extra=None):
        eco = self.get_economy(ctx.author.id, ctx.guild.id)
        item_lower = item.lower()
        if item_lower == "vip":
            if eco["balance"] < 1000:
                await ctx.send("⚠️ رصيدك غير كاف.")
                return
            role = discord.utils.get(ctx.guild.roles, name="VIP")
            if not role:
                role = await ctx.guild.create_role(name="VIP", color=discord.Color.gold())
            await ctx.author.add_roles(role)
            eco["balance"] -= 1000
            self.save_economy(ctx.author.id, ctx.guild.id, eco)
            await ctx.send("✅ تم شراء دور VIP!")
        elif item_lower == "لون" and extra:
            try:
                color = int(extra.strip("#"), 16)
                await ctx.author.edit(color=discord.Color(color))
                eco["balance"] -= 500
                self.save_economy(ctx.author.id, ctx.guild.id, eco)
                await ctx.send("✅ تم تغيير اللون!")
            except:
                await ctx.send("⚠️ صيغة اللون غير صحيحة. مثال: `!شراء لون #FF00FF`")
        else:
            await ctx.send("⚠️ هذا المنتج غير موجود.")

# --- 3. المستويات والخبرة ---
class Levels(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message):
        if message.author.bot or not message.guild:
            return
        user_id = message.author.id
        guild_id = message.guild.id
        row = fetch_one("SELECT xp, level FROM users WHERE user_id = ? AND guild_id = ?", (user_id, guild_id))
        if not row:
            execute_query("INSERT INTO users (user_id, guild_id) VALUES (?, ?)", (user_id, guild_id))
            xp, level = 0, 0
        else:
            xp, level = row
        xp_gain = random.randint(10, 25)
        xp += xp_gain
        required = get_level_xp(level)
        if xp >= required:
            level += 1
            xp = 0
            # مكافأة المستوى
            if level % 5 == 0:
                eco = fetch_one("SELECT balance FROM economy WHERE user_id = ? AND guild_id = ?", (user_id, guild_id))
                if eco:
                    new_bal = eco[0] + 300
                    execute_query("UPDATE economy SET balance=? WHERE user_id=? AND guild_id=?", (new_bal, user_id, guild_id))
                    try:
                        await message.author.send(f"🎉 مبروك مستوى {level}! حصلت على 300 دولار إضافية.")
                    except:
                        pass
            # أدوار المستويات التلقائية
            level_role = fetch_one("SELECT role_id FROM level_roles WHERE guild_id = ? AND level = ?", (guild_id, level))
            if level_role:
                role = message.guild.get_role(level_role[0])
                if role:
                    try:
                        await message.author.add_roles(role)
                    except:
                        pass
        execute_query("UPDATE users SET xp=?, level=?, messages=messages+1 WHERE user_id=? AND guild_id=?", (xp, level, user_id, guild_id))

    @commands.command(name="مستوى")
    async def level(self, ctx, member: discord.Member = None):
        member = member or ctx.author
        row = fetch_one("SELECT xp, level, messages FROM users WHERE user_id = ? AND guild_id = ?", (member.id, ctx.guild.id))
        if not row:
            xp, level, msgs = 0, 0, 0
        else:
            xp, level, msgs = row
        next_xp = get_level_xp(level)
        embed = embed_template(f"📊 مستوى {member.display_name}", 0x9b59b6)
        embed.add_field(name="المستوى", value=level)
        embed.add_field(name="XP", value=f"{xp}/{next_xp}")
        embed.add_field(name="الرسائل", value=msgs)
        await ctx.send(embed=embed)

    @commands.command(name="ترتيب")
    async def leaderboard(self, ctx):
        rows = fetch_all("SELECT user_id, level, xp FROM users WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10", (ctx.guild.id,))
        if not rows:
            await ctx.send("لا توجد بيانات.")
            return
        embed = embed_template("🏆 ترتيب المستويات", 0xffaa00)
        desc = ""
        for idx, (uid, lvl, xp) in enumerate(rows, 1):
            member = ctx.guild.get_member(uid)
            name = member.display_name if member else f"مستخدم {uid}"
            desc += f"#{idx} {name} - المستوى {lvl} (XP: {xp})\n"
        embed.description = desc
        await ctx.send(embed=embed)

# --- 4. التذاكر ---
class Tickets(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command(name="تذكرة")
    async def ticket(self, ctx, *, reason="طلب دعم"):
        overwrites = {
            ctx.guild.default_role: discord.PermissionOverwrite(read_messages=False),
            ctx.author: discord.PermissionOverwrite(read_messages=True, send_messages=True),
            ctx.guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True)
        }
        channel = await ctx.guild.create_text_channel(f"تذكرة-{ctx.author.name}", overwrites=overwrites)
        await channel.send(f"{ctx.author.mention} مرحباً! تم إنشاء تذكرتك. السبب: {reason}\nاستخدم `!إغلاق` لإغلاقها.")
        execute_query("INSERT INTO tickets (channel_id, guild_id, user_id, status, created_at) VALUES (?, ?, ?, ?, ?)",
                      (channel.id, ctx.guild.id, ctx.author.id, "مفتوحة", str(ctx.message.created_at)))
        await ctx.send(f"✅ تم إنشاء تذكرتك في {channel.mention}")

    @commands.command(name="إغلاق")
    @commands.has_permissions(manage_channels=True)
    async def close_ticket(self, ctx, channel: discord.TextChannel = None):
        channel = channel or ctx.channel
        if "تذكرة" not in channel.name:
            await ctx.send("⚠️ هذه ليست قناة تذكرة.")
            return
        await channel.delete()
        execute_query("UPDATE tickets SET status='مغلقة' WHERE channel_id=?", (channel.id,))

# --- 5. الهدايا التلقائية ---
class Giveaways(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.bot.loop.create_task(self.check_giveaways())

    @commands.command(name="هدية")
    @commands.has_permissions(administrator=True)
    async def giveaway(self, ctx, duration: str, winners: int, *, prize: str):
        secs = parse_duration(duration)
        if not secs:
            await ctx.send("⚠️ صيغة غير صحيحة. مثال: 1d2h30m")
            return
        embed = embed_template(f"🎁 هدية: {prize}", 0xff69b4, f"الرابحون: {winners}")
        embed.set_footer(text=f"انتهى بعد {duration}")
        msg = await ctx.send(embed=embed)
        await msg.add_reaction("🎉")
        end_time = datetime.utcnow() + timedelta(seconds=secs)
        execute_query("INSERT INTO giveaways (message_id, guild_id, channel_id, prize, winner_count, end_time, participants, ended) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                      (msg.id, ctx.guild.id, ctx.channel.id, prize, winners, str(end_time), "", 0))

    async def check_giveaways(self):
        await self.bot.wait_until_ready()
        while not self.bot.is_closed():
            now = datetime.utcnow()
            rows = fetch_all("SELECT message_id, channel_id, prize, winner_count, end_time FROM giveaways WHERE ended=0")
            for row in rows:
                msg_id, ch_id, prize, winners, end_time_str = row
                end_time = datetime.fromisoformat(end_time_str)
                if now >= end_time:
                    channel = self.bot.get_channel(ch_id)
                    if channel:
                        try:
                            msg = await channel.fetch_message(msg_id)
                            if msg.reactions:
                                reaction = msg.reactions[0]
                                users = await reaction.users().flatten()
                                users = [u for u in users if not u.bot]
                                if users:
                                    selected = random.sample(users, min(winners, len(users)))
                                    await channel.send(f"🎉 الفائزون في هدية **{prize}**: {', '.join([u.mention for u in selected])}")
                                else:
                                    await channel.send(f"⚠️ لا يوجد مشاركون في هدية **{prize}**.")
                            else:
                                await channel.send(f"⚠️ لم يتم العثور على تفاعلات في هدية **{prize}**.")
                            execute_query("UPDATE giveaways SET ended=1 WHERE message_id=?", (msg_id,))
                        except Exception as e:
                            print(f"خطأ في الهدية: {e}")
            await asyncio.sleep(60)

# --- 6. الأدوار التفاعلية ---
class ReactionRoles(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_raw_reaction_add(self, payload):
        if payload.user_id == self.bot.user.id:
            return
        row = fetch_one("SELECT role_id FROM reaction_roles WHERE message_id=? AND emoji=?", (payload.message_id, payload.emoji.name))
        if row:
            guild = self.bot.get_guild(payload.guild_id)
            if guild:
                role = guild.get_role(row[0])
                if role:
                    member = guild.get_member(payload.user_id)
                    if member:
                        await member.add_roles(role)

    @commands.Cog.listener()
    async def on_raw_reaction_remove(self, payload):
        row = fetch_one("SELECT role_id FROM reaction_roles WHERE message_id=? AND emoji=?", (payload.message_id, payload.emoji.name))
        if row:
            guild = self.bot.get_guild(payload.guild_id)
            if guild:
                role = guild.get_role(row[0])
                if role:
                    member = guild.get_member(payload.user_id)
                    if member:
                        await member.remove_roles(role)

    @commands.command(name="ردود")
    @commands.has_permissions(administrator=True)
    async def add_reaction_role(self, ctx, message_id: int, role: discord.Role, emoji: str):
        try:
            msg = await ctx.channel.fetch_message(message_id)
            await msg.add_reaction(emoji)
            execute_query("INSERT INTO reaction_roles (message_id, guild_id, role_id, emoji) VALUES (?, ?, ?, ?)",
                          (message_id, ctx.guild.id, role.id, emoji))
            await ctx.send(f"✅ تم إضافة الدور {role.name} على الإيموجي {emoji}.")
        except Exception as e:
            await ctx.send(f"⚠️ فشل: {e}")

# --- 7. السجلات ---
class Logging(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_message_delete(self, message):
        if message.author.bot or not message.guild:
            return
        config = get_guild_config(message.guild.id)
        if not config["log_channel"]:
            return
        channel = self.bot.get_channel(config["log_channel"])
        if channel:
            embed = discord.Embed(title="🗑️ حذف رسالة", color=0xff0000, timestamp=message.created_at)
            embed.add_field(name="المستخدم", value=message.author.mention)
            embed.add_field(name="المحتوى", value=message.content[:1000] or "غير مرئي")
            embed.add_field(name="القناة", value=message.channel.mention)
            await channel.send(embed=embed)

    @commands.Cog.listener()
    async def on_member_join(self, member):
        config = get_guild_config(member.guild.id)
        if config["welcome_channel"]:
            channel = self.bot.get_channel(config["welcome_channel"])
            if channel:
                embed = discord.Embed(title="👋 مرحباً!", description=config["welcome_message"] or f"أهلاً {member.mention} في السيرفر!", color=0x00ff00, timestamp=member.joined_at)
                if config["welcome_image_url"]:
                    embed.set_image(url=config["welcome_image_url"])
                embed.set_thumbnail(url=member.avatar.url if member.avatar else member.default_avatar.url)
                await channel.send(embed=embed)
        if config["join_role_id"]:
            role = member.guild.get_role(config["join_role_id"])
            if role:
                try:
                    await member.add_roles(role)
                except:
                    pass
        # سجل الدخول
        if config["log_channel"]:
            log_ch = self.bot.get_channel(config["log_channel"])
            if log_ch:
                embed = discord.Embed(title="👤 عضو جديد", color=0x00ff00, timestamp=member.joined_at)
                embed.set_thumbnail(url=member.avatar.url if member.avatar else member.default_avatar.url)
                embed.add_field(name="الاسم", value=member.mention)
                embed.add_field(name="العضويات", value=len(member.guild.members))
                await log_ch.send(embed=embed)

# --- 8. الترفيه ---
class Fun(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command(name="بينق")
    async def ping(self, ctx):
        await ctx.send(f"🏓 البينق: {round(self.bot.latency * 1000)}ms")

    @commands.command(name="سيرفر")
    async def server_info(self, ctx):
        embed = discord.Embed(title=ctx.guild.name, color=0x2ecc71)
        embed.add_field(name="👥 الأعضاء", value=ctx.guild.member_count)
        embed.add_field(name="💬 القنوات", value=len(ctx.guild.channels))
        embed.add_field(name="👑 المالك", value=ctx.guild.owner.mention)
        embed.add_field(name="📅 أنشئ", value=ctx.guild.created_at.strftime("%Y-%m-%d"))
        await ctx.send(embed=embed)

    @commands.command(name="صورة")
    async def image(self, ctx):
        async with aiohttp.ClientSession() as session:
            async with session.get("https://picsum.photos/400/300") as resp:
                if resp.status == 200:
                    await ctx.send(str(resp.url))

    @commands.command(name="اقتباس")
    async def quote(self, ctx):
        quotes = [
            "النجاح ليس نهائياً، الفشل ليس قاتلاً، الشجاعة للاستمرار هي التي تهم.",
            "كن أنت التغيير الذي تريد رؤيته في العالم.",
            "المستقبل ملك لأولئك الذين يؤمنون بجمال أحلامهم."
        ]
        await ctx.send(random.choice(quotes))

    @commands.command(name="رمية")
    async def dice(self, ctx):
        await ctx.send(f"🎲 النتيجة: {random.randint(1, 6)}")

# --- 9. أوامر إعدادات السيرفر (خرافية) ---
class ServerConfig(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.group(name="تعيين", invoke_without_command=True)
    @commands.has_permissions(administrator=True)
    async def set_group(self, ctx):
        embed = embed_template("⚙️ أوامر الإعدادات", 0x00ccff)
        embed.add_field(name="سجلات", value="`!تعيين سجلات #قناة`", inline=False)
        embed.add_field(name="ترحيب", value="`!تعيين ترحيب #قناة`", inline=False)
        embed.add_field(name="رسالة ترحيب", value="`!تعيين رسالة_ترحيب النص`", inline=False)
        embed.add_field(name="صورة ترحيب", value="`!تعيين صورة_ترحيب رابط_الصورة`", inline=False)
        embed.add_field(name="دور كتم", value="`!تعيين دور_كتم @الدور`", inline=False)
        embed.add_field(name="دور دخول", value="`!تعيين دور_دخول @الدور`", inline=False)
        embed.add_field(name="حد تحذير للكتم", value="`!تعيين حد_كتم عدد`", inline=False)
        embed.add_field(name="حد تحذير للطرد", value="`!تعيين حد_طرد عدد`", inline=False)
        embed.add_field(name="رتبة مستوى", value="`!تعيين رتبة_مستوى المستوى @الدور`", inline=False)
        embed.add_field(name="حذف رتبة مستوى", value="`!تعيين حذف_رتبة_مستوى المستوى`", inline=False)
        await ctx.send(embed=embed)

    @set_group.command(name="سجلات")
    async def set_log(self, ctx, channel: discord.TextChannel):
        update_guild_config(ctx.guild.id, log_channel=channel.id)
        await ctx.send(f"✅ تم تعيين قناة السجلات إلى {channel.mention}")

    @set_group.command(name="ترحيب")
    async def set_welcome(self, ctx, channel: discord.TextChannel):
        update_guild_config(ctx.guild.id, welcome_channel=channel.id)
        await ctx.send(f"✅ تم تعيين قناة الترحيب إلى {channel.mention}")

    @set_group.command(name="رسالة_ترحيب")
    async def set_welcome_msg(self, ctx, *, message: str):
        update_guild_config(ctx.guild.id, welcome_message=message)
        await ctx.send(f"✅ تم تعيين رسالة الترحيب: {message}")

    @set_group.command(name="صورة_ترحيب")
    async def set_welcome_img(self, ctx, url: str):
        update_guild_config(ctx.guild.id, welcome_image_url=url)
        await ctx.send(f"✅ تم تعيين صورة الترحيب: {url}")

    @set_group.command(name="دور_كتم")
    async def set_mute_role(self, ctx, role: discord.Role):
        update_guild_config(ctx.guild.id, mute_role_id=role.id)
        await ctx.send(f"✅ تم تعيين دور الكتم إلى {role.mention}")

    @set_group.command(name="دور_دخول")
    async def set_join_role(self, ctx, role: discord.Role):
        update_guild_config(ctx.guild.id, join_role_id=role.id)
        await ctx.send(f"✅ تم تعيين دور الدخول إلى {role.mention}")

    @set_group.command(name="حد_كتم")
    async def set_mute_threshold(self, ctx, number: int):
        update_guild_config(ctx.guild.id, warn_mute_threshold=number)
        await ctx.send(f"✅ تم تعيين حد التحذير للكتم إلى {number}")

    @set_group.command(name="حد_طرد")
    async def set_kick_threshold(self, ctx, number: int):
        update_guild_config(ctx.guild.id, warn_kick_threshold=number)
        await ctx.send(f"✅ تم تعيين حد التحذير للطرد إلى {number}")

    @set_group.command(name="رتبة_مستوى")
    async def set_level_role(self, ctx, level: int, role: discord.Role):
        execute_query("INSERT OR REPLACE INTO level_roles (guild_id, level, role_id) VALUES (?, ?, ?)", (ctx.guild.id, level, role.id))
        await ctx.send(f"✅ تم تعيين دور {role.mention} عند المستوى {level}")

    @set_group.command(name="حذف_رتبة_مستوى")
    async def remove_level_role(self, ctx, level: int):
        execute_query("DELETE FROM level_roles WHERE guild_id = ? AND level = ?", (ctx.guild.id, level))
        await ctx.send(f"✅ تم حذف رتبة المستوى {level}")

# --- 10. أوامر المالك ---
class Admin(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command(name="إيقاف")
    @commands.is_owner()
    async def shutdown(self, ctx):
        await ctx.send("🛑 جاري الإيقاف...")
        await self.bot.close()

# ====================== تحميل الكوجات ======================
bot.add_cog(Moderation(bot))
bot.add_cog(Economy(bot))
bot.add_cog(Levels(bot))
bot.add_cog(Tickets(bot))
bot.add_cog(Giveaways(bot))
bot.add_cog(ReactionRoles(bot))
bot.add_cog(Logging(bot))
bot.add_cog(Fun(bot))
bot.add_cog(ServerConfig(bot))
bot.add_cog(Admin(bot))

# ====================== أمر المساعدة الرئيسي ======================
@bot.command(name="مساعدة")
async def help_command(ctx):
    embed = discord.Embed(title="📖 قائمة الأوامر الرئيسية", color=0x00ff00)
    embed.add_field(name="🛡️ إدارة", value="`حظر` `طرد` `كتم` `تحذير` `مسح` `قفل` `فتح`", inline=False)
    embed.add_field(name="💰 اقتصاد", value="`رصيد` `يومية` `تحويل` `سرقة` `مصرف` `سحب` `متجر` `شراء`", inline=False)
    embed.add_field(name="📊 مستويات", value="`مستوى` `ترتيب`", inline=False)
    embed.add_field(name="🎫 تذاكر", value="`تذكرة` `إغلاق`", inline=False)
    embed.add_field(name="🎁 هدايا", value="`هدية` (للمشرفين)", inline=False)
    embed.add_field(name="🎭 أدوار تفاعلية", value="`ردود` (للمشرفين)", inline=False)
    embed.add_field(name="⚙️ إعدادات السيرفر", value="`تعيين` (للمشرفين)", inline=False)
    embed.add_field(name="🎮 ترفيه", value="`بينق` `سيرفر` `صورة` `اقتباس` `رمية`", inline=False)
    embed.set_footer(text=f"البادئة: {PREFIX}")
    await ctx.send(embed=embed)

# ====================== حدث الجاهزية ======================
@bot.event
async def on_ready():
    print(f"✅ البوت جاهز باسم {bot.user} (ID: {bot.user.id})")
    await bot.change_presence(activity=discord.Activity(type=discord.ActivityType.watching, name=f"{PREFIX}مساعدة | {len(bot.guilds)} سيرفر"))

# ====================== تشغيل البوت ======================
if __name__ == "__main__":
    bot.run(TOKEN)
