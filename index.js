// ============================================================
//  Yori — Minecraft Bot
//  • Groq AI brain (chat + movement + task control)
//  • Prefix '!' commands
//  • Owner-only: SparkyNox
//  • Cracked / Offline server support
//  • Diamond mining, pathfinding tasks
//  • PvP KillAura (test mode)
//  • Auto Armor equip (3-5s delay)
//  • Auto Eat when hungry / low HP
//  • Run away when starving + low HP
// ============================================================

const mineflayer        = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalNear, GoalBlock, GoalFollow, GoalXZ } = goals;
const mineflayerViewer  = require('prismarine-viewer').mineflayer;
const Groq              = require('groq-sdk');
const Vec3              = require('vec3');

// ══════════════════════════════════════════════════════════
//  🔧  CONFIG — Edit this section
// ══════════════════════════════════════════════════════════
const CONFIG = {
  // ── Minecraft server ──────────────────────────────────
  host:    'localhost',       // server IP
  port:    25565,             // server port
  version: '1.20.1',         // MC version (match your server)

  // ── Bot account (cracked / offline mode) ─────────────
  botName:    'Yori',
  auth:       'offline',      // 'offline' = cracked server

  // ── Owner (only this player can command the bot) ──────
  owner: 'SparkyNox',

  // ── Command prefix ────────────────────────────────────
  prefix: '!',

  // ── Groq API ──────────────────────────────────────────
  groqApiKey: 'YOUR_GROQ_API_KEY_HERE',   // ← CHANGE THIS
  groqModel:  'llama-3.1-8b-instant',

  // ── Auto-eat thresholds ───────────────────────────────
  eatFoodPoints:  14,   // eat when food ≤ 14 (7 shanks)
  eatHealthHP:    8,    // eat when hp ≤ 8  (4 hearts)

  // ── Run-away thresholds (no food + low HP) ────────────
  runAwayHP:      6,    // run if hp ≤ 6 AND no food
  runAwayDist:    32,   // blocks to run away

  // ── PvP KillAura ─────────────────────────────────────
  killAuraRange:  4.0,  // attack radius (blocks)
  killAuraDelay:  800,  // ms between swings

  // ── Auto armor delay (ms) ─────────────────────────────
  armorDelayMin:  3000,
  armorDelayMax:  5000,
};
// ══════════════════════════════════════════════════════════

// ─── Groq client ──────────────────────────────────────────
const groq = new Groq({ apiKey: CONFIG.groqApiKey });

// ─── Bot state ────────────────────────────────────────────
let bot;
let killAuraEnabled  = false;
let killAuraInterval = null;
let isMining         = false;
let isRunningAway    = false;
let taskActive       = false;
let chatHistory      = [];   // Groq conversation context

// ─── Utilities ────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function isOwner(username) {
  return username === CONFIG.owner;
}

// ─── Groq AI ──────────────────────────────────────────────

async function askGroq(userMsg, systemExtra = '') {
  const system = `You are Yori, a helpful and cute Minecraft bot AI assistant.
Your owner is SparkyNox. You help with Minecraft tasks.
Respond concisely (max 2 sentences) in a friendly tone.
${systemExtra}`;

  chatHistory.push({ role: 'user', content: userMsg });
  if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20); // keep context window manageable

  try {
    const res = await groq.chat.completions.create({
      model:    CONFIG.groqModel,
      messages: [{ role: 'system', content: system }, ...chatHistory],
      max_tokens: 120,
    });
    const reply = res.choices[0]?.message?.content?.trim() || 'Hmm, I\'m not sure!';
    chatHistory.push({ role: 'assistant', content: reply });
    return reply;
  } catch (e) {
    log(`Groq error: ${e.message}`);
    return 'My brain glitched! Try again.';
  }
}

