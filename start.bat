@echo off
cd /d "%~dp0"
rem Run right away if everything is ready; otherwise scripts\setup.ps1 installs what is missing (incl. a private Node.js)
if exist node_modules\electron\dist\electron.exe if exist assets\pokemon\pikachu\cry.ogg if exist assets\models\whisper-small\model.bin goto run
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup.ps1
if errorlevel 1 (
  pause
  exit /b 1
)
:run
start "" node_modules\electron\dist\electron.exe .
