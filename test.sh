#!/bin/bash

export UUID=${UUID:-'faacf142-dee8-48c2-8558-641123eb939c'} # 如开启哪吒v1,不同的平台需要改一下，否则会覆盖
export NEZHA_SERVER=${NEZHA_SERVER:-'nezha.mingfei1981.eu.org'}       # v1哪吒填写形式：nezha.abc.com:8008,v0哪吒填写形式：nezha.abc.com
export NEZHA_PORT=${NEZHA_PORT:-'443'}           # v1哪吒不要填写这个,v0哪吒agent端口为{443,8443,2053,2083,2087,2096}其中之一时自动开启tls
export NEZHA_KEY=${NEZHA_KEY:-'HnVNA6BLnNaW19979g'}             # 哪吒v0-agent密钥或v1的NZ_CLIENT_SECRET
export ARGO_DOMAIN=${ARGO_DOMAIN:-'liquidnodes.ncaa.nyc.mn'}         # 固定隧道域名,留空即启用临时隧道
export ARGO_AUTH=${ARGO_AUTH:-'eyJhIjoiOTk3ZjY4OGUzZjBmNjBhZGUwMWUxNGRmZTliOTdkMzEiLCJ0IjoiZjdkMzlhOWUtNzg1OS00YmIyLTk1MzgtNmRiMmY5ZDQzOGZlIiwicyI6Ik0yWXdaRGhsWXpBdFlqQXpOaTAwWlRoaExXSmtZbU10TmpsaE5tWXpOREprTldKaSJ9'}             # 固定隧道token或json,留空即启用临时隧道
export CFIP=${CFIP:-'cf.877774.xyz'}          # argo节点优选域名或优选ip
export CFPORT=${CFPORT:-'443'}                # argo节点端口
export NAME=${NAME:-''}                       # 节点名称
export ARGO_PORT=${ARGO_PORT:-'8001'}         # argo端口 使用固定隧道token,cloudflare后台设置的端口需和这里对应
export HY2_PORT=${HY2_PORT:-'25580'}               # Hy2 端口
export DISABLE_ARGO=${DISABLE_ARGO:-'false'}  # 是否禁用argo, true为禁用,false为不禁用

if [ -f ".env" ]; then
# 使用 sed 移除 export 关键字，并过滤注释行
set -o allexport # 临时开启自动导出变量
source <(grep -v '^#' .env | sed 's/^export //' )
set +o allexport # 关闭自动导出
fi


argo_configure() {
if [ "$DISABLE_ARGO" == 'true' ]; then
echo -e "\e[1;32mDisable argo tunnel\e[0m"
return
fi
if [[ -z $ARGO_AUTH || -z $ARGO_DOMAIN ]]; then
echo -e "\e[1;32mARGO_DOMAIN or ARGO_AUTH variable is empty, use quick tunnels\e[0m"
return
fi

if [[ $ARGO_AUTH =~ TunnelSecret ]]; then
echo $ARGO_AUTH > tunnel.json
cat > tunnel.yml << EOF
tunnel: $(cut -d\" -f12 <<< "$ARGO_AUTH")
credentials-file: tunnel.json
protocol: http2

ingress:
- hostname: $ARGO_DOMAIN
service: http://localhost:$ARGO_PORT
originRequest:
noTLSVerify: true
- service: http_status:404
EOF
else
echo -e "\e[1;32mUsing token connect to tunnel,please set $ARGO_PORT in cloudflare tunnel\e[0m"
fi
}
argo_configure
wait

download_and_run() {
ARCH=$(uname -m) && FILE_INFO=()
if [ "$ARCH" == "arm" ] || [ "$ARCH" == "arm64" ] || [ "$ARCH" == "aarch64" ]; then
BASE_URL="https://arm64.ssss.nyc.mn"
elif [ "$ARCH" == "amd64" ] || [ "$ARCH" == "x86_64" ] || [ "$ARCH" == "x86" ]; then
BASE_URL="https://amd64.ssss.nyc.mn"
elif [ "$ARCH" == "s390x" ] || [ "$ARCH" == "s390" ]; then
BASE_URL="https://s390x.ssss.nyc.mn"
else
echo "Unsupported architecture: $ARCH"
exit 1
fi
FILE_INFO=("$BASE_URL/sb web" "$BASE_URL/bot bot")

if [ -n "$NEZHA_SERVER" ] && [ -n "$NEZHA_PORT" ] && [ -n "$NEZHA_KEY" ]; then
FILE_INFO+=("$BASE_URL/agent npm")
elif [ -n "$NEZHA_SERVER" ] && [ -n "$NEZHA_KEY" ]; then
FILE_INFO+=("$BASE_URL/v1 php")
NEZHA_TLS=$(case "${NEZHA_SERVER##*:}" in 443|8443|2096|2087|2083|2053) echo -n true;; *) echo -n false;; esac)
cat > "config.yaml" << EOF
client_secret: ${NEZHA_KEY}
debug: false
disable_auto_update: true
disable_command_execute: false
disable_force_update: true
disable_nat: false
disable_send_query: false
gpu: false
insecure_tls: true
ip_report_period: 1800
report_delay: 4
server: ${NEZHA_SERVER}
skip_connection_count: true
skip_procs_count: true
temperature: false
tls: ${NEZHA_TLS}
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: ${UUID}
EOF
else
echo -e "\e[1;35mskip download nezha\e[0m"
fi

