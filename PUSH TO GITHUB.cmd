@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\windows\push-to-github.ps1"
if errorlevel 1 pause
