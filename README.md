<div align="center">

<img src="https://i.postimg.cc/pTPS6VJW/IMG-20260321-114645-622.jpg" width="120" height="120" style="border-radius: 12px" />

# YoriAI 🌸✨
### Minecraft Bot — Version 4.6

**Groq AI • Auto-Login • PvP • Guard • Auto-Eat • Auto-Armor**

*Made with 💕 by SparkyNox*

</div>

---

## Features

| Feature | Details |
|---|---|
| 🧠 **Groq AI Chat** | Talk to bot using `@YoriAI <message>` |
| 🔐 **Auto Login** | `/register` + `/login` with 5s spawn delay |
| 🎨 **Auto Skin** | Sets Yori's skin on every join |
| ⚔️ **PvP / Fight Back** | Hit the bot → it fights back and follows attacker |
| 🛡️ **Guard Mode** | Guards your position, attacks nearby mobs |
| 🛡️ **Auto Armor** | Equips best armor every 6s automatically |
| 🍗 **Auto Eat** | Eats when HP ≤ 4 hearts or food ≤ 7 shanks |
| 🏃 **Follow** | Follows a player on command |
| 🔄 **Auto Reconnect** | Reconnects in 8s on kick/disconnect |
| 💥 **Crash Protection** | `uncaughtException` + `unhandledRejection` handled |

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Add your Groq API key in index.js
GROQ_API_KEY = 'your-key-here'   # free at console.groq.com

# 3. Run
npm start
```

---

## Configuration

Edit the top of `index.js`:

```js
const HOST     = 'bladeheartsmp.falix.gg'  // server IP
const PORT     = 25565
const USERNAME = 'YoriAI'
const PASSWORD = 'Passing67'               // /register & /login password
const OWNER    = 'SparkyNox'
const PREFIX   = '@YoriAI'                // AI chat prefix

const GROQ_API_KEY      = 'YOUR_KEY'
const GROQ_MODEL        = 'llama-3.1-8b-instant'
const SPAWN_CHAT_DELAY  = 5000            // 5s delay after spawn
const ARMOR_EQUIP_DELAY = 6000            // auto armor every 6s
```

---

## Commands

| Command | What it does |
|---|---|
| `@YoriAI <message>` | Groq AI replies (anyone can use) |
| `armor` | Equips best armor from inventory |
| `guard` | Guards your position, attacks nearby mobs |
| `fight me` | Bot attacks you (PvP test) |
| `follow me` / `come` | Bot follows you |
| `stop` | Stops all tasks |
| `status` | Shows HP and food level |

---

## Auto Behaviors

### 🔐 Spawn Login Sequence
```
Bot joins server
  ↓  5s delay
/register Passing67 Passing67
  ↓  3s delay
/login Passing67
  ↓  1.5s delay
/skin <Yori skin URL>
  ↓  1.5s delay
"YoriAI is Online ✨"
```

### ⚔️ Hit Back
When any player or mob hits the bot → bot **instantly fights back** and **follows the attacker** until it's dead or stopped.

### 🛡️ Auto Armor
Every **6 seconds**, bot checks inventory and equips the best available armor automatically.
Priority: Netherite → Diamond → Iron → Golden → Chainmail → Leather

### 🍗 Auto Eat
Triggers when:
- Food ≤ 14 points (7 shanks)
- HP ≤ 8 (4 hearts)

Food priority: Cooked Beef → Golden Apple → Bread → Carrot → etc.

---

## Dependencies

| Package | Purpose |
|---|---|
| `mineflayer` | Core Minecraft bot engine |
| `mineflayer-pvp` | PvP combat system |
| `mineflayer-pathfinder` | Pathfinding & movement |
| `mineflayer-armor-manager` | Auto armor equipping |
| `groq-sdk` | Groq AI API |

---

## Getting a Free Groq API Key

1. Visit **https://console.groq.com**
2. Sign up (free, no credit card)
3. Create an API key
4. Paste it into `GROQ_API_KEY` in `index.js`

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Bot kicked instantly | Check server version in mineflayer |
| Armor not equipping | Make sure `mineflayer-armor-manager` is installed |
| Groq not responding | Verify API key at console.groq.com |
| "Same username playing" | Increase reconnect delay to 10s+ |
| Bot not eating | Make sure food items are in inventory |

---

<div align="center">
<b>YoriAI v4.6 — Made with 💕 by SparkyNox</b>
</div>