// Ask Groq to parse a task command and return structured JSON
async function parseTaskCommand(command) {
  const prompt = `Parse this Minecraft bot command into JSON. Reply ONLY with raw JSON, no markdown.
Command: "${command}"

JSON format:
{
  "action": "mine" | "goto" | "follow" | "collect" | "attack" | "stop" | "chat" | "other",
  "target": "<block/mob/player name or null>",
  "amount": <number or null>,
  "message": "<if action is chat, the message to say>"
}

Examples:
"mine some diamonds" → {"action":"mine","target":"diamond_ore","amount":10,"message":null}
"go to spawn" → {"action":"goto","target":"spawn","amount":null,"message":null}
"follow me" → {"action":"follow","target":"player","amount":null,"message":null}
"collect 32 wood" → {"action":"collect","target":"log","amount":32,"message":null}
"stop" → {"action":"stop","target":null,"amount":null,"message":null}`;

  try {
    const res = await groq.chat.completions.create({
      model:    CONFIG.groqModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
    });
    const raw = res.choices[0]?.message?.content?.trim() || '{}';
    return JSON.parse(raw);
  } catch (e) {
    log(`Task parse error: ${e.message}`);
    return { action: 'other', target: null, amount: null };
  }
}

// ─── Mining ───────────────────────────────────────────────

const ORE_MAP = {
  diamond:   ['diamond_ore', 'deepslate_diamond_ore'],
  iron:      ['iron_ore',    'deepslate_iron_ore'],
  gold:      ['gold_ore',    'deepslate_gold_ore'],
  coal:      ['coal_ore',    'deepslate_coal_ore'],
  emerald:   ['emerald_ore', 'deepslate_emerald_ore'],
  redstone:  ['redstone_ore','deepslate_redstone_ore'],
  lapis:     ['lapis_ore',   'deepslate_lapis_ore'],
  netherite: ['ancient_debris'],
  default:   ['diamond_ore', 'deepslate_diamond_ore'],
};

function getOreNames(target) {
  const t = (target || '').toLowerCase();
  for (const [key, val] of Object.entries(ORE_MAP)) {
    if (t.includes(key)) return val;
  }
  // maybe it's already a block name
  if (t.includes('_ore') || t.includes('debris') || t.includes('log') || t.includes('stone')) {
    return [t];
  }
  return ORE_MAP.default;
}

async function mineBlock(blockName) {
  const block = bot.findBlock({
    matching: b => b.name === blockName,
    maxDistance: 32,
  });
  if (!block) return false;

  const defaultMove = new Movements(bot);
  bot.pathfinder.setMovements(defaultMove);

  try {
    await bot.pathfinder.goto(new GoalBlock(block.position.x, block.position.y, block.position.z));
    await bot.dig(block);
    return true;
  } catch (e) {
    log(`Mine error: ${e.message}`);
    return false;
  }
}

async function startMining(target, amount = 10) {
  if (isMining) return;
  isMining   = true;
  taskActive = true;

  const oreNames = getOreNames(target);
  let mined      = 0;

  bot.chat(`⛏️ Mining ${amount}x ${target}! Hold on...`);
  log(`Mining started: ${oreNames.join(', ')} x${amount}`);

  while (isMining && mined < amount) {
    if (isRunningAway) { await sleep(1000); continue; }

    let found = false;
    for (const oreName of oreNames) {
      if (await mineBlock(oreName)) {
        mined++;
        log(`Mined ${mined}/${amount} ${oreName}`);
        if (mined % 5 === 0) bot.chat(`⛏️ Mined ${mined}/${amount}...`);
        found = true;
        break;
      }
    }

    if (!found) {
      // Wander a bit to find more ores
      bot.chat('🔍 Looking for more ores...');
      try {
        const pos = bot.entity.position;
        const wx  = pos.x + randInt(-16, 16);
        const wz  = pos.z + randInt(-16, 16);
        await bot.pathfinder.goto(new GoalXZ(wx, wz));
      } catch (_) {}
      await sleep(2000);
    }
  }

  isMining   = false;
  taskActive = false;
  if (mined >= amount) {
    bot.chat(`✅ Done! Mined ${mined}x ${target} for you, ${CONFIG.owner}!`);
  }
}

// ─── PvP KillAura ─────────────────────────────────────────

