"""
EZShack Serial Engine (bridge/serial_engine.py)
Non-blocking async serial queue arbiter with hardware PTT lockout,
Windows WMI / Linux tty port discovery, rig-aware baud prioritization,
and multi-protocol framing support:
  - Fixed 5-byte binary frames @ 8N2 (Yaesu FT-857D / FT-817 / FT-897, including DigiRig Mobile)
  - Icom CI-V '0xFD' binary frames (Icom IC-7300)
  - ASCII ';' delimited (Kenwood TS-2000, Yaesu FT-991A)
"""

import asyncio
import json
import logging
import os
import re
import subprocess
import time
from typing import Optional, List, Tuple
import serial
import serial.tools.list_ports

logger = logging.getLogger("SerialEngine")

YAESU_BAUDS = [38400, 4800, 9600, 57600, 19200, 115200]
YAESU_LEGACY_BAUDS = [38400, 9600, 4800]
KENWOOD_BAUDS = [9600, 57600, 38400, 19200, 4800, 115200]
ICOM_BAUDS = [115200, 19200, 9600, 38400, 57600, 4800]

CIV_PROBE_FRAME = b"\xfe\xfe\x94\xe0\x03\xfd"
FT857_PROBE_FRAME = b"\x00\x00\x00\x00\x03"
FT857_VALID_MODES = {0x00, 0x01, 0x02, 0x03, 0x04, 0x06, 0x08, 0x0A, 0x0C}


def get_windows_port_roles() -> Tuple[List[str], List[str]]:
    """
    Queries Windows PnP to distinguish CP2105 Enhanced (CAT) from Standard (PTT).
    Returns (enhanced_cat_ports, blocked_ptt_ports).
    """
    enhanced = []
    blocked = []
    if os.name != "nt":
        return enhanced, blocked

    try:
        cmd = [
            "powershell", "-NoProfile", "-Command",
            "Get-CimInstance Win32_PnPEntity | Where-Object { $_.PNPClass -eq 'Ports' } | Select-Object Name, DeviceID | ConvertTo-Json"
        ]
        out = subprocess.check_output(cmd, text=True, timeout=5.0)
        data = json.loads(out)
        if isinstance(data, dict):
            data = [data]

        for item in data:
            name = item.get("Name", "")
            dev_id = item.get("DeviceID", "").upper()

            m = re.search(r"\((COM\d+)\)", name, re.IGNORECASE)
            if not m:
                continue
            port_name = m.group(1).upper()

            if "MI_01" in dev_id or "STANDARD" in name.upper():
                blocked.append(port_name)
            elif "MI_00" in dev_id or "ENHANCED" in name.upper():
                enhanced.append(port_name)

    except Exception as e:
        logger.debug("WMI port role detection skipped: %s", e)

    return enhanced, blocked


def get_port_chipset_hint(port_name: str) -> str:
    """
    Identifies known transceiver USB-UART bridges:
      - 'cp2105': Yaesu FT-991A dual-port bridge (10c4:ea70)
      - 'cp2102': Icom IC-7300 / DigiRig Mobile single-port bridge (10c4:ea60)
      - 'generic': FTDI / Prolific / CH340 / CT-62 / generic serial
    """
    target = port_name.upper() if os.name == "nt" else port_name
    for p in serial.tools.list_ports.comports():
        dev = p.device.upper() if os.name == "nt" else p.device
        if dev == target:
            desc = (p.description or "").lower()
            hwid = (p.hwid or "").lower()
            if "10c4:ea70" in hwid or "cp2105" in desc:
                return "cp2105"
            if "10c4:ea60" in hwid or "cp2102" in desc or "cp210x" in desc:
                return "cp2102"
    return "generic"


def _is_yaesu_5byte_cmd(command: bytes) -> bool:
    """Detects fixed 5-byte Yaesu FT-857D / FT-817 / FT-897 binary CAT commands."""
    return len(command) == 5 and not command.endswith(b";") and not command.endswith(b"\xfd")


def _expected_yaesu_5byte_reply_len(command: bytes) -> int:
    """Returns expected reply byte count for Yaesu FT-857D binary opcodes."""
    opcode = command[4]
    if opcode == 0x03:
        return 5  # 4-byte BCD frequency + 1-byte mode
    if opcode in (0xE7, 0xF7):
        return 1  # 1-byte RX or TX status bitmask
    return 0