declare -A FILE_MAP
generate_random_name() {
local chars=abcdefghijklmnopqrstuvwxyz1234567890
local name=""
for i in {1..6}; do
name="$name${chars:RANDOM%${#chars}:1}"
done
echo "$name"
}
download_file() {
local URL=$1
local NEW_FILENAME=$2

if command -v curl >/dev/null 2>&1; then
curl -L -sS -o "$NEW_FILENAME" "$URL"
echo -e "\e[1;32mDownloaded $NEW_FILENAME by curl\e[0m"
elif command -v wget >/dev/null 2>&1; then
wget -q -O "$NEW_FILENAME" "$URL"
echo -e "\e[1;32mDownloaded $NEW_FILENAME by wget\e[0m"
else
echo -e "\e[1;33mNeither curl nor wget is available for downloading\e[0m"
exit 1
fi
}
for entry in "${FILE_INFO[@]}"; do
URL=$(echo "$entry" | cut -d ' ' -f 1)
RANDOM_NAME=$(generate_random_name)
NEW_FILENAME="$RANDOM_NAME" # 文件直接放在当前目录

download_file "$URL" "$NEW_FILENAME"

chmod +x "$NEW_FILENAME"
FILE_MAP[$(echo "$entry" | cut -d ' ' -f 2)]="$NEW_FILENAME"
done
wait

# Hysteria2 需要证书和私钥
# 生成证书和私钥
if command -v openssl >/dev/null 2>&1; then
openssl ecparam -genkey -name prime256v1 -out "private.key"
openssl req -new -x509 -days 3650 -key "private.key" -out "cert.pem" -subj "/CN=bing.com"
else
# 创建私钥文件
cat > "private.key" << 'EOF'
-----BEGIN EC PARAMETERS-----
BggqhkjOPQMBBw==
-----END EC PARAMETERS-----
-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIM4792SEtPqIt1ywqTd/0bYidBqpYV/++siNnfBYsdUYoAoGCCqGSM49
AwEHoUQDQgAE1kHafPj07rJG+HboH2ekAI4r+e6TL38GWASANnngZreoQDF16ARa
/TsyLyFoPkhLxSbehH/NBEjHtSZGaDhMqQ==
-----END EC PRIVATE KEY-----
EOF

# 创建证书文件
cat > "cert.pem" << 'EOF'
-----BEGIN CERTIFICATE-----
MIIBejCCASGgAwIBAgIUfWeQL3556PNJLp/veCFxGNj9crkwCgYIKoZIzj0EAwIw
EzERMA8GA1UEAwwIYmluZy5jb20wHhcNMjUwOTE4MTgyMDIyWhcNMzUwOTE2MTgy
MDIyWjATMREwDwYDVQQDDAhiaW5n\.comTBZMBMGByqGSM49AgEGCCqGSM49AwEH
A0IABNZB2nz49O6yRvh26B9npACOK/nuky9/BlgEgDZ54Ga3qEAxdegEWv07Mi8h
aD5IS8Um3oR/zQRIx7UmRmg4TKmjUzBRMB0GA1UdDgQWBBTV1cFID7UISE7PLTBR
BfGbgkrMNzAfBgNVHSMEGDAWgBTV1cFID7UISE7PLTBRBfGbgkrMNzAPBgNVHRMB
Af8EBTADAQH/MAoGCCqGSM49BAMCA0cAMEQCIAIDAJvg0vd/ytrQVvEcSm6XTlB+
eQ6OFb9LbLYL9f+sAiAffoMbi4y/0YUSlTtz7as9S8/lciBF5VCUoVIKS+vX2g==
-----END CERTIFICATE-----
EOF
fi

