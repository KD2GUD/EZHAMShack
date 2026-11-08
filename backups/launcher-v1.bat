@echo off
setlocal enabledelayedexpansion
title EZShack Station Launcher
cd /d "%~dp0"

echo [1/3] Locating and verifying FLRIG...
set "FLRIG_EXE="

:: 1. Check for running process first
tasklist /FI "IMAGENAME eq flrig.exe" 2>NUL | find /I /N "flrig.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo FLRIG is already running.
    goto :START_BRIDGE
)

:: 2. Search for versioned W1HKJ installation directories
for /d %%D in ("%ProgramFiles(x86)%\flrig*") do (
    if exist "%%D\flrig.exe" set "FLRIG_EXE=%%D\flrig.exe"
)
if not defined FLRIG_EXE (
    for /d %%D in ("%ProgramFiles%\flrig*") do (
        if exist "%%D\flrig.exe" set "FLRIG_EXE=%%D\flrig.exe"
    )
)
if not defined FLRIG_EXE (
    if exist "C:\flrig\flrig.exe" set "FLRIG_EXE=C:\flrig\flrig.exe"
)

:: 3. Launch FLRIG if binary was resolved
if defined FLRIG_EXE (
    echo Launching FLRIG from: "!FLRIG_EXE!"
    start "" "!FLRIG_EXE!"
    timeout /t 3 /nobreak >nul
) else (
    echo [WARNING] Could not locate flrig.exe automatically.
    echo Please verify FLRIG is installed or launch it manually.
)

:START_BRIDGE
echo [2/3] Starting EZShack Bridge...
start "" pythonw.exe "%~dp0flrig_bridge.py"

echo [3/3] Opening EZShack Operations Console...
timeout /t 1 /nobreak >nul
start "" "%~dp0index.html"

exit