def _open_serial_no_ptt_glitch(
    port: str,
    baudrate: int,
    stopbits: int = serial.STOPBITS_ONE,
    timeout: float = 0.6,
    write_timeout: float = 0.25,
    assert_lines: bool = False
) -> serial.Serial:
    """
    Opens a serial port with DTR/RTS pre-configured BEFORE open() so Windows USB-UART
    drivers (CP2102/FTDI) do not emit a momentary PTT pulse on DigiRig Mobile interfaces.
    """
    ser = serial.serial_for_url(port, do_not_open=True)
    ser.baudrate = baudrate
    ser.bytesize = serial.EIGHTBITS
    ser.parity = serial.PARITY_NONE
    ser.stopbits = stopbits
    ser.timeout = timeout
    ser.write_timeout = write_timeout
    ser.rtscts = False
    ser.dsrdtr = False
    ser.dtr = assert_lines
    ser.rts = assert_lines
    ser.open()
    ser.dtr = assert_lines
    ser.rts = assert_lines
    return ser


class SerialEngine:
    def __init__(
        self,
        port: Optional[str] = None,
        baudrate: int = 9600,
        settling_delay: float = 0.03
    ):
        raw_env_port = os.environ.get("EZSHACK_PORT", "").strip()
        if raw_env_port:
            env_port = raw_env_port.upper() if os.name == "nt" else raw_env_port
        else:
            env_port = None

        self.port: Optional[str] = port or env_port

        env_baud = os.environ.get("EZSHACK_BAUD", "").strip()
        self.baudrate: int = int(env_baud) if env_baud.isdigit() else baudrate

        self.settling_delay: float = settling_delay
        self.detected_rig_id: Optional[str] = None
        self._ser: Optional[serial.Serial] = None
        self._lock = asyncio.Lock()

    @property
    def is_connected(self) -> bool:
        return self._ser is not None and self._ser.is_open

    def _get_candidate_ports(self) -> List[str]:
        wmi_enhanced, wmi_blocked = get_windows_port_roles()
        all_system_ports = list(serial.tools.list_ports.comports())
        candidates: List[str] = []

        # 1. Verified Enhanced CAT ports from WMI on Windows (Yaesu FT-991A)
        for p in wmi_enhanced:
            if p not in candidates:
                candidates.append(p)

        # 2. USB serial adapters across Windows (COMx) and Linux (/dev/ttyUSB*, /dev/ttyACM*)
        for p in all_system_ports:
            dev_raw = p.device
            dev_norm = dev_raw.upper() if os.name == "nt" else dev_raw

            if os.name == "nt" and dev_norm in wmi_blocked:
                continue

            desc = (p.description or "").lower()
            hwid = (p.hwid or "").lower()

            if "standard" in desc or "mi_01" in hwid or "bluetooth" in desc:
                continue

            is_linux_usb_tty = dev_raw.startswith(("/dev/ttyUSB", "/dev/ttyACM", "/dev/cu.usb"))
            is_known_usb_uart = any(
                k in desc or k in hwid
                for k in ["ftdi", "prolific", "ch340", "cp210", "10c4:", "silicon labs", "usb to uart", "usb serial"]
            )

            if is_linux_usb_tty or is_known_usb_uart:
                if dev_norm not in candidates:
                    candidates.append(dev_norm)

        return candidates

    @staticmethod
    def _map_id_to_rig(id_resp: str) -> str:
        code = id_resp.replace("ID", "").replace(";", "").strip()
        if code in ("0670", "0671", "0650", "0710", "0680") or code.startswith("06") or code.startswith("07"):
            return "ft991a"
        if code in ("019", "020", "021", "022", "023", "024") or code.startswith("01") or code.startswith("02"):
            return "ts2000"
        return "ts2000"

    @staticmethod
    def _probe_civ(probe: serial.Serial) -> bool:
        """Sends an Icom IC-7300 CI-V frequency query and validates the reply frame."""
        probe.reset_input_buffer()
        probe.write(CIV_PROBE_FRAME)
        probe.flush()

        resp = probe.read_until(b"\xfd")
        if resp and b"\xfe\xfe\x94\xe0" in resp and b"\xfe\xfe\xe0\x94" not in resp:
            resp2 = probe.read_until(b"\xfd")
            resp = resp + resp2

        return bool(resp and b"\xfe\xfe\xe0\x94\x03" in resp and resp.endswith(b"\xfd"))

    @staticmethod
    def _validate_ft857_reply(resp: bytes) -> bool:
        """Validates a 5-byte Yaesu FT-857D / FT-817 / FT-897 freq+mode reply."""
        if not resp or len(resp) != 5:
            return False
        mode_byte = resp[4]
        if mode_byte not in FT857_VALID_MODES:
            return False
        val_10hz = 0
        for b in resp[:4]:
            hi = (b >> 4) & 0x0F
            lo = b & 0x0F
            if hi > 9 or lo > 9:
                return False
            val_10hz = val_10hz * 100 + (hi * 10 + lo)
        freq_hz = val_10hz * 10
        # Valid FT-857D coverage: 100 kHz to 470 MHz
        return 100_000 <= freq_hz <= 470_000_000

    def _probe_ft857(self, port: str) -> Optional[int]:
        """
        Probes legacy Yaesu 5-byte binary protocol at 8N2 across 38400/9600/4800 baud.
        Must run BEFORE multi-byte CI-V/ASCII probes so the FT-857D's 5-byte shift
        register is never misaligned by stray non-5-byte frames.
        """
        for baud in YAESU_LEGACY_BAUDS:
            probe = None
            try:
                probe = _open_serial_no_ptt_glitch(
                    port=port,
                    baudrate=baud,
                    stopbits=serial.STOPBITS_TWO,
                    timeout=0.35,
                    write_timeout=0.35,
                    assert_lines=False
                )
                time.sleep(0.08)
                probe.reset_input_buffer()
                probe.reset_output_buffer()

                probe.write(FT857_PROBE_FRAME)
                probe.flush()
                resp = probe.read(5)
                if self._validate_ft857_reply(resp):
                    return baud
            except (serial.SerialException, PermissionError, OSError):
                continue
            finally:
                if probe and probe.is_open:
                    try:
                        probe.close()
                    except Exception:
                        pass
        return None

    def auto_detect(self) -> Optional[Tuple[str, int, str]]:
        """Sweeps candidate ports using chipset-matched handshake and framing protocols."""
        candidate_ports = [self.port] if self.port else self._get_candidate_ports()
        if not candidate_ports:
            logger.error("No valid CAT ports found to probe.")
            return None

        logger.info("Scanning candidate CAT ports: %s", candidate_ports)

        for port in candidate_ports:
            chipset = get_port_chipset_hint(port)
            is_silabs = chipset in ("cp2105", "cp2102")
            line_assert = not is_silabs

            # 1. Probe Yaesu FT-857D / FT-817 / FT-897 FIRST on DigiRig (cp2102) or generic TTL cables
            #    Sending 5 exact bytes before any 6-byte CI-V or 3-byte ASCII probes prevents
            #    misaligning the FT-857D's fixed 5-byte UART shift register.
            if chipset in ("generic", "cp2102"):
                ft857_baud = self._probe_ft857(port)
                if ft857_baud:
                    logger.info("AUTO-DETECT SUCCESS: ft857d on %s @ %d baud (8N2 Binary CAT)", port, ft857_baud)
                    self.detected_rig_id = "ft857d"
                    return port, ft857_baud, "ft857d"

            if chipset == "cp2105":
                baud_list = YAESU_BAUDS
                settle_time = 0.05
            elif chipset == "cp2102":
                baud_list = ICOM_BAUDS
                settle_time = 0.06
            else:
                baud_list = KENWOOD_BAUDS
                settle_time = 0.15

            for baud in baud_list:
                probe = None
                try:
                    probe = _open_serial_no_ptt_glitch(
                        port=port,
                        baudrate=baud,
                        stopbits=serial.STOPBITS_ONE,
                        timeout=0.65,
                        write_timeout=0.40,
                        assert_lines=line_assert
                    )
                    time.sleep(settle_time)

                    probe.reset_input_buffer()
                    probe.reset_output_buffer()

                    # Prioritize CI-V probe when Silicon Labs CP2102 (IC-7300) is detected
                    if chipset == "cp2102":
                        if self._probe_civ(probe):
                            logger.info("AUTO-DETECT SUCCESS: ic7300 on %s @ %d baud (CI-V)", port, baud)
                            self.detected_rig_id = "ic7300"
                            return port, baud, "ic7300"

                    # Kenwood UART framing flush
                    if not is_silabs:
                        probe.write(b";;;")
                        time.sleep(0.06)
                        probe.reset_input_buffer()

                    # Query Transceiver ID (ID;)
                    probe.write(b"ID;")
                    probe.flush()
                    resp = probe.read_until(b";")

                    if resp in (b"?;", b"E;"):
                        time.sleep(0.05)
                        probe.reset_input_buffer()
                        probe.write(b"ID;")
                        probe.flush()
                        resp = probe.read_until(b";")

                    if resp and resp.startswith(b"ID") and resp.endswith(b";"):
                        id_str = resp.decode("ascii", errors="ignore").strip()
                        rig_id = self._map_id_to_rig(id_str)
                        logger.info("AUTO-DETECT SUCCESS: %s on %s @ %d baud (ID: %s)", rig_id, port, baud, id_str)
                        self.detected_rig_id = rig_id
                        return port, baud, rig_id

                    # Fallback ASCII Query: Frequency (FA;)
                    probe.write(b"FA;")
                    probe.flush()
                    resp_fa = probe.read_until(b";")

                    if resp_fa in (b"?;", b"E;"):
                        time.sleep(0.05)
                        probe.reset_input_buffer()
                        probe.write(b"FA;")
                        probe.flush()
                        resp_fa = probe.read_until(b";")

                    if resp_fa and resp_fa.startswith(b"FA") and resp_fa.endswith(b";"):
                        digits = resp_fa[2:-1]
                        rig_id = "ts2000" if len(digits) == 11 else "ft991a"
                        logger.info("AUTO-DETECT SUCCESS: Responsive VFO on %s @ %d baud (%s)", port, baud, rig_id)
                        self.detected_rig_id = rig_id
                        return port, baud, rig_id

                    # Fallback CI-V Probe for generic FTDI/Prolific CI-V cables
                    if chipset != "cp2102":
                        if self._probe_civ(probe):
                            logger.info("AUTO-DETECT SUCCESS: ic7300 on %s @ %d baud (CI-V)", port, baud)
                            self.detected_rig_id = "ic7300"
                            return port, baud, "ic7300"

                except (serial.SerialException, PermissionError, OSError):
                    continue
                finally:
                    if probe and probe.is_open:
                        try:
                            probe.close()
                        except Exception:
                            pass

        return None

    def connect(self) -> bool:
        self.close()

        forced_rig = os.environ.get("EZSHACK_RIG", "").strip().lower()
        if forced_rig:
            self.detected_rig_id = forced_rig

        if not self.port or not os.environ.get("EZSHACK_BAUD"):
            detected = self.auto_detect()
            if detected:
                self.port, self.baudrate, self.detected_rig_id = detected
            elif self.port:
                logger.warning("No auto-detect response. Using %s @ %d baud", self.port, self.baudrate)
            else:
                logger.error("Auto-detection failed: No responsive transceiver on candidate CAT ports.")
                return False

        is_ft857 = (self.detected_rig_id or "") in ("ft857d", "ft857", "ft817", "ft897")
        stopbits = serial.STOPBITS_TWO if is_ft857 else serial.STOPBITS_ONE

        try:
            chipset = get_port_chipset_hint(self.port)
            is_silabs = chipset in ("cp2105", "cp2102")
            disarm_lines = is_silabs or is_ft857

            self._ser = _open_serial_no_ptt_glitch(
                port=self.port,
                baudrate=self.baudrate,
                stopbits=stopbits,
                timeout=0.6,
                write_timeout=0.25,
                assert_lines=not disarm_lines
            )

            time.sleep(0.10)
            self._ser.reset_input_buffer()
            self._ser.reset_output_buffer()

            framing_note = "8N2" if is_ft857 else "8N1"
            status_note = "PTT lines disarmed" if disarm_lines else "RTS/DTR handshake asserted"
            logger.info("Transceiver CAT online: %s @ %d baud (%s, %s)", self.port, self.baudrate, framing_note, status_note)
            return True

        except Exception as e:
            logger.error("Failed opening %s: %s", self.port, e)
            self._ser = None
            return False

    def close(self):
        if self._ser and self._ser.is_open:
            try:
                self._ser.dtr = False
                self._ser.rts = False
                self._ser.close()
            except Exception:
                pass
        self._ser = None

    async def execute_command(
        self,
        command: bytes,
        expect_reply: bool = False,
        custom_settle_sec: Optional[float] = None
    ) -> bytes:
        if not self.is_connected or not self._ser:
            return b""

        is_civ = command.endswith(b"\xfd")
        is_yaesu_5b = _is_yaesu_5byte_cmd(command)
        terminator = b"\xfd" if is_civ else b";"

        async with self._lock:
            try:
                loop = asyncio.get_running_loop()

                def _write_and_read():
                    if is_civ or is_yaesu_5b:
                        self._ser.reset_input_buffer()

                    self._ser.write(command)
                    self._ser.flush()

                    reply = b""
                    if is_yaesu_5b:
                        expected_len = _expected_yaesu_5byte_reply_len(command)
                        if expect_reply and expected_len > 0:
                            reply = self._ser.read(expected_len)
                        else:
                            # Drain optional 1-byte ACK on set commands
                            time.sleep(0.02)
                            if self._ser.in_waiting:
                                self._ser.read(self._ser.in_waiting)
                    elif expect_reply:
                        reply = self._ser.read_until(terminator)
                        # On Icom CI-V, the transceiver echoes our command frame before sending its reply
                        if is_civ and reply and b"\xfe\xfe\x94\xe0" in reply and b"\xfe\xfe\xe0\x94" not in reply:
                            reply2 = self._ser.read_until(b"\xfd")
                            reply = reply + reply2
                    elif is_civ:
                        # Drain echoed bytes from input buffer on set commands
                        time.sleep(0.015)
                        if self._ser.in_waiting:
                            self._ser.read(self._ser.in_waiting)

                    return reply

                response = await loop.run_in_executor(None, _write_and_read)

                settle = custom_settle_sec if custom_settle_sec is not None else self.settling_delay
                if settle > 0:
                    await asyncio.sleep(settle)

                return response

            except Exception as e:
                logger.error("Serial execution fault on %s: %s", self.port, e)
                self.close()
                return b""
