const mineflayer     = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const pvp            = require('mineflayer-pvp').plugin
const armorManager   = require('mineflayer-armor-manager')
const Groq           = require('groq-sdk')

/* ============================================================
   CONFIG
   ============================================================ */
const HOST     = 'YOUR_SERVER_IP'
const PORT     = 25565
const USERNAME = 'YoriAI'               // ← bot name
const PASSWORD = 'Passing67'
const OWNER    = 'SparkyNox'            // only owner gets Groq AI replies
const PREFIX   = '@YoriAI'             // prefix to talk to bot

const GROQ_API_KEY = 'your_api_key'  // ← CHANGE THIS
const GROQ_MODEL   = 'llama-3.1-8b-instant'

const SPAWN_CHAT_DELAY = 5000   // 5s delay after spawn before any chat
const ARMOR_EQUIP_DELAY = 6000  // 6s delay for auto armor loop
/* ============================================================ */

const groq = new Groq({ apiKey: GROQ_API_KEY })

let bot
let guardPos    = null
let isDead      = false
let chatHistory = []

/* ── Groq AI ─────────────────────────────────────────────── */

async function askGroq(userMsg) {
  const system = `You are YoriAI, a cute and helpful Minecraft bot.
Your owner is ${OWNER}. Respond in max 2 short sentences, friendly tone.`

  chatHistory.push({ role: 'user', content: userMsg })
  if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20)

  try {
    const res = await groq.chat.completions.create({
      model:      GROQ_MODEL,
      messages:   [{ role: 'system', content: system }, ...chatHistory],
      max_tokens: 100,
    })
    const reply = res.choices[0]?.message?.content?.trim() || 'Hmm, not sure!'
    chatHistory.push({ role: 'assistant', content: reply })
    return reply
  } catch (e) {
    console.log('[GROQ ERROR]', e.message)
    return 'My brain glitched! Try again.'
  }
}

/* ── Auto Eat ────────────────────────────────────────────── */

const FOOD_PRIORITY = [
  'cooked_beef','cooked_porkchop','cooked_chicken','cooked_mutton',
  'cooked_rabbit','cooked_cod','cooked_salmon','bread','carrot',
  'baked_potato','apple','golden_apple','enchanted_golden_apple',
  'pumpkin_pie','cookie','melon_slice','dried_kelp',
  'beef','porkchop','chicken','potato',
]

async function tryEat() {
  for (const foodName of FOOD_PRIORITY) {
    const item = bot.inventory.items().find(i => i.name === foodName)
    if (item) {
      try {
        await bot.equip(item, 'hand')
        await bot.consume()
        console.log(`[EAT] Ate ${foodName}`)
        return
      } catch (_) {}
    }
  }
}

function startAutoEat() {
  bot.on('health', async () => {
    // Eat when food ≤ 14 (7 shanks) OR health ≤ 8 (4 hearts)
    if (bot.food <= 14 || bot.health <= 8) {
      await tryEat()
    }
  })
}

/* ── Auto Armor loop (6s delay) ──────────────────────────── */

function startAutoArmor() {
  setInterval(async () => {
    if (isDead) return
    try {
      await bot.armorManager.equipAll()
    } catch (_) {}
  }, ARMOR_EQUIP_DELAY)
}

/* ── Hit detection → fight back + follow attacker ───────── */

function setupHitBack() {
  bot.on('entityHurt', (entity) => {
    // Only care if the hurt entity is the bot itself
    if (entity !== bot.entity) return

    // Find who hit us — nearest player or mob that isn't us
    const attacker = bot.nearestEntity(e =>
      e !== bot.entity &&
      (e.type === 'player' || e.type === 'mob') &&
      e.position.distanceTo(bot.entity.position) < 8
    )

    if (attacker) {
      console.log(`[PVP] Hit by ${attacker.username || attacker.name} — fighting back!`)
      bot.pvp.attack(attacker)

      // Also pathfind to follow attacker so we stay in range
      const move = new Movements(bot)
      bot.pathfinder.setMovements(move)
      bot.pathfinder.setGoal(new goals.GoalFollow(attacker, 1), true)
    }
  })
}

/* ── startBot ────────────────────────────────────────────── */

