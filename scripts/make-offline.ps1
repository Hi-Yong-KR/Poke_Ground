# 오프라인 배포판 만들기: 인터넷이 되는 이 PC에서 실행하면, 받는 PC에서 아무것도 내려받지 않고
# 압축만 풀어 start.bat으로 실행되는 dist\PokeGround-offline.zip 을 만든다.
# 풀면 PokeGround\ 안에 start.bat, README.txt(scripts\offline\ 에서 복사)와 app\ 폴더만 보인다.
#   - Electron 본체 (실행에 Node.js는 필요 없다)
#   - 휴대용 파이썬 + faster-whisper (venv는 다른 PC로 옮길 수 없어서 파이썬 자체에 설치)
#   - Visual C++ 런타임 DLL을 python.exe 옆에 둔다 (app-local 배포: 설치·관리자 권한 불필요)
#   - Whisper small 모델, 스프라이트
# 울음소리(게임 원음)는 저작권 때문에 기본으로 빼고, -IncludeCries 를 주면 넣는다.
# 사용법: npm run make-offline   (또는 powershell -File scripts\make-offline.ps1 [-IncludeCries])
# ※ PowerShell 5.1이 한글을 읽으려면 이 파일은 UTF-8 BOM이어야 한다.
param([switch]$IncludeCries)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Root = Split-Path -Parent $PSScriptRoot
$Dist = Join-Path $Root 'dist'
$Stage = Join-Path $Dist 'PokeGround'
$App = Join-Path $Stage 'app'   # 앱 본체 (start.bat이 Electron으로 여는 폴더)
$Zip = Join-Path $Dist 'PokeGround-offline.zip'
$VcDlls = 'msvcp140.dll', 'msvcp140_1.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'   # ctranslate2·onnxruntime이 쓰는 것

function Step([string]$msg) { Write-Host "== $msg" -ForegroundColor Cyan }

# robocopy: 큰 폴더를 빠르게 복사 (종료 코드 8 이상이 실패)
function Copy-Tree([string]$from, [string]$to, [string[]]$exclude = @()) {
  $rc = @($from, $to, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
  if ($exclude.Count) { $rc += '/XF'; $rc += $exclude }
  & robocopy @rc | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "복사 실패: $from" }
}

# 1) 이 PC의 준비물 (Electron, 모델 등) — 없으면 받는다
Step '준비물 확인'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'setup.ps1')
if ($LASTEXITCODE -ne 0) { throw '준비 과정(setup.ps1) 실패' }
foreach ($f in 'node_modules\electron\dist\electron.exe', 'assets\models\whisper-small\model.bin') {
  if (-not (Test-Path (Join-Path $Root $f))) { throw "없음: $f" }
}
foreach ($d in $VcDlls) {
  if (-not (Test-Path (Join-Path $env:SystemRoot "System32\$d"))) { throw "이 PC에 Visual C++ 런타임($d)이 없어요" }
}

Step '이전 결과 지우기'
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
if (Test-Path $Zip) { Remove-Item -Force $Zip }
New-Item -ItemType Directory -Force $Stage | Out-Null

# 2) 휴대용 파이썬 (uv가 받는 python-build-standalone은 폴더째 옮겨도 동작한다)
Step '휴대용 파이썬 준비'
$py = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'setup-whisper.ps1') -Private -PythonOnly | Select-Object -Last 1
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $py)) { throw "휴대용 파이썬을 준비하지 못했어요 (코드 $LASTEXITCODE, 경로 '$py')" }
$PyStage = Join-Path $App 'runtime\python'
Copy-Tree (Split-Path -Parent $py) $PyStage
Remove-Item (Join-Path $PyStage 'Lib\EXTERNALLY-MANAGED') -ErrorAction SilentlyContinue   # uv가 붙인 pip 설치 금지 표시
$StagePy = Join-Path $PyStage 'python.exe'

Step 'faster-whisper 설치 (휴대용 파이썬 안에)'
& $StagePy -I -m pip install --disable-pip-version-check --no-warn-script-location -q faster-whisper
if ($LASTEXITCODE -ne 0) { throw 'faster-whisper 설치 실패' }

Step 'Visual C++ 런타임 DLL 넣기'
foreach ($d in $VcDlls) { Copy-Item (Join-Path $env:SystemRoot "System32\$d") $PyStage -Force }

# 3) 앱
Step '앱 파일 복사'
Copy-Item (Join-Path $Root 'package.json') $App
Copy-Tree (Join-Path $Root 'src') (Join-Path $App 'src') @('*.pyc')
$cries = if ($IncludeCries) { @() } else { @('cry.ogg') }
Copy-Tree (Join-Path $Root 'assets\pokemon') (Join-Path $App 'assets\pokemon') $cries
Copy-Tree (Join-Path $Root 'assets\models\whisper-small') (Join-Path $App 'assets\models\whisper-small')
Remove-Item -Recurse -Force (Join-Path $App 'assets\models\whisper-small\.cache') -ErrorAction SilentlyContinue
Copy-Tree (Join-Path $Root 'node_modules\electron\dist') (Join-Path $App 'node_modules\electron\dist')
Copy-Tree (Join-Path $Root 'node_modules\vosk-browser') (Join-Path $App 'node_modules\vosk-browser')
# 맨 위에는 실행기와 안내문만 (배포판은 설치 과정 없이 바로 실행)
foreach ($f in 'start.bat', 'README.txt') { Copy-Item (Join-Path $PSScriptRoot "offline\$f") $Stage }

# 4) 배포판 파이썬으로 엔진을 실제로 불러와 본다
Step '확인: 배포판에서 Whisper 불러오기'
& $StagePy -I -c 'import faster_whisper, ctranslate2; print(ctranslate2.__version__)'
if ($LASTEXITCODE -ne 0) { throw '배포판 파이썬에서 faster_whisper를 불러오지 못했어요' }

# 파이썬 캐시(__pycache__)는 첫 실행 때 다시 생긴다. 빼면 40MB 줄고, 가장 긴 경로가 짧아져
# 깊은 폴더에 풀 때 Windows 경로 길이 제한(260자)에 덜 걸린다
Get-ChildItem -LiteralPath $App -Recurse -Directory -Filter '__pycache__' | Remove-Item -Recurse -Force

Step '압축 (zip)'
# Windows 내장 bsdtar (PATH에 Git의 GNU tar가 먼저 있으면 E: 를 원격 호스트로 읽는다)
& (Join-Path $env:SystemRoot 'System32\tar.exe') -a -c -f $Zip -C $Dist 'PokeGround'
if ($LASTEXITCODE -ne 0) { throw '압축 실패' }
$mb = [math]::Round((Get-Item $Zip).Length / 1MB)
Write-Host ''
Write-Host "완료: $Zip ($mb MB)" -ForegroundColor Green
Write-Host '받는 PC에서는 압축을 풀고 PokeGround\start.bat 을 실행하면 됩니다 (인터넷 불필요).'
