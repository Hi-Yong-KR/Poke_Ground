# 음성인식(Faster-Whisper) 설치 진입점: 쓸 수 있는 파이썬을 찾아 setup-whisper.py 를 실행한다.
# 파이썬이 없으면 uv로 이 폴더의 .python 안에만 파이썬을 받아 쓴다 (관리자 권한 필요 없음, 시스템은 그대로).
# 사용법: npm run fetch-whisper   (-Private: 시스템 파이썬이 있어도 개인 파이썬을 쓴다)
# ※ PowerShell 5.1이 한글을 읽으려면 이 파일은 UTF-8 BOM이어야 한다.
param([switch]$Private)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # 5.1의 진행 표시줄은 다운로드를 크게 느리게 한다

$Root = Split-Path -Parent $PSScriptRoot
$PyDir = Join-Path $Root '.python'
$UvVersion = '0.12.24'
$UvSha256 = '7C38608C8A18EE137D748A1773053B07EC8F3A30FAB49AEBAA6F4E4EFECEB019'
$PyVersion = '3.12'

# 3.9 이상인지 실제로 실행해 본다 (WindowsApps의 python.exe는 스토어 안내만 하는 가짜라 여기서 걸러진다)
function Test-Python([string]$exe, [string[]]$pre = @()) {
  try {
    & $exe @pre -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  } catch { return $false }
}

function Get-PrivatePython {
  $env:UV_PYTHON_INSTALL_DIR = $PyDir
  $env:UV_PYTHON_BIN_DIR = Join-Path $PyDir 'bin'   # python3.12.exe 바로가기도 사용자 폴더 대신 여기에
  $env:UV_CACHE_DIR = Join-Path $PyDir 'cache'
  $uv = Join-Path $PyDir 'uv.exe'
  if (-not (Test-Path $uv)) {
    Write-Host "파이썬이 없어서 이 폴더 안에만 따로 받습니다 (uv $UvVersion)"
    New-Item -ItemType Directory -Force $PyDir | Out-Null
    $zip = Join-Path $PyDir 'uv.zip'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -OutFile $zip "https://github.com/astral-sh/uv/releases/download/$UvVersion/uv-x86_64-pc-windows-msvc.zip"
    if ((Get-FileHash $zip -Algorithm SHA256).Hash -ne $UvSha256) {
      Remove-Item $zip
      throw 'uv 다운로드 파일의 체크섬이 맞지 않아요'
    }
    Expand-Archive $zip -DestinationPath $PyDir -Force
    Remove-Item $zip
  }
  & $uv python install $PyVersion --no-bin
  if ($LASTEXITCODE -ne 0) { throw "파이썬 $PyVersion 설치 실패" }
  $py = (& $uv python find $PyVersion --managed-python | Select-Object -First 1)
  if ($LASTEXITCODE -ne 0 -or -not $py) { throw '설치한 파이썬을 찾지 못했어요' }
  return $py.Trim()
}

$venvPy = Join-Path $Root '.venv\Scripts\python.exe'
if (Test-Python $venvPy) { $py = $venvPy; $pre = @() }   # 이미 설치돼 있으면 그대로 사용
elseif (-not $Private -and (Test-Python 'python')) { $py = 'python'; $pre = @() }
elseif (-not $Private -and (Test-Python 'py' @('-3'))) { $py = 'py'; $pre = @('-3') }
else { $py = Get-PrivatePython; $pre = @() }

Write-Host "파이썬: $py $pre"
& $py @pre -I (Join-Path $PSScriptRoot 'setup-whisper.py')
exit $LASTEXITCODE
