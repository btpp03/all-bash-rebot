/**
 * ==========================================
 * CYBER-BOT MATRIX - 赛博假人矩阵控制系统
 * 版本: 2.2 (Pterodactyl & Visual Optimized)
 * 功能: 自动适配面板端口 / UI深度美化 / 输入框修复
 * ==========================================
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. 自动依赖管理 (首次运行会慢一点)
const REQUIRED_DEPS = ['mineflayer', 'minecraft-protocol', 'minecraft-data', 'express'];
const DEFAULT_PASSWORD = "babama123"; 

function setupEnvironment() {
    let missing = false;
    for (const dep of REQUIRED_DEPS) {
        try { require.resolve(dep); } catch (e) { missing = true; }
    }
    if (missing) {
        console.log("\x1b[36m[System]\x1b[0m 检测到缺失依赖，正在安装赛博核心组件...");
        try {
            execSync(`npm install ${REQUIRED_DEPS.map(d => d + '@latest').join(' ')} --no-audit --no-fund`, { stdio: 'inherit' });
        } catch(e) {
            console.error("依赖安装失败，请检查网络权限。");
        }
    }
}
setupEnvironment();

const mineflayer = require("mineflayer");
const protocol = require("minecraft-protocol");
const mcDataLoader = require("minecraft-data");
const express = require("express");

const app = express();
const activeBots = new Map(); 
const CONFIG_FILE = path.join(__dirname, 'bots_config.json');

app.use(express.json());

// 保存配置
function saveBotsConfig() {
    const config = [];
    activeBots.forEach((bot) => {
        config.push({ host: bot.targetHost, port: bot.targetPort, username: bot.username });
    });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// 自动检测服务器版本
async function detectServerVersion(host, port) {
    try {
        const response = await protocol.ping({ host, port, timeout: 5000 });
        const protocolId = response.version.protocol;
        const pcData = mcDataLoader.versionsByMinecraftVersion.pc;
        const matchedVersion = Object.keys(pcData).find(v => pcData[v].version === protocolId && !v.includes('w'));
        return matchedVersion || response.version.name.match(/(\d+\.\d+(\.\d+)?)/)?.[0] || false;
    } catch (e) { return false; }
}

// 性能优化引擎
function applyExtremeOptimization(bot) {
    bot.on('inject_allowed', () => {
        if (bot.physics) bot.physics.enabled = false;
        bot.entities = {};
        if (bot.world) { bot.world.getColumn = () => null; bot.world.getColumns = () => []; }
    });
}

// 反挂机行为逻辑
function startSmartRoam(bot) {
    const perform = () => {
        if (bot.status !== "在线" || !bot.entity) return;
        try {
            bot.look(bot.entity.yaw + (Math.random()-0.5), (Math.random()-0.5)*0.2);
            if (Math.random() > 0.8) bot.swingArm('right');
        } catch (e) {}
        bot.roamTimer = setTimeout(perform, 10000 + Math.random()*15000);
    };
    perform();
}

// 创建机器人实例
async function createBotInstance(id, host, port, username, existingLogs = []) {
    if (activeBots.get(id)?.status === "在线") return;

    const botVersion = await detectServerVersion(host, port);
    const bot = mineflayer.createBot({
        host, port, username, version: botVersion || undefined,
        auth: 'offline', hideErrors: true, viewDistance: "tiny",
        checkTimeoutInterval: 60000
    });

    bot.logs = existingLogs;
    bot.status = "初始化...";
    bot.targetHost = host;
    bot.targetPort = port;
    bot.pushLog = (msg) => {
        const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        bot.logs.unshift(`[${time}] ${msg}`);
        if (bot.logs.length > 8) bot.logs.pop();
    };

    applyExtremeOptimization(bot);

    bot.once('spawn', () => {
        bot.status = "在线";
        bot.pushLog("✨ 链路已建立，核心就绪");
        saveBotsConfig();
        setTimeout(() => {
            bot.chat(`/register ${DEFAULT_PASSWORD} ${DEFAULT_PASSWORD}`);
            setTimeout(() => { bot.chat(`/login ${DEFAULT_PASSWORD}`); startSmartRoam(bot); }, 2000);
        }, 3000);
    });

    bot.on('error', (err) => bot.pushLog(`💢 异常: ${err.message}`));
    bot.once('end', () => {
        if (activeBots.has(id)) {
            bot.status = "重连中";
            setTimeout(() => createBotInstance(id, host, port, username, bot.logs), 10000);
        }
    });
    activeBots.set(id, bot);
}

// API 路由
app.post("/api/bots", async (req, res) => {
    const { host, port, username } = req.body;
    const id = `bot_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
    await createBotInstance(id, host, port, username);
    res.json({ success: true });
});

app.get("/api/bots", (req, res) => {
    const list = [];
    activeBots.forEach((b, id) => list.push({ id, username: b.username, host: b.targetHost, status: b.status, logs: b.logs }));
    res.json(list);
});

app.delete("/api/bots/:id", (req, res) => {
    const bot = activeBots.get(req.params.id);
    if (bot) { activeBots.delete(req.params.id); bot.end(); setTimeout(saveBotsConfig, 500); }
    res.json({ success: true });
});

// 控制面板 HTML
app.get("/", (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>CYBER-BOT MATRIX</title>
        <style>
            :root {
                --primary: #00f2ff;
                --primary-glow: rgba(0, 242, 255, 0.4);
                --danger: #ff0055;
                --bg: #05060a;
                --card-bg: rgba(15, 20, 30, 0.9);
            }

            body {
                background: var(--bg);
                background-image: linear-gradient(rgba(0, 242, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 242, 255, 0.03) 1px, transparent 1px);
                background-size: 40px 40px;
                color: #e0e0e0;
                font-family: 'Segoe UI', sans-serif;
                margin: 0; padding: 40px; min-height: 100vh;
            }

            .container { max-width: 1100px; margin: 0 auto; }

            h2 {
                text-transform: uppercase; letter-spacing: 6px; color: var(--primary);
                text-shadow: 0 0 15px var(--primary-glow);
                display: flex; align-items: center; gap: 15px; margin-bottom: 40px;
            }

            .live-indicator {
                width: 12px; height: 12px; background: var(--primary); border-radius: 50%;
                box-shadow: 0 0 10px var(--primary); animation: pulse 2s infinite;
            }
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

            .control-panel {
                background: var(--card-bg);
                backdrop-filter: blur(15px);
                border: 1px solid rgba(0, 242, 255, 0.2);
                padding: 30px; border-radius: 4px;
                display: flex; gap: 15px; justify-content: center;
                margin-bottom: 50px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.6);
                clip-path: polygon(0 0, 98% 0, 100% 20%, 100% 100%, 2% 100%, 0 80%);
            }

            input {
                background: rgba(0,0,0,0.5); border: 1px solid rgba(0, 242, 255, 0.3);
                border-left: 3px solid var(--primary); color: var(--primary);
                padding: 12px 15px; outline: none; font-family: monospace;
            }
            #addr-box { width: 320px; }
            #user-box { width: 180px; }

            button.deploy {
                background: transparent; border: 2px solid var(--primary);
                color: var(--primary); padding: 0 30px; cursor: pointer;
                text-transform: uppercase; font-weight: bold; transition: 0.3s;
            }
            button.deploy:hover { background: var(--primary); color: #000; box-shadow: 0 0 25px var(--primary); }

            .bot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 25px; }

            .bot-card {
                background: var(--card-bg); border-top: 4px solid var(--primary);
                padding: 20px; transition: 0.3s; border-radius: 2px;
            }
            .bot-card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }

            .bot-header { display: flex; justify-content: space-between; margin-bottom: 15px; }
            .bot-name { font-weight: bold; color: #fff; font-size: 1.1em; }
            .bot-status { font-size: 0.75em; border: 1px solid currentColor; padding: 2px 8px; }

            .bot-logs {
                background: #000; height: 140px; padding: 10px;
                font-family: 'Consolas', monospace; font-size: 0.75em;
                color: #00ff9d; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);
                position: relative;
            }
            .bot-logs::before {
                content: ""; position: absolute; top:0; left:0; width:100%; height:100%;
                background: linear-gradient(transparent 50%, rgba(0,0,0,0.1) 50%);
                background-size: 100% 2px; pointer-events: none;
            }

            .btn-remove {
                width: 100%; margin-top: 15px; background: transparent;
                border: 1px solid var(--danger); color: var(--danger);
                padding: 10px; cursor: pointer; text-transform: uppercase; font-size: 0.8em;
            }
            .btn-remove:hover { background: var(--danger); color: #fff; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2><div class="live-indicator"></div> CYBER-BOT MATRIX 控制矩阵</h2>
            <div class="control-panel">
                <input id="addr-box" placeholder="地址:端口 (例如 play.mc.com)">
                <input id="user-box" placeholder="假人用户名">
                <button class="deploy" onclick="addBot()">初始化注入</button>
            </div>
            <div id="grid" class="bot-grid"></div>
        </div>
        <script>
            async function addBot() {
                const addr = document.getElementById('addr-box').value.trim();
                const user = document.getElementById('user-box').value.trim();
                if(!addr || !user) return;
                let host = addr; let port = 25565;
                if(addr.includes(':')) {
                    const parts = addr.split(':');
                    host = parts[0]; port = parseInt(parts[1]) || 25565;
                }
                await fetch('/api/bots', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({host, port, username: user})
                });
                document.getElementById('user-box').value = "";
            }
            async function removeBot(id) { await fetch('/api/bots/' + id, { method: 'DELETE' }); }
            function updateUI() {
                fetch('/api/bots').then(res => res.json()).then(bots => {
                    const grid = document.getElementById('grid');
                    grid.innerHTML = bots.map(b => \`
                        <div class="bot-card">
                            <div class="bot-header">
                                <div>
                                    <div class="bot-name">\${b.username}</div>
                                    <div style="font-size:0.7em; color:#666; margin-top:4px;">\${b.host}</div>
                                </div>
                                <div class="bot-status" style="color: \${b.status==='在线'?'#00f2ff':'#ff0055'}">\${b.status}</div>
                            </div>
                            <div class="bot-logs">
                                \${b.logs.map(l => \`<div style="margin-bottom:2px; opacity:0.8;">\${l}</div>\`).join('')}
                            </div>
                            <button class="btn-remove" onclick="removeBot('\${b.id}')">终止进程</button>
                        </div>
                    \`).join('');
                }).catch(() => {});
            }
            setInterval(updateUI, 2000); updateUI();
        </script>
    </body>
    </html>
    `);
});

/**
 * ==========================================
 * 启动逻辑：自动适配翼龙面板端口
 * ==========================================
 */
const PORT = process.env.SERVER_PORT || 4681; // 优先读取翼龙分配的端口
const HOST = '0.0.0.0'; // 必须使用 0.0.0.0 才能在 Docker 环境被外部访问

app.listen(PORT, HOST, async () => {
    console.log(`\x1b[36m
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃          CYBER-BOT MATRIX 系统已上线             ┃
    ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
    ┃  运行环境: 翼龙面板 (Pterodactyl)                ┃
    ┃  监听端口: ${PORT.toString().padEnd(38)} ┃
    ┃  访问地址: 请通过面板分配的 IP:${PORT} 访问      ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\x1b[0m`);
    
    // 恢复之前的配置
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const saved = JSON.parse(fs.readFileSync(CONFIG_FILE));
            for (const b of saved) {
                const id = `bot_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
                createBotInstance(id, b.host, b.port, b.username);
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) {}
    }
});