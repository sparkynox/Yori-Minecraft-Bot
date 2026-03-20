# Yori — Minecraft Bot 🤖✨

AI-powered Minecraft bot with Groq brain, cracked server support, mining, PvP, auto-eat, auto-armor and more.

---

## Install (Termux / Linux)

```bash
# Termux
pkg install nodejs -y

# Linux
# Make sure Node.js 18+ is installed

npm install
```

---

## Setup

Edit the `CONFIG` block at the top of `index.js`:

```js
host:       'localhost',       // your server IP
port:        25565,            // your server port
version:    '1.20.1',         // match your server version
botName:    'Yori',
auth:       'offline',         // 'offline' = cracked server
owner:      'SparkyNox',       // only this player can command the bot
groqApiKey: 'YOUR_KEY_HERE',   // get free key at console.groq.com
```

Then run:

```bash
node index.js
```

---

## Commands (prefix `!`)

| Command | What it does |
|---|---|
| `!Yori mine some diamonds` | Mines 10 diamonds using AI task parsing |
| `!mine 32 iron` | Mines 32 iron ore |
| `!collect 64 wood` | Collects 64 wood logs |
| `!follow me` / `!come` | Follows SparkyNox |
| `!goto spawn` | Pathfinds to 0,0 |
| `!killaura on` | Enables PvP KillAura (test mode) |
| `!killaura off` | Disables KillAura |
| `!equip armor` | Equips best available armor |
| `!status` | Shows HP, food, mining, killaura state |
| `!inventory` | Lists inventory items |
| `!stop` | Stops all tasks |
| `!<anything>` | Groq AI responds naturally |

---

## Features

### 🧠 Groq AI Brain
Every command goes through Groq's LLaMA-3 model. It understands natural language — `!Yori mine some diamonds` works the same as `!mine diamond 10`.

### 👑 Owner Lock
Only `SparkyNox` can give commands. Anyone else gets:
> "Sorry Sir, but my Owner is SparkyNox 💕"

### ⛏️ Smart Mining
Supports all ores: diamond, iron, gold, coal, emerald, redstone, lapis, netherite. Bot pathfinds to ore, digs, and wanders to find more if needed.

### ⚔️ KillAura (Test Mode)
Attacks nearby mobs and non-owner players within 4 blocks every 800ms. Toggle with `!killaura on/off`.

### 🛡️ Auto Armor
Every 10 seconds, bot checks inventory and equips the best available armor with a 3–5s human-like delay between each piece.

### 🍗 Auto Eat
- Eats when food ≤ 14 (7 shanks) OR HP ≤ 8 (4 hearts)
- Prioritizes best food first (cooked beef, golden apple, etc.)

### 🏃 Run Away
When HP ≤ 6 AND no food in inventory, bot runs 32 blocks away from the nearest threat automatically.

### 🔄 Auto Reconnect
Bot reconnects automatically if kicked or disconnected.

---

## Getting a Free Groq API Key

1. Go to https://console.groq.com
2. Sign up (free)
3. Create an API key
4. Paste it into `groqApiKey` in `index.js`

---

## Supported Minecraft Versions

Works with any offline/cracked server. Set `version` in CONFIG to match your server (e.g. `1.20.1`, `1.19.4`, `1.18.2`).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Bot won't connect | Check host/port/version in CONFIG |
| "Invalid session" | Make sure server has `online-mode=false` |
| Download fails in mining | Update yt-dlp (not needed here, ignore) |
| Groq errors | Check API key is valid at console.groq.com |
| Bot stuck pathfinding | Use `!stop` to reset |
