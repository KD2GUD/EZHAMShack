# Changelog

All notable changes to **EZHAMShack** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-11-15

Inaugural public release of **EZHAMShack**, a browser-based amateur radio operations dashboard and direct serial CAT bridge daemon.

### Added

#### Hardware CAT Engine & Transceiver Support (`bridge/`)
- **Direct Serial CAT Daemon (`bridge/daemon.py`):** Native asynchronous Python `pyserial` engine with hardware-specific command pacing, relay settling delays, coalesced low-latency frequency writes, optimistic tuning locks, 180-second PTT safety timeout, and 15-second orphan client watchdog.
- **WebSocket Telemetry Bridge (`ws://127.0.0.1:8088`):** Real-time bidirectional JSON telemetry pushing live frequency, VFO A/B state, mode, band, PTT status, S-meter, forward power, SWR, built-in ATU state, and transceiver capability flags (`sub_rx`, `af_gain`, `rf_power`, `tuner`) with Cross-Site WebSocket Hijacking (CSWSH) origin validation.
- **Supported Transceiver Profiles & Per-Rig Frequency Bounds:**
  - **Yaesu FT-991A (`38400` baud):** Full HF / 6m / 2m / 70cm CAT (`30 kHz – 470 MHz`), VFO A/B swap (`SV;`), RM1/RM4/RM5 metering, built-in ATU control (`AC;`), and automated cross-band satellite split/CTCSS programming.
  - **Yaesu FT-857D / FT-817ND / FT-897D (`38400` baud, 8N2):** Fixed 5-byte binary CAT protocol (`30 kHz` / `100 kHz – 470 MHz`), VFO toggle, RX/TX status metering, automated CTCSS split programming, and capability-gated UI disabling for hardware-knob-only AF gain and menu-only RF power.
  - **Icom IC-7300 (`19200` baud):** Native CI-V protocol (`0x94` default address, `30 kHz – 74.8 MHz` HF + 6m), BCD frequency/level encoding, DATA-U/DATA-L filter routing, S/Po/SWR metering, and built-in ATU control.
  - **Kenwood TS-2000 (`9600` baud):** Full HF / 6m / 2m / 70cm / 23cm CAT (`30 kHz – 1300 MHz`), dual-VFO (`FR`/`FT`) routing, built-in ATU control, and dedicated VHF/UHF Sub-Receiver (`FC`, `SB`, `MU`, `SM1`, `AG1`) dual-watch telemetry.
- **Automated USB Port & Baud Discovery (`bridge/serial_engine.py`):** Scans active serial ports and probes supported transceiver protocols automatically on startup, displaying `SCANNING USB...` in the console until a transceiver responds.

#### VFO, Band Compliance & Telemetry Console (`index.html`, `app.js`)
- **Interactive Decade-Stepped VFO Readout:** Tunes from `100 MHz` steps down to `1 Hz` steps via top/bottom digit clicks or mouse scroll-wheel stepping on individual digits, automatically expanding to 4 MHz digits on `23cm` (`1240–1300 MHz`) and enforcing per-rig frequency ceilings.
- **Dual VFO A/B & Per-Band Frequency Memory:** Independent VFO A and VFO B state tracking with automatic recall of the last-used frequency per amateur band (`160m` through `23cm`) and fixed-width band/mode badges to prevent horizontal display jitter.
- **60m Channelized & WRC-15 Power Compliance:** Contextual `CH 1`–`CH 5` / `WRC 15k` selector pill on `60m` covering US discrete channels (`100 W ERP` max) and the `5.3515–5.3665 MHz` WRC-15 continuous segment, automatically setting TX power to `9 W` (`9.15 W ERP` max) on the WRC segment and restoring prior TX power when leaving.
- **Automatic Sub-Band Mode Switching:** One-time automatic mode selection (`CW`, `DATA-U`, `LSB`, `USB`, `FM`) when crossing standard sub-band boundaries without overriding manual mode choices inside a segment.
- **FCC Part 97 Band Privilege Alerts:** Real-time carrier and audio bandwidth spillover validation against Technician, General, Extra, Novice, or Unrestricted privileges with cyan (in-band), yellow (edge spillover), and red (out-of-band) VFO coloring.
- **Calibrated 15-LED S-Meter / TX Power Bar Graph:** Auto-detects or manually selects calibration curves for Yaesu Modern, Yaesu Legacy (`FT-857D`), Kenwood/Elecraft, Icom CI-V, and Generic SDR (`S1`–`S9+60dB` RX / `0–100 W` TX).
- **Hardware Target Controls:** Sticky secondary telemetry bar with built-in ATU inline/bypass toggle and `TUNE` cycle trigger, TX RF power slider + quick presets (`5W`, `25W`, `50W`, `100W`), and AF volume slider + mute toggle.
- **Display & Night Shack Modes:** Tactical Red Night Vision mode, viewport display zoom (`75%–125%`), fullscreen toggle, live UTC/Zulu and local clocks, and one-click station power-down modal that cleanly halts the bridge daemon and closes the console tab.

