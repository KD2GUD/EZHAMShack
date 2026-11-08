# EZShack Automated Environment & Shortcut Installer
# Sets up Python runtime, virtual environment (.venv), dependencies, and desktop launcher
$ErrorActionPreference = "Stop"
$InstallDir = $PSScriptRoot

function Pause-Exit([int]$Code = 0) {
    Write-Host "`nPress any key to close this window..." -ForegroundColor Gray
    $null = [Console]::ReadKey($true)
    Exit $Code
}

try {
    Write-Host "==========================================" -ForegroundColor DarkYellow
    Write-Host "     EZSHACK STATION SETUP v1.0.0-BETA   " -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor DarkYellow

    # 1. Verify / Locate Python runtime (Filtering out Windows Store stubs)
    Write-Host "`n[1/5] Checking Python environment..." -ForegroundColor Yellow
    $pythonCmd = $null

    $realPython = Get-Command python -ErrorAction SilentlyContinue | Where-Object { $_.Source -notlike "*WindowsApps*" }
    $realPy = Get-Command py -ErrorAction SilentlyContinue | Where-Object { $_.Source -notlike "*WindowsApps*" }

    if ($realPython) {
        $pythonCmd = $realPython.Source
    } elseif ($realPy) {
        $pythonCmd = $realPy.Source
    }

    # If not found immediately, refresh the session PATH directly from the registry
    if (-not $pythonCmd) {
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        $realPython = Get-Command python -ErrorAction SilentlyContinue | Where-Object { $_.Source -notlike "*WindowsApps*" }
        if ($realPython) {
            $pythonCmd = $realPython.Source
        }
    }

    # Check default local AppData path if PATH broadcast is delayed
    if (-not $pythonCmd) {
        $localPython = "$env:LocalAppData\Programs\Python\Python312\python.exe"
        if (Test-Path $localPython) {
            $pythonCmd = $localPython
        }
    }

    if ($pythonCmd) {
        $pythonVer = & $pythonCmd --version 2>&1
        Write-Host "  Found Python: $pythonVer ($pythonCmd)" -ForegroundColor Green
    } else {
        Write-Host "  [NOTICE] Python runtime not detected in PATH." -ForegroundColor Yellow
        Write-Host "  Installing Python 3.12 via Windows Package Manager (winget)..." -ForegroundColor Cyan

        try {
            # Scope to user profile to avoid UAC administrative permission blocks
            winget install Python.Python.3.12 --scope user --silent --accept-package-agreements --accept-source-agreements
            Start-Sleep -Seconds 3
            
            # Refresh current session PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

            $realPython = Get-Command python -ErrorAction SilentlyContinue | Where-Object { $_.Source -notlike "*WindowsApps*" }
            if ($realPython) {
                $pythonCmd = $realPython.Source
            } else {
                $localPython = "$env:LocalAppData\Programs\Python\Python312\python.exe"
                if (Test-Path $localPython) {
                    $pythonCmd = $localPython
                } else {
                    throw "Python installation completed, but python.exe could not be located."
                }
            }
            Write-Host "  Python installed successfully." -ForegroundColor Green
        } catch {
            Write-Host "  [ERROR] Automated Python installation failed: $_" -ForegroundColor Red
            Write-Host "  Please install Python manually from https://www.python.org/downloads/ (check 'Add python.exe to PATH')." -ForegroundColor White
            Pause-Exit 1
        }
    }

    # 2. Setup Dedicated Virtual Environment (.venv)
    Write-Host "`n[2/5] Creating dedicated virtual environment (.venv)..." -ForegroundColor Yellow
    $VenvDir = Join-Path $InstallDir ".venv"
    $VenvPython = Join-Path $VenvDir "Scripts\python.exe"

    if (-not (Test-Path $VenvPython)) {
        & $pythonCmd -m venv "$VenvDir"
        Write-Host "  Virtual environment created at: .venv\" -ForegroundColor Green
    } else {
        Write-Host "  Existing virtual environment detected at: .venv\" -ForegroundColor Green
    }

    # 3. Install Direct Hardware CAT Dependencies
    Write-Host "`n[3/5] Installing bridge packages..." -ForegroundColor Yellow
    & $VenvPython -m pip install --upgrade pip --quiet

    $ReqPath = Join-Path $InstallDir "requirements.txt"
    if (Test-Path $ReqPath) {
        Write-Host "  Installing from requirements.txt..." -ForegroundColor Gray
        & $VenvPython -m pip install -r "$ReqPath" --quiet
    } else {
        Write-Host "  requirements.txt not found; installing defaults directly..." -ForegroundColor Gray
        & $VenvPython -m pip install pyserial websockets --quiet
    }

    # Verify imports inside venv
    $checkResult = & $VenvPython -c "import serial, websockets; print('OK')" 2>&1
    if ($checkResult -match "OK") {
        Write-Host "  Hardware dependencies verified: pyserial, websockets" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] Dependency import test failed: $checkResult" -ForegroundColor Red
    }

    # 4. Initialize Local Station Log Directory
    Write-Host "`n[4/5] Initializing local station directory..." -ForegroundColor Yellow
    $ShackDir = "C:\ezshack"
    if (-not (Test-Path $ShackDir)) {
        New-Item -Path $ShackDir -ItemType Directory -Force | Out-Null
        Write-Host "  Created station directory: $ShackDir" -ForegroundColor Green
    } else {
        Write-Host "  Station directory verified: $ShackDir" -ForegroundColor Green
    }

    $AdifPath = Join-Path $ShackDir "shack_log.adi"
    if (-not (Test-Path $AdifPath)) {
        $adifHeader = "<ADIF_VER:5>3.1.4`n<PROGRAMID:7>EZShack`n<PROGRAMVERSION:5>1.0.0`n<EOH>`n"
        [System.IO.File]::WriteAllText($AdifPath, $adifHeader, [System.Text.Encoding]::ASCII)
        Write-Host "  Initialized master ADIF log file: $AdifPath" -ForegroundColor Green
    }

    # 5. Create Desktop Shortcut to launcher.bat
    Write-Host "`n[5/5] Creating Desktop Shortcut..." -ForegroundColor Yellow
    $LauncherBat = Join-Path $InstallDir "launcher.bat"

    if (-not (Test-Path $LauncherBat)) {
        Write-Host "  [WARNING] launcher.bat not found in $InstallDir." -ForegroundColor Yellow
    }

    $WshShell = New-Object -ComObject WScript.Shell
    $DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
    $Shortcut = $WshShell.CreateShortcut("$DesktopPath\EZShack.lnk")
    $Shortcut.TargetPath = "$LauncherBat"
    $Shortcut.WorkingDirectory = "$InstallDir"
    $Shortcut.Description = "Launch EZShack Station Dashboard & CAT Bridge"

    $IconCandidate = Join-Path $InstallDir "assets\icons\ezshack.ico"
    if (Test-Path $IconCandidate) {
        $Shortcut.IconLocation = "$IconCandidate"
    }

    $Shortcut.Save()
    Write-Host "  Desktop shortcut created: EZShack.lnk -> launcher.bat" -ForegroundColor Green

    Write-Host "`n========================================================" -ForegroundColor Cyan
    Write-Host " Setup complete!                                         " -ForegroundColor Green
    Write-Host " Direct CAT engine runs via .venv using pyserial.       " -ForegroundColor Green
    Write-Host " Launch EZShack from your desktop icon or launcher.bat. " -ForegroundColor Cyan
    Write-Host "========================================================`n" -ForegroundColor Cyan

    Pause-Exit 0
}
catch {
    Write-Host "`n[FATAL ERROR] Setup encountered an unhandled exception:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Pause-Exit 1
}