const mineflayer = require("mineflayer");
const express = require("express");
const fs = require('fs'); // File system module for persistence

const app = express();
// 在Hugging Face Spaces中，PORT通常由环境变量自动设置
const PORT = process.env.PORT || 7860; 
const BOT_CONFIG_FILE = 'bot_configs.json'; // File to store bot connection parameters

// --- HARDCODED DEFAULT BOT CONFIGURATIONS ---
const DEFAULT_BOTS = [
    { host: "syd.retslav.net", port: 10257, username: "retslav003" },
    { host: "151.242.106.72", port: 25340, username: "vibegames003" },
    { host: "191.96.231.5", port: 30066, username: "mcserverhost003" },
    { host: "135.125.9.13", port: 2838, username: "elementiamc003" }
    // 可以在这里继续添加更多默认配置
];
// -------------------------------------------

// Store all active bots
const activeBots = new Map();

// Middleware
app.use(express.json());

// --- Persistence Functions ---

// Function to save configurations to file
function saveBotConfigs() {
    const configs = [];
    activeBots.forEach(bot => {
        // Only save parameters required for connection
        configs.push(bot.serverInfo); 
    });
    try {
        fs.writeFileSync(BOT_CONFIG_FILE, JSON.stringify(configs, null, 2));
        console.log(`[Persistence] Saved ${configs.length} bot configurations.`);
    } catch (e) {
        console.error('[Persistence] Failed to save bot configs:', e.message);
    }
}

// Function to load configurations and recreate bots on startup
function loadAndRestoreBots() {
    if (!fs.existsSync(BOT_CONFIG_FILE)) {
        console.log('[Persistence] Bot configuration file not found. Starting fresh.');
        return false; // Return false to indicate no bots were restored from file
    }
    try {
        const data = fs.readFileSync(BOT_CONFIG_FILE, 'utf8');
        const configs = JSON.parse(data);
        console.log(`[Persistence] Attempting to restore ${configs.length} bots...`);
        
        configs.forEach(config => {
            // Generate a new, unique ID for restored bots
            const id = `bot_${Date.now()}_restored_${Math.random().toString(36).substring(2, 7)}`;
            createBot(id, config.host, config.port, config.username);
        });
        return configs.length > 0; // Return true if any bots were restored
    } catch (e) {
        console.error('[Persistence] Failed to read or parse bot configs:', e.message);
        return false;
    }
}

// --- NEW: Function to create hardcoded default bots ---
function createDefaultBots() {
    console.log(`[Defaults] Creating ${DEFAULT_BOTS.length} default bots...`);
    DEFAULT_BOTS.forEach((config, index) => {
        // Use a persistent ID for default bots to prevent duplicate creation on restart if persistence fails
        const id = `bot_default_${index + 1}`;
        // Only create the default bot if no bot with this ID already exists (e.g., from a quick manual restart)
        if (!activeBots.has(id)) {
            createBot(id, config.host, config.port, config.username);
        } else {
             console.log(`[Defaults] Bot ${id} already active, skipping creation.`);
        }
    });
    // Save the configurations to the file so they persist across future restarts.
    saveBotConfigs(); 
}

// --- Global Error Handlers (Stability FIX) ---
process.on('uncaughtException', (err) => {
  const msg = err.message || String(err);
  
  // Completely silence all protocol errors including "partial packet"
  if (msg.includes('PartialReadError') ||
      msg.includes('Unexpected buffer end') ||
      msg.includes('Chunk size') ||
      msg.includes('partial packet')) { // 过滤部分数据包错误
    return;
  }
  
  console.error('CRITICAL UNCAUGHT EXCEPTION - EXITING:', msg, err.stack);
  // 【核心修复】强制退出，让 PM2/Docker 能够捕获并重启进程。
  process.exit(1); 
});