function startKillAura() {
  if (killAuraInterval) return;
  killAuraEnabled  = true;

  killAuraInterval = setInterval(() => {
    if (!killAuraEnabled) return;

    const entities = Object.values(bot.entities).filter(e =>
      e !== bot.entity &&
      e.type === 'mob' || (e.type === 'player' && e.username !== CONFIG.owner)
    );

    const nearest = entities
      .filter(e => bot.entity.position.distanceTo(e.position) <= CONFIG.killAuraRange)
      .sort((a, b) =>
        bot.entity.position.distanceTo(a.position) -
        bot.entity.position.distanceTo(b.position)
      )[0];

    if (nearest) {
      bot.lookAt(nearest.position.offset(0, nearest.height / 2, 0));
      bot.attack(nearest);
      log(`KillAura: attacked ${nearest.name || nearest.username || 'entity'}`);
    }
  }, CONFIG.killAuraDelay);

  log('KillAura enabled');
}

function stopKillAura() {
  killAuraEnabled = false;
  if (killAuraInterval) {
    clearInterval(killAuraInterval);
    killAuraInterval = null;
  }
  log('KillAura disabled');
}

// ─── Auto Armor ───────────────────────────────────────────

async function equipBestArmor() {
  const slots = {
    head:  ['helmet'],
    chest: ['chestplate'],
    legs:  ['leggings'],
    feet:  ['boots'],
  };

  const armorTiers = ['netherite', 'diamond', 'iron', 'golden', 'chainmail', 'leather'];

  for (const [slot, keywords] of Object.entries(slots)) {
    for (const tier of armorTiers) {
      const item = bot.inventory.items().find(i =>
        keywords.some(k => i.name.includes(k)) && i.name.includes(tier)
      );
      if (item) {
        try {
          await bot.equip(item, slot);
          log(`Equipped ${item.name} on ${slot}`);
          await sleep(randInt(CONFIG.armorDelayMin, CONFIG.armorDelayMax));
        } catch (e) {
          log(`Armor equip error: ${e.message}`);
        }
        break;
      }
    }
  }
}

async function autoArmorLoop() {
  while (true) {
    await sleep(10000);
    try { await equipBestArmor(); } catch (_) {}
  }
}

// ─── Auto Eat ─────────────────────────────────────────────

const FOOD_ITEMS = [
  'cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'cooked_mutton',
  'cooked_rabbit', 'cooked_cod', 'cooked_salmon', 'bread', 'carrot',
  'baked_potato', 'apple', 'golden_apple', 'enchanted_golden_apple',
  'pumpkin_pie', 'cookie', 'melon_slice', 'dried_kelp', 'suspicious_stew',
  'mushroom_stew', 'rabbit_stew', 'beef', 'porkchop', 'chicken', 'potato',
];

async function eatFood() {
  for (const foodName of FOOD_ITEMS) {
    const item = bot.inventory.items().find(i => i.name === foodName);
    if (item) {
      try {
        await bot.equip(item, 'hand');
        await bot.consume();
        log(`Ate ${foodName}`);
        return true;
      } catch (e) {
        log(`Eat error: ${e.message}`);
      }
    }
  }
  return false;
}

function hasFood() {
  return FOOD_ITEMS.some(f => bot.inventory.items().find(i => i.name === f));
}

// ─── Run Away ─────────────────────────────────────────────

async function runAway(fromEntity) {
  isRunningAway = true;
  bot.chat('🏃 Low health and no food — running away!');

  const pos    = bot.entity.position;
  const threat = fromEntity ? fromEntity.position : pos;
  const dx     = pos.x - threat.x;
  const dz     = pos.z - threat.z;
  const len    = Math.sqrt(dx * dx + dz * dz) || 1;
  const tx     = pos.x + (dx / len) * CONFIG.runAwayDist;
  const tz     = pos.z + (dz / len) * CONFIG.runAwayDist;

  try {
    const defaultMove = new Movements(bot);
    bot.pathfinder.setMovements(defaultMove);
    await bot.pathfinder.goto(new GoalXZ(Math.floor(tx), Math.floor(tz)));
  } catch (e) {
    log(`Run away error: ${e.message}`);
  }

  await sleep(3000);
  isRunningAway = false;
}

