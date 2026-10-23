# 화면 객체 스캐너: 표준입력으로 "scan" 한 줄을 받을 때마다 보이는 창/바탕화면 아이콘 목록을 JSON 한 줄로 출력한다.
# 좌표는 물리 픽셀(DPI 인식) 기준이며, Electron 쪽에서 DIP로 변환한다.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

Add-Type -Path (Join-Path $PSScriptRoot 'scanner.cs')
[PokeScan]::InitDpi()
$procNames = @{}

function Get-ProcName([uint32]$procId) {
    if (-not $procNames.ContainsKey($procId)) {
        try { $procNames[$procId] = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch { $procNames[$procId] = '' }
    }
    $procNames[$procId]
}

while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line -or $line -eq 'exit') { break }
    try {
        $wins = foreach ($w in [PokeScan]::Windows()) {
            if ($w.cls -eq 'Progman' -or $w.cls -eq 'Shell_TrayWnd') { continue }
            [pscustomobject]@{ kind = 'window'; name = $w.title; cls = $w.cls; pid = $w.pid; process = (Get-ProcName $w.pid); z = $w.z; x = $w.x; y = $w.y; w = $w.w; h = $w.h }
        }
        $icons = foreach ($i in [PokeScan]::Icons()) {
            [pscustomobject]@{ kind = 'icon'; name = $i.name; x = $i.x; y = $i.y; w = $i.w; h = $i.h }
        }
        $out = [pscustomobject]@{ ok = $true; windows = @($wins); icons = @($icons) }
    } catch {
        $out = [pscustomobject]@{ ok = $false; error = $_.Exception.Message; windows = @(); icons = @() }
    }
    [Console]::Out.WriteLine(($out | ConvertTo-Json -Depth 4 -Compress))
    [Console]::Out.Flush()
}
