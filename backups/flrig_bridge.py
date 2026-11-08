import asyncio
from datetime import datetime, timezone
import json
import os
import re
import subprocess
import sys
import websockets
import xmlrpc.client

FLRIG_URL = "http://127.0.0.1:12345"
WS_HOST = "127.0.0.1"
WS_PORT = 8088
ADIF_FILE = r"C:\ezshack\shack_log.adi"

ORPHAN_WATCHDOG_SECONDS = 12

flrig_lock = asyncio.Lock()
connected_clients = set()
watchdog_task = None

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

def freq_to_band(freq_hz):
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
    return ""

def format_adif_tag(tag, value):
    val_str = str(value).strip()
    if not val_str:
        return ""
    return f"<{tag.upper()}:{len(val_str)}>{val_str}"

def append_qso_to_adif(qso_data, current_freq_hz=None, current_mode="USB", station_profile=None):
    profile = station_profile or DEFAULT_STATION_PROFILE
    file_exists = os.path.exists(ADIF_FILE)
    
    call = qso_data.get("call", "").strip().upper()
    if not call:
        return

    raw_freq = qso_data.get("freq")
    if raw_freq:
        try:
            val = float(raw_freq)
            freq_mhz = f"{val/1_000_000:.6f}" if val > 1000 else f"{val:.6f}"
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
    qso_date = re.sub(r'[^\d]', '', str(raw_date))[:8]
    if len(qso_date) != 8:
        qso_date = now.strftime("%Y%m%d")
    qso_date_off = qso_date

    raw_time = qso_data.get("time_on") or qso_data.get("time") or now.strftime("%H%M%S")
    clean_time = re.sub(r'[^\d]', '', str(raw_time))
    if len(clean_time) == 4:
        time_on = clean_time + "00"
    elif len(clean_time) >= 6:
        time_on = clean_time[:6]
    else:
        time_on = now.strftime("%H%M%S")
    time_off = time_on

    op_call = profile.get("callsign") or profile.get("OPERATOR") or "N0CALL"
    grid_sq = profile.get("grid") or profile.get("MY_GRIDSQUARE") or ""
    city = profile.get("city") or profile.get("MY_CITY") or ""
    state = profile.get("state") or profile.get("MY_STATE") or ""
    country = profile.get("country") or profile.get("COUNTRY") or "USA"
    cqz = str(profile.get("cqz") or profile.get("CQZ") or "")
    pwr = str(profile.get("power") or profile.get("TX_PWR") or "100")

    adif_fields = [
        ("FREQ", freq_mhz),
        ("CALL", call),
        ("MODE", mode),
        ("QSO_DATE", qso_date),
        ("QSO_DATE_OFF", qso_date_off),
        ("TIME_OFF", time_off),
        ("TIME_ON", time_on),
        ("RST_RCVD", rst_rcvd),
        ("RST_SENT", rst_sent),
        ("BAND", band),
        ("COUNTRY", country),
        ("TX_PWR", pwr),
        ("OPERATOR", op_call),
        ("STATION_CALLSIGN", op_call)
    ]
    if cqz: adif_fields.append(("CQZ", cqz))
    if grid_sq: adif_fields.append(("MY_GRIDSQUARE", grid_sq))
    if city: adif_fields.append(("MY_CITY", city))
    if state: adif_fields.append(("MY_STATE", state))
    if notes: adif_fields.append(("COMMENT", notes))

    record = "".join(format_adif_tag(tag, val) for tag, val in adif_fields) + "<EOR>\n"

    try:
        with open(ADIF_FILE, "a", encoding="ascii", errors="replace") as f:
            if not file_exists:
                f.write("<ADIF_VER:5>3.1.4\n<PROGRAMID:7>EZShack\n<PROGRAMVERSION:5>0.2.4\n<EOH>\n")
            f.write(record)
        print(f"[Log OK] {call} | {freq_mhz} MHz ({mode}) | Op: {op_call} -> {ADIF_FILE}")
    except Exception as e:
        print(f"[Log Error] Failed writing to {ADIF_FILE}: {e}")

