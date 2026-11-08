@echo off
title EZShack Station Launcher

cls
echo ============================================================
echo               EZShack Station Launcher
echo ============================================================
echo Transceiver Target : AUTO-DETECT
echo Transceiver Port   : AUTO-DETECT
echo Baud Rate          : AUTO-DETECT
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
:: Clear environment overrides so bridge runs in full auto-detect mode
set "EZSHACK_RIG="
set "EZSHACK_PORT="
set "EZSHACK_BAUD="

echo [1/3] Scanning and establishing CAT link...
echo [2/3] Starting EZShack CAT Bridge Daemon...
start "EZShack Bridge Daemon" /min "%VENV_PYTHON%" -m bridge.daemon

echo [3/3] Waiting for bridge startup...
timeout /t 2 /nobreak >nul

echo Opening EZShack Operations Console...
start "" "%~dp0index.html"

echo.
echo EZShack station is online.
timeout /t 3 /nobreak >nul