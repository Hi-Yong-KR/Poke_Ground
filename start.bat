@echo off
cd /d "%~dp0"
rem Run right away if everything is ready; otherwise scripts\setup.ps1 installs what is missing
rem (private Node.js, Electron, cries, Whisper + VC++ runtime, or the Vosk fallback)
set READY=1
if not exist node_modules\electron\dist\electron.exe set READY=0
if not exist assets\pokemon\pikachu\cry.ogg set READY=0
if not exist assets\models\whisper-small\model.bin if not exist assets\models\ko.tar.gz set READY=0
if not exist "%SystemRoot%\System32\msvcp140_1.dll" if not exist assets\models\ko.tar.gz set READY=0
if "%READY%"=="1" goto run
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup.ps1
if errorlevel 1 (
  pause
  exit /b 1
)
:run
start "" node_modules\electron\dist\electron.exe .