def shutdown_station():
    """Forcefully terminates FLRIG and shuts down the Python bridge."""
    print("[Shutdown] Terminating FLRIG process...")
    try:
        subprocess.run(["taskkill", "/F", "/IM", "flrig.exe"], capture_output=True)
    except Exception as e:
        print(f"[Shutdown Error] {e}")
    print("[Shutdown] Exiting EZShack bridge.")
    os._exit(0)

async def orphan_watchdog_timer():
    print(f"[Watchdog] Browser disconnected. Starting {ORPHAN_WATCHDOG_SECONDS}s countdown...")
    await asyncio.sleep(ORPHAN_WATCHDOG_SECONDS)
    if len(connected_clients) == 0:
        print("[Watchdog] Timeout reached with 0 clients. Shutting down station.")
        shutdown_station()

async def handle_client(websocket):
    global watchdog_task
    connected_clients.add(websocket)
    
    if watchdog_task and not watchdog_task.done():
        watchdog_task.cancel()
        print("[Watchdog] Browser reconnected. Shutdown cancelled.")

    print(f"[EZShack] Client connected from {websocket.remote_address}")
    flrig = xmlrpc.client.ServerProxy(FLRIG_URL)

    state = {
        "freq": None,
        "mode": None,
        "power": 100,
        "volume": 50,
        "xcvr": "Unknown",
        "running": True
    }

    # Query initial radio power, volume, and connected transceiver model
    try:
        async with flrig_lock:
            try:
                state["xcvr"] = str(await asyncio.to_thread(flrig.rig.get_xcvr)).strip()
            except Exception:
                state["xcvr"] = "FT-991A"
            try:
                state["power"] = int(float(await asyncio.to_thread(flrig.rig.get_power)))
            except Exception:
                pass
            try:
                state["volume"] = int(float(await asyncio.to_thread(flrig.rig.get_volume)))
            except Exception:
                pass
    except Exception as e:
        print(f"[Init Telemetry Notice] {e}")

    async def incoming_listener():
        try:
            async for raw_msg in websocket:
                try:
                    data = json.loads(raw_msg)
                    action = data.get("action")

                    if action == "shutdown":
                        print("[Command] Operator clicked Power Down. Exiting.")
                        state["running"] = False
                        await asyncio.sleep(0.1)
                        shutdown_station()

                    elif action == "log_qso":
                        profile = data.get("station") or DEFAULT_STATION_PROFILE
                        append_qso_to_adif(
                            data.get("qso", {}),
                            current_freq_hz=state["freq"],
                            current_mode=state["mode"] or "USB",
                            station_profile=profile
                        )

                    elif action == "set_freq":
                        freq_val = float(data.get("freq", 0))
                        if freq_val > 0:
                            async with flrig_lock:
                                def _set_frequency():
                                    try:
                                        flrig.rig.set_vfo(freq_val)
                                    except Exception:
                                        flrig.rig.set_frequency(freq_val)
                                await asyncio.to_thread(_set_frequency)
                            state["freq"] = int(freq_val)

                    elif action == "set_mode":
                        mode_val = str(data.get("mode", "")).strip().upper()
                        if mode_val:
                            flrig_mode = "FM" if mode_val == "C4FM" else mode_val
                            async with flrig_lock:
                                await asyncio.to_thread(flrig.rig.set_mode, flrig_mode)
                            state["mode"] = mode_val

                    elif action == "set_vfo":
                        vfo_val = str(data.get("vfo", "A")).strip().upper()
                        async with flrig_lock:
                            def _set_active_vfo():
                                try:
                                    flrig.rig.set_AB(vfo_val)
                                except Exception:
                                    pass
                            await asyncio.to_thread(_set_active_vfo)

                    elif action == "set_power":
                        pwr_int = int(round(float(data.get("power", 100))))
                        pwr_int = max(5, min(100, pwr_int))
                        state["power"] = pwr_int
                        async with flrig_lock:
                            def _do_set_power():
                                try:
                                    flrig.rig.set_power(pwr_int)
                                except Exception:
                                    try:
                                        flrig.rig.set_pwr(pwr_int)
                                    except Exception:
                                        pass
                            await asyncio.to_thread(_do_set_power)
                        print(f"[EZShack CAT] Radio Power Target -> {pwr_int}W")

                    elif action == "set_volume":
                        vol_int = int(round(float(data.get("volume", 50))))
                        vol_int = max(0, min(100, vol_int))
                        state["volume"] = vol_int
                        async with flrig_lock:
                            def _do_set_volume():
                                try:
                                    flrig.rig.set_volume(vol_int)
                                except Exception:
                                    try:
                                        flrig.rig.set_af(vol_int)
                                    except Exception:
                                        pass
                            await asyncio.to_thread(_do_set_volume)
                        print(f"[EZShack CAT] Radio AF Volume -> {vol_int}%")

                except Exception as ex:
                    print(f"[CAT Error] Command error: {ex}")
        except websockets.exceptions.ConnectionClosed:
            pass

    async def telemetry_loop():
        consecutive_errors = 0
        tick_counter = 0

        while state["running"]:
            try:
                ptt = False
                smeter_val = 0.0
                pwr_out = 0.0
                swr_val = 1.0

                async with flrig_lock:
                    raw_freq = await asyncio.to_thread(flrig.rig.get_vfo)
                    raw_mode = await asyncio.to_thread(flrig.rig.get_mode)
                    
                    try:
                        ptt = bool(await asyncio.to_thread(flrig.rig.get_ptt))
                    except Exception:
                        ptt = False

                    if ptt:
                        try:
                            pwr_out = round(float(await asyncio.to_thread(flrig.rig.get_pwrmeter)), 1)
                            swr_val = round(float(await asyncio.to_thread(flrig.rig.get_swrmeter)), 2)
                        except Exception:
                            pass
                    else:
                        try:
                            smeter_val = float(await asyncio.to_thread(flrig.rig.get_smeter))
                        except Exception:
                            smeter_val = 0.0

                    # Sync slider targets and xcvr name every ~4 seconds
                    tick_counter += 1
                    if tick_counter % 16 == 0:
                        try:
                            state["xcvr"] = str(await asyncio.to_thread(flrig.rig.get_xcvr)).strip()
                        except Exception:
                            pass
                        try:
                            state["power"] = int(float(await asyncio.to_thread(flrig.rig.get_power)))
                        except Exception:
                            pass
                        try:
                            state["volume"] = int(float(await asyncio.to_thread(flrig.rig.get_volume)))
                        except Exception:
                            pass

                freq_hz = int(float(raw_freq))
                mode_str = str(raw_mode).strip().upper()

                state["freq"] = freq_hz
                state["mode"] = mode_str
                consecutive_errors = 0

                payload = {
                    "connected": True,
                    "frequency": freq_hz,
                    "mode": mode_str,
                    "band": freq_to_band(freq_hz),
                    "ptt": ptt,
                    "smeter_val": smeter_val,
                    "pwr_out": pwr_out,
                    "swr": swr_val,
                    "power_target": state["power"],
                    "volume_target": state["volume"],
                    "xcvr": state["xcvr"]
                }
                await websocket.send(json.dumps(payload))
                await asyncio.sleep(0.25)

            except websockets.exceptions.ConnectionClosed:
                break
            except Exception:
                consecutive_errors += 1
                if consecutive_errors >= 4:
                    try:
                        await websocket.send(json.dumps({"connected": False, "error": "FLRIG Disconnected"}))
                    except websockets.exceptions.ConnectionClosed:
                        break
                await asyncio.sleep(0.4)

    try:
        await asyncio.gather(incoming_listener(), telemetry_loop())
    finally:
        connected_clients.discard(websocket)
        print("[EZShack] Client disconnected.")
        if len(connected_clients) == 0 and state["running"]:
            watchdog_task = asyncio.create_task(orphan_watchdog_timer())

async def main():
    if not os.path.exists(ADIF_FILE):
        try:
            with open(ADIF_FILE, "w", encoding="ascii") as f:
                f.write("<ADIF_VER:5>3.1.4\n<PROGRAMID:7>EZShack\n<PROGRAMVERSION:5>0.2.4\n<EOH>\n")
            print(f"[Init] Initialized master ADIF log file at {ADIF_FILE}")
        except Exception as e:
            print(f"[Init Error] Could not initialize {ADIF_FILE}: {e}")

    print(f"Starting EZShack CAT Bridge on ws://{WS_HOST}:{WS_PORT}")
    print(f"Targeting FLRIG XML-RPC at {FLRIG_URL}")
    async with websockets.serve(handle_client, WS_HOST, WS_PORT):
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        shutdown_station()