cat > config.json << EOF
{
"log": {
"disabled": true,
"level": "error",
"timestamp": true
},
"inbounds": [
{
"tag": "vmess-ws-in",
"type": "vmess",
"listen": "::",
"listen_port": ${ARGO_PORT},
"users": [
{
"uuid": "${UUID}"
}
],
"transport": {
"type": "ws",
"path": "/vmess-argo",
"early_data_header_name": "Sec-WebSocket-Protocol"
}
}$(if [ "$HY2_PORT" != "" ]; then echo ',
{
"tag": "hysteria2-in",
"type": "hysteria2",
"listen": "::",
"listen_port": '${HY2_PORT}',
"users": [
{
"password": "'${UUID}'"
}
],
"masquerade": "https://bing.com",
"tls": {
"enabled": true,
"alpn": [
"h3"
],
"certificate_path": "cert.pem",
"key_path": "private.key"
}
}'; fi)
],
"endpoints": [
{
"type": "wireguard",
"tag": "warp-out",
"mtu": 1280,
"address": [
"172.16.0.2/32",
"2606:4700:110:8dfe:d141:69bb:6b80:925/128"
],
"private_key": "YFYOAdbw1bKTHlNNi+aEjBM3BO7unuFC5rOkMRAz9XY=",
"peers": [
{
"address": "engage.cloudflareclient.com",
"port": 2408,
"public_key": "bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=",
"allowed_ips": [
"0.0.0.0/0",
"::/0"
],
"reserved": [
78,
135,
76
]
}
]
}
],
"outbounds": [
{ "type": "direct", "tag": "direct" }
],
"route": {
"rule_set": [
{
"tag": "openai",
"type": "remote",
"format": "binary",
"url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo-lite/geosite/openai.srs",
"download_detour": "direct"
},
{
"tag": "netflix",
"type": "remote",
"format": "binary",
"url": "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo-lite/geosite/netflix.srs",
"download_detour": "direct"
}
],
"rules": [
{ "action": "sniff" },
{ "rule_set": ["openai", "netflix"], "outbound": "warp-out" }
],
"final": "direct"
}
}
EOF

if [ -e "$(basename ${FILE_MAP[web]})" ]; then
nohup "$(basename ${FILE_MAP[web]})" run -c config.json >/dev/null 2>&1 &
sleep 2
echo -e "\e[1;32m$(basename ${FILE_MAP[web]}) is running\e[0m"
fi

if [ "$DISABLE_ARGO" == 'false' ]; then
if [ -e "$(basename ${FILE_MAP[bot]})" ]; then
if [[ $ARGO_AUTH =~ ^[A-Z0-9a-z=]{120,250}$ ]]; then
args="tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token ${ARGO_AUTH}"
elif [[ $ARGO_AUTH =~ TunnelSecret ]]; then
args="tunnel --edge-ip-version auto --config tunnel.yml run"
else
args="tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile boot.log --loglevel info --url http://localhost:$ARGO_PORT"
fi
nohup "$(basename ${FILE_MAP[bot]})" $args >/dev/null 2>&1 &
sleep 2
echo -e "\e[1;32m$(basename ${FILE_MAP[bot]}) is running\e[0m"
fi
fi

if [ -n "$NEZHA_SERVER" ] && [ -n "$NEZHA_PORT" ] && [ -n "$NEZHA_KEY" ]; then
if [ -e "$(basename ${FILE_MAP[npm]})" ]; then
tlsPorts=("443" "8443" "2096" "2087" "2083" "2053")
[[ "${tlsPorts[*]}" =~ "${NEZHA_PORT}" ]] && NEZHA_TLS="--tls" || NEZHA_TLS=""
export TMPDIR=$(pwd)
nohup "$(basename ${FILE_MAP[npm]})" -s ${NEZHA_SERVER}:${NEZHA_PORT} -p ${NEZHA_KEY} ${NEZHA_TLS} >/dev/null 2>&1 &
sleep 2
echo -e "\e[1;32m$(basename ${FILE_MAP[npm]}) is running\e[0m"
fi
elif [ -n "$NEZHA_SERVER" ] && [ -n "$NEZHA_KEY" ]; then
if [ -e "$(basename ${FILE_MAP[php]})" ]; then
nohup "$(basename ${FILE_MAP[php]})" -c "config.yaml" >/dev/null 2>&1 &
echo -e "\e[1;32m$(basename ${FILE_MAP[php]}) is running\e[0m"
fi
else
echo -e "\e[1;35mNEZHA variable is empty, skip running\e[0m"
fi

# 清理下载后的临时文件（可执行文件）
for key in "${!FILE_MAP[@]}"; do
if [ -e "$(basename ${FILE_MAP[$key]})" ]; then
rm -rf "$(basename ${FILE_MAP[$key]})" >/dev/null 2>&1
fi
done
}
download_and_run

