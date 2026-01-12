#!/usr/bin/env sh

# ==================== VARIABLES ====================
export UUID=${UUID:-'faacf142-dee8-48c2-8558-641123eb939c'}
export PASSWORD="$UUID" # HY2 Password

# Custom port (user-defined, not random)
export HY_PORT=${HY_PORT:-'5058'}
export NAME=${NAME:-'MJJ'}

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
if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
download_file "https://github.com/apernet/hysteria/releases/download/app%2Fv2.6.5/hysteria-linux-arm64" "icchy"
sleep 5
elif [[ "$ARCH" == "x86_64" || "$ARCH" == "amd64" ]]; then
download_file "https://github.com/apernet/hysteria/releases/download/app%2Fv2.6.5/hysteria-linux-amd64" "icchy"
sleep 5
else
exit 1
fi

chmod +x "icchy" 2>/dev/null

# ==================== GENERATE HY CERTIFICATES ====================
openssl ecparam -name prime256v1 -genkey -noout -out server.key >/dev/null 2>&1
openssl req -new -x509 -key server.key -out server.crt -subj "/CN=www.bing.com" -days 36500 >/dev/null 2>&1

# ==================== HY CONFIG ====================
cat > hy_config.json << EOF
{
"listen": ":$HY_PORT",
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

# ==================== START SERVICES (silent) ====================
nohup ./"icchy" server -c hy_config.json > /dev/null 2>&1 &

# ==================== GET PUBLIC INFO (silent) ====================
sleep 15
HOST_IP=$(curl -s ipv4.ip.sb || curl -s ipv6.ip.sb)
ISP=$(curl -s https://speed.cloudflare.com/meta | awk -F\" '{print $26"-"$18}' | sed 's/ /_/g')

# ==================== GENERATE SUBSCRIPTION (silent) ====================
cat > sub.txt << EOF
start install success

=== HY2 ===
hysteria2://$PASSWORD@$HOST_IP:$HY_PORT/?insecure=1&sni=www.bing.com#$NAME-HY-$ISP
EOF

base64 -w0 sub.txt > sub_base64.txt

# ==================== AUTO CLEANUP AFTER 60 SECONDS (in background) ====================

(
sleep 60
rm -rf icchy server.key server.crt hy_config.json sub.txt sub_base64.txt core core.*
) &

# ==================== START GAME (KEEP ALIVE) ====================

tail -f /dev/null
