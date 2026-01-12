import os
import time
import requests
import psutil
import sys
from typing import Dict
from fastapi import FastAPI, UploadFile, File, Body, Form
from fastapi.responses import HTMLResponse
import uvicorn

# --- [ 1. 静默运行配置 ] ---
def apply_silent_mode():
    # 彻底关闭终端输出，保持后台静默
    sys.stdout = open(os.devnull, 'w')
    sys.stderr = open(os.devnull, 'w')

app = FastAPI()
active_bots: Dict[str, dict] = {}

# --- [ 2. API 通讯核心逻辑 ] ---
def pto_api_call(bot, endpoint: str, method: str = "POST", data: dict = None):
    s = bot.get("settings", {}).get("pterodactyl", {})
    url = s.get("url", "").strip().rstrip("/")
    key = s.get("key", "").strip()
    sid = s.get("id", "").strip()

    if not all([url, key, sid]): return None, "配置不完整"

    target_url = f"{url}/api/client/servers/{sid}{endpoint}"
    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

    try:
        if method == "GET":
            response = requests.get(target_url, headers=headers, timeout=12)
        else:
            response = requests.post(target_url, json=data or {}, headers=headers, timeout=12)
        
        if response.status_code in [200, 204]:
            return response, None
        return None, f"状态码:{response.status_code}"
    except Exception as e:
        return None, str(e)

# --- [ 3. API 路由接口 ] ---

@app.get("/api/bots")
async def list_bots():
    return {"bots": list(active_bots.values())}

@app.post("/api/bots")
async def add_bot(data: dict = Body(...)):
    bid = f"bot_{os.urandom(2).hex()}"
    active_bots[bid] = {
        "id": bid, "username": data.get('username', '新实例'), "host": data.get('host', '未知'),
        "logs": [], "settings": {"pterodactyl": {"url": "", "key": "", "id": ""}}
    }
    return {"success": True}

@app.delete("/api/bots/{bid}")
async def delete_bot(bid: str):
    if bid in active_bots:
        del active_bots[bid]
        return {"success": True}
    return {"success": False}

@app.post("/api/bots/{bid}/config")
async def update_config(bid: str, data: dict = Body(...)):
    if bid in active_bots:
        active_bots[bid]["settings"]["pterodactyl"] = data
        return {"success": True}
    return {"success": False}

# --- [ 核心修复：兼容 PY 实例的文件上传 ] ---
@app.post("/api/bots/{bid}/upload")
async def upload_file(bid: str, file: UploadFile = File(...), path: str = Form("/")):
    bot = active_bots.get(bid)
    if not bot: return {"success": False}
    
    # 1. 向翼手龙获取上传授权 URL
    res, err = pto_api_call(bot, "/files/upload", "GET")
    if res and res.status_code == 200:
        upload_base_url = res.json()['attributes']['url']
        
        # 2. 准备文件流
        file_content = await file.read()
        
        try:
            # 关键：使用 params 传递 directory，解决 Python Egg 路径解析不稳定的问题
            # 同时增加 timeout 应对 Python 实例响应较慢的情况
            up = requests.post(
                upload_base_url,
                params={"directory": path},
                files={'files': (file.filename, file_content)},
                timeout=30 
            )
            
            if up.status_code in [200, 204]:
                bot["logs"].insert(0, {"time": time.strftime("%H:%M:%S"), "msg": f"📁 成功上传至 {path}: {file.filename}", "color": "text-blue-400 font-bold"})
                return {"success": True}
            else:
                bot["logs"].insert(0, {"time": time.strftime("%H:%M:%S"), "msg": f"❌ 上传失败: 面板拒绝({up.status_code})", "color": "text-red-400"})
        except Exception as e:
            bot["logs"].insert(0, {"time": time.strftime("%H:%M:%S"), "msg": f"❌ 上传异常: {str(e)}", "color": "text-red-500"})
    else:
        bot["logs"].insert(0, {"time": time.strftime("%H:%M:%S"), "msg": f"❌ 无法连接API: {err}", "color": "text-red-500"})
    return {"success": False}

@app.post("/api/bots/{bid}/power")
async def power_control(bid: str, data: dict = Body(...)):
    bot = active_bots.get(bid)
    if bot:
        sig = data.get("signal")
        res, err = pto_api_call(bot, "/power", "POST", data={"signal": sig})
        bot["logs"].insert(0, {"time": time.strftime("%H:%M:%S"), "msg": f"⚡ 电源操作: {sig.upper()}" if res else f"❌ 操作失败: {err}", "color": "text-emerald-400" if res else "text-red-500"})
    return {"success": True}

