# EZHAMShack

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Release: v1.0.0](https://img.shields.io/badge/release-v1.0.0-brightgreen.svg)]()
[![Website](https://img.shields.io/badge/website-ezhamshack.com-green.svg)](https://ezhamshack.com)

**A modern, lightweight, cross-platform amateur radio station dashboard and direct serial CAT control console.**

**Website:** [ezhamshack.com](https://ezhamshack.com)  
**License:** GNU General Public License v3.0 (GPLv3)  
**Tech Stack:** Python 3.10+ backend · Vanilla JavaScript · Tailwind CSS · HTML5 Canvas frontend  
**Status:** Release (`v1.0.0`)

---

## Why EZHAMShack

Legacy amateur radio software often forces operators into a fragmented, resource-heavy desktop experience. Multiple floating windows, virtual COM port splitters, and heavy middleware layers make it cumbersome to run a modern station—especially when operating across multi-band transceivers or tracking satellites and digital traffic simultaneously.

EZHAMShack consolidates station control, propagation tools, satellite tracking, and ADIF logging into a single dark-mode browser console backed by a lightweight Python daemon that communicates directly with your transceiver hardware.

| The Traditional Shack Stack | The EZHAMShack Approach |
| --- | --- |
| Resource-heavy desktop middleware (FLRIG, etc.) | Direct Python serial CAT engine (`bridge/daemon.py`) with transceiver relay settling delays, coalesced tuning, and auto-detection |
| Multiple disconnected windows (CAT, satellites, solar, spots) | Single 16-column modular fluid grid dashboard with saved memory workspaces (`P1`–`P4` + custom `MEM` slots) |
| Manual frequency/mode look-ups and band-edge guesswork | Real-time FCC Part 97 privilege guard, 60m channelized/WRC-15 power compliance, and per-rig frequency ceiling enforcement |
| Fragmented satellite tuning tools | SGP4 orbital propagation, polar radar view, audible AOS alerts, Doppler retuning, and automated cross-band split/CTCSS |
| Rigid single-receiver displays | Hardware-aware capability gating (dedicated VHF/UHF Sub-Receiver panel on the Kenwood TS-2000; disabled VHF/UHF sat tuning on HF+6m rigs) |
| Proprietary log formats | Built-in ADIF 3.1.4 logger (`logs/shack_log.adi`) ready for direct `.adi` export and import into external logbook software |

---

## Core Architectural Capabilities

- **Direct Hardware CAT Engine (`bridge/daemon.py`, `bridge/serial_engine.py`)**  
  Native asynchronous Python serial driver (`pyserial`) with hardware-specific command pacing, relay settling delays, and coalesced frequency writes for lag-free dial tuning. Automatically probes USB serial ports, baud rates, and transceiver profiles on startup.

- **WebSocket Telemetry Bridge (`ws://127.0.0.1:8088`)**  
  High-speed bidirectional event bridge pushing live frequency, band, mode, VFO A/B state, calibrated S-meter, forward power, SWR, ATU status, and sub-receiver telemetry directly into the browser dashboard.

- **Hardware-Aware Capability Gating**  
  Dynamically adapts UI controls and available widgets to the connected radio:
  - Enables the dedicated **VHF/UHF Sub-Receiver** dual-watch widget on the **Kenwood TS-2000**.
  - Ghosts software AF Gain, TX Power, and ATU controls on legacy radios that rely on physical knobs/menus (**Yaesu FT-857D / FT-817 / FT-897**).
  - Enforces per-rig tuning limits (`74.8 MHz` on the **IC-7300**, `470 MHz` on the **FT-991A** / **FT-857D**, `1300 MHz` on the **TS-2000**) and disables VHF/UHF satellite `Tune & Sync` on HF+6m-only rigs.

- **SGP4 Satellite Tracker & Doppler Control (`widgets/satellite.js`)**  
  Real-time SGP4 orbital propagation (`satellite.js`), next-pass countdown rankings, polar radar azimuth/elevation plot, audible 1-minute/AOS chimes, continuous Doppler correction, and automated cross-band split + CTCSS tone configuration.

- **Built-In ADIF 3.1.4 Logbook (`widgets/logger.js`)**  
  Logs QSOs directly to `logs/shack_log.adi` on disk with automatic frequency, band, mode, UTC timestamp, station profile, and CQ/ITU zone population, plus one-click `.adi` download for importing into external logbooks (QRZ, LoTW, Log4OM, N1MM, etc.).

- **FCC License & Band Privilege Engine (`app.js`, `widgets/greatcircle.js`)**  
  Automated callsign lookup via Callook and HamDB to populate license class, 6-character Maidenhead grid square, QTH, CQ/ITU zones, and coordinates, paired with live carrier/passband edge color alerts and 60m channelized/WRC-15 `9W` power compliance.

---

## Architecture Overview

```text
  ┌─────────────────────────────────────────────────────────┐
  │                 Physical Transceiver                    │
  │      (FT-991A / FT-857D / IC-7300 / TS-2000)            │
  └───────────────────────────▲─────────────────────────────┘
                              │ Physical USB / Serial CAT
  ┌───────────────────────────▼─────────────────────────────┐
  │               EZHAMShack Bridge Daemon                  │
  │  ├── Serial Engine (Auto-detect, pacing & coalescing)   │
  │  ├── Rig Profiles (Yaesu ASCII/Binary, CI-V, Kenwood)   │
  │  ├── ADIF 3.1.4 Logbook Writer (logs/shack_log.adi)     │
  │  └── WebSocket Telemetry Server (ws://127.0.0.1:8088)   │
  └───────────────────────────▲─────────────────────────────┘
                              │ Local WebSockets / JSON
  ┌───────────────────────────▼─────────────────────────────┐
  │               EZHAMShack Web Dashboard                  │
  │      (HTML5 Canvas, Vanilla JS, Tailwind CSS)           │
  └─────────────────────────────────────────────────────────┘
```

---

## Transceiver Compatibility Matrix

| Model | Status | CAT Protocol & Baud | Frequency Coverage | Special Hardware Support | Satellite Split & CTCSS |
| --- | --- | --- | --- | --- | --- |
| **Yaesu FT-991A** | Supported (`v1.0.0`) | Yaesu ASCII (`38400` baud) | `30 kHz – 470 MHz` | Built-in ATU, RF Power, AF Gain | Automated (`FT2`/`FT3`/`SV`) |
| **Yaesu FT-857D / 817 / 897** | Supported (`v1.0.0`) | Legacy 5-Byte Binary (`38400` baud, `8N2`) | `100 kHz – 470 MHz` | UI capability-gated for knob/menu controls | Automated (`0x02`/`0x0B`/`0x4A`) |
| **Icom IC-7300** | Supported (`v1.0.0`) | Icom CI-V (`19200` baud, Addr `0x94`) | `30 kHz – 74.8 MHz` | Built-in ATU, USB-D/LSB-D, VHF/UHF sat gated | HF/6m Split (`0x0F`/`0x1B`) |
| **Kenwood TS-2000** | Supported (`v1.0.0`) | Kenwood ASCII (`9600` baud) | `30 kHz – 1300 MHz` | Full VHF/UHF Sub-Receiver (`FC`/`SB`/`SM1`), ATU | Automated (`SP1`/`TN`/`TO1`) |

---

## System & Display Requirements

- **Operating System:** Windows 10/11 or Linux (Ubuntu, Debian, Linux Mint, Raspberry Pi OS, Fedora, Arch).
- **Python Runtime:** Python **3.10 or newer** (installed and isolated automatically inside `.venv` by the setup scripts).
- **Browser:** Modern Chromium-based browser (Chrome, Edge, Brave) or Firefox.
- **Display Resolution (16:9 Widescreen):**
  - **Minimum:** `1366 × 768` (16:9 HD) — uses compact header and preset spacing.
  - **Recommended:** `1920 × 1080` (16:9 Full HD) or higher for optimal 16-column multi-pane density.
  - Use the upper-right **Zoom (`−` / `100%` / `+`)** and **Fullscreen (`F11`)** controls to fine-tune workspace density on smaller monitors.
- **Radio Interface:** Direct USB cable (for radios with built-in USB CAT such as the FT-991A and IC-7300) or a USB-to-Serial CAT cable (such as CT-62 for the FT-857D or DB9 RS-232 for the TS-2000).

---

## Installation & Setup Guide

### 1. Windows Setup (Windows 10 / 11)

#### Step A: Install USB / Serial Chipset Drivers
Before connecting your transceiver, install the USB driver matching your radio or CAT cable so Windows assigns a valid Virtual COM Port in **Device Manager → Ports (COM & LPT)**:

- **Icom IC-7300:** Install the **Silicon Labs CP210x Universal Windows Driver** from Icom or Silicon Labs. Set `CI-V Baud Rate = 19200` and `CI-V Address = 94h` in the IC-7300 connectors menu.
- **Yaesu FT-991A:** Install the **Silicon Labs CP210x** Virtual COM Port driver from Yaesu. Windows will create two COM ports (*Enhanced* and *Standard*); EZHAMShack automatically finds the *Enhanced* CAT port at `38400` baud.
- **Yaesu FT-857D / FT-817 / FT-897 & Kenwood TS-2000:** Install the driver for your USB-to-CAT interface cable (**FTDI**, **Prolific PL2303**, or **WCH CH340/CH341**).

#### Step B: Download & Run the Automated Installer
1. **Clone or Download the Repository:**
   ```bash
   git clone https://github.com/KD2GUD/EZHAMShack.git
   cd EZHAMShack
   ```
   *(Or download the release ZIP, extract it to a permanent folder such as `C:\EZHAMShack`, and open that folder.)*

2. **Run `install.bat`:**
   Double-click `install.bat` (or run it from Command Prompt). It automatically:
   - Verifies Python 3.10+ (installing Python 3.12 via `winget` if missing).
   - Creates an isolated virtual environment in `.venv\`.
   - Installs `pyserial`, `websockets`, and all packages listed in `requirements.txt`.
   - Creates a desktop shortcut for **EZShack**.

3. **Launch the Station (`launcher.bat`):**
   - Power on your transceiver and connect its USB/CAT cable.
   - Double-click **`launcher.bat`** (or the **EZShack** desktop shortcut).
   - On startup, the launcher checks GitHub for updates and upgrades Python dependencies automatically before launching `bridge.daemon` and opening `index.html` in your browser.

---

### 2. Linux Setup (Ubuntu / Debian / Mint / Raspberry Pi OS)

#### Step A: Grant Serial Port Permissions (`dialout`) & Reboot
Linux restricts access to USB serial devices (`/dev/ttyUSB0`, `/dev/ttyACM0`) to members of the `dialout` group (or `uucp` on Arch-based distributions). **You must reboot after adding your user to this group**, or the bridge daemon will receive `Permission denied` when scanning USB ports.

```bash
# Add your user to the serial port group (Debian/Ubuntu/Mint/RPi OS)
sudo usermod -aG dialout $USER

# (Arch / Manjaro users run this instead:)
# sudo usermod -aG uucp $USER

# Reboot so the new group membership takes effect
sudo reboot
```

*(Note: Most modern Linux kernels include built-in drivers for Silicon Labs CP210x, FTDI, and CH340 adapters—no extra driver download is required.)*

#### Step B: Make Scripts Executable & Run the Installer
After rebooting, open a terminal in your `EZHAMShack` directory:

```bash
git clone https://github.com/KD2GUD/EZHAMShack.git
cd EZHAMShack

# Make the installer and station launcher executable
chmod +x install.sh launcher.sh

# Run the automated setup script
./install.sh
```

`install.sh` creates the `.venv` virtual environment and installs `pyserial`, `websockets`, and all dependencies from `requirements.txt`.

#### Step C: Launch the Station (`./launcher.sh`)
Power on your transceiver, connect the USB/CAT cable, and run:

```bash
./launcher.sh
```

On startup, `launcher.sh` checks for internet connectivity, pulls any new GitHub updates, verifies/upgrades the `.venv` Python runtime and libraries, starts `python -m bridge.daemon`, and opens `index.html` in your default browser.

---

## Privacy & Station Configuration Policy

**Personal operator information is never hardcoded into the codebase.**

- **In-Dashboard Configuration:** Click your callsign badge in the top-left header (or the gear icon) to open **Master Settings → Station Profile**, enter your callsign, and click **Auto-Detect License** to populate your license class, Maidenhead grid, QTH, CQ/ITU zones, and coordinates.
- **Local Storage Only:** Dashboard layouts, presets, and station profiles are stored locally in browser `localStorage` (`EZSHACK_STATE_V1`).
- **Protected Local Logbook:** QSOs are saved locally to `logs/shack_log.adi` (excluded from Git via `.gitignore` so updates never touch your logbook). You can also export/import your full dashboard configuration as JSON under **Settings → Export & Storage**.

---

## Contributing

Contributions, bug reports, and new transceiver profiles are welcome:

1. Fork the repository and create a feature branch (`git checkout -b feature/new-rig-profile`).
2. Implement a new profile class in `bridge/rig_profiles/` inheriting from `BaseRig` (defining `rig_id`, `name`, `default_baudrate`, `min_freq_hz`, `max_freq_hz`, `supported_bands`, and CAT command/parser methods).
3. Register the profile in `bridge/rig_profiles/__init__.py` and `bridge/serial_engine.py`.
4. Confirm that **no operator callsigns, coordinates, or local log files** are included in your commit.
5. Open a Pull Request with serial trace notes or hardware test details.

---

## License

Distributed under the **GNU General Public License v3.0**. See the `LICENSE` file for full terms and conditions.

**Project Website:** [ezhamshack.com](https://ezhamshack.com)

---

*EZHAMShack is an independent open-source project and is not affiliated with Yaesu, Kenwood, Icom, or Elecraft.*