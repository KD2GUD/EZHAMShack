"""
bridge/rig_profiles/ft991a.py
Yaesu FT-991A CAT Driver Profile.
Hardware CAT Architecture:
- Single active receiver path: FA; and MD0; always address the active displayed VFO.
- VFO selection: SV; swaps VFO-A and VFO-B into FA.
- PTT status: TX; query returns TX0 (RX), TX1/TX2 (TX).
- Metering: RM1 (S-Meter), RM4 (Forward Power), RM5 (SWR).
"""
from typing import Optional, Tuple, List
from .base_rig import BaseRig

YAESU_MODE_TO_STR = {
    "1": "LSB", "2": "USB", "3": "CW-U", "4": "FM",
    "5": "AM", "6": "RTTY-LSB", "7": "CW-L", "8": "DATA-LSB",
    "9": "RTTY-USB", "A": "DATA-FM", "B": "FM-N", "C": "DATA-U",
    "D": "AM-N", "E": "C4FM"
}

STR_TO_YAESU_MODE = {
    "LSB": "1", "USB": "2", "CW": "3", "CW-U": "3", "FM": "4",
    "AM": "5", "RTTY": "9", "RTTY-LSB": "6", "CW-L": "7",
    "DATA-L": "8", "DATA-LSB": "8", "RTTY-USB": "9", "DATA-FM": "A",
    "FM-N": "B", "DATA-U": "C", "DATA": "C", "AM-N": "D", "C4FM": "E"
}

YAESU_CTCSS_TABLE = [
    67.0, 69.3, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5,
    94.8, 97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3,
    131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 159.8, 162.2, 165.5, 167.9,
    171.3, 173.8, 177.3, 179.9, 183.5, 186.2, 189.9, 192.8, 196.6, 199.5,
    203.5, 206.5, 210.7, 218.1, 225.7, 229.1, 233.6, 241.8, 250.3, 254.1
]


def get_yaesu_tone_idx(hz: float) -> str:
    closest_idx = 0
    min_diff = 999.0
    for i, t in enumerate(YAESU_CTCSS_TABLE):
        diff = abs(t - hz)
        if diff < min_diff:
            min_diff = diff
            closest_idx = i
    return f"{closest_idx:03d}"


