/**
 * mc.js - The complete Node.js script (V4 - Fixed Xray config JS syntax error).
 *
 * Core Fix: Fixed sniffing/destOverride syntax error for Fallback targets (3002, 3003, 3004) in v2Config.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// ==================== 1. VARIABLES ====================
// Read from environment variables, use default if not present
const UUID = process.env.UUID || 'faacf142-dee8-48c2-8558-641123eb939c';
const PASSWORD = UUID;
const HYSTERIA_PORT = process.env.SERVER_PORT || process.env.PORT || '7860';
const NEZHA_SERVER = process.env.NEZHA_SERVER || 'nezhak2.btpp.ggff.net';
const NEZHA_PORT = process.env.NEZHA_PORT || '443';
const NEZHA_KEY = process.env.NEZHA_KEY || 'gOjH5FFxeRga8QbbHu';
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || '';
const ARGO_AUTH = process.env.ARGO_AUTH || '';
const CFIP = process.env.CFIP || 'jd.bp.cloudns.ch';
const CFPORT = process.env.CFPORT || '443';
const NAME = process.env.NAME || 'lunes-btpp04';
const ARGO_PORT = process.env.ARGO_PORT || '8001'; 

// ==================== 2. Helper Functions ====================

// Modified runCommand to suppress all output (stdout and stderr)
function runCommand(command) {
    try {
        // Use 'ignore' for stdio[2] (stderr) to suppress error messages from execSync
        // Note: execSync will still throw on non-zero exit code, which is handled in catch block
        return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (error) {
        // Suppress console.error output, but still check for 'sleep' to avoid exiting
        if (!command.includes('sleep')) process.exit(1); 
        return '';
    }
}

// Modified downloadFile to suppress console.log and use 'ignore' for curl output
function downloadFile(url, filename) {
    try {
        // Use -s (silent) in curl and suppress stdout/stderr of execSync
        runCommand(`curl -sL --fail --connect-timeout 10 "${url}" -o "${filename}"`);
    } catch (error) {
        // Suppress console.error output
        process.exit(1);
    }
}

// Modified startService to suppress console.log
function startService(command, args) {
    const child = spawn(command, args, {
        detached: true,
        // Using 'ignore' for stdio to suppress output of the spawned process
        stdio: 'ignore' 
    });
    child.unref(); 
}

// ==================== 3. ARCH DETECTION & DOWNLOAD ====================
const ARCH = runCommand('uname -m');

let hysteriaBinary = '';
let v2Binary = '';
let agentBinary = '';
let goBinary = '';

if (ARCH === "aarch64" || ARCH === "arm64") {
    hysteriaBinary = "https://github.com/apernet/hysteria/releases/download/app%2Fv2.6.5/hysteria-linux-arm64";
    v2Binary = "https://github.com/babama1001980/good/releases/download/npc/armv2";
    agentBinary = "https://github.com/babama1001980/good/releases/download/npc/arm64agent";
    goBinary = "https://github.com/babama1001980/good/releases/download/npc/arm642go";
} else if (ARCH === "x86_64" || ARCH === "amd64") {
    hysteriaBinary = "https://github.com/apernet/hysteria/releases/download/app%2Fv2.6.5/hysteria-linux-amd64";
    v2Binary = "https://github.com/babama1001980/good/releases/download/npc/amdv2";
    agentBinary = "https://github.com/babama1001980/good/releases/download/npc/amd64agent";
    goBinary = "https://github.com/babama1001980/good/releases/download/npc/amd642go";
} else {
    process.exit(1);
}

downloadFile(hysteriaBinary, "icchy");
runCommand('sleep 5');
downloadFile(v2Binary, "iccv2");
runCommand('sleep 5');
downloadFile(agentBinary, "iccagent");
runCommand('sleep 5');
downloadFile(goBinary, "icc2go");

// Suppress output of chmod
runCommand('chmod +x "icchy" "iccv2" "iccagent" "icc2go" 2>/dev/null');


// ==================== 4. GENERATE HY CERTIFICATES ====================
// Suppress console.log
runCommand('openssl ecparam -name prime256v1 -genkey -noout -out server.key >/dev/null 2>&1');
runCommand('openssl req -new -x509 -key server.key -out server.crt -subj "/CN=www.bing.com" -days 36500 >/dev/null 2>&1');

// ==================== 5. HYSTERIA2 CONFIG ====================
// Suppress console.log
const hyConfig = {
    listen: `:${HYSTERIA_PORT}`,
    tls: {
        cert: "server.crt",
        key: "server.key"
    },
    auth: {
        type: "password",
        password: PASSWORD
    },
    quic: {
        maxIdleTimeout: "30s",
        disablePathMTUDiscovery: false
    },
    udpIdleTimeout: "60s",
    disableUDP: false,
    ignoreClientBandwidth: false
};
fs.writeFileSync('hy_config.json', JSON.stringify(hyConfig, null, 2));


// ==================== 6. XRAY CONFIG (Restored Fallback with fix) ====================
// Suppress console.log

const v2Config = {
    log: { "access": "/dev/null", "error": "/dev/null", "loglevel": "none" },
    inbounds: [
        // Inbound 1 (Main Fallback Dispatcher) - Listens for pure HTTP traffic forwarded by Argo
        {
            "port": parseInt(ARGO_PORT),
            "protocol": "vless",
            "settings": {
                "clients": [{ "id": UUID, "flow": "" }], // FIX: Removed "xtls-rprx-vision"
                "decryption": "none",
                "fallbacks": [
                    { "dest": 3001 }, 
                    { "path": "/vless-argo", "dest": 3002 },
                    { "path": "/vmess-argo", "dest": 3003 }, 
                    { "path": "/trojan-argo", "dest": 3004 }
                ]
            },
            "streamSettings": { "network": "tcp" } // Receives pure HTTP forwarded by Argo
        },
        // Fallback Target 1 (VLESS-TCP)
        { "port": 3001, "listen": "127.0.0.1", "protocol": "vless", "settings": { "clients": [{ "id": UUID }], "decryption": "none" }, "streamSettings": { "network": "tcp", "security": "none" } },
        
        // Fallback Target 2 (VLESS-WS)
        { "port": 3002, "listen": "127.0.0.1", "protocol": "vless", "settings": { "clients": [{ "id": UUID }], "decryption": "none" }, "streamSettings": { "network": "ws", "security": "none", "wsSettings": { "path": "/vless-argo" } }, "sniffing": { "enabled": true, "destOverride": ["http", "tls", "quic"] } },
        
        // Fallback Target 3 (VMESS-WS)
        { "port": 3003, "listen": "127.0.0.1", "protocol": "vmess", "settings": { "clients": [{ "id": UUID, "alterId": 0 }] }, "streamSettings": { "network": "ws", "wsSettings": { "path": "/vmess-argo" } }, "sniffing": { "enabled": true, "destOverride": ["http", "tls", "quic"] } },
        
        // Fallback Target 4 (TROJAN-WS) - FIX: Fixed destOverride syntax
        { "port": 3004, "listen": "127.0.0.1", "protocol": "trojan", "settings": { "clients": [{ "password": UUID }] }, "streamSettings": { "network": "ws", "security": "none", "wsSettings": { "path": "/trojan-argo" } }, "sniffing": { "enabled": true, "destOverride": ["http", "tls", "quic"] } }
    ],
    "dns": { "servers": ["https+local://8.8.8.8/dns-query"] },
    "outbounds": [ { "protocol": "freedom", "tag": "direct" }, { "protocol": "blackhole", "tag": "block" } ]
};
fs.writeFileSync('v2_config.json', JSON.stringify(v2Config, null, 2));


// ==================== 7. ARGO CONFIG ====================
const ARGO_TARGET_URL = `http://localhost:${ARGO_PORT}`; // Forward back to original port 8001

if (ARGO_AUTH && ARGO_DOMAIN) {
    if (ARGO_AUTH.includes('TunnelSecret')) {
        // Suppress console.log
        fs.writeFileSync('tunnel.json', ARGO_AUTH);
        
        // Use Node.js equivalent to cut command to get TunnelID
        let tunnelId = 'unknown-tunnel-id';
        try {
            // Simulate: echo "${ARGO_AUTH}" | cut -d'"' -f12
            const authParts = ARGO_AUTH.split('"');
            if (authParts.length > 11) {
                 tunnelId = authParts[11];
            }
        } catch (e) {}

        const tunnelYml = `tunnel: ${tunnelId}\n` +
                          `credentials-file: tunnel.json\n` +
                          `protocol: http2\n` +
                          `ingress:\n` +
                          `- hostname: ${ARGO_DOMAIN}\n` +
                          `  service: ${ARGO_TARGET_URL}\n` + // Forward to Xray main inbound
                          `  originRequest:\n` +
                          `    noTLSVerify: true\n` +
                          `- service: http_status:404\n`;
        fs.writeFileSync('tunnel.yml', tunnelYml);
    }
}


// ==================== 8. START SERVICES ====================
// Suppress console.log

startService('./icchy', ['server', '-c', 'hy_config.json']);
startService('./iccv2', ['-c', 'v2_config.json']);

if (ARGO_AUTH) {
    if (ARGO_AUTH.match(/^[A-Z0-9a-z=]{120,250}$/)) {
        startService('./icc2go', ['tunnel', '--edge-ip-version', 'auto', '--no-autoupdate', '--protocol', 'http2', 'run', '--token', ARGO_AUTH, '--url', ARGO_TARGET_URL]);
    } else if (ARGO_AUTH.includes('TunnelSecret')) {
        startService('./icc2go', ['tunnel', '--edge-ip-version', 'auto', '--config', 'tunnel.yml', 'run']);
    } else {
        startService('./icc2go', ['tunnel', '--edge-ip-version', 'auto', '--no-autoupdate', '--protocol', 'http2', '--logfile', 'argo.log', '--loglevel', 'info', '--url', ARGO_TARGET_URL]);
    }
} else {
    startService('./icc2go', ['tunnel', '--edge-ip-version', 'auto', '--no-autoupdate', '--protocol', 'http2', '--logfile', 'argo.log', '--loglevel', 'info', '--url', ARGO_TARGET_URL]);
}

if (NEZHA_SERVER && NEZHA_KEY) {
    const tlsPorts = ["443", "8443", "2096", "2087", "2083", "2053"];
    const isTls = tlsPorts.includes(NEZHA_PORT.toString());
    
    let nezhaArgs = ['-s', `${NEZHA_SERVER}:${NEZHA_PORT}`, '-p', NEZHA_KEY];
    if (isTls) {
        nezhaArgs.push('--tls');
    }

    startService('./iccagent', nezhaArgs);
}


// ==================== 9. GET PUBLIC INFO ====================
// Suppress console.log
runCommand('sleep 15'); 

const HOST_IP = runCommand('curl -s ipv4.ip.sb || curl -s ipv6.ip.sb');
const ISP_RAW = runCommand('curl -s https://speed.cloudflare.com/meta || echo "{}"');

let ISP = 'Unknown_ISP';
try {
    const meta = JSON.parse(ISP_RAW);
    if (meta.colo && meta.asn && meta.asn.name) {
        ISP = `${meta.colo}-${meta.asn.name.replace(/ /g, '_')}`;
    }
} catch (e) {}

let ARGO_DOMAIN_FINAL = ARGO_DOMAIN;
if (!ARGO_DOMAIN_FINAL) {
    try {
        const argoLog = fs.readFileSync('argo.log', 'utf8');
        const match = argoLog.match(/https:\/\/[a-z0-9.-]*\.trycloudflare\.com/);
        if (match) {
            ARGO_DOMAIN_FINAL = match[0].split('//')[1];
        }
    } catch (e) {}
    if (!ARGO_DOMAIN_FINAL) {
        ARGO_DOMAIN_FINAL = "temporary-tunnel-not-ready.trycloudflare.com";
    }
}


// ==================== 10. GENERATE SUBSCRIPTION ====================
// Suppress console.log

function toBase64(str) {
    return Buffer.from(str, 'utf8').toString('base64');
}

const vmessConfig = JSON.stringify({
    v: "2",
    ps: `${NAME}-VMESS-${ISP}`,
    add: CFIP,
    port: "443",
    id: UUID,
    aid: "0",
    scy: "none",
    net: "ws",
    type: "none",
    host: ARGO_DOMAIN_FINAL,
    path: "/vmess-argo?ed=2560",
    tls: "tls",
    sni: ARGO_DOMAIN_FINAL
});
const vmessBase64 = toBase64(vmessConfig);

const subContent = `start install success

=== HY2 ===
hysteria2://${PASSWORD}@${HOST_IP}:${HYSTERIA_PORT}/?insecure=1&sni=www.bing.com#${NAME}-HY-${ISP}

=== VLESS-WS-ARGO ===
vless://${UUID}@${CFIP}:443?encryption=none&security=tls&sni=${ARGO_DOMAIN_FINAL}&type=ws&host=${ARGO_DOMAIN_FINAL}&path=%2Fvless-argo%3Fed%3D2560#${NAME}-VLESS-${ISP}

=== VMESS-WS-ARGO ===
vmess://${vmessBase64}

=== TROJAN-WS-ARGO ===
trojan://${UUID}@${CFIP}:443?security=tls&sni=${ARGO_DOMAIN_FINAL}&type=ws&host=${ARGO_DOMAIN_FINAL}&path=%2Ftrojan-argo%3Fed%3D2560#${NAME}-TROJAN-${ISP}`;

fs.writeFileSync('sub.txt', subContent);
fs.writeFileSync('sub_base64.txt', toBase64(subContent));

// ==================== 11. AUTO CLEANUP & KEEP ALIVE ====================

// Run cleanup after 60 seconds
setTimeout(() => {
    // Suppress console.log
    const filesToClean = [
        'icchy', 'iccv2', 'iccagent', 'icc2go', 'server.key', 
        'server.crt', 'hy_config.json', 'v2_config.json', 'tunnel.json', 
        'tunnel.yml', 'nezha.yaml', 'argo.log', 'sub.txt', 'sub_base64.txt'
    ];
    filesToClean.forEach(file => {
        try {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        } catch (e) {
            // Suppress console.error
        }
    });
    // Suppress console.log
}, 60000); 

// Keep Alive, prevents container shutdown
// Suppress console.log
setInterval(() => {}, 3600000);
