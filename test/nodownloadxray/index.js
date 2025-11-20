const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const os = require('os');

// ==================== CONFIGURATION ====================
const UUID = process.env.UUID || 'faacf142-dee8-48c2-8558-641123eb939c';
const NEZHA_SERVER = process.env.NEZHA_SERVER || 'nezha.mingfei1981.eu.org';
const NEZHA_PORT = process.env.NEZHA_PORT || '443';
const NEZHA_KEY = process.env.NEZHA_KEY || '';
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || '';
const ARGO_AUTH = process.env.ARGO_AUTH || '';
const CFIP = process.env.CFIP || 'jd.bp.cloudns.ch';
const NAME = process.env.NAME || 'MJJ';
const ARGO_PORT = process.env.ARGO_PORT || '8001';

// ==================== UTILITIES ====================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// ==================== MAIN ====================
(async () => {
    // 1. SET EXECUTE PERMISSIONS (Fixes EACCES for pre-uploaded binaries)
    try {
        fs.chmodSync('iccv2', 0o755);
        fs.chmodSync('iccagent', 0o755);
        fs.chmodSync('icc2go', 0o755);
    } catch (e) {
        // Ignore errors if files are not present
    }
    
    await sleep(2000); 

    // 2. ARGO CONFIGURATION
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
                // Ignore
            }
        }
    }

    // 3. START SERVICES
    
    // Start Xray
    spawn('./iccv2', ['-c', 'v2_config.json'], {
        detached: true,
        stdio: 'ignore'
    });

    // Start Argo
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
    
    spawn('./icc2go', argoArgs, {
        detached: true,
        stdio: 'ignore' 
    });


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

    // 4. GENERATE & PRINT SUBSCRIPTION
    await sleep(10000); 

    const ispInfo = await getIspInfo();
    const finalArgoDomain = ARGO_DOMAIN;

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
    console.log('--- SUBSCRIPTION INFO ---');
    console.log(subContent);
    console.log('--- BASE64 SUBSCRIPTION ---');
    console.log(Buffer.from(subContent).toString('base64'));
    console.log('-------------------------');

    // 5. TERMINAL CLEAR & KEEP ALIVE
    setTimeout(() => {
        // Clear the terminal after 1 minute (60000 ms), but do not print any message afterwards.
        process.stdout.write('\x1Bc'); 
    }, 60000);

    setInterval(() => {}, 1000 * 60 * 60); 

})();