// ─── Auto survival loop ───────────────────────────────────

async function survivalLoop() {
  while (true) {
    await sleep(1500);
    try {
      const hp   = bot.health;
      const food = bot.food;

      // Run away: very low HP + no food
      if (hp <= CONFIG.runAwayHP && !hasFood() && !isRunningAway) {
        const nearby = Object.values(bot.entities).find(e =>
          e !== bot.entity &&
          (e.type === 'mob' || e.type === 'player') &&
          bot.entity.position.distanceTo(e.position) < 16
        );
        await runAway(nearby);
        continue;
      }

      // Eat: hungry OR low HP with food available
      if ((food <= CONFIG.eatFoodPoints || hp <= CONFIG.eatHealthHP) && hasFood()) {
        await eatFood();
      }

    } catch (e) {
      log(`Survival loop error: ${e.message}`);
    }
  }
}

// ─── Command handler ──────────────────────────────────────

async function handleCommand(username, fullMsg) {
  // Strip prefix
  const msg = fullMsg.slice(CONFIG.prefix.length).trim();

  // ── Owner check ────────────────────────────────────────
  if (!isOwner(username)) {
    bot.chat(`Sorry Sir, but my Owner is ${CONFIG.owner} 💕`);
    return;
  }

  const lower = msg.toLowerCase();

  // ── Built-in hard commands ─────────────────────────────

  // STOP
  if (lower === 'stop' || lower === 'stop all') {
    isMining   = false;
    taskActive = false;
    stopKillAura();
    bot.pathfinder.stop();
    bot.chat('⏹️ Stopped everything!');
    return;
  }

  // KILLAURA ON/OFF
  if (lower.includes('killaura on') || lower.includes('pvp on')) {
    startKillAura();
    bot.chat('⚔️ KillAura ON! (Test mode)');
    return;
  }
  if (lower.includes('killaura off') || lower.includes('pvp off')) {
    stopKillAura();
    bot.chat('🛡️ KillAura OFF');
    return;
  }

  // ARMOR
  if (lower.includes('equip armor') || lower.includes('wear armor')) {
    bot.chat('🛡️ Equipping best armor...');
    await equipBestArmor();
    bot.chat('✅ Done equipping armor!');
    return;
  }

  // COME / FOLLOW
  if (lower === 'come' || lower === 'follow me' || lower === 'come here') {
    const player = bot.players[username];
    if (!player?.entity) { bot.chat('I can\'t see you!'); return; }
    bot.chat('🏃 Coming to you!');
    const defaultMove = new Movements(bot);
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(new GoalFollow(player.entity, 2), true);
    return;
  }

  // STATUS
  if (lower === 'status' || lower === 'stats') {
    bot.chat(`💓 HP: ${bot.health}/20 | 🍗 Food: ${bot.food}/20 | ⚔️ KillAura: ${killAuraEnabled ? 'ON' : 'OFF'} | ⛏️ Mining: ${isMining ? 'YES' : 'NO'}`);
    return;
  }

  // INVENTORY
  if (lower === 'inv' || lower === 'inventory') {
    const items = bot.inventory.items().map(i => `${i.name}x${i.count}`).join(', ') || 'Empty';
    bot.chat(`🎒 Inventory: ${items}`);
    return;
  }

  // ── AI-parsed task commands ────────────────────────────
  // Covers: mine, collect, goto, attack, and anything else
  const task = await parseTaskCommand(msg);
  log(`Groq parsed task: ${JSON.stringify(task)}`);

  switch (task.action) {
    case 'mine': {
      const target = task.target || 'diamond_ore';
      const amount = task.amount || 10;
      startMining(target, amount);   // runs async, non-blocking
      break;
    }

    case 'collect': {
      const target = task.target || 'log';
      const amount = task.amount || 10;
      startMining(target, amount);
      break;
    }

    case 'follow': {
      const player = bot.players[username];
      if (!player?.entity) { bot.chat('I can\'t see you!'); return; }
      bot.chat('🏃 Following you!');
      const defaultMove = new Movements(bot);
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalFollow(player.entity, 2), true);
      break;
    }

    case 'goto': {
      bot.chat(`🗺️ Pathfinding to ${task.target}...`);
      // If they say "spawn" go to 0,0 roughly
      if ((task.target || '').includes('spawn')) {
        const defaultMove = new Movements(bot);
        bot.pathfinder.setMovements(defaultMove);
        await bot.pathfinder.goto(new GoalXZ(0, 0));
        bot.chat('✅ Arrived at spawn!');
      }
      break;
    }

    case 'attack': {
      const targetName = task.target || '';
      const enemy = Object.values(bot.entities).find(e =>
        (e.name || e.username || '').toLowerCase().includes(targetName.toLowerCase()) &&
        e !== bot.entity
      );
      if (enemy) {
        bot.chat(`⚔️ Attacking ${targetName}!`);
        const defaultMove = new Movements(bot);
        bot.pathfinder.setMovements(defaultMove);
        bot.pathfinder.setGoal(new GoalFollow(enemy, 1), true);
        setTimeout(() => bot.attack(enemy), 500);
      } else {
        bot.chat(`Can't find ${targetName} nearby!`);
      }
      break;
    }

    case 'stop': {
      isMining   = false;
      taskActive = false;
      bot.pathfinder.stop();
      bot.chat('⏹️ Stopped!');
      break;
    }

    case 'chat': {
      if (task.message) bot.chat(task.message);
      break;
    }

    default: {
      // Free-form chat through Groq
      const reply = await askGroq(msg);
      bot.chat(reply);
      break;
    }
  }
}

