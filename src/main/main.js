// 메인 프로세스: 투명 오버레이 창, 트레이, 전역 단축키, 화면 객체 스캐너
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, globalShortcut, session, nativeImage, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { spawn, execFile } = require('node:child_process');
const readline = require('node:readline');
const { pathToFileURL } = require('node:url');
const { Whisper } = require('./whisper.js');

const ROOT = path.resolve(__dirname, '..', '..');
const HOTKEY = 'Control+Alt+Space';

let win = null;
let tray = null;
let config = { party: ['pikachu'], voice: true, sound: true };   // 처음엔 피카츄 한 마리 — 나머지는 파티 창에서 고른다
const configPath = () => path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  // 이름이 poke-action일 때 저장한 설정은 새 폴더에 설정이 없을 때 한 번 가져온다
  const legacy = path.join(app.getPath('appData'), 'poke-action', 'config.json');
  const file = fs.existsSync(configPath()) || !fs.existsSync(legacy) ? configPath() : legacy;
  try { config = { ...config, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { /* 첫 실행 */ }
  if (file === legacy) saveConfig();
}
function saveConfig() {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

// 렌더러를 http://127.0.0.1 로 서빙: 마이크(보안 컨텍스트)와 음성 모델 fetch를 위해
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.gz': 'application/gzip', '.ogg': 'audio/ogg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',   // 사용자가 넣은 그림
};
// 도감 포켓몬 그림은 앱에 들어 있는 것(assets/dex)과 앱에서 받은 것(userData/dex)을 같은 /assets/dex/ 주소로 낸다
const DEX_URL = '/assets/dex/';
const userDex = () => path.join(app.getPath('userData'), 'dex');
let listDownloaded = async () => [];   // src/main/dexdownload.mjs
let downloadDex = async () => 'missing';
let importCreation, deleteCreation;   // src/main/creations.mjs
const userCreations = () => path.join(app.getPath('userData'), 'creations');

// 사용자가 직접 넣는 그림 (이미지 한 장 또는 PMD zip·폴더) → userData/creations/<id>/, /user/<id>/ 로 서빙
ipcMain.handle('creation-pick', async (_e, folder) => {
  const r = await dialog.showOpenDialog(win, folder
    ? { title: 'PMD 스프라이트 폴더 고르기', properties: ['openDirectory'] }
    // 여러 개 고르기: SpriteCollab에서 따로 받은 스프라이트 zip + 초상화 시트(portrait-XXXX.png)를 한 번에
    : { title: '그림 또는 PMD zip 고르기 (초상화 시트와 함께 여러 개 골라도 돼요)', properties: ['openFile', 'multiSelections'], filters: [{ name: '그림 또는 zip', extensions: ['png', 'gif', 'webp', 'jpg', 'jpeg', 'zip'] }] });
  return r.canceled ? null : r.filePaths;
});
// 초상화 시트를 칸별 PNG로 자른다. 비어 있는(완전히 투명한) 칸은 null
function sliceSheet(file, { size, cols, rows }) {
  const img = nativeImage.createFromPath(file);
  const { width, height } = img.getSize();
  const tiles = [];
  for (let i = 0; i < cols * rows; i++) {
    const x = (i % cols) * size, y = Math.floor(i / cols) * size;
    if (x + size > width || y + size > height) { tiles.push(null); continue; }
    const tile = img.crop({ x, y, width: size, height: size });
    const bgra = tile.toBitmap();
    let used = false;
    for (let p = 3; p < bgra.length && !used; p += 4) used = bgra[p] > 0;
    tiles.push(used ? tile.toPNG() : null);
  }
  return tiles;
}

ipcMain.handle('creation-import', async (_e, src) => {
  try { return { ok: true, ...await importCreation(src, userCreations(), { sliceSheet }) }; } catch (e) {
    if (!e.user) console.error('[creation]', e);
    return { ok: false, error: e.user ? e.message : `가져오지 못했어요 (${e.message})` };
  }
});
ipcMain.handle('creation-delete', (_e, id) => deleteCreation(id, userCreations()));

// 앱 안에서 그림 받기: { status: 'ok' | 'missing' | 'error', message }
ipcMain.handle('dex-download', async (_e, dex) => {
  try { return { status: await downloadDex(dex, userDex()) }; } catch (e) { return { status: 'error', message: e.message }; }
});

function sendFile(file, res, onMissing) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { if (onMissing) onMissing(); else { res.writeHead(404); res.end(); } return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Length': st.size });
    fs.createReadStream(file).pipe(res);
  });
}

