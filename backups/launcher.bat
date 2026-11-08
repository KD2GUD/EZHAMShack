@'
@echo off
set "EZSHACK_RIG=ts2000"
set "EZSHACK_PORT=COM4"
set "EZSHACK_BAUD=9600"

title EZShack Console - %EZSHACK_RIG% (%EZSHACK_PORT%)

cls
echo ============================================================
echo               EZShack Station Launcher
echo ============================================================
echo Transceiver Target : %EZSHACK_RIG%
echo Transceiver Port   : %EZSHACK_PORT% @ %EZSHACK_BAUD% baud
echo Bridge WebSockets  : ws://127.0.0.1:8088
echo Hamlib rigctld     : 127.0.0.1:4532 (WSJT-X / JTDX)
echo ============================================================
echo.

set "VENV_PYTHON=%~dp0.venv\Scripts\python.exe"

if exist "%VENV_PYTHON%" goto :RUN

echo [ERROR] Virtual environment (.venv) not found at: %VENV_PYTHON%
echo Run: powershell -ExecutionPolicy Bypass -File .\install.ps1
pause
exit /b 1

:RUN
echo [1/3] Verifying serial port %EZSHACK_PORT%...
echo [2/3] Starting EZShack CAT Bridge Daemon...
start "EZShack Bridge Daemon" /min "%VENV_PYTHON%" -m bridge.daemon

echo [3/3] Waiting for bridge startup...
timeout /t 2 /nobreak >nul

echo Opening EZShack Operations Console...
start "" "%~dp0index.html"

echo.
echo EZShack station is online.
timeout /t 3 /nobreak >nul
'@ | Out-File -FilePath .\launcher.bat -Encoding ascii