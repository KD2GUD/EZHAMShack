"""
Yaesu FT-857D / FT-817ND / FT-897D Binary CAT Profile (bridge/rig_profiles/ft857d.py)
Protocol: Fixed 5-byte binary frames [P1, P2, P3, P4, OPCODE]
Serial Framing: 8N2 (2 stop bits) @ 38400 / 9600 / 4800 baud
"""

from typing import List, Optional, Tuple

try:
    from .base_rig import BaseRig
except ImportError:
    from bridge.rig_profiles.base_rig import BaseRig


class FT857DRig(BaseRig):
    rig_id = "ft857d"
    name = "Yaesu FT-857D"
    default_baudrate = 38400
    stopbits = 2
    supports_sub_rx = False
    supports_af_gain = False
    supports_rf_power = False

    MODE_TO_BYTE = {
        "LSB": 0x00,
        "USB": 0x01,
        "CW": 0x02,
        "CW-R": 0x03,
        "CWR": 0x03,
        "AM": 0x04,
        "WFM": 0x06,
        "FM": 0x08,
        "DIG": 0x0A,
        "DATA": 0x0A,
        "DATA-U": 0x0A,
        "DATA-L": 0x0A,
        "RTTY": 0x0A,
        "PKT": 0x0C,
        "PKTUSB": 0x0C,
        "PKTLSB": 0x0C,
    }

    BYTE_TO_MODE = {
        0x00: "LSB",
        0x01: "USB",
        0x02: "CW",
        0x03: "CW-R",
        0x04: "AM",
        0x06: "FM",
        0x08: "FM",
        0x0A: "DATA-U",
        0x0C: "FM",
    }

    @staticmethod
    def _encode_freq_bcd(freq_hz: int) -> bytes:
        """Encodes integer Hz into 4-byte big-endian BCD (10 Hz resolution)."""
        tens_hz = max(0, int(round(freq_hz / 10.0)))
        digits = f"{tens_hz:08d}"
        return bytes([
            (int(digits[0]) << 4) | int(digits[1]),
            (int(digits[2]) << 4) | int(digits[3]),
            (int(digits[4]) << 4) | int(digits[5]),
            (int(digits[6]) << 4) | int(digits[7]),
        ])

    @staticmethod
    def _decode_freq_bcd(bcd: bytes) -> Optional[int]:
        """Decodes 4-byte big-endian BCD (10 Hz resolution) into integer Hz."""
        if len(bcd) < 4:
            return None
        val_10hz = 0
        for b in bcd[:4]:
            hi = (b >> 4) & 0x0F
            lo = b & 0x0F
            if hi > 9 or lo > 9:
                return None
            val_10hz = val_10hz * 100 + (hi * 10 + lo)
        return val_10hz * 10

    # --- Frequency & VFO ---

    def cmd_get_frequency(self, vfo: str = "A") -> bytes:
        return b"\x00\x00\x00\x00\x03"

    def parse_frequency(self, resp: bytes) -> Optional[int]:
        if not resp or len(resp) < 5:
            return None
        frame = resp[-5:]
        return self._decode_freq_bcd(frame[:4])

    def cmd_set_frequency(self, freq_hz: int, vfo: str = "A") -> bytes:
        return self._encode_freq_bcd(freq_hz) + b"\x01"

    def cmd_set_vfo(self, vfo: str) -> bytes:
        # FT-857D uses opcode 0x81 to toggle between VFO A and VFO B
        return b"\x00\x00\x00\x00\x81"

    # --- Mode ---

    def cmd_get_mode(self) -> bytes:
        return b"\x00\x00\x00\x00\x03"

    def parse_mode(self, resp: bytes) -> Optional[str]:
        if not resp or len(resp) < 5:
            return None
        frame = resp[-5:]
        return self.BYTE_TO_MODE.get(frame[4], "USB")

    def cmd_set_mode(self, mode_str: str) -> bytes:
        m = (mode_str or "USB").upper().strip()
        mode_byte = self.MODE_TO_BYTE.get(m, 0x01)
        return bytes([mode_byte, 0x00, 0x00, 0x00, 0x07])

    # --- PTT ---

    def cmd_get_ptt(self) -> bytes:
        # Read TX Status (0xF7): bit 7 == 0 indicates TX active (PTT ON)
        return b"\x00\x00\x00\x00\xF7"

    def parse_ptt(self, resp: bytes) -> bool:
        if not resp:
            return False
        status = resp[-1]
        return (status & 0x80) == 0

    def cmd_set_ptt(self, tx_on: bool) -> bytes:
        return b"\x00\x00\x00\x00\x08" if tx_on else b"\x00\x00\x00\x00\x88"

    # --- Meters & Levels ---

    def cmd_get_meters(self) -> Tuple[bytes, bytes, bytes]:
        return (
            b"\x00\x00\x00\x00\xE7",  # RX Status (low nibble 0..15 = S-meter)
            b"\x00\x00\x00\x00\xF7",  # TX Status (low nibble 0..15 = PO meter)
            b"\x00\x00\x00\x00\xF7",  # TX Status (bit 6 = High SWR flag)
        )

    def parse_smeter(self, resp: bytes) -> float:
        if not resp:
            return 0.0
        raw_s = resp[-1] & 0x0F
        return round(raw_s * 17.0, 1)

    def parse_power(self, resp: bytes) -> float:
        if not resp:
            return 0.0
        status = resp[-1]
        if (status & 0x80) != 0:
            return 0.0
        raw_po = status & 0x0F
        return round((raw_po / 15.0) * 100.0, 1)

    def parse_swr(self, resp: bytes) -> float:
        if not resp:
            return 1.0
        status = resp[-1]
        if (status & 0x80) == 0 and (status & 0x40) != 0:
            return 3.0
        return 1.2

    def cmd_get_rf_power(self) -> bytes:
        return b"\x00\x00\x00\x00\xE7"

    def parse_rf_power(self, resp: bytes) -> Optional[int]:
        return None

    def cmd_set_rf_power(self, watts: int) -> bytes:
        return b"\x00\x00\x00\x00\xE7"

    def cmd_set_af_gain(self, vol_percent: int) -> bytes:
        return b"\x00\x00\x00\x00\xE7"

    # --- Split & Satellite / Repeater ---

    def cmd_configure_split(
        self, rx_freq: int, tx_freq: int, rx_mode: str, tx_mode: str, tone_hz: float = 0.0
    ) -> List[Tuple[bytes, float]]:
        ops: List[Tuple[bytes, float]] = [
            (b"\x00\x00\x00\x00\x82", 0.06),               # 1. Split OFF initially
            (self.cmd_set_frequency(rx_freq, "A"), 0.06),     # 2. Program RX freq on VFO A
            (self.cmd_set_mode(rx_mode), 0.06),               # 3. Program RX mode on VFO A
            (b"\x8A\x00\x00\x00\x0A", 0.06),               # 4. Keep CTCSS/TSQ OFF on RX VFO A
            (b"\x00\x00\x00\x00\x81", 0.08),               # 5. Toggle to VFO B (TX VFO)
            (self.cmd_set_frequency(tx_freq, "B"), 0.06),     # 6. Program TX freq on VFO B
            (self.cmd_set_mode(tx_mode), 0.06),               # 7. Program TX mode on VFO B
        ]

        # 8. Configure CTCSS tone & encoder on VFO B while VFO B is active
        if tone_hz and tone_hz > 0:
            tenths = f"{int(round(tone_hz * 10)):04d}"
            t_hi = (int(tenths[0]) << 4) | int(tenths[1])
            t_lo = (int(tenths[2]) << 4) | int(tenths[3])
            # FT-857D 0x0B expects [TX_HI, TX_LO, RX_HI, RX_LO, 0x0B]
            ops.append((bytes([t_hi, t_lo, t_hi, t_lo, 0x0B]), 0.08))
            # 0x4A = CTCSS Encoder ON ('TON'), avoiding 0x2A Tone Squelch ('TSQ')
            ops.append((b"\x4A\x00\x00\x00\x0A", 0.08))
        else:
            ops.append((b"\x8A\x00\x00\x00\x0A", 0.06))

        ops.extend([
            (b"\x00\x00\x00\x00\x81", 0.08),               # 9. Toggle back to VFO A (RX)
            (b"\x00\x00\x00\x00\x02", 0.06),               # 10. Split ON (RX=VFO A, TX=VFO B)
        ])
        return ops

    def cmd_disengage_satellite(self) -> List[Tuple[bytes, float]]:
        return [
            (b"\x00\x00\x00\x00\x82", 0.06),  # Split OFF
            (b"\x00\x00\x00\x00\x81", 0.08),  # Toggle to VFO B
            (b"\x8A\x00\x00\x00\x0A", 0.06),  # CTCSS OFF on VFO B
            (b"\x00\x00\x00\x00\x81", 0.08),  # Toggle back to VFO A
            (b"\x8A\x00\x00\x00\x0A", 0.06),  # CTCSS OFF on VFO A
        ]