function startBot() {
  bot = mineflayer.createBot({
    host:      HOST,
    port:      PORT,
    username:  USERNAME,
    logErrors: false,
  })

  bot.loadPlugin(pvp)
  bot.loadPlugin(pathfinder)
  bot.loadPlugin(armorManager)

  /* ── SPAWN ─────────────────────────────────────────────── */

  bot.on('spawn', () => {
    isDead = false
    console.log('[BOT] Spawned — waiting 5s before chat...')

    // ALL spawn chat delayed by 5s
    setTimeout(() => {
      bot.chat(`/register ${PASSWORD} ${PASSWORD}`)

      setTimeout(() => {
        bot.chat(`/login ${PASSWORD}`)

        setTimeout(() => {
          bot.chat(`/skin https://textures.minecraft.net/texture/c0d467cf5224b9426091ad8036dfa01ce1b9a731c686481d084fb08cfa9dd32b`)

          setTimeout(() => {
            bot.chat('YoriAI is Online ✨')
          }, 1500)

        }, 1500)
      }, 3000)  // /login 3s after /register

    }, SPAWN_CHAT_DELAY)  // 5s after spawn

    // Start loops once spawned
    startAutoEat()
    startAutoArmor()
    setupHitBack()
  })

  /* ── DEATH ─────────────────────────────────────────────── */

  bot.on('death', () => {
    isDead = true
    console.log('[BOT] Died → respawning')
    setTimeout(() => bot.respawn(), 1500)
  })

  /* ── CHAT COMMANDS ─────────────────────────────────────── */

  bot.on('chat', async (username, rawMessage) => {
    if (isDead) return
    if (username === bot.username) return

    const message = rawMessage.trim()
    const lower   = message.toLowerCase()
    const player  = bot.players[username]

    /* ── @YoriAI prefix → Groq AI reply ─────────────────── */
    if (message.startsWith(PREFIX)) {
      const query = message.slice(PREFIX.length).trim()
      if (!query) return
      console.log(`[GROQ] ${username}: ${query}`)
      const reply = await askGroq(query)
      bot.chat(reply)
      return
    }

    /* ── Normal commands (anyone can use) ───────────────── */

    if (lower === 'armor' || lower === 'equip armor') {
      bot.chat('🛡️ Equipping best armor...')
      setTimeout(async () => {
        try {
          await bot.armorManager.equipAll()
          bot.chat('✅ Armor equipped!')
        } catch (e) {
          bot.chat('Could not equip armor.')
          console.log('[ARMOR ERR]', e.message)
        }
      }, 500)  // tiny delay so inventory is ready
      return
    }

    if (lower === 'guard') {
      if (!player?.entity) return
      bot.chat('Guarding. 🛡️')
      guardPos = player.entity.position.clone()
      const move = new Movements(bot)
      bot.pathfinder.setMovements(move)
      bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z))
      return
    }

    if (lower === 'fight me') {
      if (!player?.entity) return
      bot.chat('Come. ⚔️')
      bot.pvp.attack(player.entity)
      return
    }

    if (lower === 'follow me' || lower === 'come') {
      if (!player?.entity) return
      bot.chat('Following you! 🏃')
      const move = new Movements(bot)
      bot.pathfinder.setMovements(move)
      bot.pathfinder.setGoal(new goals.GoalFollow(player.entity, 2), true)
      return
    }

    if (lower === 'stop') {
      bot.chat('Stopped. ⏹️')
      guardPos = null
      bot.pvp.stop()
      bot.pathfinder.setGoal(null)
      return
    }

    if (lower === 'status') {
      bot.chat(`💓 HP: ${bot.health}/20 | 🍗 Food: ${bot.food}/20`)
      return
    }

  })

  /* ── GUARD LOOP (physicTick) ───────────────────────────── */

  bot.on('physicTick', () => {
    if (!guardPos || bot.pvp.target || isDead) return
    const mob = bot.nearestEntity(e =>
      e.type === 'mob' &&
      e.position.distanceTo(bot.entity.position) < 16
    )
    if (mob) bot.pvp.attack(mob)
  })

  /* ── RECONNECT ─────────────────────────────────────────── */

  bot.on('end', () => {
    console.log('[BOT] Disconnected → reconnecting in 8s')
    setTimeout(startBot, 8000)
  })

  bot.on('kicked', r => {
    console.log('[BOT] Kicked:', r)
    setTimeout(startBot, 8000)
  })

  bot.on('error', e => console.log('[BOT] Error:', e.message))
}

/* ── Hard crash protection ───────────────────────────────── */

process.on('unhandledRejection', e => console.log('[UNHANDLED]', e))
process.on('uncaughtException',  e => console.log('[CRASH]', e))

startBot()
