#!/bin/sh

UUID=${UUID:-'faacf142-dee8-48c2-8558-641123eb939c'}
NEZHA_SERVER=${NEZHA_SERVER:-'nezha.mingfei1981.eu.org'}
NEZHA_PORT=${NEZHA_PORT:-'443'}
NEZHA_KEY=${NEZHA_KEY:-''}
ARGO_DOMAIN=${ARGO_DOMAIN:-''}
ARGO_AUTH=${ARGO_AUTH:-''}
CFIP=${CFIP:-'jd.bp.cloudns.ch'}
NAME=${NAME:-'MJJ'}
ARGO_PORT=${ARGO_PORT:-'8001'}

chmod 755 iccv2 iccagent icc2go 2>/dev/null || true

if [ -n "$ARGO_AUTH" ] && [ -n "$ARGO_DOMAIN" ] && echo "$ARGO_AUTH" | grep -q "TunnelSecret"; then
    echo "$ARGO_AUTH" > tunnel.json 2>/dev/null
    TUNNEL_ID=$(echo "$ARGO_AUTH" | grep -o '"t":"[^"]*' | cut -d'"' -f4 2>/dev/null)
    cat > tunnel.yml <<EOF 2>/dev/null
tunnel: $TUNNEL_ID
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

nohup ./iccv2 -c v2_config.json > /dev/null 2>&1 &

if [ -n "$ARGO_AUTH" ]; then
    if echo "$ARGO_AUTH" | grep -qE '^[A-Za-z0-9=]{120,250}$'; then
        nohup ./icc2go tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token "$ARGO_AUTH" > /dev/null 2>&1 &
    elif echo "$ARGO_AUTH" | grep -q "TunnelSecret"; then
        nohup ./icc2go tunnel --edge-ip-version auto --config tunnel.yml run > /dev/null 2>&1 &
    else
        nohup ./icc2go tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --url http://localhost:$ARGO_PORT > /dev/null 2>&1 &
    fi
else
    nohup ./icc2go tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --url http://localhost:$ARGO_PORT > /dev/null 2>&1 &
fi

tls_ports="443 8443 2096 2087 2083 2053"
NEZHA_TLS=""
for p in $tls_ports; do
    [ "$NEZHA_PORT" = "$p" ] && NEZHA_TLS="--tls" && break
done

if [ -n "$NEZHA_SERVER" ] && [ -n "$NEZHA_KEY" ]; then
    if [ -n "$NEZHA_PORT" ]; then
        nohup ./iccagent -s "${NEZHA_SERVER}:${NEZHA_PORT}" -p "$NEZHA_KEY" $NEZHA_TLS > /dev/null 2>&1 &
    else
        AUTO_TLS="false"
        echo "$NEZHA_SERVER" | grep -qE ':(443|8443|2096|2087|2083|2053)$' && AUTO_TLS="true"
        cat > nezha.yaml <<EOF 2>/dev/null
client_secret: $NEZHA_KEY
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
server: $NEZHA_SERVER
skip_connection_count: false
skip_procs_count: false
temperature: false

tls: $AUTO_TLS
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: $UUID
EOF
        nohup ./iccagent -c nezha.yaml > /dev/null 2>&1 &
    fi
fi

sleep 10 > /dev/null 2>&1

exec tail -f /dev/null