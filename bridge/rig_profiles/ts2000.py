"""
bridge/rig_profiles/ts2000.py
Kenwood TS-2000 CAT Driver Profile.
Standard Kenwood CAT with Sub-Receiver (VHF/UHF Dual Watch) & Optional UT-20 23cm Support.
Main: FA/FB, MD, IF, SM0, PC, AG0, FR/FT, TO/TN (30 kHz - 450 MHz; 1300 MHz w/ UT-20).
Sub : FC (Freq), SB (Power), MU (Mute), SM1 (S-Meter), AG1 (AF Gain) (2m / 70cm FM & AM).
"""

from typing import Optional, Tuple, List
from .base_rig import BaseRig

KENWOOD_MODE_TO_STR = {
    "1": "LSB",
    "2": "USB",
    "3": "CW",
    "4": "FM",
    "5": "AM",
    "6": "RTTY-LSB",
    "7": "CW-R",
    "9": "RTTY-USB"
}

STR_TO_KENWOOD_MODE = {
    "LSB": "1",
    "USB": "2",
    "CW": "3",
    "CW-U": "3",
    "CW-L": "7",
    "FM": "4",
    "AM": "5",
    "RTTY": "6",
    "RTTY-LSB": "6",
    "RTTY-USB": "9",
    "DATA-U": "2",
    "DATA": "2",
    "C4FM": "4"
}

# Exact Kenwood TS-2000 42-entry CTCSS / Tone table (indices 01..42)
KENWOOD_TS2000_TONE_TABLE = [
    67.0, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8,
    97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3, 131.8,
    136.5, 141.3, 146.2, 151.4, 156.7, 162.2, 167.9, 173.8, 179.9, 186.2,
    192.8, 203.5, 210.7, 218.1, 225.7, 233.6, 241.8, 250.3, 1750.0, 69.3,
    159.8, 165.5
]

BASE_SUPPORTED_BANDS: List[str] = [
    "160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "2m", "70cm"
]
UT20_SUPPORTED_BANDS: List[str] = BASE_SUPPORTED_BANDS + ["23cm"]


def get_kenwood_tone_idx(hz: float) -> str:
    closest_idx = 0
    min_diff = 999.0
    for i, t in enumerate(KENWOOD_TS2000_TONE_TABLE):
        diff = abs(t - hz)
        if diff < min_diff:
            min_diff = diff
            closest_idx = i
    return f"{closest_idx + 1:02d}"


