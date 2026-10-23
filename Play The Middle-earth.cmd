@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\shire-local.ps1" -Mode Start -OpenBrowser
if errorlevel 1 pause
