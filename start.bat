@echo off
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe call npm install
if not exist assets\pokemon\pikachu\cry.ogg call npm run fetch-assets
if not exist assets\models\whisper-small\model.bin call npm run fetch-whisper
rem Whisper를 못 깔았으면(파이썬 없음 등) 예비용 Vosk 모델이라도 받는다
if not exist assets\models\whisper-small\model.bin if not exist assets\models\ko.tar.gz call npm run fetch-voice
start "" node_modules\electron\dist\electron.exe .
