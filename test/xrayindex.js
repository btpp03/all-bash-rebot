const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

// ==================== VARIABLES ====================
const UUID = process.env.UUID || 'faacf142-dee8-48c2-8558-641123eb939c';
const NEZHA_SERVER = process.env.NEZHA_SERVER || 'nezha.mingfei1981.eu.org';
const NEZHA_PORT = process.env.NEZHA_PORT || '443';
const NEZHA_KEY = process.env.NEZHA_KEY || 'VcNmAA8ErRWXY9l13e';
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || '';
const ARGO_AUTH = process.env.ARGO_AUTH || '';
const CFIP = process.env.CFIP || 'jd.bp.cloudns.ch';
const CFPORT = process.env.CFPORT || '443';
const NAME = process.env.NAME || 'MJJ';
const ARGO_PORT = process.env.ARGO_PORT || '8001';

// ==================== UTILS ====================

// Silent logger (does nothing)
const log = (msg) => {};

// Async sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Download file (supports redirects)
const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const request = (currentUrl) => {
            https.get(currentUrl, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    return request(response.headers.location);
                }
                if (response.statusCode !== 200) {
                    return reject(new Error(`Failed to download ${currentUrl}`));
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => reject(err));
            });
        };
        request(url);
    });
};

// Get Cloudflare ISP info
const getIspInfo = () => {
    return new Promise((resolve) => {
        https.get('https://speed.cloudflare.com/meta', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const isp = `${json.asOrganization}-${json.region}`.replace(/ /g, '_');
                    resolve(isp);
                } catch (e) {
                    resolve('Unknown_ISP');
                }
            });
        }).on('error', () => resolve('Unknown_ISP'));
    });
};

