"""
Embedded Hamlib rigctld Protocol Server (127.0.0.1:4532).
Allows WSJT-X, JTDX, and logging software to connect over Hamlib NET rigctl.
"""

import asyncio
import logging
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .daemon import BridgeCoordinator

logger = logging.getLogger("HamlibRigctld")


class RigctldServer:
    def __init__(self, coordinator: 'BridgeCoordinator', host: str = "127.0.0.1", port: int = 4532):
        self.coord = coordinator
        self.host = host
        self.port = port
        self.server: Optional[asyncio.AbstractServer] = None

    async def start(self):
        try:
            self.server = await asyncio.start_server(self.handle_client, self.host, self.port)
            logger.info("Hamlib rigctld emulator listening on %s:%d", self.host, self.port)
        except OSError as e:
            logger.error("Failed to bind Hamlib port %d: %s (Port already in use?)", self.port, e)

    async def stop(self):
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            logger.info("Hamlib rigctld emulator stopped.")

    async def handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        addr = writer.get_extra_info('peername')
        logger.info("rigctld client connected from %s", addr)

        try:
            while not reader.at_eof():
                line = await reader.readline()
                if not line:
                    break

                raw_str = line.decode('ascii', errors='ignore').strip()
                if not raw_str:
                    continue

                response = await self.process_command(raw_str)
                if response:
                    writer.write(response.encode('ascii'))
                    await writer.drain()
        except (ConnectionResetError, asyncio.IncompleteReadError):
            pass
        except Exception as e:
            logger.error("rigctld client error (%s): %s", addr, e)
        finally:
            writer.close()
            await writer.wait_closed()
            logger.info("rigctld client %s disconnected", addr)

    async def process_command(self, cmd_line: str) -> str:
        parts = cmd_line.split()
        cmd = parts[0]

        # GET FREQUENCY: 'f' or '\get_freq'
        if cmd in ("f", "\\get_freq"):
            freq = self.coord.state.get("frequency") or 14074000
            return f"{freq}\n"

        # SET FREQUENCY: 'F <freq_hz>' or '\set_freq <freq_hz>'
        elif cmd in ("F", "\\set_freq"):
            if len(parts) > 1:
                try:
                    f = int(float(parts[1]))
                    await self.coord.set_frequency(f)
                    return "RPRT 0\n"
                except Exception:
                    return "RPRT -1\n"
            return "RPRT -2\n"

        # GET MODE: 'm' or '\get_mode' -> returns "<mode>\n<passband_hz>\n"
        elif cmd in ("m", "\\get_mode"):
            mode = self.coord.state.get("mode") or "USB"
            passband = 2400
            if "CW" in mode:
                passband = 500
            elif "FM" in mode:
                passband = 12000
            elif "AM" in mode:
                passband = 6000
            return f"{mode}\n{passband}\n"

        # SET MODE: 'M <mode> <passband>'
        elif cmd in ("M", "\\set_mode"):
            if len(parts) > 1:
                mode = parts[1].upper()
                await self.coord.set_mode(mode)
                return "RPRT 0\n"
            return "RPRT -2\n"

        # GET PTT: 't' or '\get_ptt' -> 0 (RX) or 1 (TX)
        elif cmd in ("t", "\\get_ptt"):
            ptt = 1 if self.coord.state.get("ptt") else 0
            return f"{ptt}\n"

        # SET PTT: 'T <0|1>'
        elif cmd in ("T", "\\set_ptt"):
            if len(parts) > 1:
                tx_on = (parts[1] == "1")
                await self.coord.set_ptt(tx_on)
                return "RPRT 0\n"
            return "RPRT -2\n"

        # GET VFO: 'v' or '\get_vfo'
        elif cmd in ("v", "\\get_vfo"):
            return "VFOA\n"

        # DUMP CAPS: '\dump_caps' or '1'
        elif cmd in ("\\dump_caps", "1", "chk_vfo"):
            return "0\n"

        # Fallback acknowledgment
        return "RPRT 0\n"