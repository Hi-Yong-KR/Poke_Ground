# 처음 실행 준비 (start.bat이 부른다): 필요한 것만 설치하고, 실패하면 이유를 보여 주고 1로 끝난다.
# 1) Node.js — PC에 없으면 이 폴더의 .node 안에만 받는다 (관리자 권한 필요 없음, 시스템은 그대로)
# 2) Electron (npm install)  3) 울음소리  4) 음성인식(Whisper, 실패하면 예비용 Vosk)
# ※ PowerShell 5.1이 한글을 읽으려면 이 파일은 UTF-8 BOM이어야 한다.
param([switch]$PrivateNode)   # 테스트용: PC에 Node가 있어도 개인 Node를 쓴다
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # 5.1의 진행 표시줄은 다운로드를 크게 느리게 한다

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$NodeVersion = 'v24.21.0'
$NodeSha256 = '158F7685B44DE51F6C0DF1D153526CBCD3E1BC739A8DFC607721CEF75DE9E541'
$NodeDir = Join-Path $Root ".node\node-$NodeVersion-win-x64"
$Electron = Join-Path $Root 'node_modules\electron\dist\electron.exe'

function Fail([string]$msg) {
  Write-Host ''
  Write-Host "[준비 실패] $msg" -ForegroundColor Red
  exit 1
}

# Node 18 이상이 실제로 실행되는지 본다 (5.1은 네이티브 인자 속 큰따옴표를 지우므로 따옴표 없는 식으로)
function Test-Node {
  try {
    & node -e 'process.exit(parseInt(process.versions.node) >= 18 ? 0 : 1)' 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  } catch { return $false }
}

function Get-PrivateNode {
  if (Test-Path (Join-Path $NodeDir 'node.exe')) { return }
  Write-Host "Node.js가 없어서 이 폴더 안에만 따로 받습니다 ($NodeVersion, 약 36MB)"
  $dir = Split-Path -Parent $NodeDir
  New-Item -ItemType Directory -Force $dir | Out-Null
  $zip = Join-Path $dir 'node.zip'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -UseBasicParsing -OutFile $zip "https://nodejs.org/dist/$NodeVersion/node-$NodeVersion-win-x64.zip"
  if ((Get-FileHash $zip -Algorithm SHA256).Hash -ne $NodeSha256) {
    Remove-Item $zip
    Fail 'Node.js 다운로드 파일의 체크섬이 맞지 않아요. 인터넷 연결을 확인하고 다시 실행하세요'
  }
  Expand-Archive $zip -DestinationPath $dir -Force
  Remove-Item $zip
}

try {
  # ---- 1) Node.js ----
  if (Test-Path (Join-Path $NodeDir 'node.exe')) { $env:Path = "$NodeDir;$env:Path" }   # 전에 받아 둔 것
  elseif ($PrivateNode -or -not (Test-Node)) { Get-PrivateNode; $env:Path = "$NodeDir;$env:Path" }
  if (-not (Test-Node)) { Fail 'Node.js를 실행할 수 없어요' }

  # ---- 2) Electron ----
  if (-not (Test-Path $Electron)) {
    Write-Host 'Electron 설치 중 (npm install, 처음 1회 1~2분)...'
    & npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Fail 'npm install 실패. 인터넷 연결을 확인하고 다시 실행하세요' }
    # 설치 스크립트가 Electron 본체 다운로드를 건너뛰었거나 실패한 경우 한 번 더
    if (-not (Test-Path $Electron)) { & node node_modules\electron\install.js }
    if (-not (Test-Path $Electron)) { Fail 'Electron 본체(electron.exe)를 받지 못했어요. 인터넷 연결을 확인하고 다시 실행하세요' }
  }

  # ---- 3) 울음소리 (없어도 실행은 되므로 실패해도 계속) ----
  if (-not (Test-Path 'assets\pokemon\pikachu\cry.ogg')) {
    & npm run fetch-assets
    if ($LASTEXITCODE -ne 0) { Write-Host '울음소리를 받지 못했어요 — 소리 없이 실행합니다' -ForegroundColor Yellow }
  }

  # ---- 4) 음성인식 (안 되면 텍스트 명령만 쓰면 되므로 실패해도 계속) ----
  if (-not (Test-Path 'assets\models\whisper-small\model.bin')) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'setup-whisper.ps1')
    if ($LASTEXITCODE -ne 0 -and -not (Test-Path 'assets\models\ko.tar.gz')) {
      Write-Host 'Whisper 설치 실패 — 예비용 Vosk 모델을 받습니다' -ForegroundColor Yellow
      & npm run fetch-voice
      if ($LASTEXITCODE -ne 0) { Write-Host '음성 모델을 받지 못했어요 — 텍스트 명령만 쓸 수 있어요' -ForegroundColor Yellow }
    }
  }
} catch {
  Fail $_.Exception.Message
}
exit 0
