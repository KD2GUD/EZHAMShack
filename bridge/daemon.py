"""
EZShack Bridge Daemon (bridge/daemon.py)
Direct Serial CAT Engine with Dual-VFO Tracking, Sub-Receiver (Dual Watch) Telemetry,
Hardware Settling Delays, Startup Power Readout, Embedded Hamlib rigctld Server,
Two-Way ADIF Sync Engine, CSWSH Protection, and Dynamic Auto-Detect Rig Profile Registry.
"""

import asyncio
from datetime import datetime, timezone
import json
import logging
import os
import re
import sys
import time
from typing import Any, Dict, Optional, Set

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
for p in (CURRENT_DIR, PROJECT_ROOT):
    if p not in sys.path:
        sys.path.insert(0, p)

import websockets

try:
    from bridge.serial_engine import SerialEngine
    from bridge.rig_profiles import get_rig_profile, BaseRig
    from bridge.rigctld_server import RigctldServer
except ModuleNotFoundError:
    from serial_engine import SerialEngine
    from rig_profiles import get_rig_profile, BaseRig
    from rigctld_server import RigctldServer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] [%(levelname)s] %(message)s"
)
logger = logging.getLogger("BridgeDaemon")

WS_HOST = os.environ.get("EZSHACK_WS_HOST", "127.0.0.1")
WS_PORT = int(os.environ.get("EZSHACK_WS_PORT", 8088))
RIGCTLD_HOST = os.environ.get("EZSHACK_RIGCTLD_HOST", "127.0.0.1")
RIGCTLD_PORT = int(os.environ.get("EZSHACK_RIGCTLD_PORT", 4532))

# Portable path resolution: <PROJECT_ROOT>/logs/shack_log.adi
DEFAULT_LOGS_DIR = os.path.join(PROJECT_ROOT, "logs")
DEFAULT_ADIF_FILE = os.path.join(DEFAULT_LOGS_DIR, "shack_log.adi")
LEGACY_ADIF_FILE = r"C:\ezshack\shack_log.adi"

# Preserve existing C:\ezshack logs if already on disk and local folder has none yet
if not os.environ.get("EZSHACK_ADIF_FILE") and os.path.exists(LEGACY_ADIF_FILE) and not os.path.exists(DEFAULT_ADIF_FILE):
    ADIF_FILE = LEGACY_ADIF_FILE
else:
    ADIF_FILE = os.environ.get("EZSHACK_ADIF_FILE", DEFAULT_ADIF_FILE)

ORPHAN_WATCHDOG_SECONDS = 15
PTT_SAFETY_TIMEOUT_SECONDS = 180

ALLOWED_WS_ORIGINS = {
    "", "null",
    "http://localhost", "http://127.0.0.1",
    "http://localhost:8088", "http://127.0.0.1:8088"
}

DEFAULT_STATION_PROFILE = {
    "OPERATOR": "N0CALL",
    "STATION_CALLSIGN": "N0CALL",
    "MY_GRIDSQUARE": "",
    "MY_CITY": "",
    "MY_STATE": "",
    "COUNTRY": "USA",
    "CQZ": "",
    "TX_PWR": "100"
}


def freq_to_band(freq_hz: int) -> str:
    mhz = freq_hz / 1_000_000.0
    if 1.8 <= mhz <= 2.0: return "160m"
    if 3.5 <= mhz <= 4.0: return "80m"
    if 5.33 <= mhz <= 5.41: return "60m"
    if 7.0 <= mhz <= 7.3: return "40m"
    if 10.1 <= mhz <= 10.15: return "30m"
    if 14.0 <= mhz <= 14.35: return "20m"
    if 18.068 <= mhz <= 18.168: return "17m"
    if 21.0 <= mhz <= 21.45: return "15m"
    if 24.89 <= mhz <= 24.99: return "12m"
    if 28.0 <= mhz <= 29.7: return "10m"
    if 50.0 <= mhz <= 54.0: return "6m"
    if 144.0 <= mhz <= 148.0: return "2m"
    if 420.0 <= mhz <= 450.0: return "70cm"
    return "--m"


def format_adif_tag(tag: str, value: Any) -> str:
    val_str = str(value).strip()
    return f"<{tag.upper()}:{len(val_str)}>{val_str}" if val_str else ""