class FT991A(BaseRig):
    rig_id = "ft991a"
    supports_sub_rx: bool = False

    @property
    def name(self) -> str:
        return "Yaesu FT-991A"

    @property
    def default_baudrate(self) -> int:
        return 38400

    # --- Receiver / Frequency ---

    def cmd_get_frequency(self, vfo: str = "A") -> bytes:
        return b"FA;"

    def parse_frequency(self, response: bytes) -> Optional[int]:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            if (raw.startswith("FA") or raw.startswith("FB")) and raw.endswith(";"):
                digits = raw[2:-1]
                if digits.isdigit():
                    return int(digits)
            if raw.startswith("IF") and len(raw) >= 14:
                digits = raw[5:14]
                if digits.isdigit():
                    return int(digits)
        except Exception:
            pass
        return None

    def cmd_set_frequency(self, freq_hz: int, vfo: str = "A") -> bytes:
        return f"FA{int(freq_hz):09d};".encode("ascii")

    # --- VFO Routing ---

    def cmd_set_vfo(self, vfo: str) -> bytes:
        return b"SV;"

    def cmd_get_vfo(self) -> bytes:
        return b"IF;"

    def parse_vfo(self, response: bytes) -> Optional[str]:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            if raw.startswith("IF") and len(raw) >= 23:
                return "B" if raw[22] == "2" else "A"
        except Exception:
            pass
        return None

    # --- PTT Line Interrogation ---

    def cmd_get_ptt(self) -> bytes:
        # Native Yaesu CAT command for transmitter state
        return b"TX;"

    def parse_ptt(self, response: bytes) -> bool:
        # TX0 = RX; TX1, TX2 = TX
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            if raw.startswith("TX") and len(raw) >= 3:
                return raw[2] in ("1", "2")
        except Exception:
            pass
        return False

    def cmd_set_ptt(self, tx: bool) -> bytes:
        return b"TX1;" if tx else b"TX0;"

    # --- Operating Mode ---

    def cmd_get_mode(self) -> bytes:
        return b"MD0;"

    def parse_mode(self, response: bytes) -> Optional[str]:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            if raw.startswith("MD0") and raw.endswith(";"):
                return YAESU_MODE_TO_STR.get(raw[3], "USB")
            if raw.startswith("IF") and len(raw) >= 22:
                return YAESU_MODE_TO_STR.get(raw[21], "USB")
        except Exception:
            pass
        return None

    def cmd_set_mode(self, mode: str) -> bytes:
        code = STR_TO_YAESU_MODE.get(mode.upper().strip(), "2")
        return f"MD0{code};".encode("ascii")

    # --- RF Power & AF Gain ---

    def cmd_get_rf_power(self) -> bytes:
        return b"PC;"

    def parse_rf_power(self, response: bytes) -> Optional[int]:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            if raw.startswith("PC") and raw.endswith(";"):
                digits = raw[2:-1]
                if digits.isdigit():
                    return int(digits)
        except Exception:
            pass
        return None

    def cmd_set_rf_power(self, watts: int) -> bytes:
        w = max(5, min(100, int(watts)))
        return f"PC{w:03d};".encode("ascii")

    def cmd_set_af_gain(self, level_0_100: int) -> bytes:
        scaled = max(0, min(255, int((level_0_100 / 100.0) * 255)))
        return f"AG0{scaled:03d};".encode("ascii")

    # --- Metering Telemetry ---

    def cmd_get_meters(self) -> Tuple[bytes, bytes, bytes]:
        return (b"RM1;", b"RM4;", b"RM5;")

    def parse_smeter(self, response: bytes) -> float:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            if raw.startswith("RM1") and raw.endswith(";"):
                val = int(raw[3:-1])
                return round((val / 255.0) * 100.0, 1)
        except Exception:
            pass
        return 0.0

    def parse_power(self, response: bytes) -> float:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            if raw.startswith("RM4") and raw.endswith(";"):
                val = int(raw[3:-1])
                return round((val / 255.0) * 100.0, 1)
        except Exception:
            pass
        return 0.0

    def parse_swr(self, response: bytes) -> float:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            if raw.startswith("RM5") and raw.endswith(";"):
                val = int(raw[3:-1])
                if val <= 5: return 1.0
                return round(1.0 + (val / 50.0), 2)
        except Exception:
            pass
        return 1.0

    # --- Satellite Splits ---

    def cmd_configure_split(
        self,
        rx_freq_hz: int,
        tx_freq_hz: int,
        rx_mode: str,
        tx_mode: str,
        tone_hz: Optional[float] = None
    ) -> List[Tuple[bytes, float]]:
        has_uplink = bool(tx_freq_hz and tx_freq_hz > 0)
        ops: List[Tuple[bytes, float]] = []

        ops.append((b"FT2;", 0.400))

        if has_uplink:
            ops.append((b"SV;", 0.300))
            ops.append((self.cmd_set_frequency(tx_freq_hz, vfo="A"), 0.350))
            ops.append((self.cmd_set_mode(tx_mode), 0.300))
            if tx_mode.upper() == "FM":
                ops.append((b"OS00;", 0.200))

            if tone_hz and tone_hz > 0:
                tone_code = get_yaesu_tone_idx(tone_hz)
                ops.append((b"CT02;", 0.250))
                ops.append((f"CN00{tone_code};".encode("ascii"), 0.350))
            else:
                ops.append((b"CT00;", 0.250))

            ops.append((b"SV;", 0.300))

        ops.append((self.cmd_set_frequency(rx_freq_hz, vfo="A"), 0.350))
        ops.append((self.cmd_set_mode(rx_mode), 0.300))
        ops.append((b"CT00;", 0.200))

        if rx_mode.upper() == "FM":
            ops.append((b"OS00;", 0.200))

        if has_uplink:
            ops.append((b"FT3;", 0.300))
        else:
            ops.append((b"FT2;", 0.300))

        return ops

    def cmd_disengage_satellite(self) -> List[Tuple[bytes, float]]:
        return [
            (b"FT2;", 0.250),
            (b"CT00;", 0.250),
            (b"OS00;", 0.150)
        ]