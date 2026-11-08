"""
EZShack Serial Engine (bridge/serial_engine.py)
Non-blocking async serial queue arbiter with hardware PTT lockout,
CP2105 MI_00/MI_01 isolation via Windows WMI, rig-aware baud prioritization,
and transceiver-specific framing clearance.
"""

import asyncio
import logging
import os
import subprocess
import time
from typing import Optional, List, Tuple
import serial
import serial.tools.list_ports

logger = logging.getLogger("SerialEngine")

YAESU_BAUDS = [38400, 4800, 9600, 57600, 19200, 115200]
KENWOOD_BAUDS = [9600, 57600, 38400, 19200, 4800, 115200]


def get_windows_port_roles() -> Tuple[List[str], List[str]]:
    """
    Queries Windows PnP to distinguish CP2105 Enhanced (CAT) from Standard (PTT).
    Returns (enhanced_cat_ports, blocked_ptt_ports).
    """
    enhanced = []
    blocked = []
    try:
        cmd = [
            "powershell", "-NoProfile", "-Command",
            "Get-CimInstance Win32_PnPEntity | Where-Object { $_.PNPClass -eq 'Ports' } | Select-Object Name, DeviceID | ConvertTo-Json"
        ]
        out = subprocess.check_output(cmd, text=True, timeout=5.0)
        import json
        data = json.loads(out)
        if isinstance(data, dict):
            data = [data]

        for item in data:
            name = item.get("Name", "")
            dev_id = item.get("DeviceID", "").upper()

            import re
            m = re.search(r"\((COM\d+)\)", name)
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


def is_cp2105_device(port_name: str) -> bool:
    """Returns True if the port belongs to a Silicon Labs CP2105 dual-port bridge."""
    for p in serial.tools.list_ports.comports():
        if p.device.upper() == port_name.upper():
            desc = (p.description or "").lower()
            hwid = (p.hwid or "").lower()
            if "10c4:ea70" in hwid or "cp2105" in desc:
                return True
    return False


class SerialEngine:
    def __init__(
        self,
        port: Optional[str] = None,
        baudrate: int = 9600,
        settling_delay: float = 0.03
    ):
        env_port = os.environ.get("EZSHACK_PORT", "").strip().upper()
        self.port: Optional[str] = port or (env_port if env_port else None)

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
        candidates = []

        # 1. Verified Enhanced CAT ports from WMI (Yaesu FT-991A)
        for p in wmi_enhanced:
            if p not in candidates:
                candidates.append(p)

        # 2. Dedicated USB serial adapters (FTDI / TS-2000)
        for p in all_system_ports:
            dev = p.device.upper()
            if dev in wmi_blocked:
                continue

            desc = (p.description or "").lower()
            hwid = (p.hwid or "").lower()

            if "standard" in desc or "mi_01" in hwid or "bluetooth" in desc:
                continue

            if any(k in desc or k in hwid for k in ["ftdi", "prolific", "ch340", "usb to uart", "usb serial"]):
                if dev not in candidates:
                    candidates.append(dev)

        return candidates

    @staticmethod
    def _map_id_to_rig(id_resp: str) -> str:
        code = id_resp.replace("ID", "").replace(";", "").strip()
        if code in ("0670", "0671", "0650", "0710", "0680") or code.startswith("06") or code.startswith("07"):
            return "ft991a"
        if code in ("019", "020", "021", "022", "023", "024") or code.startswith("01") or code.startswith("02"):
            return "ts2000"
        return "ts2000"

    def auto_detect(self) -> Optional[Tuple[str, int, str]]:
        """Sweeps candidate ports using chipset-matched handshake and framing protocols."""
        candidate_ports = [self.port] if self.port else self._get_candidate_ports()
        if not candidate_ports:
            logger.error("No valid CAT ports found to probe.")
            return None

        logger.info("Scanning candidate CAT ports: %s", candidate_ports)

        for port in candidate_ports:
            is_yaesu_bridge = is_cp2105_device(port)
            line_assert = not is_yaesu_bridge
            baud_list = YAESU_BAUDS if is_yaesu_bridge else KENWOOD_BAUDS
            settle_time = 0.05 if is_yaesu_bridge else 0.15

            for baud in baud_list:
                try:
                    with serial.Serial(
                        port=port,
                        baudrate=baud,
                        bytesize=serial.EIGHTBITS,
                        parity=serial.PARITY_NONE,
                        stopbits=serial.STOPBITS_ONE,
                        timeout=0.80,
                        write_timeout=0.40,
                        rtscts=False,
                        dsrdtr=False
                    ) as probe:
                        probe.dtr = line_assert
                        probe.rts = line_assert
                        time.sleep(settle_time)

                        probe.reset_input_buffer()
                        probe.reset_output_buffer()

                        # Kenwood UART framing flush
                        if not is_yaesu_bridge:
                            probe.write(b";;;")
                            time.sleep(0.06)
                            probe.reset_input_buffer()

                        # Query Transceiver ID (ID;)
                        probe.write(b"ID;")
                        probe.flush()
                        resp = probe.read_until(b";")

                        # If buffer had leftover framing and returned error, clear and retry
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

                        # Fallback Query: Frequency (FA;)
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

                except (serial.SerialException, PermissionError, OSError):
                    continue

        return None

    def connect(self) -> bool:
        self.close()

        if not self.port or not os.environ.get("EZSHACK_BAUD"):
            detected = self.auto_detect()
            if detected:
                self.port, self.baudrate, self.detected_rig_id = detected
            elif self.port:
                logger.warning("No auto-detect response. Using %s @ %d baud", self.port, self.baudrate)
            else:
                logger.error("Auto-detection failed: No responsive transceiver on candidate CAT ports.")
                return False

        try:
            self._ser = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                timeout=0.6,
                write_timeout=0.25,
                rtscts=False,
                dsrdtr=False
            )

            is_yaesu_bridge = is_cp2105_device(self.port)
            self._ser.dtr = not is_yaesu_bridge
            self._ser.rts = not is_yaesu_bridge

            time.sleep(0.10)
            self._ser.reset_input_buffer()
            self._ser.reset_output_buffer()

            status_note = "PTT lines disarmed" if is_yaesu_bridge else "RTS/DTR handshake asserted"
            logger.info("Transceiver CAT online: %s @ %d baud (%s)", self.port, self.baudrate, status_note)
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

        async with self._lock:
            try:
                loop = asyncio.get_running_loop()

                def _write_and_read():
                    self._ser.write(command)
                    self._ser.flush()
                    reply = b""
                    if expect_reply:
                        reply = self._ser.read_until(b";")
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