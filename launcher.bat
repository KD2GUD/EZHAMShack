@echo off
setlocal EnableDelayedExpansion
title EZHAMShack Station Launcher

cls
echo ============================================================
echo              EZHAMShack Station Launcher
echo                    Version: 1.0.0
echo ============================================================
echo Transceiver Target : AUTO-DETECT
echo Transceiver Port   : AUTO-DETECT
echo Baud Rate          : AUTO-DETECT
echo Bridge WebSockets  : ws://127.0.0.1:8088
echo ============================================================
echo.

set "VENV_PYTHON=%~dp0.venv\Scripts\python.exe"

if exist "%VENV_PYTHON%" goto :CHECK_UPDATES

echo [ERROR] Virtual environment (.venv) not found at: %VENV_PYTHON%
echo Run: install.bat
pause
exit /b 1

:CHECK_UPDATES
:: ============================================================
:: UPDATER & VERSION VALIDATION ENGINE
:: ============================================================
set "UPDATE_TIMEOUT=30"
set "DEFAULT_ACTION=U"

echo [0/3] Checking environment, GitHub updates, Python ^& libraries...

:: 1. Silent Internet Connectivity Check (800ms max timeout)
ping -n 1 -w 800 1.1.1.1 >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    ping -n 1 -w 800 8.8.8.8 >nul 2>&1
    if !ERRORLEVEL! NEQ 0 (
        echo   [INFO] Offline mode: No internet detected. Skipping update checks.
        goto :RUN
    )
)

:: 2. Verify Python Runtime Version (0x030a0000 = Python 3.10.0)
set "PY_VER=unknown"
for /f "usebackq tokens=2 delims= " %%v in (`"%VENV_PYTHON%" --version 2^>^&1`) do set "PY_VER=%%v"

"%VENV_PYTHON%" -c "import sys; assert sys.hexversion >= 0x030a0000" >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo   [WARNING] Installed Python is v!PY_VER!. EZHAMShack recommends Python 3.10+.
)

:: 3. Check EZHAMShack Core Repository Updates (GitHub)
set "APP_UPDATE_AVAILABLE=0"
if not exist "%~dp0.git" goto :EVAL_UPDATE

where git >nul 2>&1
if !ERRORLEVEL! NEQ 0 goto :EVAL_UPDATE

git -C "%~dp0." fetch --quiet 2>nul
if !ERRORLEVEL! NEQ 0 goto :EVAL_UPDATE

set "LOCAL_HASH="
set "REMOTE_HASH="
for /f "usebackq delims=" %%a in (`git -C "%~dp0." rev-parse HEAD 2^>nul`) do set "LOCAL_HASH=%%a"
for /f "usebackq delims=" %%b in (`git -C "%~dp0." rev-parse @{u} 2^>nul`) do set "REMOTE_HASH=%%b"

if defined REMOTE_HASH (
    if not "!LOCAL_HASH!"=="!REMOTE_HASH!" (
        set "APP_UPDATE_AVAILABLE=1"
    )
)

:EVAL_UPDATE
if "!APP_UPDATE_AVAILABLE!"=="1" (
    echo.
    echo   ************************************************************
    echo    [UPDATE AVAILABLE] A newer version of EZHAMShack was found!
    echo   ************************************************************
    echo.
    if "!DEFAULT_ACTION!"=="U" (
        echo   Press [U] to pull GitHub updates ^& upgrade Python libraries.
        echo   Press [L] to skip and launch immediately.
        echo   ^(Auto-updating in !UPDATE_TIMEOUT! seconds...^)
    ) else (
        echo   Press [U] to apply updates now.
        echo   Press [L] to skip and launch immediately.
        echo   ^(Defaulting to Launch in !UPDATE_TIMEOUT! seconds...^)
    )
    echo.

    choice /C UL /T !UPDATE_TIMEOUT! /D !DEFAULT_ACTION! /M "Select option"
    if !ERRORLEVEL! EQU 1 (
        echo.
        echo   [1/3] Pulling latest repository commits from GitHub...
        git -C "%~dp0." pull --ff-only --quiet 2>nul || git -C "%~dp0." pull --quiet
        echo   [2/3] Upgrading Python pip...
        "%VENV_PYTHON%" -m pip install --upgrade pip --quiet >nul 2>&1
        echo   [3/3] Updating runtime library dependencies...
        if exist "%~dp0requirements.txt" (
            "%VENV_PYTHON%" -m pip install -r "%~dp0requirements.txt" --upgrade --quiet
        ) else (
            "%VENV_PYTHON%" -m pip install pyserial websockets --upgrade --quiet
        )
        echo   Update complete! Launching station...
        timeout /t 2 /nobreak >nul
    ) else (
        echo   Update skipped by operator. Proceeding to launch...
    )
) else (
    "%VENV_PYTHON%" -c "import serial, websockets" >nul 2>&1
    if !ERRORLEVEL! NEQ 0 (
        echo   [INFO] Installing missing Python libraries...
        if exist "%~dp0requirements.txt" (
            "%VENV_PYTHON%" -m pip install -r "%~dp0requirements.txt" --upgrade --quiet
        ) else (
            "%VENV_PYTHON%" -m pip install pyserial websockets --upgrade --quiet
        )
    )
    echo   [OK] System up to date ^(Python !PY_VER! ^| GitHub ^& Libraries current^).
)

:RUN
:: Clear environment overrides so bridge runs in full auto-detect mode
set "EZSHACK_RIG="
set "EZSHACK_PORT="
set "EZSHACK_BAUD="

echo.
echo [1/3] Scanning and establishing CAT link...
echo [2/3] Starting EZHAMShack CAT Bridge Daemon...
start "EZHAMShack Bridge Daemon" /min "%VENV_PYTHON%" -m bridge.daemon

echo [3/3] Waiting for bridge startup...
timeout /t 2 /nobreak >nul

echo Opening EZHAMShack Operations Console...
start "" "%~dp0index.html"

echo.
echo EZHAMShack station is online.
timeout /t 3 /nobreak >nul