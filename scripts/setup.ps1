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

# Whisper 엔진(ctranslate2)이 쓰는 Microsoft Visual C++ 런타임. 새로 설치한 Windows에는 없을 수 있다
function Test-VcRuntime {
  foreach ($d in 'msvcp140.dll', 'msvcp140_1.dll', 'vcruntime140.dll', 'vcruntime140_1.dll') {
    if (-not (Test-Path (Join-Path $env:SystemRoot "System32\$d"))) { return $false }
  }
  return $true
}

# Microsoft 공식 설치 파일을 받아 서명을 확인한 뒤 설치한다. 관리자 확인(UAC) 창이 한 번 뜬다
function Install-VcRuntime {
  Write-Host '음성인식에 필요한 Microsoft Visual C++ 런타임을 설치합니다 — 관리자 확인 창이 뜨면 "예"를 눌러 주세요'
  $exe = Join-Path $env:TEMP 'poke-vc_redist.x64.exe'
  try {
    Invoke-WebRequest -UseBasicParsing -OutFile $exe 'https://aka.ms/vs/17/release/vc_redist.x64.exe'
    $sig = Get-AuthenticodeSignature $exe
    if ($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
      Write-Host 'Visual C++ 런타임 설치 파일의 서명을 확인할 수 없어요' -ForegroundColor Yellow
      return $false
    }
    $p = Start-Process $exe -ArgumentList '/install', '/quiet', '/norestart' -Verb RunAs -Wait -PassThru
    # 0 성공, 1638 더 새 버전이 이미 있음, 3010 재부팅 필요(DLL은 이미 설치됨)
    if ($p.ExitCode -notin 0, 1638, 3010) { Write-Host "Visual C++ 런타임 설치 실패 (코드 $($p.ExitCode))" -ForegroundColor Yellow }
  } catch {
    Write-Host "Visual C++ 런타임을 설치하지 못했어요 ($($_.Exception.Message))" -ForegroundColor Yellow
  } finally {
    Remove-Item $exe -ErrorAction SilentlyContinue
  }
  return (Test-VcRuntime)
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

  # ---- 3-2) 도감에서 추가할 수 있는 포켓몬 그림 (git 필요, 없어도 기본 포켓몬은 쓸 수 있으므로 실패해도 계속) ----
  if (-not (Test-Path 'assets\dex\index.json')) {
    if (Get-Command git -ErrorAction SilentlyContinue) {
      Write-Host '도감 포켓몬 그림 준비 중 (처음 1회 약 300MB)...'
      & npm run fetch-dex
      if ($LASTEXITCODE -ne 0) { Write-Host '도감 포켓몬 그림을 받지 못했어요 — 기본 포켓몬만 쓸 수 있어요' -ForegroundColor Yellow }
    } else {
      Write-Host 'git이 없어서 도감 포켓몬 그림은 건너뜁니다 (기본 포켓몬만 사용)' -ForegroundColor Yellow
    }
  }

  # ---- 4) 음성인식 (안 되면 텍스트 명령만 쓰면 되므로 실패해도 계속) ----
  $whisperOk = Test-Path 'assets\models\whisper-small\model.bin'
  if (-not $whisperOk) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'setup-whisper.ps1')
    $whisperOk = $LASTEXITCODE -eq 0
  }
  if ($whisperOk -and -not (Test-VcRuntime)) { $whisperOk = Install-VcRuntime }
  if ($whisperOk) {
    # 설치만 되고 못 불러오는 경우(DLL 누락 등)를 여기서 잡는다
    & (Join-Path $Root '.venv\Scripts\python.exe') -I -c 'import faster_whisper' 2>$null
    $whisperOk = $LASTEXITCODE -eq 0
    if (-not $whisperOk) { Write-Host 'Whisper를 불러오지 못했어요' -ForegroundColor Yellow }
  }
  if (-not $whisperOk -and -not (Test-Path 'assets\models\ko.tar.gz')) {
    Write-Host 'Whisper를 쓸 수 없어서 예비용 Vosk 모델을 받습니다' -ForegroundColor Yellow
    & npm run fetch-voice
    if ($LASTEXITCODE -ne 0) { Write-Host '음성 모델을 받지 못했어요 — 텍스트 명령만 쓸 수 있어요' -ForegroundColor Yellow }
  }
} catch {
  Fail $_.Exception.Message
}
exit 0
