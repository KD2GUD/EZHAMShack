"""
test_ts2000.py - Standalone Kenwood TS-2000 Hardware CAT Diagnostics
Run using: .\.venv\Scripts\python.exe test_ts2000.py
"""

import sys
import time
import serial
import serial.tools.list_ports

TARGET_PORT = "COM4"
BAUD_RATES = [9600, 57600, 38400, 19200, 4800]
PROBE_COMMANDS = [
    (b"ID;", "Transceiver Identification (Expected: ID019;)"),
    (b"FA;", "VFO A Frequency Read"),
    (b"IF;", "Transceiver Status Interrogation")
]

def list_system_ports():
    print("=" * 60)
    print(" DETECTED SERIAL PORTS")
    print("=" * 60)
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        print("  [!] No COM ports detected by Windows.")
        return
    for p in ports:
        print(f"  Port: {p.device:<6} | Desc: {p.description:<28} | HWID: {p.hwid}")
    print()

def probe_radio():
    list_system_ports()

    print("=" * 60)
    print(f" STARTING TS-2000 SERIAL PROBE ON {TARGET_PORT}")
    print("=" * 60)

    for baud in BAUD_RATES:
        print(f"\n--- Testing {TARGET_PORT} @ {baud} Baud ---")

        line_configs = [
            {"label": "DTR=ON,  RTS=ON  (Standard)", "dtr": True,  "rts": True,  "rtscts": False},
            {"label": "DTR=OFF, RTS=ON",             "dtr": False, "rts": True,  "rtscts": False},
            {"label": "Hardware Flow Control (RTS/CTS)", "dtr": True, "rts": True, "rtscts": True},
        ]

        for cfg in line_configs:
            try:
                with serial.Serial(
                    port=TARGET_PORT,
                    baudrate=baud,
                    bytesize=serial.EIGHTBITS,
                    parity=serial.PARITY_NONE,
                    stopbits=serial.STOPBITS_ONE,
                    timeout=0.8,
                    write_timeout=0.5,
                    rtscts=cfg["rtscts"],
                    dsrdtr=False
                ) as ser:
                    ser.dtr = cfg["dtr"]
                    ser.rts = cfg["rts"]
                    time.sleep(0.15)
                    ser.reset_input_buffer()
                    ser.reset_output_buffer()

                    # Clear radio CAT buffer with semicolons
                    ser.write(b";;;")
                    time.sleep(0.06)
                    ser.reset_input_buffer()

                    for cmd, desc in PROBE_COMMANDS:
                        ser.write(cmd)
                        ser.flush()

                        raw = ser.read_until(b";")

                        if raw:
                            print(f"\n  [SUCCESS] {cfg['label']}")
                            print(f"  Command : {cmd.decode('ascii')}")
                            print(f"  Response: {raw} ({raw.decode('ascii', errors='replace').strip()})")
                            print(f"  Hex Dump: {' '.join(f'{b:02X}' for b in raw)}")
                            if b"ID019" in raw or raw.startswith(b"FA") or raw.startswith(b"IF"):
                                print(f"\n  ===> CONFIRMED WORKING: {TARGET_PORT} @ {baud} BAUD")
                                return
                        else:
                            pending = ser.read(ser.in_waiting or 1)
                            if pending:
                                print(f"  [RAW BYTES RECEIVED]: {pending}")
                            else:
                                sys.stdout.write(".")
                                sys.stdout.flush()

            except serial.SerialException as err:
                print(f"\n  [ERROR] Could not open/operate {TARGET_PORT} @ {baud}: {err}")
                break

    print("\n\n" + "=" * 60)
    print(" PROBE COMPLETE: No valid Kenwood responses received.")
    print("=" * 60)

if __name__ == "__main__":
    probe_radio()