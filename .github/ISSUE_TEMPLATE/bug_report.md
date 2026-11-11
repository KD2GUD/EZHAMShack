---
name: Bug Report
about: Report an unexpected error, crash, or CAT communication failure
title: '[BUG] '
labels: bug
assignees: ''
---

## Describe the Bug
A clear and concise description of what the error is, what went wrong, and under what operating conditions it occurred.

---

## Station Hardware & Operating Environment
* **Transceiver Model:** [e.g., Yaesu FT-991A, Kenwood TS-2000, Other]
* **Baud Rate:** [e.g., 38400, 9600, 4800]
* **Interface / Hardware Cable:** [e.g., Built-in rear USB soundcard/CAT, FTDI USB-to-RS232, Prolific cable]
* **COM Port Assignment:** [e.g., COM3, COM4, /dev/ttyUSB0]
* **Operating System:** [e.g., Windows 11 (23H2), Windows 10, Ubuntu 24.04, Raspberry Pi OS]
* **EZHAMShack Version:** [e.g., v1.0.0-Beta, commit hash]
* **Browser Used:** [e.g., Chrome 122, Firefox 124, Edge]

---

## Radio Configuration & Menu Settings
* **Selected CAT Rate in Rig Menu:** [e.g., 38400 bps / 9600 bps]
* **RTS / DTR Flow Control Settings:** [e.g., RTS On, RTS Off]
* **Operating Mode / Band at Time of Error:** [e.g., 20m USB, 2m FM, SO-50 Satellite Split]

---

## Steps to Reproduce
1. Start the hardware daemon via `launcher.bat` (or `python daemon.py`).
2. Navigate to `http://127.0.0.1:8080`.
3. Perform action: [e.g., Click on SO-50 satellite pass, initiate quick log, tune VFO].
4. Observe the failure or terminal disconnect.

---

## Expected Behavior
A concise description of what should have occurred (e.g., "The rig should tune to 436.795 MHz with -9.4 kHz Doppler correction applied without dropping CAT link").

---

## Daemon Console & Browser Logs

### Python Daemon Output
Paste any stack traces, serial errors, or timeout messages printed in your daemon command prompt window:
```text
Paste terminal logs here
```

### Browser Console Logs (Press F12 -> Console Tab)
If the web UI stalled, disconnected, or failed to render:
```text
Paste browser JavaScript console errors here
```

---

## Screenshots / Photos
If applicable, attach screenshots of your dashboard state or photos of your transceiver's front panel display when the issue occurred.

---

## Additional Station Context
Add any other relevant details regarding third-party utilities running simultaneously (e.g., WSJT-X, soundcard drivers, virtual audio cables) or recent changes to your shack configuration.