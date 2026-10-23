@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem 포켓몬 그라운드 오프라인 배포판 실행기 (make-offline.ps1이 zip 맨 위에 넣는다)
if not exist "app\node_modules\electron\dist\electron.exe" (
  echo.
  echo  [포켓몬 그라운드] 실행 파일을 찾지 못했어요.
  echo  zip 파일 안에서 바로 실행하지 말고, 먼저 압축을 푼 다음
  echo  풀린 폴더의 start.bat 을 실행해 주세요.
  echo.
  pause
  exit /b 1
)
rem 인터넷에서 받은 파일 표시를 첫 실행 때 한 번 지운다 - 실행할 때마다 뜨는 보안 경고 방지
if not exist "app\.unblocked" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath 'app' -Recurse -File -Include *.exe,*.dll,*.pyd,*.ps1 | Unblock-File" >nul 2>&1
  type nul > "app\.unblocked"
)
start "" "app\node_modules\electron\dist\electron.exe" app
