# EZHAMShack

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Status: Public Beta](https://img.shields.io/badge/status-Public%20Beta%20v1.0.0--Beta-orange.svg)]()
[![Website](https://img.shields.io/badge/website-ezhamshack.com-green.svg)](https://ezhamshack.com)

**A modern, lightweight, cross-platform amateur radio station dashboard and hardware automation suite.**

**Author:** Chris Nichols (Callsign: KD2GUD)  
**Website:** [ezhamshack.com](https://ezhamshack.com)  
**License:** GNU General Public License v3.0 (GPLv3)  
**Tech Stack:** Python 3.10+ backend · Vanilla JavaScript · Tailwind CSS · HTML5 Canvas frontend  
**Status:** Public Beta (v1.0.0-Beta)

---

## Why EZHAMShack

Legacy amateur radio software often forces operators into a fragmented, resource-heavy desktop experience. Multiple windows, virtual COM port splitters that crash under port locks, and heavy native applications make it difficult to run a modern station—especially when operating across multi-band transceivers or monitoring satellites and digital traffic simultaneously.

EZHAMShack consolidates station control, digital mode integration, satellite tracking, and logging into a single dark-mode browser SPA while providing a lightweight Python daemon that communicates directly with your radio hardware.

| The Traditional Shack Stack | The EZHAMShack Approach |
| --- | --- |
| Resource-heavy desktop apps (FLRIG, etc.) | Direct Python serial CAT engine with transceiver relay settling delays and thread-safe lock management |
| Virtual COM port splitters that crash on port locks | Internal Hamlib rigctld server (TCP 127.0.0.1:4532) so WSJT-X, JTDX, and FLDIGI share the radio without conflicts |
| Multiple disconnected windows (CAT, satellites, decodes) | Single 16-column modular fluid grid dashboard consolidating all station telemetry and widgets |
| Disconnected log files and manual ADIF sync | Two-way live disk synchronization (`shack_log.adi`) with composite key deletion safeguards |
| Fragmented satellite tuning tools | SGP4 orbital propagation, HTML5 Canvas polar radar, Doppler retuning, and automated cross-band split/CTCSS |
| Rigid single-receiver displays | Dynamic hardware capability detection supporting dedicated VHF/UHF Sub-Receiver dual-watch monitoring |

## Core Architectural Capabilities

- **Direct Hardware CAT Engine**  
  Native asynchronous Python serial driver (`pyserial`) with hardware-specific command pacing and relay settling delays. Direct serial access eliminates intermediary layers like FLRIG.

- **WebSocket Telemetry Bridge (`ws://127.0.0.1:8088`)**  
  High-speed bidirectional event bridge pushing live frequency, mode, S-meter, forward power, SWR, and rig state directly into the browser dashboard.

- **Internal Hamlib rigctld Server (`TCP 127.0.0.1:4532`)**  
  Built-in `rigctld` server emulation handling initialization protocol handshakes (`\chk_vfo`, `\dump_state`), frequency/mode tracking, and PTT toggling for external programs (WSJT-X, JTDX, FLDIGI) without serial bus collisions.

- **Dual-Watch & Sub-Receiver Architecture**  
  Hardware-aware capability gating. Automatically provides dedicated secondary VFO tuning, independent S-meter telemetry, audio gain, mute, and quick-pick channels when connected to dual-watch transceivers (such as the Kenwood TS-2000).

- **Headless WSJT-X / FT8 Dashboard**  
  Listens to the WSJT-X UDP broadcast on port 2237. Features an in-browser 15-second cycle timer, activity decodes, one-click CQ replies, and an immediate red Emergency TX Halt control.

- **Hardware-Agnostic Satellite Tracking**  
  Real-time SGP4 orbital propagation, next-pass predictions, HTML5 Canvas polar radar, dynamic downlink/uplink Doppler shift retuning, and automated CAT dispatch for cross-band splits and CTCSS tone actuation.

- **Two-Way ADIF Sync Engine (`shack_log.adi`)**  
  Automatic disk persistence adhering to the ADIF 3.1.4 standard. Reads records on startup, broadcasts real-time additions to connected clients, and enforces confirmation-gated deletions using a three-point composite key (`CALL` + `QSO_DATE` + `TIME_ON`).

- **FCC License & Band Privilege Engine**  
  Automated callsign verification via the FCC Callook API, Maidenhead grid calculation, Great Circle beam headings, and live carrier/audio bandwidth spillover edge detection against license privileges (Technician, General, Extra).

## Architecture Overview
```text
  ┌─────────────────────────────────────────────────────────┐
  │                 Physical Transceiver                    │
  │                  (Yaesu FT-991A, etc.)                  │
  └───────────────────────────▲─────────────────────────────┘
                              │ Physical USB / Serial
  ┌───────────────────────────▼─────────────────────────────┐
  │                 EZHAMShack Python Daemon                │
  │  ├── Serial Engine (Async queue & relay pacing)         │
  │  ├── SGP4 Satellite Doppler & Split Control             │
  │  ├── Hamlib rigctld Emulator (TCP: 127.0.0.1:4532)      │ ◄── WSJT-X / FLDIGI
  │  ├── WSJT-X UDP Listener (Port 2237)                    │
  │  └── WebSocket & Static Web Server                      │
  └───────────────────────────▲─────────────────────────────┘
                              │ Local WebSockets / JSON
  ┌───────────────────────────▼─────────────────────────────┐
  │               EZHAMShack Web Dashboard                  │
  │        (HTML5 Canvas, Vanilla JS, Tailwind CSS)         │
  └─────────────────────────────────────────────────────────┘
```
## Transceiver Compatibility Matrix

| Model | Status | CAT Engine | rigctld Emulation | Dual-Watch / Sub-RX | Satellite Split & CTCSS |
| --- | --- | --- | --- | --- | --- |
| **Yaesu FT-991A** | Supported (Beta) | Native Serial (38400 baud) | Yes (Port 4532) | N/A (Single Receiver) | Automated (`FT2`/`FT3`/`SV`) |
| **Kenwood TS-2000** | Supported (Beta) | Native Serial (9600 baud) | Yes (Port 4532) | Full Sub-VFO Control | Automated (`SP1`/`TF-SET`) |
| **Icom IC-7300** | In Development | CI-V Protocol | Planned | N/A (HF/6m) | N/A |
| **Elecraft (K3 / KX3)** | Planned | Direct Serial | Planned | Planned | Planned |

## Privacy & Station Configuration Policy

**Personal operator information must never be hardcoded into the codebase.**

All station parameters—callsign, license class, Maidenhead grid locator, geographic coordinates, and layout configurations—are managed dynamically:

* **In-Dashboard Configuration:** Set your station callsign, grid, power, and hardware settings via the **Settings Modal** (accessible from the top header).
* **Browser Persistence:** Configurations are safely stored locally in browser `localStorage` under `EZSHACK_STATE_V1` and never transmitted to external third-party servers.
* **Backup & Migration:** Export and import your complete station configuration as a standalone JSON file directly through the **Backup & Reset** tab in Settings.

---

## Quick Start Guide

### Windows Automated Setup (Recommended)

EZHAMShack provides a turnkey setup pipeline that configures your runtime, creates an isolated virtual environment, installs dependencies, formats station storage, and adds a desktop launcher.

1. **Clone or Download the Repository:**
   ```bash
   git clone https://github.com/KD2GUD/EZHAMShack.git
   cd EZHAMShack
   ```
   *(Alternatively, download the repository ZIP file and extract it to a directory on your machine, unzip and put the folder on your drive.).*

2. **Run the Automated Installer:**
   Double-click `install.bat` (or execute it from a command prompt).

   The installer executes the following operations automatically:
   * **Python Runtime Verification:** Scans for an existing Python installation. If missing, it automatically installs Python 3.12 in user scope via `winget`.
   * **Dedicated Virtual Environment:** Builds a self-contained `.venv\` directory to isolate all dependencies.
   * **CAT Dependency Installation:** Upgrades `pip` and installs required hardware communication modules (`pyserial`, `websockets`, and all packages in `requirements.txt`).
   * **Station Directory & ADIF Initialization:** Creates the master local station directory at `C:\ezshack\` and initializes a valid ADIF 3.1.4 log file at `C:\ezshack\shack_log.adi`.

3. **Launch the Station:**
   * Double-click the **EZShack** desktop shortcut (or run `launcher.bat`).
   * The launcher loads the page into your default browser.

---

## Contributing

Contributions, bug reports, and new transceiver profiles are welcome. To contribute support for an unlisted transceiver:

1. Fork the repository.
2. Create a feature branch:
   ```bash
   git checkout -b feature/new-rig-profile
   ```
3. Implement a new profile class inheriting from the abstract `BaseRigProfile`.
4. Verify that all CAT commands handle pacing and relay delays appropriately.
5. Confirm that **no operator callsigns, coordinates, or station paths** are hardcoded into the profile or unit tests.
6. Open a Pull Request with recorded serial trace logs or verification on physical hardware.

---

## License

Distributed under the **GNU General Public License v3.0**. See the `LICENSE` file for full terms and conditions.

**Developer:** Chris Nichols (KD2GUD)  
**Project Website:** [ezhamshack.com](https://ezhamshack.com)

---

*EZHAMShack is an independent open-source project and is not affiliated with Yaesu, Kenwood, Icom, or Elecraft.*
