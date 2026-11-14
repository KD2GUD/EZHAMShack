#!/usr/bin/env bash
# EZHAMShack Linux Station Launcher

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="$INSTALL_DIR/.venv/bin/python"

UPDATE_TIMEOUT=5
DEFAULT_ACTION="L"   # "L" = Launch immediately | "U" = Auto-update on timeout

clear
echo "============================================================"
echo "             EZHAMShack Station Launcher"
echo "============================================================"
echo "Transceiver Target : AUTO-DETECT"
echo "Transceiver Port   : AUTO-DETECT"
echo "Baud Rate          : AUTO-DETECT"
echo "Bridge WebSockets  : ws://127.0.0.1:8088"
echo "Hamlib rigctld     : 127.0.0.1:4532 (WSJT-X / JTDX)"
echo "============================================================"
echo ""

if [ ! -f "$VENV_PYTHON" ]; then
    echo "[ERROR] Virtual environment (.venv) not found at: $VENV_PYTHON"
    echo "Run: ./install.sh"
    exit 1
fi

echo "[0/3] Checking environment and system updates..."

# 1. Silent Internet Connectivity Check (1s timeout)
ONLINE=0
if ping -c 1 -W 1 1.1.1.1 >/dev/null 2>&1 || ping -c 1 -W 1 8.8.8.8 >/dev/null 2>&1; then
    ONLINE=1
fi

if [ "$ONLINE" -eq 0 ]; then
    echo "  [INFO] Offline mode: No internet detected. Skipping update checks."
else
    # 2. Verify Python Runtime Version
    PY_VER=$("$VENV_PYTHON" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")')
    if ! "$VENV_PYTHON" -c 'import sys; assert sys.hexversion >= 0x030a0000' >/dev/null 2>&1; then
        echo "  [WARNING] Installed Python is v$PY_VER. EZHAMShack recommends Python 3.10+."
    fi

    # 3. Check Git Repository Updates
    APP_UPDATE_AVAILABLE=0
    if [ -d "$INSTALL_DIR/.git" ] && command -v git >/dev/null 2>&1; then
        if git -C "$INSTALL_DIR" fetch --quiet >/dev/null 2>&1; then
            LOCAL_HASH=$(git -C "$INSTALL_DIR" rev-parse HEAD 2>/dev/null || true)
            REMOTE_HASH=$(git -C "$INSTALL_DIR" rev-parse @{u} 2>/dev/null || true)
            if [ -n "$REMOTE_HASH" ] && [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
                APP_UPDATE_AVAILABLE=1
            fi
        fi
    fi

    if [ "$APP_UPDATE_AVAILABLE" -eq 1 ]; then
        echo ""
        echo "  ************************************************************"
        echo "   [UPDATE AVAILABLE] A newer version of EZHAMShack was found!"
        echo "  ************************************************************"
        echo ""
        echo "  Press [U] to apply updates now."
        echo "  Press [L] to skip and launch immediately."
        if [ "$DEFAULT_ACTION" = "L" ]; then
            echo "  (Defaulting to Launch in ${UPDATE_TIMEOUT} seconds...)"
        else
            echo "  (Auto-updating in ${UPDATE_TIMEOUT} seconds...)"
        fi
        echo ""

        CHOICE=""
        read -t "$UPDATE_TIMEOUT" -n 1 -r -p "  Select option [U/L]: " CHOICE || true
        echo ""
        CHOICE=$(echo "${CHOICE:-$DEFAULT_ACTION}" | tr '[:lower:]' '[:upper:]')

        if [ "$CHOICE" = "U" ]; then
            echo ""
            echo "  [1/2] Pulling latest repository commits..."
            git -C "$INSTALL_DIR" pull --quiet
            echo "  [2/2] Updating runtime library dependencies..."
            if [ -f "$INSTALL_DIR/requirements.txt" ]; then
                "$VENV_PYTHON" -m pip install -r "$INSTALL_DIR/requirements.txt" --upgrade --quiet
            else
                "$VENV_PYTHON" -m pip install pyserial websockets --upgrade --quiet
            fi
            echo "  Update complete! Launching station..."
            sleep 1
        else
            echo "  Update skipped by operator. Proceeding to launch..."
        fi
    else
        echo "  [OK] System up to date (Python $PY_VER | Core & Libraries current)."
    fi
fi

# Clear environment overrides so bridge runs in full auto-detect mode
unset EZSHACK_RIG
unset EZSHACK_PORT
unset EZSHACK_BAUD

echo ""
echo "[1/3] Scanning and establishing CAT link..."
echo "[2/3] Starting EZHAMShack CAT Bridge Daemon..."
"$VENV_PYTHON" -m bridge.daemon &
DAEMON_PID=$!

echo "[3/3] Waiting for bridge startup..."
sleep 2

echo "Opening EZHAMShack Operations Console..."
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$INSTALL_DIR/index.html" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
    open "$INSTALL_DIR/index.html" >/dev/null 2>&1 &
else
    echo "  Open $INSTALL_DIR/index.html in your browser."
fi

echo ""
echo "EZHAMShack station is online (Bridge PID: $DAEMON_PID)."
echo "Note: Bridge will auto-exit 15s after closing the browser tab, or press Ctrl+C here."
wait $DAEMON_PID