#!/usr/bin/env node

const { writeFile, chmod, rm } = require('fs/promises');
const { exec: execCallback } = require('child_process');
const { promisify } = require('util');
const os = require('os');

// ==================== HELPERS ====================
const exec = promisify(execCallback);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Runs a shell command silently.
 * Only throws and logs on fatal execution errors.
 */
async function run(command) {
    try {
        const { stdout, stderr } = await exec(command);
        return { stdout: stdout.trim(), stderr };
    } catch (error) {
        console.error(`Error executing: ${command}`, error);
        throw error;
    }
}

/**
 * Starts a detached process in the background.
 */
function startDetached(command, args, logFile) {
    const fullCommand = `${command} ${args.join(' ')}`;
    let shellCommand = `nohup ${fullCommand} > ${logFile || '/dev/null'} 2>&1 &`;
    
    exec(shellCommand).catch(err => {
        console.error(`Failed to start detached process: ${fullCommand}`, err);
    });
}


// ==================== VARIABLES ====================
const env = process.env;
const UUID = env.UUID || 'faacf142-dee8-48c2-8558-641123eb939c';
const PASSWORD = UUID;
const NEZHA_SERVER = env.NEZHA_SERVER || 'nezha.mingfei1981.eu.org';
const NEZHA_PORT = env.NEZHA_PORT || '443';
const NEZHA_KEY = env.NEZHA_KEY || 'pdsioixxZbwpxy5hk2f';
const ARGO_DOMAIN = env.ARGO_DOMAIN || '';
const ARGO_AUTH = env.ARGO_AUTH || '';
const CFIP = env.CFIP || 'time.is';
const CFPORT = env.CFPORT || '443';
const NAME = env.NAME || 'MJJ';
const ARGO_PORT = env.ARGO_PORT || '8001';
const TU_PORT = env.TU_PORT || '3054';