// ==================== MAIN LOGIC ====================
(async () => {
    // 1. ARCH DETECTION & DOWNLOAD
    const arch = os.arch();
    const baseUrl = "https://github.com/babama1001980/good/releases/download/npc";
    let filesToDownload = [];

    if (arch === 'arm64') {
        filesToDownload = [
            { url: `${baseUrl}/armv2`, name: 'iccv2' },
            { url: `${baseUrl}/arm64agent`, name: 'iccagent' },
            { url: `${baseUrl}/arm642go`, name: 'icc2go' }
        ];
    } else if (arch === 'x64') {
        filesToDownload = [
            { url: `${baseUrl}/amdv2`, name: 'iccv2' },
            { url: `${baseUrl}/amd64agent`, name: 'iccagent' },
            { url: `${baseUrl}/amd642go`, name: 'icc2go' }
        ];
    } else {
        process.exit(1);
    }
    
    for (const item of filesToDownload) {
        try {
            await downloadFile(item.url, item.name);
            fs.chmodSync(item.name, 0o755);
            await sleep(2000); 
        } catch (e) {
            process.exit(1);
        }
    }

    // 2. XRAY CONFIG
    const v2Config = {
        log: { access: "/dev/null", error: "/dev/null", loglevel: "none" },
        inbounds: [
            {
                port: parseInt(ARGO_PORT),
                protocol: "vless",
                settings: {
                    clients: [{ id: UUID, flow: "xtls-rprx-vision" }],
                    decryption: "none",
                    fallbacks: [
                        { dest: 3001 },
                        { path: "/vless-argo", dest: 3002 },
                        { path: "/vmess-argo", dest: 3003 },
                        { path: "/trojan-argo", dest: 3004 }
                    ]
                },
                streamSettings: { network: "tcp" }
            },
            { port: 3001, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: UUID }], decryption: "none" }, streamSettings: { network: "tcp", security: "none" } },
            { port: 3002, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: UUID }], decryption: "none" }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/vless-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] } },
            { port: 3003, listen: "127.0.0.1", protocol: "vmess", settings: { clients: [{ id: UUID, alterId: 0 }] }, streamSettings: { network: "ws", wsSettings: { path: "/vmess-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] } },
            { port: 3004, listen: "127.0.0.1", protocol: "trojan", settings: { clients: [{ password: UUID }] }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/trojan-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] } }
        ],
        dns: { servers: ["https+local://8.8.8.8/dns-query"] },
        outbounds: [{ protocol: "freedom", tag: "direct" }, { protocol: "blackhole", tag: "block" }]
    };

    fs.writeFileSync('v2_config.json', JSON.stringify(v2Config, null, 2));

    // 3. ARGO CONFIG
    if (ARGO_AUTH && ARGO_DOMAIN) {
        if (ARGO_AUTH.includes("TunnelSecret")) {
            fs.writeFileSync('tunnel.json', ARGO_AUTH);
            try {
                const authJson = JSON.parse(ARGO_AUTH);
                const tunnelID = authJson.TunnelID; 
                
                const tunnelYml = `tunnel: ${tunnelID}
credentials-file: tunnel.json
protocol: http2
ingress:
  - hostname: ${ARGO_DOMAIN}
    service: http://localhost:${ARGO_PORT}
    originRequest:
      noTLSVerify: true
  - service: http_status:404
`;
                fs.writeFileSync('tunnel.yml', tunnelYml);
            } catch (e) {
                // Silent catch
            }
        }
    }

    // 4. START SERVICES
    
    // Start Xray
    spawn('./iccv2', ['-c', 'v2_config.json'], {
        detached: true,
        stdio: 'ignore'
    });

    // Start Argo
    const argoLogStream = fs.createWriteStream('argo.log');
    let argoArgs = [];
    
    if (ARGO_AUTH) {
        if (ARGO_AUTH.match(/^[A-Z0-9a-z=]{120,250}$/)) {
            argoArgs = ['tunnel', '--edge-ip-version', 'auto', '--no-autoupdate', '--protocol', 'http2', 'run', '--token', ARGO_AUTH];
        } else if (ARGO_AUTH.includes('TunnelSecret')) {
            argoArgs = ['tunnel', '--edge-ip-version', 'auto', '--config', 'tunnel.yml', 'run'];
        } else {
            argoArgs = ['tunnel', '--edge-ip-version', 'auto', '--no-autoupdate', '--protocol', 'http2', '--url', `http://localhost:${ARGO_PORT}`];
        }
    } else {
        argoArgs = ['tunnel', '--edge-ip-version', 'auto', '--no-autoupdate', '--protocol', 'http2', '--url', `http://localhost:${ARGO_PORT}`];
    }

    const argoProcess = spawn('./icc2go', argoArgs, {
        detached: true
    });
    argoProcess.stdout.pipe(argoLogStream);
    argoProcess.stderr.pipe(argoLogStream);

    // Start Nezha
    const tlsPorts = ["443", "8443", "2096", "2087", "2083", "2053"];
    const useTls = tlsPorts.includes(NEZHA_PORT);
    
    if (NEZHA_SERVER && NEZHA_KEY) {
        if (NEZHA_PORT) {
            const agentArgs = ['-s', `${NEZHA_SERVER}:${NEZHA_PORT}`, '-p', NEZHA_KEY];
            if (useTls) agentArgs.push('--tls');
            spawn('./iccagent', agentArgs, { detached: true, stdio: 'ignore' });
        } else {
            const isTls = tlsPorts.some(p => NEZHA_SERVER.includes(p)) ? "true" : "false";
            const nezhaYaml = `client_secret: ${NEZHA_KEY}
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
tls: ${isTls}
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: ${UUID}
`;
            fs.writeFileSync('nezha.yaml', nezhaYaml);
            spawn('./iccagent', ['-c', 'nezha.yaml'], { detached: true, stdio: 'ignore' });
        }
    }

    // 5. GET PUBLIC INFO
    await sleep(10000);

    const ispInfo = await getIspInfo();
    
    let finalArgoDomain = ARGO_DOMAIN;
    if (!finalArgoDomain) {
        try {
            const logContent = fs.readFileSync('argo.log', 'utf8');
            const match = logContent.match(/https:\/\/[a-z0-9.-]*\.trycloudflare\.com/);
            if (match) {
                finalArgoDomain = match[0].replace('https://', '');
            } else {
                finalArgoDomain = "temporary-tunnel-not-ready.trycloudflare.com";
            }
        } catch (e) {
            finalArgoDomain = "temporary-tunnel-not-ready.trycloudflare.com";
        }
    }

    // 6. GENERATE SUBSCRIPTION
    const vmessJson = {
        v: "2", ps: `${NAME}-VMESS-${ispInfo}`, add: CFIP, port: "443", id: UUID, aid: "0",
        scy: "none", net: "ws", type: "none", host: finalArgoDomain, path: "/vmess-argo?ed=2560",
        tls: "tls", sni: finalArgoDomain
    };
    const vmessLink = "vmess://" + Buffer.from(JSON.stringify(vmessJson)).toString('base64');

    const subContent = `start install success

=== VLESS-WS-ARGO ===
vless://${UUID}@${CFIP}:443?encryption=none&security=tls&sni=${finalArgoDomain}&type=ws&host=${finalArgoDomain}&path=%2Fvless-argo%3Fed%3D2560#${NAME}-VLESS-${ispInfo}

=== VMESS-WS-ARGO ===
${vmessLink}

=== TROJAN-WS-ARGO ===
trojan://${UUID}@${CFIP}:443?security=tls&sni=${finalArgoDomain}&type=ws&host=${finalArgoDomain}&path=%2Ftrojan-argo%3Fed%3D2560#${NAME}-TROJAN-${ispInfo}
`;

    fs.writeFileSync('sub.txt', subContent);
    fs.writeFileSync('sub_base64.txt', Buffer.from(subContent).toString('base64'));
    
    // Removed console.log output here for silence

    // 7. AUTO CLEANUP
    setTimeout(() => {
        const filesToDelete = ['iccv2', 'iccagent', 'icc2go', 'v2_config.json', 'tunnel.json', 'tunnel.yml', 'nezha.yaml', 'argo.log', 'sub.txt', 'sub_base64.txt'];
        filesToDelete.forEach(f => {
            fs.unlink(f, () => {}); 
        });
        fs.readdir('.', (err, files) => {
            if (files) {
                files.filter(f => f.startsWith('core')).forEach(f => fs.unlink(f, () => {}));
            }
        });
    }, 60000);

    // 8. KEEP ALIVE
    setInterval(() => {}, 1000 * 60 * 60); 

})();