def append_qso_to_adif(qso_data: dict, current_freq_hz: Optional[int] = None, current_mode: str = "USB", station_profile: Optional[dict] = None):
    profile = station_profile or DEFAULT_STATION_PROFILE
    file_exists = os.path.exists(ADIF_FILE)

    call = qso_data.get("call", "").strip().upper()
    if not call:
        return

    raw_freq = qso_data.get("freq")
    if raw_freq:
        try:
            val = float(raw_freq)
            freq_mhz = f"{val / 1_000_000:.6f}" if val > 1000 else f"{val:.6f}"
            freq_hz = int(float(raw_freq) * 1_000_000) if val <= 1000 else int(val)
        except ValueError:
            freq_mhz = "14.074000"
            freq_hz = 14074000
    elif current_freq_hz:
        freq_mhz = f"{current_freq_hz / 1_000_000.0:.6f}"
        freq_hz = current_freq_hz
    else:
        freq_mhz = "14.000000"
        freq_hz = 14000000

    mode = str(qso_data.get("mode") or current_mode).strip().upper()
    band = qso_data.get("band") or freq_to_band(freq_hz)
    rst_sent = str(qso_data.get("rst_sent") or qso_data.get("rstS") or "599").strip()
    rst_rcvd = str(qso_data.get("rst_rcvd") or qso_data.get("rstR") or "599").strip()
    notes = str(qso_data.get("notes") or qso_data.get("comment") or "").strip()

    now = datetime.now(timezone.utc)
    raw_date = qso_data.get("date") or now.strftime("%Y%m%d")
    qso_date = re.sub(r"[^\d]", "", str(raw_date))[:8] or now.strftime("%Y%m%d")

    raw_time = qso_data.get("time_on") or qso_data.get("time") or now.strftime("%H%M%S")
    clean_time = re.sub(r"[^\d]", "", str(raw_time))
    time_on = clean_time.ljust(6, "0")[:6] if clean_time else now.strftime("%H%M%S")

    op_call = profile.get("callsign") or profile.get("OPERATOR") or "N0CALL"
    grid_sq = profile.get("grid") or profile.get("MY_GRIDSQUARE") or ""
    city = profile.get("city") or profile.get("MY_CITY") or ""
    state = profile.get("state") or profile.get("MY_STATE") or ""
    country = profile.get("country") or profile.get("COUNTRY") or "USA"
    cqz = str(profile.get("cqz") or profile.get("CQZ") or "")
    pwr = str(profile.get("power") or profile.get("TX_PWR") or "100")

    fields = [
        ("FREQ", freq_mhz), ("CALL", call), ("MODE", mode),
        ("QSO_DATE", qso_date), ("TIME_ON", time_on),
        ("RST_SENT", rst_sent), ("RST_RCVD", rst_rcvd),
        ("BAND", band), ("COUNTRY", country), ("TX_PWR", pwr),
        ("OPERATOR", op_call), ("STATION_CALLSIGN", op_call)
    ]
    if cqz: fields.append(("CQZ", cqz))
    if grid_sq: fields.append(("MY_GRIDSQUARE", grid_sq))
    if city: fields.append(("MY_CITY", city))
    if state: fields.append(("MY_STATE", state))
    if notes: fields.append(("COMMENT", notes))

    record = "".join(format_adif_tag(t, v) for t, v in fields) + "<EOR>\n"

    try:
        os.makedirs(os.path.dirname(os.path.abspath(ADIF_FILE)), exist_ok=True)
        with open(ADIF_FILE, "a", encoding="ascii", errors="replace") as f:
            if not file_exists:
                f.write("<ADIF_VER:5>3.1.4\n<PROGRAMID:7>EZShack\n<PROGRAMVERSION:5>1.0.0\n<EOH>\n")
            f.write(record)
        logger.info("[ADIF] Logged QSO: %s | %s MHz (%s) | Op: %s", call, freq_mhz, mode, op_call)
    except Exception as e:
        logger.error("[ADIF] Failed writing record: %s", e)


