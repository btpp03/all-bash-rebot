#!/usr/bin/env node

// 从命令行参数取：node index.js <host> <port><playername>
const hostFromArg = process.argv[2];
const portFromArg = process.argv[3];  
const usernameFromArg = process.argv[4]; 
// 从环境变量取
const hostFromEnv = process.env.HOST;
const portFromEnv = process.env.PORT;
const usernameFromEnv = process.env.USERNAME;

// ===============================================
// === 关键修改：直接将 IP 和 端口 硬编码到代码中 ===
// ===============================================
const HOST = '151.242.106.72'; // <-- 已修改
const PORT = 25340;           // <-- 已修改
// ===============================================
// === 如果命令行或环境变量提供了值，将忽略上面的硬编码 ===
// ===============================================
const USERNAME=usernameFromArg||usernameFromEnv||generateUsername();

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalNear } = goals;
const { Vec3 } = require('vec3');
//攻击冷却时间
let lastAttackTime = 0;           // 上次攻击时间
const ATTACK_COOLDOWN = 5000; 
let wanderInterval=null
let attackInterval = null;
let activityMonitorInterval = null;

let reconnecting = false;
let bot = null;
let lastActivity = Date.now();

function logWithTime(msg) {
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];
  console.log(`[${now}] ${msg}`);
}

