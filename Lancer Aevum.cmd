@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Installez Node.js 22 ou plus recent, puis relancez ce fichier.
  pause
  exit /b 1
)
if not exist node_modules\tsx (
  echo Installation des dependances au premier lancement...
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm run launch
if errorlevel 1 pause
