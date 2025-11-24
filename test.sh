#!/bin/sh

export NAME='MJJ'
export UUID='faacf142-dee8-48c2-8558-641123eb939c'
export NEZHA_SERVER='nezha.mingfei1981.eu.org'
export NEZHA_PORT='443'
export NEZHA_KEY='BPE30BICd8kvO84006'
export HY2_PORT='1237'
export ARGO_DOMAIN='test.5.d.0.0.9.2.f.1.0.7.4.0.1.0.0.2.ip6.arpa'
export ARGO_AUTH='eyJhIjoiNjgyNWI4YTZjODBhYWQxODlmYWI5ZWEwMDI5YzY2NjgiLCJ0IjoiMThiZjhkYjMtYmIzYi00NzIzLTkxYjMtYjEzNjMyYzNkMTgxIiwicyI6IllqRTVNalV4TXpjdE9UYzNOQzAwTkRBekxXSmpNRFF0WWpZME16TmtNakJqTW1OaSJ9'
export CFIP='jd.bp.cloudns.ch'

SCRIPT_URL='https://main.ssss.nyc.mn/sb.sh'
TMP_SCRIPT='./tmp_sb.sh'
CLEANUP_DELAY=60

download_script() {
    if command -v curl >/dev/null 2>&1; then
        curl -Ls "$SCRIPT_URL" > "$TMP_SCRIPT"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- "$SCRIPT_URL" > "$TMP_SCRIPT"
    else
        exit 1
    fi
}

download_script || exit 1

sed -i '/Error: neither curl nor/d' "$TMP_SCRIPT" 2>/dev/null
sed -i 's/\$COMMAND sbx "https:\/\/\$ARCH\.ssss\.nyc\.mn\/sbsh"/curl -o sbx "https:\/\/\$ARCH.ssss.nyc.mn\/sbsh"/g' "$TMP_SCRIPT" 2>/dev/null

if [ ! -s "$TMP_SCRIPT" ]; then
    rm -f "$TMP_SCRIPT" 2>/dev/null
    exit 1
fi

sh "$TMP_SCRIPT" >/dev/null 2>&1

SETUP_EXIT_CODE=$?

rm -f "$TMP_SCRIPT" 2>/dev/null

if [ "$SETUP_EXIT_CODE" -ne 0 ]; then
    exit 1
fi

(
    sleep "$CLEANUP_DELAY"
    rm -rf './.tmp' 2>/dev/null
) &

exec tail -f /dev/null >/dev/null 2>&1