get_argodomain() {
if [ "$DISABLE_ARGO" == 'false' ]; then
if [[ -n $ARGO_AUTH ]]; then
echo "$ARGO_DOMAIN"
else
local retry=0
local max_retries=8
local argodomain=""
while [[ $retry -lt $max_retries ]]; do
((retry++))
argodomain=$(sed -n 's|.*https://\([^/]*trycloudflare\.com\).*|\1|p' boot.log)
if [[ -n $argodomain ]]; then
break
fi
sleep 1
done
echo "$argodomain"
fi
fi
}

argodomain=$(get_argodomain)
[ "$DISABLE_ARGO" == 'false' ] && echo -e "\e[1;32mArgoDomain:\e[1;35m${argodomain}\e[0m\n"
sleep 1
IP=$(curl -s --max-time 2 ipv4.ip.sb || curl -s --max-time 1 api.ipify.org || { ipv6=$(curl -s --max-time 1 ipv6.ip.sb); echo "[$ipv6]"; } || echo "XXX")
ISP=$(curl -s --max-time 2 https://speed.cloudflare.com/meta | awk -F\" '{print $26"-"$18}' | sed -e 's/ /_/g' || echo "0.0")
costom_name() { if [ -n "$NAME" ]; then echo "${NAME}_${ISP}"; else echo "${ISP}"; fi; }

VMESS="{ \"v\": \"2\", \"ps\": \"$(costom_name)\", \"add\": \"${CFIP}\", \"port\": \"${CFPORT}\", \"id\": \"${UUID}\", \"aid\": \"0\", \"scy\": \"auto\", \"net\": \"ws\", \"type\": \"none\", \"host\": \"${argodomain}\", \"path\": \"/vmess-argo?ed=2560\", \"tls\": \"tls\", \"sni\": \"${argodomain}\", \"alpn\": \"\", \"fp\": \"firefox\"}"

if [ "$DISABLE_ARGO" == 'false' ]; then
cat > list.txt << EOF
vmess://$(echo "$VMESS" | base64 | tr -d '\n')
EOF
fi

if [ "$HY2_PORT" != "" ]; then
echo -e "\nhysteria2://${UUID}@${IP}:${HY2_PORT}/?sni=www.bing.com&alpn=h3&insecure=1#$(costom_name)" >> list.txt
fi

base64 list.txt | tr -d '\n' > sub.txt
cat list.txt
echo -e "\n\n\e[1;32msub.txt saved successfully in current directory\e[0m"
echo -e "\n\e[1;32mRunning done!\e[0m\n"
sleep 3

# 清理不再需要的配置文件、日志和临时文件
rm -rf fake_useragent_0.2.0.json boot.log config.json sb.log core fake_useragent_0.2.0.json list.txt tunnel.json tunnel.yml key.txt config.yaml cert.pem private.key >/dev/null 2>&1
echo -e "\e[1;32mTelegram群组：\e[1;35mhttps://t.me/eooceu\e[0m"
echo -e "\e[1;32mYoutube频道：\e[1;35mhttps://www.youtube.com/@eooce\e[0m"
echo -e "\e[1;32m此脚本由老王编译: \e[1;35mGithub：https://github.com/eooce\e[0m\n"
sleep 5
clear

tail -f /dev/null