#### 16-Column Modular Workspace & Native Widgets (`panes.js`, `widgets/`)
- **16-Column Fluid Grid & Memory Presets (`P1`–`P4` + `MEM`):** Drag-and-drop pane headers, corner resize handles, smart first-open-slot pane insertion with viewport auto-scroll, pre-configured workspace layouts (`P1: GEN`, `P2: SAT`, `P3: FT8`, `P4: DX`), and `MEM` save/rename slots.
- **SGP4 Satellite Tracker & Doppler CAT (`widgets/satellite.js`):** Real-time orbital propagation via `satellite.js`, 36-hour next-pass predictions, pass-sorted satellite selector, polar radar display, continuous RX Doppler correction, automated split/CTCSS rig tuning, audible 1-minute/AOS chimes, CelesTrak TLE caching, and transceiver band-capability gating (disabling VHF/UHF transponders on HF-only rigs).
- **PSK Reporter Live Spot Map (`widgets/pskreporter.js`):** Embedded real-time digital reception map filtered automatically to the operator's callsign.
- **Solar & Geomagnetic Telemetry (`widgets/solar.js`):** Live NOAA SWPC SFI, Sunspot Number, A-Index, K-Index, X-ray flare class, geomagnetic storm scale, and HF band condition matrix (`80m–10m`), paired with a compact K-index badge in the top bar.
- **Great Circle & Beam Heading Calculator (`widgets/greatcircle.js`):** Short-path azimuth, distance (`km` / `mi`), visual compass needle, Maidenhead coordinate conversion, and CQ/ITU zone estimation.
- **Callsign Lookup (`widgets/lookup.js`):** Live FCC Callook and HamDB callsign resolution with auto-sync to the Great Circle calculator and QSO Logger.
- **QSO QuickLog & Standalone ADIF Logbook (`widgets/logger.js`):** Logs contacts directly to `logs/shack_log.adi` in standard ADIF 3.1.4 format (including `CQZ`, `ITUZ`, `MY_GRIDSQUARE`, and rig telemetry) for easy import into external logging software, with live table filtering, confirmation-gated record deletion, and ADIF export.
- **Station Scratchpad & External Tools Launcher (`widgets/scratchpad.js`, `panes.js`):** Persistent operator notepad plus a customizable new-tab button launcher for frame-restricted sites (VOACAP, LightningMaps, QRZ, DXSummit, Windy) alongside inline embed panels for DXMaps, KC2G MUF, and Reverse Beacon Network (RBN).
- **Auto-Detect Station Profile & Backup:** One-click license class, Maidenhead grid, QTH, lat/lon, and CQ/ITU zone lookup in Settings, plus full JSON configuration export/import.

#### Cross-Platform Installers & Auto-Update Launchers
- **Automated Setup & Launchers (`install.bat`, `launcher.bat`, `install.sh`, `launcher.sh`):** Isolated Python `.venv` setup and startup scripts for Windows and Linux featuring silent connectivity detection, GitHub update checks with operator countdown prompt, automatic `pip` / library upgrades (`pyserial`, `websockets`), and clean environment reset into auto-detect mode.