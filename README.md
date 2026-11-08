# EZHAMShack

A modern, lightweight, cross-platform amateur radio station dashboard and hardware automation suite.

![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)
![Status: Public Beta](https://img.shields.io/badge/Status-Beta-orange.svg)
![Python](https://img.shields.io/badge/Python-3.10%2B-brightgreen.svg)
![Frontend](https://img.shields.io/badge/UI-Vanilla%20JS%20%2F%20Tailwind-38bdf8.svg)

**EZHAMShack** replaces bulky legacy shack tools, virtual COM port splitters, and fragmented utility windows with a unified browser interface backed by a lightweight, asynchronous local Python daemon.

---

## Why EZHAMShack?

| The Traditional Shack Stack | The EZHAMShack Approach |
| :--- | :--- |
| FLRIG or proprietary desktop suites eating memory | Lightweight local Python daemon holding the serial link |
| Virtual COM port splitters causing driver collisions | Built-in `rigctld` emulator shares access across apps |
| Multiple windows for CAT, satellites, and decodes | Single, high-performance dark-mode web dashboard |
| Cluttered desktop screens on local machines only | Browser-based UI accessible from PC, tablet, or phone |

---

## Key Features

* **Direct Hardware CAT Engine:** Native Python serial engine (`pyserial`) with rig-specific relay settling delays. Direct, low-latency control without relying on FLRIG.
* **Internal Hamlib `rigctld` Server (`127.0.0.1:4532`):** Multiplexes rig access. Run third-party digital mode tools (WSJT-X, FLDIGI) concurrently with the dashboard without serial port locks.
* **Headless WSJT-X / FT8 Dashboard:** Ingests live decodes over UDP (port 2237), provides an in-browser 15-second cycle timer, one-click CQ responses, and an instant Emergency TX Halt button.
* **Integrated Satellite Tracker:** Real-time SGP4 orbital propagation, HTML5 Canvas polar radar, next-pass predictions, and automated Doppler frequency compensation. Automatically engages cross-band split and CTCSS tones on supported transceivers during passes.
* **Built-in Station Utilities:** FCC Callook API + offline DXCC prefix lookup, Maidenhead grid distance and Great Circle bearing calculations, and QuickLog with standard ADIF 3.1 export.

---

## Architecture Overview

```text
  ┌─────────────────────────────────────────────────────────┐
  │                 Physical Transceiver                    │
  │                  (Yaesu FT-991A, etc.)                  │
  └───────────────────────────▲─────────────────────────────┘
                              │ Physical USB / Serial
  ┌───────────────────────────▼─────────────────────────────┐
  │                 EZHAMShack Python Daemon                │
  │  ├── Serial Engine (Async queue & relay pacing)        │
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