function createBot() {
  function updateActivity() {
  lastActivity = Date.now();
  }

const botOptions = {
  // 注意：这里会使用上面硬编码的 HOST 和 PORT 值
  host: hostFromArg || hostFromEnv || HOST, // 优先使用命令行/环境变量，否则使用硬编码的 HOST
  port: portFromArg || portFromEnv || PORT, // 优先使用命令行/环境变量，否则使用硬编码的 PORT
  username: USERNAME,
  version: false,
  connectTimeout: 10000,
  // ====== 解决磁盘空间耗尽的关键修改 ======
  // mineflayer默认会写入debug.log文件，设置 skipValidation: true 可以禁用此功能
  skipValidation: true, 
  // 隐藏一些内部错误，防止过于频繁地打印不必要的错误信息（可选）
  hideErrors: true 
  // ===================================
}
console.log('Bot options:', botOptions)
  bot = mineflayer.createBot(botOptions);
  bot.loadPlugin(pathfinder);
  bot._behaviorStarted = false;
  bot.on('login', () => {
    logWithTime('? Bot 已成功登录 Minecraft 服务器');
    reconnecting = false; // 登录成功，停止重连标记
    updateActivity();
    startActivityMonitor();
  });
  bot.once('spawn', () => {
    bot.pathfinder.setMovements(new Movements(bot, bot.registry));
    startBotBehavior(bot);
  });
  function startActivityMonitor() {
    if (activityMonitorInterval) {
      clearInterval(activityMonitorInterval); // 清除旧的定时器
    }

    activityMonitorInterval = setInterval(() => {
      if (Date.now() - lastActivity > 300000) { // 300秒无活动
        console.log('?? Bot 可能卡死，重启中...');
        scheduleReconnect();
      }
    }, 10000);
  }
  function registerBotEvents(bot) {
    bot.on('error', err => {
      console.log('? Mineflayer 错误:', err);
      scheduleReconnect();
    });

    bot.on('end', () => {
      console.log('?? Bot 断开连接');
      scheduleReconnect();
    });

    bot.on('kicked', reason => {
      console.log('?? 被踢出:', reason);
      scheduleReconnect();
    });

    bot._client.on('error', err => {
      console.log('?? 底层协议错误:', err);
      scheduleReconnect();
    });

    bot._client.on('end', () => {
      console.log('?? 底层连接断开');
      scheduleReconnect();
    });

    bot._client.on('disconnect', packet => {
      console.log('?? 收到断开包:', packet);
      scheduleReconnect();
    });
    bot._client.on('connect_timeout', () => {
      console.log('? 底层连接超时');
      scheduleReconnect();
    });
    bot._client.on('packet', (data, meta) => {
      if (meta.name === 'explosion') {
        try {
          const y = data.playerKnockback?.y;
          if (typeof y === 'number' && (y > 1e12 || isNaN(y))) {
            console.log('?? 检测到异常爆炸数据，重启 bot');
            scheduleReconnect();
          }
        } catch (e) {
          scheduleReconnect();
        }
      }
    });
  }

  registerBotEvents(bot);

  function scheduleReconnect() {
    if (!reconnecting) {
      reconnecting = true;
      console.log('?? 正在等待服务器恢复，准备重连...');
       // 清理定时器，避免残留
      cleanup();
      setTimeout(() => {
        reconnecting = false;
        createBot();
      }, 10000);
    }
  }
  
function startBotBehavior(bot) {
  if (bot._behaviorStarted) return;
  
  if (bot.pathfinder.isMoving()) {
    console.log('?? 正在移动中，跳过本次 wander');
    return;
  }  
  
  bot._behaviorStarted = true;
  const defaultMove = new Movements(bot);
  bot.pathfinder.setMovements(defaultMove);

  const safeZone = {
    xMin: 50, xMax: 100,
    zMin: 300, zMax: 360
  };

  function wander() {
    const dx = Math.floor(Math.random() * 20 - 10);
    const dz = Math.floor(Math.random() * 20 - 10);
    let targetX = bot.entity.position.x + dx;
    let targetZ = bot.entity.position.z + dz;

    // 限制在安全区域内
    targetX = Math.max(safeZone.xMin, Math.min(safeZone.xMax, targetX));
    targetZ = Math.max(safeZone.zMin, Math.min(safeZone.zMax, targetZ));

    const targetY = bot.entity.position.y;
    const targetPos = new Vec3(targetX, targetY, targetZ);

    // 如果目标点距离当前位置太近，就不设置目标
    if (bot.entity.position.distanceTo(targetPos) < 1) {
      console.log('?? 距离太近，跳过本次 wander');
      return;
    }

    // 如果当前目标已经是这个点，就不重复设置
    const currentGoal = bot.pathfinder.goal;
    if (
      !currentGoal ||
      currentGoal.x !== targetX ||
      currentGoal.y !== targetY ||
      currentGoal.z !== targetZ
    ) {
      const goal = new GoalNear(targetX, targetY, targetZ, 1);
      bot.pathfinder.setGoal(goal);
      updateActivity();
    } else {
      console.log('?? 当前目标已设置，无需重复');
    }
  }
  wanderInterval = setInterval(wander, 30000);
  attackInterval = setInterval(() => {
    const now = Date.now();
  
    // 如果冷却未结束，跳过
    if (now - lastAttackTime < ATTACK_COOLDOWN) {
      return;
    }
  
    const entity = Object.values(bot.entities).find(e =>
      e.type === 'mob' &&
      e.position.distanceTo(bot.entity.position) < 6 &&
      e.mobType !== 'Armor Stand'
    );
  
    if (entity) {
      bot.lookAt(entity.position.offset(0, entity.height, 0), true, () => {
        bot.attack(entity);
        bot.chat(`?? 攻击 ${entity.name}`);
        lastAttackTime = now; // 更新冷却时间
      });
    }
  }, 1000);
}
  bot.on('goal_reached', () => {
    logWithTime('? 已到达目标点');
  });
  bot.on('path_update', (r) => {
    if (r.status === 'success') {
      logWithTime(`?? 正在移动，预计耗时 ${r.time.toFixed(2)} 秒`);
    } else if (r.status === 'noPath') {
      logWithTime('?? 无法找到路径');
    }
    updateActivity();
  });

  bot.on('goal_updated', (goal) => {
    console.log(`?? 新目标设置为：(${goal.x}, ${goal.y}, ${goal.z})`);
  });
}
function generateUsername() {
    const adjectives = [
        'Clever', 'Swift', 'Brave', 'Sneaky', 'Happy', 'Crazy', 'Silky',
        'Fluffy', 'Shiny', 'Quick', 'Mighty', 'Tiny', 'Wise', 'Lazy'
    ];
    
    const animals = [
        'Fox', 'Wolf', 'Bear', 'Panda', 'Tiger', 'Eagle', 'Shark',
        'Mole', 'Badger', 'Otter', 'Raccoon', 'Frog', 'Hedgehog'
    ];
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    const number = Math.random() > 0.5 ? Math.floor(Math.random() * 99) : ''; // 50% 加数字
    
    return `${adjective}${animal}${number}`;
}
function cleanup() {
  // 清理 wander 定时器 
  if (wanderInterval) { 
      clearInterval(wanderInterval); 
      wanderInterval = null; 
  }
  // 清理 attack 定时器
  if (attackInterval) {
    clearInterval(attackInterval);
    attackInterval = null;
  }

  // 清理活动监控定时器
  if (activityMonitorInterval) {
    clearInterval(activityMonitorInterval);
    activityMonitorInterval = null;
  }

  // 移除 bot 事件监听器并安全退出
  if (bot) {
    bot.removeAllListeners();
    if (typeof bot.quit === 'function') {
      bot.quit();
    }
    bot = null;
  }
}
createBot();
process.on('SIGINT', () => {
  console.log('?? 收到中断信号 (SIGINT)，正在清理资源...');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('?? 收到终止信号 (SIGTERM)，正在清理资源...');
  cleanup();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  if (err.name === 'PartialReadError') {
    // 忽略
    return;
  }
  console.error('未捕获异常:', err);
});

process.on('unhandledRejection', (reason) => {
  if (reason && reason.name === 'PartialReadError') {
    // 忽略
    return;
  }
  console.error('未处理的 Promise 拒绝:', reason);
});