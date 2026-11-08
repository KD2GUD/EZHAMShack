# 1. Verify / Install Python (Ignoring WindowsApps stub)
Write-Host "`n[1/5] Checking Python environment..." -ForegroundColor Yellow
$pythonCmd = $null

# Filter out dummy Microsoft Store aliases in WindowsApps
$realPython = Get-Command python -ErrorAction SilentlyContinue | Where-Object { $_.Source -notlike "*WindowsApps*" }
$realPy = Get-Command py -ErrorAction SilentlyContinue | Where-Object { $_.Source -notlike "*WindowsApps*" }

if ($realPython) {
    $pythonCmd = $realPython.Source
} elseif ($realPy) {
    $pythonCmd = $realPy.Source
}

if ($pythonCmd) {
    $pythonVer = & $pythonCmd --version 2>&1
    Write-Host "  Found existing Python: $pythonVer" -ForegroundColor Green
} else {
    Write-Host "  [NOTICE] Real Python runtime not found in PATH." -ForegroundColor Yellow
    Write-Host "  Installing Python 3.12 via Windows Package Manager (winget)..." -ForegroundColor Cyan

    try {
        winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
        Update-SessionPath
        Start-Sleep -Seconds 2

        $realPython = Get-Command python -ErrorAction SilentlyContinue | Where-Object { $_.Source -notlike "*WindowsApps*" }
        if ($realPython) {
            $pythonCmd = $realPython.Source
        } else {
            $localPython = "$env:LocalAppData\Programs\Python\Python312\python.exe"
            if (Test-Path $localPython) {
                $pythonCmd = $localPython
            } else {
                throw "Python installation completed, but executable could not be resolved."
            }
        }
        Write-Host "  Python installed successfully." -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] Automated Python installation failed: $_" -ForegroundColor Red
        Write-Host "  Please install Python manually from https://www.python.org/downloads/ (check 'Add python.exe to PATH')." -ForegroundColor White
        Exit 1
    }
}