async function sendDexIndex(res) {
  let bundled = [];
  try { bundled = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'dex', 'index.json'), 'utf8')); } catch { /* 그림 없이 실행 */ }
  const all = [...new Set([...bundled, ...await listDownloaded(userDex())])].sort((a, b) => a - b);
  res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(all));
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.normalize(path.join(ROOT, url));
      if (!file.startsWith(ROOT) || /node_modules[\\/](?!vosk-browser)/.test(path.relative(ROOT, file))) {
        res.writeHead(403); res.end(); return;
      }
      if (url === `${DEX_URL}index.json`) { sendDexIndex(res); return; }
      if (url.startsWith('/user/')) {
        const f = path.normalize(path.join(userCreations(), url.slice('/user/'.length)));
        if (f.startsWith(userCreations() + path.sep)) sendFile(f, res); else { res.writeHead(403); res.end(); }
        return;
      }
      const fallback = url.startsWith(DEX_URL) && path.normalize(path.join(userDex(), url.slice(DEX_URL.length)));
      sendFile(file, res, fallback && fallback.startsWith(userDex()) ? () => sendFile(fallback, res) : null);
    });
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

// ---- 화면 객체 스캐너 (상주 PowerShell) ----
let scanner = null;
const scanQueue = [];
function startScanner() {
  scanner = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'scanner.ps1')], { windowsHide: true });
  readline.createInterface({ input: scanner.stdout }).on('line', (line) => {
    const resolve = scanQueue.shift();
    if (!resolve) return;
    try { resolve(JSON.parse(line)); } catch { resolve({ ok: false, windows: [], icons: [] }); }
  });
  scanner.stderr.on('data', (d) => console.error('[scanner]', d.toString()));
  scanner.on('exit', () => {
    scanner = null;
    while (scanQueue.length) scanQueue.shift()({ ok: false, windows: [], icons: [] });
  });
}
function scanScreen() {
  if (!scanner) startScanner();
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, windows: [], icons: [] }), 8000);
    scanQueue.push((r) => { clearTimeout(timer); resolve(r); });
    scanner.stdin.write('scan\n');
  });
}

function toOverlay(o, area) {
  const r = screen.screenToDipRect(null, { x: o.x, y: o.y, width: o.w, height: o.h });
  return { ...o, x: r.x - area.x, y: r.y - area.y, w: r.width, h: r.height };
}

ipcMain.handle('scan', async () => {
  const area = screen.getPrimaryDisplay().workArea;
  const r = await scanScreen();
  const inArea = (o) => o.x + o.w > 0 && o.y + o.h > 0 && o.x < area.width && o.y < area.height;
  return {
    ok: r.ok,
    error: r.error,
    objects: [
      ...(r.windows || []).filter((w) => w.pid !== process.pid).map((w) => toOverlay(w, area)),
      ...(r.icons || []).map((i) => toOverlay(i, area)),
    ].filter(inArea),
  };
});

// ---- 마이크 진단 (읽기 전용: 장치 상태와 Windows 개인정보 설정만 조회) ----
const MIC_DIAG = `
$ErrorActionPreference='SilentlyContinue'
$cap = @(Get-PnpDevice -Class AudioEndpoint | Where-Object { $_.InstanceId -like 'SWD\\MMDEVAPI\\{0.0.1.*' })
$k = 'CapabilityAccessManager\\ConsentStore\\microphone'
[pscustomobject]@{
  total = $cap.Count
  ok = @($cap | Where-Object { $_.Status -eq 'OK' }).Count
  disabled = @($cap | Where-Object { $_.Problem -eq 'CM_PROB_DISABLED' }).Count
  sys = (Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\$k").Value
  user = (Get-ItemProperty "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\$k").Value
  desktop = (Get-ItemProperty "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\$k\\NonPackaged").Value
} | ConvertTo-Json -Compress`;

ipcMain.handle('mic-diagnose', () => new Promise((resolve) => {
  execFile('powershell.exe', ['-NoProfile', '-Command', `[Console]::OutputEncoding=[Text.Encoding]::UTF8; ${MIC_DIAG}`], { windowsHide: true, timeout: 10000 }, (err, out) => {
    let d;
    try { d = JSON.parse(out); } catch { return resolve(null); }
    const reasons = [];
    let fix = null;
    if (d.sys === 'Deny') { reasons.push('이 PC의 마이크 액세스가 꺼져 있어요(관리자 설정)'); fix = 'privacy'; }
    if (d.user === 'Deny' || d.desktop === 'Deny') { reasons.push('앱/데스크톱 앱의 마이크 액세스가 꺼져 있어요'); fix = fix || 'privacy'; }
    if (!d.total) reasons.push('연결된 마이크가 없어요');
    else if (!d.ok && d.disabled) { reasons.push('마이크 장치가 "사용 안 함" 상태예요'); fix = fix || 'sound'; }
    else if (!d.ok) reasons.push('마이크가 꽂혀 있지 않거나 동작하지 않아요');
    resolve(reasons.length ? { text: reasons.join(' / '), fix } : null);
  });
}));

