#!/usr/bin/env bash
# Stream GNOME Shell logs filtered to this extension and BlueZ.
# Errors are highlighted in red, warnings in yellow.

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Watching GNOME Shell logs (Ctrl+C to stop)..."
echo "─────────────────────────────────────────────"

journalctl -f /usr/bin/gnome-shell 2>/dev/null | grep --line-buffered -i \
    -e "bt battery" \
    -e "bluetooth-battery" \
    -e "bluez" \
    -e "Error\|error\|Exception\|exception\|Warning\|warning" | \
grep --line-buffered -v "downloading update for extension" | \
while IFS= read -r line; do
    if echo "$line" | grep -qi "error\|exception"; then
        echo -e "${RED}${line}${NC}"
    elif echo "$line" | grep -qi "warning"; then
        echo -e "${YELLOW}${line}${NC}"
    else
        echo "$line"
    fi
done