class TS2000(BaseRig):
    rig_id = "ts2000"
    supports_sub_rx: bool = True
    min_freq_hz: int = 30_000
    max_freq_hz: int = 450_000_000
    ut20_installed: bool = False
    supported_bands: List[str] = list(BASE_SUPPORTED_BANDS)

    def set_ut20_installed(self, installed: bool) -> None:
        self.ut20_installed = bool(installed)
        self.max_freq_hz = 1_300_000_000 if self.ut20_installed else 450_000_000
        self.supported_bands = list(UT20_SUPPORTED_BANDS if self.ut20_installed else BASE_SUPPORTED_BANDS)

    @property
    def name(self) -> str:
        return "Kenwood TS-2000"

    @property
    def default_baudrate(self) -> int:
        return 9600

    # --- Main Receiver (VFO A / VFO B) ---

    def cmd_get_frequency(self, vfo: str = "A") -> bytes:
        return b"FA;" if vfo.upper() == "A" else b"FB;"

    def parse_frequency(self, response: bytes) -> Optional[int]:
        """Parses Main VFO A/B replies (FA/FB only) so Sub-RX FC frames never cross-talk."""
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            for part in raw.split(";"):
                p = part.strip()
                if (p.startswith("FA") or p.startswith("FB")) and len(p) >= 11:
                    digits = p[2:]
                    if digits.isdigit():
                        return int(digits)
        except Exception:
            pass
        return None

    def cmd_set_frequency(self, freq_hz: int, vfo: str = "A") -> bytes:
        prefix = "FA" if vfo.upper() == "A" else "FB"
        clamped = max(self.min_freq_hz, min(self.max_freq_hz, int(freq_hz)))
        return f"{prefix}{clamped:011d};".encode("ascii")

    def cmd_set_vfo(self, vfo: str) -> bytes:
        return b"FR0;FT0;" if vfo.upper().strip() == "A" else b"FR1;FT1;"

    def cmd_get_vfo(self) -> bytes:
        return b"FR;"

    def parse_vfo(self, response: bytes) -> Optional[str]:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            for part in raw.split(";"):
                p = part.strip()
                if p.startswith("FR") and len(p) >= 3:
                    return "B" if p[2] == "1" else "A"
                if p.startswith("IF") and len(p) >= 31:
                    return "B" if p[30] == "1" else "A"
        except Exception:
            pass
        return None

    def cmd_get_mode(self) -> bytes:
        return b"MD;"

    def parse_mode(self, response: bytes) -> Optional[str]:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            for part in raw.split(";"):
                p = part.strip()
                if p.startswith("MD") and len(p) >= 3:
                    return KENWOOD_MODE_TO_STR.get(p[2], "USB")
        except Exception:
            pass
        return None

    def cmd_set_mode(self, mode: str) -> bytes:
        code = STR_TO_KENWOOD_MODE.get(mode.upper().strip(), "2")
        return f"MD{code};".encode("ascii")

    def cmd_get_ptt(self) -> bytes:
        return b"IF;"

    def parse_ptt(self, response: bytes) -> bool:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            for part in raw.split(";"):
                p = part.strip()
                if p.startswith("IF") and len(p) >= 29:
                    return p[28] == "1"
        except Exception:
            pass
        return False

    def cmd_set_ptt(self, tx: bool) -> bytes:
        return b"TX;" if tx else b"RX;"

    def cmd_get_meters(self) -> Tuple[bytes, bytes, bytes]:
        return (b"SM0;", b"SM0;", b"RM;")

    def parse_smeter(self, response: bytes) -> float:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            for part in reversed(raw.split(";")):
                p = part.strip()
                if p.startswith("SM0") and len(p) > 3 and p[3:].isdigit():
                    return float(int(p[3:]))
        except Exception:
            pass
        return 0.0

    def parse_power(self, response: bytes) -> float:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            for part in reversed(raw.split(";")):
                p = part.strip()
                if p.startswith("SM0") and len(p) > 3 and p[3:].isdigit():
                    val = int(p[3:])
                    return round((val / 15.0) * 100.0, 1)
        except Exception:
            pass
        return 0.0

    def parse_swr(self, response: bytes) -> float:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            for part in reversed(raw.split(";")):
                p = part.strip()
                if p.startswith("RM") and len(p) > 3 and p[3:].isdigit():
                    val = int(p[3:])
                    return 1.0 if val <= 2 else round(1.0 + (val / 10.0), 2)
        except Exception:
            pass
        return 1.0

    def cmd_get_rf_power(self) -> bytes:
        return b"PC;"

    def parse_rf_power(self, response: bytes) -> Optional[int]:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            for part in reversed(raw.split(";")):
                p = part.strip()
                if p.startswith("PC") and p[2:].isdigit():
                    return int(p[2:])
        except Exception:
            pass
        return None

    def cmd_set_rf_power(self, watts: int) -> bytes:
        w = max(5, min(100, int(watts)))
        return f"PC{w:03d};".encode("ascii")

    def cmd_set_af_gain(self, level_0_100: int) -> bytes:
        scaled = max(0, min(255, int((level_0_100 / 100.0) * 255)))
        return f"AG0{scaled:03d};".encode("ascii")

    # --- Sub-Receiver (2m / 70cm FM & AM Dual Watch) ---

    def cmd_get_sub_frequency(self) -> bytes:
        return b"FC;"

    def parse_sub_frequency(self, response: bytes) -> Optional[int]:
        """Parses Sub-Receiver frequency replies (FC only)."""
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            for part in raw.split(";"):
                p = part.strip()
                if p.startswith("FC") and len(p) >= 11:
                    digits = p[2:]
                    if digits.isdigit():
                        return int(digits)
        except Exception:
            pass
        return None

    def cmd_set_sub_frequency(self, freq_hz: int) -> bytes:
        clamped = max(144_000_000, min(450_000_000, int(freq_hz)))
        return f"FC{clamped:011d};".encode("ascii")

    def cmd_get_sub_power(self) -> bytes:
        return b"SB;"

    def parse_sub_power(self, response: bytes) -> Optional[bool]:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            for part in reversed(raw.split(";")):
                p = part.strip()
                if p.startswith("SB") and len(p) >= 3:
                    return p[2] == "1"
        except Exception:
            pass
        return None

    def cmd_set_sub_power(self, on: bool) -> bytes:
        return b"SB1;" if on else b"SB0;"

    def cmd_get_sub_smeter(self) -> bytes:
        return b"SM1;"

    def parse_sub_smeter(self, response: bytes) -> float:
        try:
            raw = response.decode("ascii", errors="ignore").strip()
            for part in reversed(raw.split(";")):
                p = part.strip()
                if p.startswith("SM1") and len(p) > 3 and p[3:].isdigit():
                    return float(int(p[3:]))
        except Exception:
            pass
        return 0.0

    def cmd_set_sub_volume(self, level_0_100: int) -> bytes:
        scaled = max(0, min(255, int((level_0_100 / 100.0) * 255)))
        return f"AG1{scaled:03d};".encode("ascii")

    def cmd_set_sub_mute(self, muted: bool) -> bytes:
        return b"MU1;" if muted else b"MU0;"

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

        # Start in clean simplex on VFO A (TS-2000 uses FR/FT for split, not SP)
        ops.append((b"FR0;FT0;", 0.150))

        if has_uplink:
            # Switch active VFO to VFO B to program TX frequency, mode, and CTCSS tone
            ops.append((b"FR1;FT1;", 0.200))
            ops.append((self.cmd_set_frequency(tx_freq_hz, vfo="B"), 0.250))
            ops.append((self.cmd_set_mode(tx_mode), 0.250))

            if tone_hz and tone_hz > 0:
                tone_code = get_kenwood_tone_idx(tone_hz)
                ops.append((f"TN{tone_code};".encode("ascii"), 0.200))
                ops.append((b"TO1;", 0.200))
            else:
                ops.append((b"TO0;", 0.150))

        # Switch RX focus back to VFO A and configure downlink frequency & mode
        ops.append((b"FR0;", 0.200))
        ops.append((self.cmd_set_frequency(rx_freq_hz, vfo="A"), 0.250))
        ops.append((self.cmd_set_mode(rx_mode), 0.250))

        if has_uplink:
            # Engage Split (RX = VFO A, TX = VFO B) and assert TX Tone Encode if required
            ops.append((b"FT1;", 0.200))
            if tone_hz and tone_hz > 0:
                tone_code = get_kenwood_tone_idx(tone_hz)
                ops.append((f"TN{tone_code};".encode("ascii"), 0.200))
                ops.append((b"TO1;", 0.200))
        else:
            ops.append((b"FT0;", 0.150))
            ops.append((b"TO0;", 0.150))

        return ops

    def cmd_disengage_satellite(self) -> List[Tuple[bytes, float]]:
        return [
            (b"FR1;FT1;", 0.150),
            (b"TO0;", 0.150),
            (b"FR0;FT0;", 0.150),
            (b"TO0;", 0.150),
        ]