def reset_adif_file() -> bool:
    """Overwrites shack_log.adi with a clean ADIF 3.1.4 header, wiping all records."""
    try:
        os.makedirs(os.path.dirname(os.path.abspath(ADIF_FILE)), exist_ok=True)
        header = (
            "ADIF 3.1.4 Export\n"
            "Generated by EZShack Bridge\n"
            "<ADIF_VER:5>3.1.4\n"
            "<PROGRAMID:7>EZShack\n"
            "<PROGRAMVERSION:5>1.0.0\n"
            "<EOH>\n"
        )
        with open(ADIF_FILE, "w", encoding="ascii", errors="replace") as f:
            f.write(header)
        logger.info("[ADIF] Log file %s purged and initialized with clean header.", ADIF_FILE)
        return True
    except Exception as e:
        logger.error("[ADIF] Failed resetting log file: %s", e)
        return False


def delete_qso_from_adif(qso_data: dict) -> bool:
    if not os.path.exists(ADIF_FILE):
        return False

    target_call = str(qso_data.get("call") or "").strip().upper()
    if not target_call:
        return False

    raw_date = qso_data.get("date") or qso_data.get("qso_date") or ""
    target_date = re.sub(r"[^\d]", "", str(raw_date))[:8]

    raw_time = qso_data.get("time_on") or qso_data.get("time") or ""
    target_time = re.sub(r"[^\d]", "", str(raw_time))[:6]

    try:
        with open(ADIF_FILE, "r", encoding="ascii", errors="replace") as f:
            content = f.read()

        header_match = re.search(r"(.*?)<EOH>\s*", content, re.IGNORECASE | re.DOTALL)
        if header_match:
            header = header_match.group(0)
            records_body = content[len(header):]
        else:
            header = ""
            records_body = content

        raw_records = re.split(r"<EOR>\s*", records_body, flags=re.IGNORECASE)
        new_records = []
        deleted = False

        for rec in raw_records:
            rec_clean = rec.strip()
            if not rec_clean:
                continue

            m_call = re.search(r"<CALL:\d+>([^<]+)", rec_clean, re.IGNORECASE)
            rec_call = m_call.group(1).strip().upper() if m_call else ""

            m_date = re.search(r"<QSO_DATE:\d+>([^<]+)", rec_clean, re.IGNORECASE)
            rec_date = re.sub(r"[^\d]", "", m_date.group(1).strip())[:8] if m_date else ""

            m_time = re.search(r"<TIME_ON:\d+>([^<]+)", rec_clean, re.IGNORECASE)
            rec_time = re.sub(r"[^\d]", "", m_time.group(1).strip())[:6] if m_time else ""

            matches = False
            if rec_call == target_call:
                if target_date and rec_date:
                    if target_date == rec_date:
                        matches = (target_time == rec_time) if (target_time and rec_time) else True
                else:
                    matches = True

            if matches and not deleted:
                deleted = True
                logger.info("[ADIF] Deleted QSO record: %s | Date: %s | Time: %s", rec_call, rec_date, rec_time)
                continue

            new_records.append(rec_clean + "<EOR>\n")

        if deleted:
            with open(ADIF_FILE, "w", encoding="ascii", errors="replace") as f:
                f.write(header)
                for nr in new_records:
                    f.write(nr)
            return True
        else:
            logger.warning("[ADIF] No matching QSO found to delete: %s (%s %s)", target_call, target_date, target_time)
            return False

    except Exception as e:
        logger.error("[ADIF] Error removing record from %s: %s", ADIF_FILE, e)
        return False


def load_qsos_from_adif(limit: int = 50) -> list:
    """Parses recent QSO records from shack_log.adi into JSON-serializable dicts."""
    if not os.path.exists(ADIF_FILE):
        return []

    try:
        with open(ADIF_FILE, "r", encoding="ascii", errors="replace") as f:
            content = f.read()

        header_match = re.search(r"(.*?)<EOH>\s*", content, re.IGNORECASE | re.DOTALL)
        records_body = content[len(header_match.group(0)):] if header_match else content

        raw_records = re.split(r"<EOR>\s*", records_body, flags=re.IGNORECASE)
        parsed = []

        for rec in raw_records:
            rec_clean = rec.strip()
            if not rec_clean:
                continue

            def get_tag(tag_name: str) -> str:
                m = re.search(rf"<{tag_name}:\d+>([^<]+)", rec_clean, re.IGNORECASE)
                return m.group(1).strip() if m else ""

            call = get_tag("CALL").upper()
            if not call:
                continue

            parsed.append({
                "call": call,
                "freq": get_tag("FREQ"),
                "mode": get_tag("MODE") or "USB",
                "band": get_tag("BAND"),
                "date": get_tag("QSO_DATE"),
                "time": get_tag("TIME_ON"),
                "time_on": get_tag("TIME_ON"),
                "rst_sent": get_tag("RST_SENT") or "599",
                "rst_rcvd": get_tag("RST_RCVD") or "599",
                "rstS": get_tag("RST_SENT") or "599",
                "rstR": get_tag("RST_RCVD") or "599",
                "notes": get_tag("COMMENT")
            })

        return list(reversed(parsed))[:limit]
    except Exception as e:
        logger.error("[ADIF] Error reading records: %s", e)
        return []


