"""
Abstract Base Rig Interface for EZShack Hardware Drivers.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple

class BaseRig(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Transceiver model name."""
        pass

    @property
    @abstractmethod
    def default_baudrate(self) -> int:
        """Default serial CAT baudrate."""
        pass

    @abstractmethod
    def cmd_get_frequency(self, vfo: str = "A") -> bytes:
        """Command to read current frequency."""
        pass

    @abstractmethod
    def parse_frequency(self, response: bytes) -> Optional[int]:
        """Parse raw CAT response into frequency in Hz."""
        pass

    @abstractmethod
    def cmd_set_frequency(self, freq_hz: int, vfo: str = "A") -> bytes:
        """Command to set frequency."""
        pass

    @abstractmethod
    def cmd_get_mode(self) -> bytes:
        """Command to get current operational mode."""
        pass

    @abstractmethod
    def parse_mode(self, response: bytes) -> Optional[str]:
        """Parse raw CAT response into generic mode string (USB, LSB, FM, CW, C4FM, etc.)."""
        pass

    @abstractmethod
    def cmd_set_mode(self, mode: str) -> bytes:
        """Command to set mode."""
        pass

    @abstractmethod
    def cmd_get_ptt(self) -> bytes:
        """Command to read PTT state."""
        pass

    @abstractmethod
    def parse_ptt(self, response: bytes) -> bool:
        """Parse PTT state (True=TX, False=RX)."""
        pass

    @abstractmethod
    def cmd_set_ptt(self, tx: bool) -> bytes:
        """Command to set PTT state."""
        pass

    @abstractmethod
    def cmd_get_meters(self) -> Tuple[bytes, bytes, bytes]:
        """Returns tuple of commands to poll: (S-meter, Forward Power, SWR)."""
        pass

    @abstractmethod
    def parse_smeter(self, response: bytes) -> float:
        """Parse raw S-meter response into calibrated raw value."""
        pass

    @abstractmethod
    def parse_power(self, response: bytes) -> float:
        """Parse RF forward power reading in Watts."""
        pass

    @abstractmethod
    def parse_swr(self, response: bytes) -> float:
        """Parse SWR ratio reading."""
        pass

    @abstractmethod
    def cmd_set_rf_power(self, watts: int) -> bytes:
        """Command to set RF output power."""
        pass

    @abstractmethod
    def cmd_set_af_gain(self, level_0_100: int) -> bytes:
        """Command to set AF volume."""
        pass

    @abstractmethod
    def cmd_configure_split(self, rx_freq_hz: int, tx_freq_hz: int, rx_mode: str, tx_mode: str, tone_hz: Optional[float] = None) -> list[bytes]:
        """Generate command sequences for cross-band or split-frequency duplex operation."""
        pass
    
    @abstractmethod
    def cmd_get_rf_power(self) -> bytes:
        """Command to query the current RF output power setting."""
        pass

    @abstractmethod
    def parse_rf_power(self, response: bytes) -> Optional[int]:
        """Parse raw CAT response into target RF power in Watts."""
        pass
    
    # Sub-Receiver (Dual Watch) Capabilities
    supports_sub_rx: bool = False

    def cmd_get_sub_frequency(self) -> bytes:
        return b""

    def cmd_set_sub_frequency(self, freq_hz: int) -> bytes:
        return b""

    def cmd_get_sub_power(self) -> bytes:
        return b""

    def cmd_set_sub_power(self, on: bool) -> bytes:
        return b""

    def parse_sub_power(self, response: bytes) -> Optional[bool]:
        return None

    def cmd_get_sub_smeter(self) -> bytes:
        return b""

    def parse_sub_smeter(self, response: bytes) -> float:
        return 0.0

    def cmd_set_sub_volume(self, level_0_100: int) -> bytes:
        return b""

    def cmd_set_sub_mute(self, muted: bool) -> bytes:
        return b""