@app.post("/api/bots/{bid}/command")
async def send_command(bid: str, data: dict = Body(...)):
    bot = active_bots.get(bid)
    if bot:
        cmd = data.get("command")
        res, err = pto_api_call(bot, "/command", "POST", data={"command": cmd})
        bot["logs"].insert(0, {"time": time.strftime("%H:%M:%S"), "msg": f"▶️ 执行: {cmd}" if res else f"❌ 指令无效", "color": "text-orange-400"})
    return {"success": True}

# --- [ 4. UI 界面逻辑 ] ---
@app.get("/", response_class=HTMLResponse)
async def index():
    return """
    <!DOCTYPE html>
    <html class="dark">
    <head>
        <meta charset="utf-8"><title>toffee - Universal Controller</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            body { background: #020617; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; }
            .glass { background: #0f172a; border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; position: relative; transition: 0.3s; }
            .glass:hover { border-color: rgba(59,130,246,0.5); }
            .log-box { background: #000000; border-radius: 12px; height: 150px; overflow-y: auto; font-family: 'Fira Code', monospace; font-size: 11px; padding: 12px; border: 1px solid #1e293b; }
            input { background: #020617; border: 1px solid #1e293b; padding: 8px 12px; border-radius: 10px; font-size: 12px; outline: none; transition: 0.2s; }
            input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
            .locked { opacity: 0.4; pointer-events: none; background: #0f172a; }
            .btn-del { position: absolute; top: 1.5rem; right: 7rem; color: #f87171; font-size: 11px; border: 1px solid #ef4444; padding: 3px 10px; border-radius: 8px; cursor: pointer; transition: 0.2s; font-weight: bold; }
            .btn-del:hover { background: #ef4444; color: white; }
        </style>
    </head>
    <body class="p-8" onload="startSync()">
        <div class="max-w-4xl mx-auto">
            <header class="mb-10 flex justify-between items-end">
                <div>
                    <h1 class="text-4xl font-black tracking-tighter italic text-blue-500">TOFFEE PRO</h1>
                    <p class="text-slate-500 text-xs mt-1 uppercase tracking-widest">Multi-Instance Management System</p>
                </div>
                <div class="glass px-4 py-2 flex gap-3">
                    <input id="new_h" placeholder="目标地址" class="w-40">
                    <input id="new_u" placeholder="显示名称" class="w-32">
                    <button onclick="addBot()" class="bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-xl font-bold text-xs transition-all">部署监控</button>
                </div>
            </header>
            
            <div id="list" class="grid gap-8"></div>
        </div>

        <script>
            let editingId = null; 

            async function startSync() {
                updateUI();
                setInterval(() => { if (!editingId) updateUI(); }, 5000);
            }

            async function addBot() {
                const h = document.getElementById('new_h').value;
                const u = document.getElementById('new_u').value;
                if(!h || !u) return;
                await fetch('/api/bots', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({host:h, username:u})});
                document.getElementById('new_h').value = ''; document.getElementById('new_u').value = '';
                updateUI();
            }

            async function deleteBot(bid) {
                if(!confirm('确定永久移除此实例监控吗？')) return;
                await fetch('/api/bots/'+bid, {method:'DELETE'});
                updateUI();
            }

            function toggleEdit(id) {
                const btn = document.getElementById('btn-'+id);
                const inputs = document.querySelectorAll('.in-'+id);
                if (editingId === id) {
                    saveConf(id).then(() => {
                        editingId = null;
                        btn.innerText = "修改配置";
                        btn.className = "bg-slate-800 hover:bg-slate-700 px-4 py-1.5 rounded-lg text-[11px] transition";
                        inputs.forEach(i => i.classList.add('locked'));
                        updateUI();
                    });
                } else {
                    editingId = id;
                    btn.innerText = "确认并保存";
                    btn.className = "bg-blue-600 px-4 py-1.5 rounded-lg text-[11px] font-bold animate-pulse";
                    inputs.forEach(i => i.classList.remove('locked'));
                }
            }

            async function saveConf(id) {
                const data = {
                    url: document.getElementById('u-'+id).value,
                    id: document.getElementById('s-'+id).value,
                    key: document.getElementById('k-'+id).value
                };
                await fetch('/api/bots/'+id+'/config', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
            }

            async function updateUI() {
                const r = await fetch('/api/bots'); const d = await r.json();
                document.getElementById('list').innerHTML = d.bots.map(b => `
                    <div class="glass p-8">
                        <div class="btn-del" onclick="deleteBot('${b.id}')">删除实例</div>
                        <div class="flex justify-between items-center mb-6">
                            <div>
                                <h2 class="text-2xl font-bold text-white">${b.username}</h2>
                                <p class="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-1">${b.host}</p>
                            </div>
                            <button id="btn-${b.id}" onclick="toggleEdit('${b.id}')" class="bg-slate-800 hover:bg-slate-700 px-4 py-1.5 rounded-lg text-[11px]">修改配置</button>
                        </div>

                        <div class="grid grid-cols-2 gap-4 mb-6">
                            <div class="flex flex-col gap-1">
                                <label class="text-[9px] uppercase text-slate-500 ml-1">Panel URL</label>
                                <input id="u-${b.id}" placeholder="https://..." value="${b.settings.pterodactyl.url}" class="in-${b.id} locked">
                            </div>
                            <div class="flex flex-col gap-1">
                                <label class="text-[9px] uppercase text-slate-500 ml-1">Server ID</label>
                                <input id="s-${b.id}" placeholder="8位短ID" value="${b.settings.pterodactyl.id}" class="in-${b.id} locked">
                            </div>
                            <div class="flex flex-col gap-1 col-span-2">
                                <label class="text-[9px] uppercase text-slate-500 ml-1">API Client Key</label>
                                <input id="k-${b.id}" type="password" placeholder="ptlc_..." value="${b.settings.pterodactyl.key}" class="in-${b.id} locked">
                            </div>
                        </div>

                        <div class="flex items-center gap-3 mb-6 pt-4 border-t border-white/5">
                            <button onclick="pwr('${b.id}','start')" class="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-5 py-2 rounded-xl text-xs font-bold transition">启动</button>
                            <button onclick="pwr('${b.id}','restart')" class="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-5 py-2 rounded-xl text-xs font-bold transition">重启</button>
                            <button onclick="pwr('${b.id}','stop')" class="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-5 py-2 rounded-xl text-xs font-bold transition">停止</button>
                            <div class="flex-1"></div>
                            
                            <div class="flex items-center bg-black/40 rounded-xl px-2 border border-white/5">
                                <span class="text-[10px] text-slate-500 px-2 font-mono">DIR:</span>
                                <input id="path-${b.id}" placeholder="/" value="/" class="w-20 text-[11px] bg-transparent border-none text-blue-400 font-bold">
                                <input type="file" id="f-${b.id}" onchange="upFile('${b.id}')" class="hidden">
                                <button onclick="document.getElementById('f-${b.id}').click()" class="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-1.5 rounded-lg text-[11px] font-bold transition m-1">上传</button>
                            </div>
                        </div>

                        <div class="flex gap-3 mb-6">
                            <input id="cmd-${b.id}" value="${localStorage.getItem('c_'+b.id)||''}" oninput="localStorage.setItem('c_'+b.id, this.value)" placeholder="发送命令到控制台..." class="flex-1 bg-black/60 border-none h-11 text-orange-400 font-mono">
                            <button onclick="sendCmd('${b.id}')" class="bg-orange-600 hover:bg-orange-500 px-6 py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-orange-900/20">发送</button>
                        </div>

                        <div class="log-box">
                            ${b.logs.map(l => `<div class="mb-1"><span class="opacity-20 font-mono mr-2">${l.time}</span><span class="${l.color}">${l.msg}</span></div>`).join('')}
                        </div>
                    </div>
                `).join('');
            }

            async function upFile(id) {
                const f = document.getElementById('f-'+id).files[0];
                if(!f) return;
                const fd = new FormData();
                fd.append('file', f);
                fd.append('path', document.getElementById('path-'+id).value);
                
                await fetch('/api/bots/'+id+'/upload', {method:'POST', body:fd});
                document.getElementById('f-'+id).value = ''; 
                updateUI();
            }
            async function pwr(id, signal) { await fetch('/api/bots/'+id+'/power', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({signal})}); updateUI(); }
            async function sendCmd(id) {
                const cmd = document.getElementById('cmd-'+id).value;
                if(!cmd) return;
                await fetch('/api/bots/'+id+'/command', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({command:cmd})});
                updateUI();
            }
        </script>
    </body>
    </html>
    """

if __name__ == "__main__":
    apply_silent_mode()
    # 使用 4681 端口，log_level="critical" 确保完全静默
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("SERVER_PORT", 4681)), log_level="critical")