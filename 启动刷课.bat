@echo off
title xxt-auto
set "ELECTRON_RUN_AS_NODE="
cd /d "%~dp0"

if not exist "node_modules\electron\dist\electron.exe" (
    echo [ERROR] Electron not found. Please run: npm install
    pause
    exit /b 1
)

start "" "%CD%\node_modules\electron\dist\electron.exe" "%CD%"
exit /b 0