// ─── Listen to all chat (non-command) ─────────────────────

async function handleChat(username, message) {
  if (username === bot.username) return;

  // Command
  if (message.startsWith(CONFIG.prefix)) {
    await handleCommand(username, message);
    return;
  }

  // Mention bot name in chat (responds with AI)
  if (message.toLowerCase().includes(CONFIG.botName.toLowerCase())) {
    if (!isOwner(username)) {
      bot.chat(`Hi ${username}! I only take commands from ${CONFIG.owner} 💕`);
      return;
    }
    const reply = await askGroq(message);
    bot.chat(reply);
  }
}

// ─── Create bot ───────────────────────────────────────────

function createBot() {
  bot = mineflayer.createBot({
    host:     CONFIG.host,
    port:     CONFIG.port,
    username: CONFIG.botName,
    version:  CONFIG.version,
    auth:     CONFIG.auth,       // 'offline' = cracked
  });

  bot.loadPlugin(pathfinder);

  // ── Events ──────────────────────────────────────────────

  bot.once('spawn', async () => {
    log('✅ Yori spawned!');
    bot.chat(`✨ Yori online! Owner: ${CONFIG.owner} | Prefix: ${CONFIG.prefix} | Say ${CONFIG.prefix}help`);

    // Start background loops
    survivalLoop();
    autoArmorLoop();
  });

  bot.on('chat', async (username, message) => {
    try { await handleChat(username, message); }
    catch (e) { log(`Chat handler error: ${e.message}`); }
  });

  bot.on('health', () => {
    log(`HP: ${bot.health} | Food: ${bot.food}`);
  });

  bot.on('kicked', (reason) => {
    log(`Kicked: ${reason}`);
    setTimeout(createBot, 5000);
  });

  bot.on('error', (err) => {
    log(`Bot error: ${err.message}`);
  });

  bot.on('end', () => {
    log('Bot disconnected — reconnecting in 5s...');
    setTimeout(createBot, 5000);
  });
}

// ─── Boot ─────────────────────────────────────────────────

console.log('');
console.log('  ╔══════════════════════════════════════════════════╗');
console.log('  ║   Yori — Minecraft Bot 🤖✨                      ║');
console.log('  ║   Groq AI • Cracked • Group • PvP • Auto-Eat    ║');
console.log(`  ║   Owner: SparkyNox | Prefix: ${CONFIG.prefix}                  ║`);
console.log('  ╚══════════════════════════════════════════════════╝');
console.log('');

createBot();