// ==================== MAIN SCRIPT ====================
(async () => {
    try {
        // ==================== DOWNLOAD FUNCTION ====================
        async function downloadFile(url, filename) {
            try {
                await run(`curl -sL --fail "${url}" -o "${filename}"`);
            } catch (e) {
                console.error(`Failed to download ${filename} from ${url}`);
                process.exit(1);
            }
        }

        // ==================== ARCH DETECTION & DOWNLOAD ====================
        const arch = os.arch();
        let filesToDownload = {};

        if (arch === 'arm64') {
            filesToDownload = {
                icctu: "https://github.com/babama1001980/good/releases/download/npc/arm64tu.0-x86_64-unknown-linux-gnu",
                iccv2: "https://github.com/babama1001980/good/releases/download/npc/armv2",
                iccagent: "https://github.com/babama1001980/good/releases/download/npc/arm64agent",
                icc2go: "https://github.com/babama1001980/good/releases/download/npc/arm642go"
            };
        } else if (arch === 'x64') {
            filesToDownload = {
                icctu: "https://github.com/babama1001980/good/releases/download/npc/amd64tu.0-x86_64-unknown-linux-gnu",
                iccv2: "https://github.com/babama1001980/good/releases/download/npc/amdv2",
                iccagent: "https://github.com/babama1001980/good/releases/download/npc/amd64agent",
                icc2go: "https://github.com/babama1001980/good/releases/download/npc/amd642go"
            };
        } else {
            console.error(`Unsupported architecture: ${arch}`);
            process.exit(1);
        }

        for (const [filename, url] of Object.entries(filesToDownload)) {
            await downloadFile(url, filename);
            await chmod(filename, 0o755);
        }

        // ==================== GENERATE TUIC CERTIFICATES ====================
        await run('openssl ecparam -name prime256v1 -genkey -noout -out server.key >/dev/null 2>&1');
        await run('openssl req -new -x509 -key server.key -out server.crt -subj "/CN=www.bing.com" -days 36500 >/dev/null 2>&1');

        // ==================== TUIC CONFIG ====================
        const tuConfigContent = `{
  "server": "[::]:${TU_PORT}",
  "users": {
    "${UUID}": "${PASSWORD}"
  },
  "certificate": "server.crt",
  "private_key": "server.key",
  "congestion_control": "bbr",
  "alpn": ["h3", "spdy/3.1"],
  "udp_relay_ipv6": true,
  "zero_rtt_handshake": false,
  "dual_stack": true,
  "auth_timeout": "3s",
  "task_negotiation_timeout": "3s",
  "max_idle_time": "10s",
  "max_external_packet_size": 1500,
  "gc_interval": "3s",
  "gc_lifetime": "15s",
  "log_level": "warn"
}
`;
        await writeFile('tu_config.json', tuConfigContent);

        // ==================== XRAY CONFIG ====================
        const v2ConfigContent = `{
  "log": { "access": "/dev/null", "error": "/dev/null", "loglevel": "none" },
  "inbounds": [
    {
      "port": ${ARGO_PORT},
      "protocol": "vless",
      "settings": {
        "clients": [{ "id": "${UUID}", "flow": "xtls-rprx-vision" }],
        "decryption": "none",
        "fallbacks": [
          { "dest": 3001 }, { "path": "/vless-argo", "dest": 3002 },
          { "path": "/vmess-argo", "dest": 3003 }, { "path": "/trojan-argo", "dest": 3004 }
        ]
      },
      "streamSettings": { "network": "tcp" }
    },
    { "port": 3001, "listen": "127.0.0.1", "protocol": "vless", "settings": { "clients": [{ "id": "${UUID}" }], "decryption": "none" }, "streamSettings": { "network": "tcp", "security": "none" } },
    { "port": 3002, "listen": "127.0.0.1", "protocol": "vless", "settings": { "clients": [{ "id": "${UUID}" }], "decryption": "none" }, "streamSettings": { "network": "ws", "security": "none", "wsSettings": { "path": "/vless-argo" } }, "sniffing": { "enabled": true, "destOverride": ["http", "tls", "quic"] } },
    { "port": 3003, "listen": "127.0.0.1", "protocol": "vmess", "settings": { "clients": [{ "id": "${UUID}", "alterId": 0 }] }, "streamSettings": { "network": "ws", "wsSettings": { "path": "/vmess-argo" } }, "sniffing": { "enabled": true, "destOverride": ["http", "tls", "quic"] } },
    { "port": 3004, "listen": "127.0.0.1", "protocol": "trojan", "settings": { "clients": [{ "password": "${UUID}" }] }, "streamSettings": { "network": "ws", "security": "none", "wsSettings": { "path": "/trojan-argo" } }, "sniffing": { "enabled": true, "destOverride": ["http", "tls", "quic"] } }
  ],
  "dns": { "servers": ["https+local://8.8.8.8/dns-query"] },
  "outbounds": [ { "protocol": "freedom", "tag": "direct" }, { "protocol": "blackhole", "tag": "block" } ]
}
`;
        await writeFile('v2_config.json', v2ConfigContent);

        // ==================== ARGO CONFIG ====================
        if (ARGO_AUTH && ARGO_DOMAIN) {
            if (ARGO_AUTH.includes('TunnelSecret')) {
                await writeFile('tunnel.json', ARGO_AUTH);
                
                const { stdout: tunnelId } = await run(`echo "${ARGO_AUTH}" | cut -d\\\" -f12`);
                
                const tunnelYmlContent = `tunnel: ${tunnelId}
credentials-file: tunnel.json
protocol: http2
ingress:
  - hostname: ${ARGO_DOMAIN}
    service: http://localhost:${ARGO_PORT}
    originRequest:
      noTLSVerify: true
  - service: http_status:404
`;
                await writeFile('tunnel.yml', tunnelYmlContent);
            }
        }

        // ==================== START SERVICES ====================
        startDetached('./icctu', ['-c', 'tu_config.json']);
        startDetached('./iccv2', ['-c', 'v2_config.json']);

        if (ARGO_AUTH) {
            if (/^[A-Z0-9a-z=]{120,250}$/.test(ARGO_AUTH)) {
                startDetached('./icc2go', ['tunnel', '--edge-ip-version', 'auto', '--no-autoupdate', '--protocol', 'http2', 'run', '--token', ARGO_AUTH], 'argo.log');
            } else if (ARGO_AUTH.includes('TunnelSecret')) {
                startDetached('./icc2go', ['tunnel', '--edge-ip-version', 'auto', '--config', 'tunnel.yml', 'run'], 'argo.log');
            } else {
                startDetached('./icc2go', ['tunnel', '--edge-ip-version', 'auto', '--no-autoupdate', '--protocol', 'http2', '--logfile', 'argo.log', '--loglevel', 'info', '--url', `http://localhost:${ARGO_PORT}`]);
            }
        } else {
            startDetached('./icc2go', ['tunnel', '--edge-ip-version', 'auto', '--no-autoupdate', '--protocol', 'http2', '--logfile', 'argo.log', '--loglevel', 'info', '--url', `http://localhost:${ARGO_PORT}`]);
        }

        const tlsPorts = ["443", "8443", "2096", "2087", "2083", "2053"];
        const NEZHA_TLS_FLAG = tlsPorts.includes(NEZHA_PORT) ? "--tls" : "";

        if (NEZHA_SERVER && NEZHA_KEY) {
            if (NEZHA_PORT) {
                startDetached('./iccagent', ['-s', `${NEZHA_SERVER}:${NEZHA_PORT}`, '-p', NEZHA_KEY, NEZHA_TLS_FLAG].filter(Boolean));
            } else {
                const nezhaServerTls = tlsPorts.some(port => NEZHA_SERVER.endsWith(`:${port}`));
                const nezhaYamlContent = `client_secret: ${NEZHA_KEY}
debug: false
disable_auto_update: true
disable_command_execute: false
disable_force_update: true
disable_nat: false
disable_send_query: false
gpu: false
insecure_tls: false
ip_report_period: 1800
report_delay: 1
server: ${NEZHA_SERVER}
skip_connection_count: false
skip_procs_count: false
temperature: false
tls: ${nezhaServerTls}
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: ${UUID}
`;
                await writeFile('nezha.yaml', nezhaYamlContent);
                startDetached('./iccagent', ['-c', 'nezha.yaml']);
            }
        }

        // ==================== GET PUBLIC INFO ====================
        await sleep(8000);
        
        let HOST_IP = '';
        try {
            const { stdout } = await run('curl -s ipv4.ip.sb');
            HOST_IP = stdout;
        } catch (e) {
            try {
                const { stdout } = await run('curl -s ipv6.ip.sb');
                HOST_IP = stdout;
            } catch (err) {
                HOST_IP = '127.0.0.1';
            }
        }

        let ISP = 'Unknown-ISP';
        try {
            const { stdout } = await run(`curl -s https://speed.cloudflare.com/meta | awk -F\\\" '{print $26"-"$18}' | sed 's/ /_/g'`);
            if (stdout) ISP = stdout;
        } catch (e) { /* ignore */ }
        
        let ARGO_DOMAIN_FINAL = '';
        if (ARGO_DOMAIN) {
            ARGO_DOMAIN_FINAL = ARGO_DOMAIN;
        } else {
            try {
                const { stdout } = await run(`grep -oE "https://[a-z0-9.-]*\\.trycloudflare\\.com" argo.log | head -1 | cut -d/ -f3`);
                ARGO_DOMAIN_FINAL = stdout || "temporary-tunnel-not-ready.trycloudflare.com";
            } catch (e) {
                ARGO_DOMAIN_FINAL = "temporary-tunnel-not-ready.trycloudflare.com";
            }
        }

        // ==================== GENERATE SUBSCRIPTION ====================
        const vmessJson = JSON.stringify({
            "v": "2",
            "ps": `${NAME}-VMESS-${ISP}`,
            "add": CFIP,
            "port": "443",
            "id": UUID,
            "aid": "0",
            "scy": "none",
            "net": "ws",
            "type": "none",
            "host": ARGO_DOMAIN_FINAL,
            "path": "/vmess-argo?ed=2560",
            "tls": "tls",
            "sni": ARGO_DOMAIN_FINAL
        });
        const vmessBase64 = Buffer.from(vmessJson).toString('base64');
        
        const subContent = `start install success

=== TUIC ===
tuic://${UUID}:${PASSWORD}@${HOST_IP}:${TU_PORT}/?congestion_control=bbr&alpn=h3&sni=www.bing.com&udp_relay_mode=native&allow_insecure=1#${NAME}-TUIC-${ISP}

=== VLESS-WS-ARGO ===
vless://${UUID}@${CFIP}:443?encryption=none&security=tls&sni=${ARGO_DOMAIN_FINAL}&type=ws&host=${ARGO_DOMAIN_FINAL}&path=%2Fvless-argo%3Fed%3D2560#${NAME}-VLESS-${ISP}

=== VMESS-WS-ARGO ===
vmess://${vmessBase64}

=== TROJAN-WS-ARGO ===
trojan://${UUID}@${CFIP}:443?security=tls&sni=${ARGO_DOMAIN_FINAL}&type=ws&host=${ARGO_DOMAIN_FINAL}&path=%2Ftrojan-argo%3Fed%3D2560#${NAME}-TROJAN-${ISP}
`;
        await writeFile('sub.txt', subContent);
        
        const subBase64 = Buffer.from(subContent).toString('base64').replace(/(\r\n|\n|\r)/gm, "");
        await writeFile('sub_base64.txt', subBase64);

        // ==================== AUTO CLEANUP AFTER 60 SECONDS ====================
        const filesToClean = [
            'icctu', 'iccv2', 'iccagent', 'icc2go', 
            'server.key', 'server.crt', 
            'tu_config.json', 'v2_config.json', 
            'tunnel.json', 'tunnel.yml', 'nezha.yaml', 
            'argo.log', 'sub.txt', 'sub_base64.txt'
        ];

        setTimeout(() => {
            for (const file of filesToClean) {
                rm(file, { force: true, recursive: true }).catch(() => {
                    // ignore errors if file doesn't exist
                });
            }
        }, 60 * 1000);

        // ==================== KEEP ALIVE ====================
        setInterval(() => {
            // Keep process alive
        }, 1000 * 60 * 60);

    } catch (error) {
        console.error('An unrecoverable error occurred:', error);
        process.exit(1);
    }
})();