---
name: Transceiver Support Request
about: Request native CAT support and a profile for a new radio model
title: '[RIG REQUEST] '
labels: enhancement, hardware-profile
assignees: ''
---

## Transceiver Details

* **Manufacturer:** [e.g., Icom, Yaesu, Kenwood, Elecraft, Xiegu]
* **Model:** [e.g., IC-7300, IC-705, KX3, G90, FTM-400]
* **Interface / Physical Connection:** [e.g., Direct rear USB, DB9 RS-232, 3.5mm CI-V jack]
* **Default Baud Rate:** [e.g., 19200, 9600, 4800, 38400]
* **Flow Control Requirements:** [e.g., RTS/CTS hardware handshaking, None]

## Protocol & Architecture Details

* **Protocol Family:** [e.g., Icom CI-V binary hex, Yaesu/Kenwood ASCII text with `;` terminator]
* **Transceiver Capabilities:**
  - [ ] Single Receiver (Standard single-VFO monitoring)
  - [ ] Dedicated Sub-Receiver / Dual-Watch (Independent secondary VFO receiver like TS-2000)
  - [ ] Full Duplex (Simultaneous cross-band satellite transmit/receive)
  - [ ] Live S-Meter / Forward Power polling supported over CAT
  - [ ] Sub-audible CTCSS tone selection supported over CAT

## Manufacturer Reference Documentation

Please link official manufacturer CAT command manuals or protocol specifications:
* **CAT / Programming Reference Manual:** [Paste URL or link to PDF]
* **Rig Firmware Version Tested:** [e.g., v1.41]

## Hardware Testing & Validation

Accurate serial profiling requires physical hardware validation (verifying relay settling delays, buffer polling rates, and command timeouts).

* [ ] **I physically own this transceiver** and have it connected to a station PC.
* [ ] **I am willing to test beta feature branches** and provide terminal serial debug traces.
* [ ] **I have verified the radio responds to serial CAT** using standard serial terminal software or vendor tools.

## Sample CAT Commands (If Known)

If available in the reference manual, provide sample command syntax:
* **Read Active Frequency (VFO A):** [e.g., `FA;` or `FE FE ...`]
* **Set Operating Mode:** [e.g., `MD2;`]
* **Engage PTT / TX:** [e.g., `TX1;`]

## Additional Notes & Menu Quirks

Add any details regarding specific rig menu settings needed to enable CAT control (e.g., menu numbers for baud rate, internal soundcard USB settings, or CI-V transceive toggles).