class BridgeCoordinator:
    """
    Central Station CAT & Telemetry Coordinator.
    Arbitrates transceiver CAT access between physical COM port, Hamlib rigctld,
    and dashboard WebSocket clients. Supports Dual-VFO and TS-2000 Sub-Receiver dual watch.
    """
    def __init__(self):
        self.serial = SerialEngine(settling_delay=0.03)

        forced_rig = os.environ.get("EZSHACK_RIG", "").strip().lower()
        self.rig: BaseRig = get_rig_profile(forced_rig) if forced_rig else get_rig_profile("ts2000")
        logger.info("Initial Transceiver Profile: %s (%s)", self.rig.name, getattr(self.rig, "rig_id", "custom"))

        self.rigctld = RigctldServer(self, host=RIGCTLD_HOST, port=RIGCTLD_PORT)
        self.connected_ws: Set[websockets.WebSocketServerProtocol] = set()
        self.watchdog_task: Optional[asyncio.Task] = None
        self.running = True
        self._initial_power_synced = False
        self._ptt_start_timestamp: Optional[float] = None
        self.active_vfo = "A"

        has_sub = getattr(self.rig, "supports_sub_rx", False)
        self.state: Dict[str, Any] = {
            "connected": False,
            "frequency": 14074000,
            "mode": "USB",
            "band": "20m",
            "vfo": "A",
            "ptt": False,
            "smeter_val": 0.0,
            "pwr_out": 0.0,
            "swr": 1.0,
            "power_target": 100,
            "volume_target": 50,
            "xcvr": self.rig.name,
            "capabilities": ["sub_rx"] if has_sub else [],
            "qsos": load_qsos_from_adif(),
            "sub_rx": {
                "enabled": False,
                "frequency": 146520000,
                "band": "2m",
                "mode": "FM",
                "smeter_val": 0.0,
                "volume": 50,
                "muted": False
            } if has_sub else None
        }

    async def initialize(self):
        loop = asyncio.get_running_loop()
        connected = await loop.run_in_executor(None, self.serial.connect)

        if connected:
            self.state["connected"] = True

            forced_rig = os.environ.get("EZSHACK_RIG", "").strip().lower()
            if not forced_rig and getattr(self.serial, "detected_rig_id", None):
                self.rig = get_rig_profile(self.serial.detected_rig_id)
                self.state["xcvr"] = self.rig.name

                has_sub = getattr(self.rig, "supports_sub_rx", False)
                self.state["capabilities"] = ["sub_rx"] if has_sub else []
                if has_sub and self.state.get("sub_rx") is None:
                    self.state["sub_rx"] = {
                        "enabled": False,
                        "frequency": 146520000,
                        "band": "2m",
                        "mode": "FM",
                        "smeter_val": 0.0,
                        "volume": 50,
                        "muted": False
                    }
                elif not has_sub:
                    self.state["sub_rx"] = None

            logger.info("Station Online: %s on %s @ %d baud", self.rig.name, self.serial.port, self.serial.baudrate)

            try:
                pwr_resp = await self.serial.execute_command(self.rig.cmd_get_rf_power(), expect_reply=True)
                pwr = self.rig.parse_rf_power(pwr_resp)
                if pwr is not None:
                    self.state["power_target"] = pwr
                    self._initial_power_synced = True
                    logger.info("Read initial RF power: %dW", pwr)
            except Exception as e:
                logger.debug("Startup power read error: %s", e)

            if getattr(self.rig, "supports_sub_rx", False) and self.state.get("sub_rx"):
                try:
                    sb_resp = await self.serial.execute_command(self.rig.cmd_get_sub_power(), expect_reply=True)
                    sub_on = self.rig.parse_sub_power(sb_resp)
                    if sub_on is not None:
                        self.state["sub_rx"]["enabled"] = sub_on
                        if sub_on:
                            fc_resp = await self.serial.execute_command(self.rig.cmd_get_sub_frequency(), expect_reply=True)
                            sub_freq = self.rig.parse_frequency(fc_resp)
                            if sub_freq:
                                self.state["sub_rx"]["frequency"] = sub_freq
                                self.state["sub_rx"]["band"] = freq_to_band(sub_freq)
                except Exception as e:
                    logger.debug("Sub-RX power sync error: %s", e)
        else:
            logger.warning("CAT connection failed. Retrying in background.")

        await self.rigctld.start()
        asyncio.create_task(self.telemetry_poller())

    async def broadcast_state(self):
        if not self.connected_ws:
            return
        payload = json.dumps(self.state)
        dead = set()
        for ws in self.connected_ws:
            try:
                await ws.send(payload)
            except websockets.exceptions.ConnectionClosed:
                dead.add(ws)
        self.connected_ws.difference_update(dead)

    async def set_frequency(self, freq_hz: int, vfo: Optional[str] = None):
        target_vfo = (vfo or self.active_vfo).upper()
        self.state["frequency"] = freq_hz
        self.state["band"] = freq_to_band(freq_hz)
        cmd = self.rig.cmd_set_frequency(freq_hz, vfo=target_vfo)
        await self.serial.execute_command(cmd, expect_reply=False)

    async def set_vfo(self, vfo: str):
        vfo_clean = vfo.upper().strip()
        if vfo_clean not in ("A", "B"):
            vfo_clean = "A"

        if vfo_clean == self.active_vfo:
            return

        self.active_vfo = vfo_clean
        self.state["vfo"] = vfo_clean

        if hasattr(self.rig, "cmd_set_vfo"):
            cmd = self.rig.cmd_set_vfo(vfo_clean)
            await self.serial.execute_command(cmd, expect_reply=False)
        elif getattr(self.rig, "rig_id", "") == "ts2000":
            cmd = b"FR0;FT0;" if vfo_clean == "A" else b"FR1;FT1;"
            await self.serial.execute_command(cmd, expect_reply=False)
        else:
            await self.serial.execute_command(b"SV;", expect_reply=False)

        await asyncio.sleep(0.08)

        freq_resp = await self.serial.execute_command(self.rig.cmd_get_frequency(self.active_vfo), expect_reply=True)
        freq = self.rig.parse_frequency(freq_resp)
        if freq:
            self.state["frequency"] = freq
            self.state["band"] = freq_to_band(freq)

        mode_resp = await self.serial.execute_command(self.rig.cmd_get_mode(), expect_reply=True)
        mode = self.rig.parse_mode(mode_resp)
        if mode:
            self.state["mode"] = mode

        logger.info("Switched to VFO %s: %d Hz (%s)", self.active_vfo, self.state["frequency"], self.state["mode"])

    async def set_mode(self, mode_str: str):
        self.state["mode"] = mode_str
        cmd = self.rig.cmd_set_mode(mode_str)
        await self.serial.execute_command(cmd, expect_reply=False)

    async def set_ptt(self, tx_on: bool):
        self.state["ptt"] = tx_on
        if tx_on:
            if self._ptt_start_timestamp is None:
                self._ptt_start_timestamp = time.time()
        else:
            self._ptt_start_timestamp = None

        cmd = self.rig.cmd_set_ptt(tx_on)
        await self.serial.execute_command(cmd, expect_reply=False)

    async def set_power(self, watts: int):
        w = max(5, min(100, int(watts)))
        self.state["power_target"] = w
        cmd = self.rig.cmd_set_rf_power(w)
        await self.serial.execute_command(cmd, expect_reply=False)

    async def set_volume(self, vol_percent: int):
        v = max(0, min(100, int(vol_percent)))
        self.state["volume_target"] = v
        cmd = self.rig.cmd_set_af_gain(v)
        await self.serial.execute_command(cmd, expect_reply=False)

    async def set_sub_frequency(self, freq_hz: int):
        if not self.state.get("sub_rx"):
            return
        self.state["sub_rx"]["frequency"] = freq_hz
        self.state["sub_rx"]["band"] = freq_to_band(freq_hz)
        if hasattr(self.rig, "cmd_set_sub_frequency"):
            cmd = self.rig.cmd_set_sub_frequency(freq_hz)
            await self.serial.execute_command(cmd, expect_reply=False)

    async def set_sub_power(self, enabled: bool):
        if not self.state.get("sub_rx"):
            return
        self.state["sub_rx"]["enabled"] = enabled
        if hasattr(self.rig, "cmd_set_sub_power"):
            cmd = self.rig.cmd_set_sub_power(enabled)
            await self.serial.execute_command(cmd, expect_reply=False)
            if enabled:
                await asyncio.sleep(0.08)
                fc_resp = await self.serial.execute_command(self.rig.cmd_get_sub_frequency(), expect_reply=True)
                freq = self.rig.parse_frequency(fc_resp)
                if freq:
                    self.state["sub_rx"]["frequency"] = freq
                    self.state["sub_rx"]["band"] = freq_to_band(freq)

    async def set_sub_volume(self, vol_percent: int):
        if not self.state.get("sub_rx"):
            return
        v = max(0, min(100, int(vol_percent)))
        self.state["sub_rx"]["volume"] = v
        if hasattr(self.rig, "cmd_set_sub_volume"):
            cmd = self.rig.cmd_set_sub_volume(v)
            await self.serial.execute_command(cmd, expect_reply=False)

    async def set_sub_mute(self, muted: bool):
        if not self.state.get("sub_rx"):
            return
        self.state["sub_rx"]["muted"] = muted
        if hasattr(self.rig, "cmd_set_sub_mute"):
            cmd = self.rig.cmd_set_sub_mute(muted)
            await self.serial.execute_command(cmd, expect_reply=False)

    async def configure_satellite(self, sat_data: dict):
        rx_freq = int(sat_data.get("rx_freq", 0))
        tx_freq = int(sat_data.get("tx_freq", 0))
        rx_mode = str(sat_data.get("rx_mode", "FM")).strip()
        tx_mode = str(sat_data.get("tx_mode", "FM")).strip()
        tone_hz = float(sat_data.get("tone_hz") or 0.0)

        logger.info("Configuring Satellite Split: RX=%d (%s) | TX=%d (%s) | Tone=%.1f Hz",
                    rx_freq, rx_mode, tx_freq, tx_mode, tone_hz)

        timed_ops = self.rig.cmd_configure_split(rx_freq, tx_freq, rx_mode, tx_mode, tone_hz)
        for cmd, settle in timed_ops:
            await self.serial.execute_command(cmd, expect_reply=False, custom_settle_sec=settle)

        self.active_vfo = "A"
        self.state["vfo"] = "A"
        self.state["frequency"] = rx_freq
        self.state["mode"] = rx_mode
        self.state["band"] = freq_to_band(rx_freq)

    async def disengage_satellite(self):
        logger.info("Disengaging Satellite Tracking and Split Mode.")
        timed_ops = self.rig.cmd_disengage_satellite()
        for cmd, settle in timed_ops:
            await self.serial.execute_command(cmd, expect_reply=False, custom_settle_sec=settle)

    async def telemetry_poller(self):
        tick = 0

        while self.running:
            if not self.serial.is_connected:
                self.state["connected"] = False
                await asyncio.sleep(2.0)
                loop = asyncio.get_running_loop()
                conn = await loop.run_in_executor(None, self.serial.connect)
                if not conn:
                    continue

                forced_rig = os.environ.get("EZSHACK_RIG", "").strip().lower()
                if not forced_rig and getattr(self.serial, "detected_rig_id", None):
                    self.rig = get_rig_profile(self.serial.detected_rig_id)
                    self.state["xcvr"] = self.rig.name
                    has_sub = getattr(self.rig, "supports_sub_rx", False)
                    self.state["capabilities"] = ["sub_rx"] if has_sub else []
                    if has_sub and self.state.get("sub_rx") is None:
                        self.state["sub_rx"] = {
                            "enabled": False,
                            "frequency": 146520000,
                            "band": "2m",
                            "mode": "FM",
                            "smeter_val": 0.0,
                            "volume": 50,
                            "muted": False
                        }
                    elif not has_sub:
                        self.state["sub_rx"] = None

                    logger.info("Station Reconnected: %s on %s @ %d baud", self.rig.name, self.serial.port, self.serial.baudrate)

            cmd_smtr, cmd_pwr, cmd_swr = self.rig.cmd_get_meters()

            try:
                active_cmd = self.rig.cmd_get_frequency(self.active_vfo)
                fa_resp = await self.serial.execute_command(active_cmd, expect_reply=True)
                freq = self.rig.parse_frequency(fa_resp)
                if freq:
                    self.state["frequency"] = freq
                    self.state["band"] = freq_to_band(freq)
                    self.state["connected"] = True

                if not self._initial_power_synced:
                    pwr_resp = await self.serial.execute_command(self.rig.cmd_get_rf_power(), expect_reply=True)
                    pwr = self.rig.parse_rf_power(pwr_resp)
                    if pwr is not None:
                        self.state["power_target"] = pwr
                        self._initial_power_synced = True
                        logger.info("Synchronized RF power setting from radio: %dW", pwr)

                tick += 1

                if self.state["ptt"] and self._ptt_start_timestamp:
                    duration = time.time() - self._ptt_start_timestamp
                    if duration > PTT_SAFETY_TIMEOUT_SECONDS:
                        logger.error("SAFETY: PTT duration exceeded %ds timeout! Forcing RX state.", PTT_SAFETY_TIMEOUT_SECONDS)
                        await self.set_ptt(False)

                has_sub = getattr(self.rig, "supports_sub_rx", False)
                sub_active = has_sub and self.state.get("sub_rx") and self.state["sub_rx"]["enabled"]

                if tick % 32 == 0 and not self.state["ptt"]:
                    pwr_resp = await self.serial.execute_command(self.rig.cmd_get_rf_power(), expect_reply=True)
                    pwr = self.rig.parse_rf_power(pwr_resp)
                    if pwr is not None:
                        self.state["power_target"] = pwr

                elif has_sub and tick % 32 == 16 and not self.state["ptt"]:
                    sb_resp = await self.serial.execute_command(self.rig.cmd_get_sub_power(), expect_reply=True)
                    sub_on = self.rig.parse_sub_power(sb_resp)
                    if sub_on is not None and self.state.get("sub_rx"):
                        self.state["sub_rx"]["enabled"] = sub_on

                elif sub_active and tick % 4 == 3 and not self.state["ptt"]:
                    fc_resp = await self.serial.execute_command(self.rig.cmd_get_sub_frequency(), expect_reply=True)
                    sub_f = self.rig.parse_frequency(fc_resp)
                    if sub_f:
                        self.state["sub_rx"]["frequency"] = sub_f
                        self.state["sub_rx"]["band"] = freq_to_band(sub_f)

                    sm1_resp = await self.serial.execute_command(self.rig.cmd_get_sub_smeter(), expect_reply=True)
                    self.state["sub_rx"]["smeter_val"] = self.rig.parse_sub_smeter(sm1_resp)

                elif tick % 2 == 0:
                    tx_resp = await self.serial.execute_command(self.rig.cmd_get_ptt(), expect_reply=True)
                    is_tx = self.rig.parse_ptt(tx_resp)
                    self.state["ptt"] = is_tx
                    if is_tx and self._ptt_start_timestamp is None:
                        self._ptt_start_timestamp = time.time()
                    elif not is_tx:
                        self._ptt_start_timestamp = None

                    if hasattr(self.rig, "parse_vfo"):
                        hw_vfo = self.rig.parse_vfo(tx_resp)
                        if hw_vfo and hw_vfo != self.active_vfo:
                            self.active_vfo = hw_vfo
                            self.state["vfo"] = hw_vfo

                elif tick % 4 == 1:
                    md_resp = await self.serial.execute_command(self.rig.cmd_get_mode(), expect_reply=True)
                    mode = self.rig.parse_mode(md_resp)
                    if mode:
                        self.state["mode"] = mode

                else:
                    if self.state["ptt"]:
                        pwr_resp = await self.serial.execute_command(cmd_pwr, expect_reply=True)
                        self.state["pwr_out"] = self.rig.parse_power(pwr_resp)
                        swr_resp = await self.serial.execute_command(cmd_swr, expect_reply=True)
                        self.state["swr"] = self.rig.parse_swr(swr_resp)
                    else:
                        smtr_resp = await self.serial.execute_command(cmd_smtr, expect_reply=True)
                        self.state["smeter_val"] = self.rig.parse_smeter(smtr_resp)
                        self.state["pwr_out"] = 0.0

                await self.broadcast_state()

            except Exception as e:
                logger.debug("CAT polling error: %s", e)

            await asyncio.sleep(0.18)

    async def handle_ws(self, websocket):
        origin = str(getattr(websocket, "origin", "") or "").rstrip("/")
        if origin and origin not in ALLOWED_WS_ORIGINS:
            logger.warning("Rejected unauthorized WebSocket origin: %s", origin)
            await websocket.close(1008, "Forbidden Origin")
            return

        self.connected_ws.add(websocket)
        logger.info("Dashboard connected from %s", websocket.remote_address)

        if self.watchdog_task and not self.watchdog_task.done():
            self.watchdog_task.cancel()

        try:
            await websocket.send(json.dumps(self.state))
        except Exception:
            pass

        try:
            async for raw in websocket:
                try:
                    data = json.loads(raw)
                    action = data.get("action")

                    if action == "set_freq":
                        vfo_target = data.get("vfo") or self.active_vfo
                        await self.set_frequency(int(data.get("freq", 0)), vfo=vfo_target)

                    elif action == "set_vfo":
                        await self.set_vfo(str(data.get("vfo", "A")))

                    elif action == "set_mode":
                        await self.set_mode(str(data.get("mode", "USB")))

                    elif action == "set_power":
                        await self.set_power(int(data.get("power", 100)))

                    elif action == "set_volume":
                        await self.set_volume(int(data.get("volume", 50)))

                    elif action == "set_sub_freq":
                        await self.set_sub_frequency(int(data.get("freq", 146520000)))

                    elif action == "set_sub_power":
                        await self.set_sub_power(bool(data.get("enabled", False)))

                    elif action == "set_sub_volume":
                        await self.set_sub_volume(int(data.get("volume", 50)))

                    elif action == "set_sub_mute":
                        await self.set_sub_mute(bool(data.get("muted", False)))

                    elif action == "setup_satellite":
                        await self.configure_satellite(data.get("satellite", {}))

                    elif action == "stop_satellite":
                        await self.disengage_satellite()

                    elif action == "delete_qso":
                        delete_qso_from_adif(data.get("qso", {}))
                        self.state["qsos"] = load_qsos_from_adif()
                        await self.broadcast_state()

                    elif action == "log_qso":
                        append_qso_to_adif(
                            qso_data=data.get("qso", {}),
                            current_freq_hz=self.state["frequency"],
                            current_mode=self.state["mode"],
                            station_profile=data.get("station")
                        )
                        self.state["qsos"] = load_qsos_from_adif()
                        await self.broadcast_state()

                    elif action == "clear_adif_log":
                        reset_adif_file()
                        self.state["qsos"] = []
                        await self.broadcast_state()

                    elif action == "shutdown":
                        logger.info("Operator triggered power-down from dashboard.")
                        await self.shutdown()

                except json.JSONDecodeError:
                    logger.error("Malformed JSON payload: %s", raw)
                except Exception as ex:
                    logger.error("Error processing WebSocket CAT command: %s", ex)

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.connected_ws.discard(websocket)
            logger.info("Dashboard client disconnected (%d remaining)", len(self.connected_ws))

            if not self.connected_ws and self.running:
                self.watchdog_task = asyncio.create_task(self.orphan_watchdog())

    async def orphan_watchdog(self):
        await asyncio.sleep(ORPHAN_WATCHDOG_SECONDS)
        if not self.connected_ws:
            logger.warning("No clients reconnected within %ds. Shutting down bridge.", ORPHAN_WATCHDOG_SECONDS)
            await self.shutdown()

    async def shutdown(self):
        self.running = False
        self.serial.close()
        await self.rigctld.stop()

        for ws in list(self.connected_ws):
            await ws.close()
        self.connected_ws.clear()

        logger.info("EZShack bridge daemon stopped cleanly.")
        os._exit(0)


async def main():
    coordinator = BridgeCoordinator()
    await coordinator.initialize()

    logger.info("EZShack Bridge WebSocket listening on ws://%s:%d", WS_HOST, WS_PORT)
    logger.info("Hamlib rigctld emulator listening on %s:%d", RIGCTLD_HOST, RIGCTLD_PORT)

    async with websockets.serve(coordinator.handle_ws, WS_HOST, WS_PORT):
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("KeyboardInterrupt received. Exiting.")
        sys.exit(0)