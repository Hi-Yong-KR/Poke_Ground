@echo off
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe call npm install
if not exist assets\pokemon\pikachu\anims.json call npm run fetch-assets
if not exist assets\models\ko.tar.gz call npm run fetch-voice
start "" node_modules\electron\dist\electron.exe .