process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason);

  if (msg.includes('PartialReadError') ||
      msg.includes('Unexpected buffer end') ||
      msg.includes('Chunk size') ||
      msg.includes('partial packet')) { // 过滤部分数据包错误
    return;
  }
  console.error('Unhandled Promise Rejection:', reason);
});


// --- Bot Creation Function ---
function createBot(id, host, port, username) {
  try {
    const bot = mineflayer.createBot({
      host: host,
      port: port,
      username: username,
      version: false,
      hideErrors: false, // We handle errors manually
      checkTimeoutInterval: 60000,
      keepAlive: true
    });

    bot.customId = id;
    bot.serverInfo = { host, port, username };
    bot.status = "connecting";
    bot.lastError = null;
    bot.spawnLogged = false;

    // Log spawn only once
    bot.once("spawn", () => {
      if (!bot.spawnLogged) {
        console.log(`[${id}] ${username} successfully connected to ${host}:${port}`);
        
        // 【优化方案 A】禁用物理引擎以降低 CPU 占用
        bot.physicsEnabled = false; 

        bot.spawnLogged = true;
        bot.status = "online";
        bot.lastError = null;
      }
    });

    bot.on("end", (reason) => {
      if (reason !== 'socketClosed') {
        console.log(`[${id}] Connection ended: ${reason}`);
      }
      bot.status = "disconnected";
      bot.spawnLogged = false;
    });

    bot.on("error", (err) => {
      const msg = err.message || "";
      
      // Ignore all protocol-related errors including "partial packet"
      if (msg.includes('PartialReadError') ||
          msg.includes('ECONNRESET') ||
          msg.includes('Unexpected buffer') ||
          msg.includes('Chunk size') ||
          msg.includes('partial packet')) { // 过滤部分数据包错误
        return;
      }
      
      // Log only critical errors
      if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
        console.error(`[${id}] Connection Error: ${msg}`);
        bot.status = "error";
        bot.lastError = msg;
      }
    });

    bot.on("kicked", (reason) => {
      console.log(`[${id}] Kicked: ${reason}`);
      bot.status = "kicked";
      bot.lastError = reason;
      bot.spawnLogged = false;
    });

    // Intercept underlying client errors
    if (bot._client) {
      bot._client.removeAllListeners('error');
      bot._client.on('error', () => {}); // Silence underlying errors
    }

    activeBots.set(id, bot);
    return { success: true, id };
  } catch (error) {
    console.error(`Failed to create bot:`, error.message);
    return { success: false, error: error.message };
  }
}

// --- API Routes ---

app.get("/api/bots", (req, res) => {
  const bots = [];
  activeBots.forEach((bot, id) => {
    bots.push({
      id: id,
      host: bot.serverInfo.host,
      port: bot.serverInfo.port,
      username: bot.serverInfo.username,
      status: bot.status,
      error: bot.lastError,
      health: bot.health || 0,
      food: bot.food || 0
    });
  });
  res.json(bots);
});