ipcMain.on('open-mic-settings', (_e, which) => {
  shell.openExternal(which === 'sound' ? 'ms-settings:sound-devices' : 'ms-settings:privacy-microphone');
});

ipcMain.on('mouse-through', (_e, ignore) => {
  if (!win) return;
  if (ignore) win.setIgnoreMouseEvents(true, { forward: true });
  else win.setIgnoreMouseEvents(false);
});
// ---- 오프라인 음성인식 (Faster-Whisper small, CPU INT8 — 상주 파이썬 프로세스) ----
const whisper = new Whisper(ROOT);
ipcMain.handle('stt-info', () => ({ available: whisper.available }));
ipcMain.on('stt-hotwords', (_e, list) => whisper.setHotwords(list));
ipcMain.handle('stt-transcribe', (_e, pcm) => whisper.transcribe(pcm));

ipcMain.handle('get-config', () => config);
ipcMain.on('set-config', (_e, patch) => {
  config = { ...config, ...patch };
  saveConfig();
  buildTrayMenu();
});
ipcMain.on('focus-window', () => { if (win) { win.focus(); } });
ipcMain.on('blur-window', () => { if (win) win.blur(); });

function send(type, payload) { if (win) win.webContents.send('event', { type, payload }); }

// 몬스터볼 우클릭 메뉴와 화면의 종료 버튼
ipcMain.on('show-menu', () => { if (win) Menu.buildFromTemplate(menuTemplate()).popup({ window: win }); });
ipcMain.on('quit', () => app.quit());

function buildTrayMenu() {
  if (tray) tray.setContextMenu(Menu.buildFromTemplate(menuTemplate()));
}

function menuTemplate() {
  return [
    { label: `명령창 열기 (${HOTKEY.replace('Control', 'Ctrl')})`, click: () => { win.focus(); send('toggle-bar', true); } },
    { type: 'separator' },   // 포켓몬 고르기는 명령창의 🎒 파티 버튼 한 곳에서만 한다
    { label: '음성인식', type: 'checkbox', checked: config.voice, click: (item) => { config.voice = item.checked; saveConfig(); send('voice', config.voice); } },
    { label: '울음소리', type: 'checkbox', checked: config.sound, click: (item) => { config.sound = item.checked; saveConfig(); send('sound', config.sound); } },
    { label: '개발자 도구', click: () => win.webContents.openDevTools({ mode: 'detach' }) },
    { type: 'separator' },
    { label: '포켓몬 그라운드 종료', click: () => app.quit() },
  ];
}

async function createWindow() {
  const port = await startServer();
  const { workArea } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    x: workArea.x, y: workArea.y, width: workArea.width, height: workArea.height,
    transparent: true, frame: false, resizable: false, movable: false, hasShadow: false,
    skipTaskbar: true, alwaysOnTop: true, show: false, title: 'PokeGround',
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadURL(`http://127.0.0.1:${port}/src/renderer/index.html`);
  win.once('ready-to-show', () => win.showInactive());
  win.webContents.on('console-message', (e) => {
    if (e.level !== 'debug' && e.level !== 'info') console.log(`[renderer:${e.level}] ${e.message} (${e.sourceId}:${e.lineNumber})`);
  });

  screen.on('display-metrics-changed', () => {
    const a = screen.getPrimaryDisplay().workArea;
    win.setBounds({ x: a.x, y: a.y, width: a.width, height: a.height });
  });

  const icon = nativeImage.createFromPath(path.join(ROOT, 'assets', 'pokemon', 'pikachu', 'portrait', 'Happy.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('포켓몬 그라운드');
  tray.on('click', () => { win.focus(); send('toggle-bar', true); });
  buildTrayMenu();

  globalShortcut.register(HOTKEY, () => { win.focus(); send('toggle-bar'); });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(async () => {
    ({ downloadDex, listDownloaded } = await import(pathToFileURL(path.join(__dirname, 'dexdownload.mjs')).href));
    ({ importCreation, deleteCreation } = await import(pathToFileURL(path.join(__dirname, 'creations.mjs')).href));
    loadConfig();
    session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
    session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === 'media');
    startScanner();
    whisper.start();   // 모델을 미리 올려 두어 첫 명령이 느리지 않게
    createWindow();
  });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    whisper.stop();
    if (scanner) scanner.stdin.write('exit\n');
  });
}
