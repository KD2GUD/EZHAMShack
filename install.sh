#!/usr/bin/env bash
# EZHAMShack Linux Automated Environment & Shortcut Installer
set -e

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$INSTALL_DIR/.venv"
VENV_PYTHON="$VENV_DIR/bin/python"

echo "=========================================="
echo "   EZHAMShack Linux Setup (v1.0.0-Beta)   "
echo "=========================================="

# Ensure installer and launcher scripts are executable
chmod +x "$INSTALL_DIR/install.sh" 2>/dev/null || true
if [ -f "$INSTALL_DIR/launcher.sh" ]; then
    chmod +x "$INSTALL_DIR/launcher.sh"
fi

# 1. Verify Python 3.10+
echo ""
echo "[1/5] Checking Python environment..."
if ! command -v python3 >/dev/null 2>&1; then
    echo "  [ERROR] python3 is not installed."
    echo "  Install via your package manager (e.g., sudo apt install python3 python3-venv python3-pip)"
    exit 1
fi

PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")')
PY_VER_MAJMIN=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')

if ! python3 -c 'import sys; assert sys.hexversion >= 0x030a0000' >/dev/null 2>&1; then
    echo "  [ERROR] Python 3.10+ is required (found v$PY_VER)."
    exit 1
fi
echo "  Found Python v$PY_VER ($(command -v python3))"

# 2. Setup Virtual Environment (.venv) with Health Check & Auto-Remediation
echo ""
echo "[2/5] Creating dedicated virtual environment (.venv)..."
if [ -d "$VENV_DIR" ] && { [ ! -f "$VENV_PYTHON" ] || ! "$VENV_PYTHON" -m pip --version >/dev/null 2>&1; }; then
    echo "  [NOTICE] Incomplete virtual environment detected (missing pip). Removing .venv/..."
    rm -rf "$VENV_DIR"
fi

if [ ! -f "$VENV_PYTHON" ]; then
    if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
        echo "  [NOTICE] python3-venv/ensurepip missing. Installing python${PY_VER_MAJMIN}-venv via apt..."
        if command -v apt-get >/dev/null 2>&1; then
            if [ "$EUID" -eq 0 ]; then
                apt-get update && (apt-get install -y "python${PY_VER_MAJMIN}-venv" || apt-get install -y python3-venv) || true
            elif command -v sudo >/dev/null 2>&1; then
                sudo apt-get update && (sudo apt-get install -y "python${PY_VER_MAJMIN}-venv" || sudo apt-get install -y python3-venv) || true
            fi
        fi
    fi

    if ! python3 -m venv "$VENV_DIR"; then
        rm -rf "$VENV_DIR"
        echo "  [ERROR] Failed to create .venv. Please run manually:"
        echo "    sudo apt install python${PY_VER_MAJMIN}-venv python3-venv"
        exit 1
    fi
    echo "  Virtual environment created at: .venv/"
else
    echo "  Existing virtual environment verified at: .venv/"
fi

# 3. Install Dependencies
echo ""
echo "[3/5] Installing bridge packages (pyserial, websockets)..."
"$VENV_PYTHON" -m pip install --upgrade pip --quiet

if [ -f "$INSTALL_DIR/requirements.txt" ]; then
    "$VENV_PYTHON" -m pip install -r "$INSTALL_DIR/requirements.txt" --quiet
else
    "$VENV_PYTHON" -m pip install pyserial websockets --quiet
fi

if "$VENV_PYTHON" -c "import serial, websockets" >/dev/null 2>&1; then
    echo "  Hardware dependencies verified: pyserial, websockets"
else
    echo "  [WARNING] Dependency import test failed."
    exit 1
fi

# 4. Initialize Local Station Log Directory
echo ""
echo "[4/5] Initializing local station log directory..."
LOGS_DIR="$INSTALL_DIR/logs"
ADIF_PATH="$LOGS_DIR/shack_log.adi"

mkdir -p "$LOGS_DIR"
if [ ! -f "$ADIF_PATH" ]; then
    printf "<ADIF_VER:5>3.1.4\n<PROGRAMID:7>EZShack\n<PROGRAMVERSION:5>1.0.0\n<EOH>\n" > "$ADIF_PATH"
    echo "  Initialized master ADIF log file: $ADIF_PATH"
else
    echo "  Station log verified: $ADIF_PATH"
fi

# 5. Create Desktop Menu Entry & Configure Serial Port Permissions
echo ""
echo "[5/5] Configuring desktop shortcut & serial port permissions..."
if [ -f "$INSTALL_DIR/launcher.sh" ]; then
    chmod +x "$INSTALL_DIR/launcher.sh"
    echo "  Verified executable permission on launcher.sh"
fi

DESKTOP_DIR="$HOME/.local/share/applications"
mkdir -p "$DESKTOP_DIR"
DESKTOP_FILE="$DESKTOP_DIR/ezhamshack.desktop"

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=EZHAMShack
Comment=Amateur Radio Station Dashboard & Direct CAT Bridge
Exec="$INSTALL_DIR/launcher.sh"
Path=$INSTALL_DIR
Terminal=true
Categories=HamRadio;Utility;Network;
EOF

if [ -f "$INSTALL_DIR/assets/icons/ezshack.png" ]; then
    echo "Icon=$INSTALL_DIR/assets/icons/ezshack.png" >> "$DESKTOP_FILE"
fi
chmod +x "$DESKTOP_FILE"
echo "  Created application menu entry: $DESKTOP_FILE"

# Check Linux serial port group membership (dialout on Debian/Ubuntu, uucp on Arch/Fedora)
SERIAL_GROUP=""
if getent group dialout >/dev/null 2>&1; then
    SERIAL_GROUP="dialout"
elif getent group uucp >/dev/null 2>&1; then
    SERIAL_GROUP="uucp"
fi

if [ -n "$SERIAL_GROUP" ]; then
    if id -nG "$USER" | grep -qw "$SERIAL_GROUP"; then
        echo "  Serial port permissions verified (user '$USER' is in '$SERIAL_GROUP')."
    else
        echo ""
        echo "  [PERMISSION CHECK] User '$USER' is not in the '$SERIAL_GROUP' group."
        echo "  Linux blocks access to /dev/ttyUSB0 and /dev/ttyACM0 without it."
        read -r -p "  Add '$USER' to '$SERIAL_GROUP' now via sudo? [Y/n]: " ADD_GRP
        ADD_GRP=${ADD_GRP:-Y}

        if [[ "$ADD_GRP" =~ ^[Yy]$ ]]; then
            if sudo usermod -aG "$SERIAL_GROUP" "$USER"; then
                echo "  [OK] Added '$USER' to '$SERIAL_GROUP'."
                echo "  [IMPORTANT] Log out and log back in (or reboot) once for group permissions to take effect."
            else
                echo "  [WARNING] Could not add group automatically. Run manually:"
                echo "    sudo usermod -aG $SERIAL_GROUP $USER"
            fi
        else
            echo "  Skipped. Run this manually before connecting a transceiver:"
            echo "    sudo usermod -aG $SERIAL_GROUP $USER"
        fi
    fi
fi

echo ""
echo "========================================================"
echo " Setup complete! Launch EZHAMShack with ./launcher.sh    "
echo "========================================================"