app.post("/api/bots", (req, res) => {
  const { host, port, username } = req.body;

  if (!host || !port || !username) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const id = `bot_${Date.now()}`;
  const result = createBot(id, host, parseInt(port), username);

  if (result.success) {
    saveBotConfigs(); // Save config after adding
    res.json({ success: true, id: result.id });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

app.delete("/api/bots/:id", (req, res) => {
  const id = req.params.id;
  const bot = activeBots.get(id);

  if (!bot) {
    return res.status(404).json({ error: "Bot not found" });
  }

  try {
    bot.end();
  } catch (e) {
    // Ignore end errors
  }
  activeBots.delete(id);
  saveBotConfigs(); // Save config after deleting
  res.json({ success: true });
});

app.post("/api/bots/:id/reconnect", (req, res) => {
  const id = req.params.id;
  const bot = activeBots.get(id);

  if (!bot) {
    return res.status(404).json({ error: "Bot not found" });
  }

  const { host, port, username } = bot.serverInfo;
  
  try {
    bot.end();
  } catch (e) {
    // Ignore end errors
  }
  
  activeBots.delete(id);

  // 【延迟修复】增加延迟到 2000ms
  setTimeout(() => {
    const result = createBot(id, host, port, username);
    res.json(result);
  }, 2000); 
});

// --- HTML Content (Fully English) ---
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Minecraft Fake Player Manager</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 {
            color: white;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .add-form {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            margin-bottom: 30px;
        }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; color: #333; }
        input {
            width: 100%;
            padding: 10px;
            border: 2px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
        }
        input:focus { outline: none; border-color: #667eea; }
        button {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover { background: #5568d3; }
        .bot-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
        }
        .bot-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        .bot-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f0f0f0;
        }
        .bot-username { font-size: 1.2em; font-weight: bold; color: #333; }
        .status {
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: bold;
        }
        .status.online { background: #4caf50; color: white; }
        .status.connecting { background: #ff9800; color: white; }
        .status.error, .status.kicked { background: #f44336; color: white; }
        .status.disconnected { background: #9e9e9e; color: white; }
        .bot-info { margin: 10px 0; color: #666; font-size: 0.9em; }
        .bot-actions { display: flex; gap: 10px; margin-top: 15px; }
        .bot-actions button { flex: 1; padding: 8px; font-size: 14px; }
        .delete-btn { background: #f44336; }
        .delete-btn:hover { background: #d32f2f; }
        .reconnect-btn { background: #4caf50; }
        .reconnect-btn:hover { background: #388e3c; }
        .error-message {
            color: #f44336;
            font-size: 0.85em;
            margin-top: 5px;
            padding: 5px;
            background: #ffebee;
            border-radius: 3px;
        }
        .empty-state {
            text-align: center;
            color: white;
            font-size: 1.2em;
            margin-top: 50px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎮 Minecraft Fake Player Manager</h1>
        
        <div class="add-form">
            <h2 style="margin-bottom: 20px;">Add New Bot</h2>
            <div class="form-group">
                <label>Server Host:</label>
                <input type="text" id="host" placeholder="e.g., syd.retslav.net">
            </div>
            <div class="form-group">
                <label>Port:</label>
                <input type="number" id="port" placeholder="e.g., 10045">
            </div>
            <div class="form-group">
                <label>Username:</label>
                <input type="text" id="username" placeholder="e.g., mcplayer">
            </div>
            <button onclick="addBot()">➕ Add Bot</button>
        </div>
        <div id="botList" class="bot-list"></div>
    </div>
    <script>
        async function loadBots() {
            try {
                const response = await fetch('/api/bots');
                const bots = await response.json();
                const botList = document.getElementById('botList');
                if (bots.length === 0) {
                    botList.innerHTML = '<div class="empty-state">No active bots. Please add one.</div>';
                    return;
                }
                botList.innerHTML = bots.map(bot => {
                    const healthInfo = bot.status === 'online' ? 
                        '<div>❤️ Health: ' + bot.health + '/20</div><div>🍖 Food: ' + bot.food + '/20</div>' : '';
                    const errorInfo = bot.error ? 
                        '<div class="error-message">Error: ' + bot.error + '</div>' : '';
                    return '<div class="bot-card">' +
                        '<div class="bot-header">' +
                            '<div class="bot-username">' + bot.username + '</div>' +
                            '<div class="status ' + bot.status + '">' + getStatusText(bot.status) + '</div>' +
                        '</div>' +
                        '<div class="bot-info"><div>🌐 ' + bot.host + ':' + bot.port + '</div>' + healthInfo + '</div>' +
                        errorInfo +
                        '<div class="bot-actions">' +
                            '<button class="reconnect-btn" onclick="reconnectBot(\\'' + bot.id + '\\')">🔄 Reconnect</button>' +
                            '<button class="delete-btn" onclick="deleteBot(\\'' + bot.id + '\\')">🗑️ Delete</button>' +
                        '</div></div>';
                }).join('');
            } catch (error) {
                console.error('Failed to load bots:', error);
            }
        }
        function getStatusText(status) {
            const map = {online:'Online',connecting:'Connecting',error:'Error',kicked:'Kicked',disconnected:'Disconnected'};
            return map[status] || status;
        }
        async function addBot() {
            const host = document.getElementById('host').value;
            const port = document.getElementById('port').value;
            const username = document.getElementById('username').value;
            if (!host || !port || !username) { alert('Please fill in all fields'); return; }
            try {
                const response = await fetch('/api/bots', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ host, port: parseInt(port), username })
                });
                if (response.ok) {
                    document.getElementById('host').value = '';
                    document.getElementById('port').value = '';
                    document.getElementById('username').value = '';
                    loadBots();
                } else {
                    const error = await response.json();
                    alert('Failed to add bot: ' + error.error);
                }
            } catch (error) {
                alert('Failed to add bot: ' + error.message);
            }
        }
        async function deleteBot(id) {
            if (!confirm('Are you sure you want to delete this bot?')) return;
            try {
                await fetch('/api/bots/' + id, { method: 'DELETE' });
                loadBots();
            } catch (error) {
                alert('Failed to delete bot: ' + error.message);
            }
        }
        async function reconnectBot(id) {
            try {
                await fetch('/api/bots/' + id + '/reconnect', { method: 'POST' });
                // 确保有足够的延迟来等待后端 2000ms 的重连操作
                setTimeout(loadBots, 2500); 
            } catch (error) {
                alert('Failed to reconnect bot: ' + error.message);
            }
        }
        setInterval(loadBots, 3000);
        loadBots();
    </script>
</body>
</html>`;

app.get("/", (req, res) => {
  res.send(htmlContent);
});

// --- Auto-Reconnect Logic ---

// Function to reconnect all bots sequentially with a 5-second interval
function autoReconnectBots() {
  const idsToReconnect = Array.from(activeBots.keys());

  if (idsToReconnect.length === 0) {
    console.log('[AutoReconnect] No active bots to reconnect.');
    return;
  }

  console.log(`[AutoReconnect] Starting reconnect for ${idsToReconnect.length} bots...`);

  idsToReconnect.forEach((id, index) => {
    // Use setTimeout to ensure a 5-second gap between each bot's reconnect operation
    setTimeout(() => {
      const bot = activeBots.get(id);

      if (!bot) {
        console.log(`[AutoReconnect] Bot ${id} was not found during operation, skipping.`);
        return;
      }

      const { host, port, username } = bot.serverInfo;

      // 1. End current connection
      try {
        bot.end();
        console.log(`[AutoReconnect - ${id}] Ending connection...`);
      } catch (e) {
        // Ignore end errors
      }
      activeBots.delete(id); // Remove immediately to prevent misleading status queries

      // 2. Create a new connection after a 2000ms delay
      // 【延迟修复】增加延迟到 2000ms
      setTimeout(() => {
        const result = createBot(id, host, port, username);
        if (result.success) {
          console.log(`[AutoReconnect - ${id}] Reconnect attempt initiated.`);
        } else {
          console.error(`[AutoReconnect - ${id}] Reconnect failed: ${result.error}`);
        }
      }, 2000); // 2-second delay to ensure connection is fully closed
    }, index * 5000); // Core logic: index * 5000ms ensures each reconnect operation is 5 seconds apart
  });
}

// Execute autoReconnectBots every 10 minutes (10 * 60 * 1000 ms)
const RECONNECT_INTERVAL = 10 * 60 * 1000;
console.log(`[AutoReconnect] Auto-reconnect will trigger every ${RECONNECT_INTERVAL / 60000} minutes.`);
setInterval(autoReconnectBots, RECONNECT_INTERVAL);

// Call the restore function on startup
const botsRestored = loadAndRestoreBots();

// If no bots were restored from file (e.g., first run or file lost), load the defaults
if (!botsRestored) {
    createDefaultBots();
}

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Service running on port ${PORT}`);
});