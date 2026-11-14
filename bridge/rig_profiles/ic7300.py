"""
Icom IC-7300 CI-V Transceiver Profile (bridge/rig_profiles/ic7300.py)
Default CI-V Address: 0x94 | Controller Address: 0xE0 | Baud: 19200 / 115200
"""

from typing import List, Optional, Tuple

try:
    from .base_rig import BaseRig
except ImportError:
    from bridge.rig_profiles.base_rig import BaseRig


class IC7300Rig(BaseRig):
    rig_id = "ic7300"
    name = "Icom IC-7300"
    default_baudrate = 19200
    supports_sub_rx = False
    civ_addr = 0x94
    ctrl_addr = 0xE0

    MODE_TO_CIV = {
        "LSB": b"\x00",
        "DATA-L": b"\x00",
        "PKTLSB": b"\x00",
        "USB": b"\x01",
        "DATA-U": b"\x01",
        "DATA": b"\x01",
        "PKTUSB": b"\x01",
        "AM": b"\x02",
        "CW": b"\x03",
        "RTTY": b"\x04",
        "FM": b"\x05",
        "CW-R": b"\x07",
        "RTTY-R": b"\x08",
    }

    CIV_TO_MODE = {
        0x00: "LSB",
        0x01: "USB",
        0x02: "AM",
        0x03: "CW",
        0x04: "RTTY",
        0x05: "FM",
        0x07: "CW-R",
        0x08: "RTTY-R",
    }

    def _frame(self, payload: bytes) -> bytes:
        return bytes([0xFE, 0xFE, self.civ_addr, self.ctrl_addr]) + payload + b"\xFD"

    def _extract_reply(self, raw: bytes) -> Optional[bytes]:
        """
        Extracts the payload from the most recent transceiver reply frame
        (FE FE E0 94 <payload> FD), ignoring echoed controller frames (FE FE 94 E0 ... FD).
        """
        if not raw:
            return None
        target_hdr = bytes([0xFE, 0xFE, self.ctrl_addr, self.civ_addr])
        idx = raw.rfind(target_hdr)
        while idx != -1:
            end = raw.find(b"\xFD", idx + 4)
            if end != -1:
                return raw[idx + 4 : end]
            idx = raw.rfind(target_hdr, 0, idx)
        return None

    @staticmethod
    def _encode_freq_bcd(freq_hz: int) -> bytes:
        """Encodes integer Hz into 5-byte little-endian BCD (1 Hz resolution)."""
        digits = f"{max(0, int(freq_hz)):010d}"
        out = bytearray(5)
        out[0] = (int(digits[8]) << 4) | int(digits[9])
        out[1] = (int(digits[6]) << 4) | int(digits[7])
        out[2] = (int(digits[4]) << 4) | int(digits[5])
        out[3] = (int(digits[2]) << 4) | int(digits[3])
        out[4] = (int(digits[0]) << 4) | int(digits[1])
        return bytes(out)

    @staticmethod
    def _decode_freq_bcd(bcd: bytes) -> Optional[int]:
        if len(bcd) < 5:
            return None
        freq = 0
        mult = 1
        for b in bcd[:5]:
            low = b & 0x0F
            high = (b >> 4) & 0x0F
            if low > 9 or high > 9:
                return None
            freq += low * mult
            mult *= 10
            freq += high * mult
            mult *= 10
        return freq

    @staticmethod
    def _encode_level_bcd(val_0_255: int) -> bytes:
        clamped = max(0, min(255, int(val_0_255)))
        s = f"{clamped:04d}"
        return bytes([
            (int(s[0]) << 4) | int(s[1]),
            (int(s[2]) << 4) | int(s[3]),
        ])

    @staticmethod
    def _decode_level_bcd(bcd: bytes) -> Optional[int]:
        if len(bcd) < 2:
            return None
        d3 = (bcd[0] >> 4) & 0x0F
        d2 = bcd[0] & 0x0F
        d1 = (bcd[1] >> 4) & 0x0F
        d0 = bcd[1] & 0x0F
        if max(d0, d1, d2, d3) > 9:
            return None
        return d3 * 1000 + d2 * 100 + d1 * 10 + d0

    # --- Frequency & VFO ---

    def cmd_get_frequency(self, vfo: str = "A") -> bytes:
        return self._frame(b"\x03")

    def parse_frequency(self, resp: bytes) -> Optional[int]:
        payload = self._extract_reply(resp)
        if payload and len(payload) >= 6 and payload[0] == 0x03:
            return self._decode_freq_bcd(payload[1:6])
        return None

    def cmd_set_frequency(self, freq_hz: int, vfo: str = "A") -> bytes:
        return self._frame(b"\x05" + self._encode_freq_bcd(freq_hz))

    def cmd_set_vfo(self, vfo: str) -> bytes:
        vfo_byte = b"\x00" if vfo.upper() == "A" else b"\x01"
        return self._frame(b"\x07" + vfo_byte)

    # --- Mode ---

    def cmd_get_mode(self) -> bytes:
        return self._frame(b"\x04")

    def parse_mode(self, resp: bytes) -> Optional[str]:
        payload = self._extract_reply(resp)
        if payload and len(payload) >= 2 and payload[0] == 0x04:
            return self.CIV_TO_MODE.get(payload[1], "USB")
        return None

    def cmd_set_mode(self, mode_str: str) -> bytes:
        m = mode_str.upper().strip()
        mode_byte = self.MODE_TO_CIV.get(m, b"\x01")
        # Filter 1 (0x01)
        if m in ("DATA-U", "DATA", "PKTUSB"):
            # Set USB + Data Mode ON (Filter 1)
            return self._frame(b"\x06\x01\x01") + self._frame(b"\x1A\x06\x01\x01")
        if m in ("DATA-L", "PKTLSB"):
            # Set LSB + Data Mode ON (Filter 1)
            return self._frame(b"\x06\x00\x01") + self._frame(b"\x1A\x06\x01\x01")
        if m in ("USB", "LSB"):
            # Set SSB + explicitly turn Data Mode OFF so rig doesn't stay stuck in USB-D/LSB-D
            return self._frame(b"\x06" + mode_byte + b"\x01") + self._frame(b"\x1A\x06\x00")
        return self._frame(b"\x06" + mode_byte + b"\x01")

    # --- PTT ---

    def cmd_get_ptt(self) -> bytes:
        return self._frame(b"\x1C\x00")

    def parse_ptt(self, resp: bytes) -> bool:
        payload = self._extract_reply(resp)
        if payload and len(payload) >= 3 and payload[0] == 0x1C and payload[1] == 0x00:
            return payload[2] == 0x01
        return False

    def cmd_set_ptt(self, tx_on: bool) -> bytes:
        return self._frame(b"\x1C\x00" + (b"\x01" if tx_on else b"\x00"))

    # --- Meters & Levels ---

    def cmd_get_meters(self) -> Tuple[bytes, bytes, bytes]:
        return (
            self._frame(b"\x15\x02"),  # S-meter (0000 - 0241)
            self._frame(b"\x15\x11"),  # RF Power meter (0000 - 0255)
            self._frame(b"\x15\x12"),  # SWR meter (0000 - 0255)
        )

    def parse_smeter(self, resp: bytes) -> float:
        payload = self._extract_reply(resp)
        if payload and len(payload) >= 4 and payload[0] == 0x15 and payload[1] == 0x02:
            raw = self._decode_level_bcd(payload[2:4])
            if raw is not None:
                return float(raw)
        return 0.0

    def parse_power(self, resp: bytes) -> float:
        payload = self._extract_reply(resp)
        if payload and len(payload) >= 4 and payload[0] == 0x15 and payload[1] == 0x11:
            raw = self._decode_level_bcd(payload[2:4])
            if raw is not None:
                # IC-7300: 0143 ~= 50W, 0212 ~= 100W
                return round(min(100.0, (raw / 212.0) * 100.0), 1)
        return 0.0

    def parse_swr(self, resp: bytes) -> float:
        payload = self._extract_reply(resp)
        if payload and len(payload) >= 4 and payload[0] == 0x15 and payload[1] == 0x12:
            raw = self._decode_level_bcd(payload[2:4])
            if raw is not None:
                # 0000=1.0, 0048=1.5, 0080=2.0, 0120=3.0
                if raw <= 48:
                    return round(1.0 + (raw / 48.0) * 0.5, 2)
                if raw <= 80:
                    return round(1.5 + ((raw - 48) / 32.0) * 0.5, 2)
                return round(2.0 + ((raw - 80) / 40.0) * 1.0, 2)
        return 1.0

    def cmd_get_rf_power(self) -> bytes:
        return self._frame(b"\x14\x0A")

    def parse_rf_power(self, resp: bytes) -> Optional[int]:
        payload = self._extract_reply(resp)
        if payload and len(payload) >= 4 and payload[0] == 0x14 and payload[1] == 0x0A:
            raw = self._decode_level_bcd(payload[2:4])
            if raw is not None:
                return max(5, min(100, round((raw / 255.0) * 100)))
        return None

    def cmd_set_rf_power(self, watts: int) -> bytes:
        raw_val = round((max(0, min(100, int(watts))) / 100.0) * 255)
        return self._frame(b"\x14\x0A" + self._encode_level_bcd(raw_val))

    def cmd_set_af_gain(self, vol_percent: int) -> bytes:
        raw_val = round((max(0, min(100, int(vol_percent))) / 100.0) * 255)
        return self._frame(b"\x14\x01" + self._encode_level_bcd(raw_val))

    # --- Split & Satellite / Repeater ---

    def cmd_configure_split(
        self, rx_freq: int, tx_freq: int, rx_mode: str, tx_mode: str, tone_hz: float = 0.0
    ) -> List[Tuple[bytes, float]]:
        ops: List[Tuple[bytes, float]] = [
            (self._frame(b"\x0F\x00"), 0.05),                               # Split OFF initially
            (self._frame(b"\x07\x01"), 0.05),                               # Select VFO B (TX)
            (self.cmd_set_frequency(tx_freq, "B"), 0.05),
            (self.cmd_set_mode(tx_mode), 0.05),
            (self._frame(b"\x07\x00"), 0.05),                               # Select VFO A (RX)
            (self.cmd_set_frequency(rx_freq, "A"), 0.05),
            (self.cmd_set_mode(rx_mode), 0.05),
            (self._frame(b"\x0F\x01"), 0.05),                               # Split ON
        ]
        if tone_hz and tone_hz > 0:
            # Encode tone in 0.1 Hz units into 3-byte BCD (e.g. 88.5 -> 000885 -> 00 08 85)
            tenths = f"{int(round(tone_hz * 10)):06d}"
            tone_bcd = bytes([
                (int(tenths[0]) << 4) | int(tenths[1]),
                (int(tenths[2]) << 4) | int(tenths[3]),
                (int(tenths[4]) << 4) | int(tenths[5]),
            ])
            ops.append((self._frame(b"\x1B\x00" + tone_bcd), 0.05))
            ops.append((self._frame(b"\x16\x42\x01"), 0.05))                # Repeater Tone ON
        else:
            ops.append((self._frame(b"\x16\x42\x00"), 0.05))                # Tone OFF
        return ops

    def cmd_disengage_satellite(self) -> List[Tuple[bytes, float]]:
        return [
            (self._frame(b"\x0F\x00"), 0.05),
            (self._frame(b"\x16\x42\x00"), 0.05),
        ]