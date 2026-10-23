// 렌더러 진입점: 포켓몬 관리, 마우스 상호작용, 명령 실행, 음성/텍스트 입력
import { FX } from './fx.mjs';
import { Mon, loadSpecies } from './pokemon.mjs';
import { Voice } from './speech.mjs';
import { parseCommand, resolveTarget } from '../shared/parser.mjs';
import { POKEMON, MOVES, REACTIONS, CLICK_POOL, CANT_TEXT, HIT_TEXT } from '../shared/data.mjs';

const $ = (s) => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const poke = window.poke;

const app = {
  w: innerWidth,
  h: innerHeight,
  stage: $('#stage'),
  fx: new FX($('#fx')),
  mons: [],
  species: {},
  cursor: { x: innerWidth / 2, y: innerHeight / 2 },
  focus: null,
  config: { party: ['pikachu'], voice: true },
  log(text, cls = '') {
    const box = $('#log');
    const d = document.createElement('div');
    d.className = cls; d.textContent = text;
    box.appendChild(d);
    while (box.children.length > 60) box.firstChild.remove();
    box.scrollTop = box.scrollHeight;
  },
};
addEventListener('resize', () => { app.w = innerWidth; app.h = innerHeight; });
app.blocked = () => ($('#bar').classList.contains('collapsed') ? $('#ball') : $('#bar')).getBoundingClientRect();

// ---------- 포켓몬 등장/퇴장 ----------
async function ensureMon(key, { announce = true } = {}) {
  let m = app.mons.find((x) => x.key === key);
  if (!m) {
    if (!app.species[key]) app.species[key] = await loadSpecies(key);
    m = new Mon(app, app.species[key]);
    app.mons.push(m);
    m.hidden = true;
  }
  if (m.hidden) {
    m.hidden = false;
    m.mode = 'auto';
    m.x = Math.max(80, Math.min(app.w - 80, m.x));
    pokeballPop(m);
    if (announce) m.react('greet', { text: '몬스터볼에서 힘차게 튀어나왔다! 반갑다는 뜻 같다' });
    if (!app.config.party.includes(key)) {
      app.config.party = [...app.config.party, key];
      poke.setConfig({ party: app.config.party });
    }
  }
  return m;
}

function pokeballPop(m) {
  const c = m.center;
  app.fx.spawn({ shape: 'ring', x: c.x, y: c.y, color: '#ffffff', size: 6, grow: 260, life: 0.4 });
  app.fx.burst(c.x, c.y, 'normal', 22, 260);
  m.vz = 420;
}

function returnToBall(m, { save = true } = {}) {
  m.cancel();
  const c = m.center;
  app.fx.spawn({ shape: 'ring', x: c.x, y: c.y, color: '#ff4040', size: 70, grow: -200, life: 0.35 });
  app.fx.spawn({ shape: 'text', text: '🔴', x: c.x, y: c.y, size: 26, life: 0.9, vy: -40 });
  m.hidden = true;
  m.mode = 'ball';
  m.bubble.classList.remove('show');
  app.log(`${m.name}: 몬스터볼로 돌아갔다`, 'sys');
  if (save) {
    app.config.party = app.config.party.filter((k) => k !== m.key);
    poke.setConfig({ party: app.config.party });
  }
}

async function syncParty(party) {
  app.config.party = party;
  for (const k of party) await ensureMon(k);
  for (const m of app.mons) if (!party.includes(m.key) && !m.hidden) returnToBall(m, { save: false });
}

// ---------- 마우스: 클릭 통과 전환, 클릭/드래그/쓰다듬기 ----------
let through = true;
function setThrough(v) {
  if (v !== through) { through = v; poke.setMouseThrough(v); }
}
let drag = null;

addEventListener('mousemove', (e) => {
  app.cursor = { x: e.clientX, y: e.clientY };
  if (drag) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const inter = el && el.closest('.interactive');
  setThrough(!inter);
  // 쓰다듬기: 버튼을 누르지 않고 포켓몬 위에서 문지르기
  if (inter && inter.mon && !e.buttons) {
    const m = inter.mon, now = performance.now();
    if (!m.pet || now - m.pet.t0 > 2500) m.pet = { t0: now, dist: 0 };
    m.pet.dist += Math.hypot(e.movementX, e.movementY);
    if (m.pet.dist > 650 && now - (m.lastPet || 0) > 6000 && m.mode !== 'busy') {
      m.lastPet = now; m.pet = null;
      m.react('pet');
    }
  }
});

app.stage.addEventListener('pointerdown', (e) => {
  const hit = e.target.closest('.hit');
  if (!hit || e.button !== 0) return;
  const m = hit.mon;
  drag = { m, sx: e.clientX, sy: e.clientY, ox: m.x - e.clientX, oy: m.y - e.clientY, moved: false };
  hit.setPointerCapture(e.pointerId);
});

addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { m } = drag;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
    drag.moved = true;
    m.cancel();
    m.mode = 'drag';
    m.el.classList.add('dragging');
    const r = REACTIONS.lifted;
    m.say({ emotion: r.emotion, text: r.text });
    m.setAnim(r.anims);
    app.fx.emote(r.fx, m.center.x, m.center.y - 30);
  }
  if (drag.moved) {
    m.x = e.clientX + drag.ox;
    m.y = e.clientY + drag.oy + 40;
    m.z = 40;
  }
});

addEventListener('pointerup', () => {
  if (!drag) return;
  const { m, moved } = drag;
  drag = null;
  app.focus = m;
  if (moved) {
    m.el.classList.remove('dragging');
    m.x = Math.max(40, Math.min(app.w - 40, m.x));
    m.y = Math.max(m.bodyH + 100, Math.min(app.h - 10, m.y));
    m.mode = 'auto';
    m.react('dropped');
  } else {
    onClick(m);
  }
});

function onClick(m) {
  const now = performance.now();
  m.clicks = (m.clicks || []).filter((t) => now - t < 3000);
  m.clicks.push(now);
  if (m.mode === 'sleep') return m.react('wake');
  if (m.clicks.length >= 8) return m.react('cry');
  if (m.clicks.length >= 6) return m.react('angry');
  if (now - (m.lastClick || 0) < 320) { m.lastClick = 0; return m.react('jump'); }   // 더블클릭
  m.lastClick = now;
  m.recent = m.recent || [];
  const key = pick(CLICK_POOL.filter((k) => !m.recent.includes(k)));
  m.recent = [key, ...m.recent].slice(0, 8);
  m.react(key);
}

// ---------- 명령 실행 ----------
async function handleCommand(text, source) {
  app.log(`${source === 'voice' ? '🎤' : '⌨️'} ${text}`, 'me');
  const p = parseCommand(text);
  const visible = app.mons.filter((m) => !m.hidden);

  if (source === 'voice' && !p.pokemon.length && !p.all) {
    app.log('(포켓몬 이름이 들리지 않아 넘어갔어요)', 'dim');
    return;
  }

  // 몬스터볼로 돌려보내기는 이미 나와 있는 포켓몬에만
  if (p.action === 'ball') {
    const list = p.all ? visible : visible.filter((m) => p.pokemon.includes(m.key));
    (list.length ? list : [app.focus].filter(Boolean)).forEach((m) => returnToBall(m));
    return;
  }

  let actors = p.all ? [...visible] : [];
  for (const k of p.pokemon) actors.push(await ensureMon(k, { announce: p.action === 'out' || !p.understood }));
  actors = [...new Set(actors)];
  if (!actors.length) {
    const f = app.focus && !app.focus.hidden ? app.focus : visible[0];
    if (!f) { app.log('화면에 포켓몬이 없어요. "피카츄 나와"라고 불러 보세요', 'sys'); return; }
    actors = [f];
  }
  app.focus = actors[0];

  if (!p.understood) {
    const key = p.pokemon.length && !p.targetWords.length && p.targetKey == null ? 'called' : 'confused';
    actors.forEach((m) => m.react(key));
    return;
  }
  if (p.move || p.attack) return doAttack(actors, p);
  actors.forEach((m) => doAction(m, p.action));
}

function doAction(m, action) {
  const cur = app.cursor;
  const simple = {
    sit: 'sit', sleep: 'sleep', wake: 'wake', jump: 'jump', dance: 'dance', spin: 'spin', eat: 'eat',
    praise: 'praised', scold: 'scolded', greet: 'greet', stop: 'stop', pose: 'pose',
  };
  if (simple[action]) return m.react(simple[action]);
  switch (action) {
    case 'out':
      return;   // ensureMon에서 이미 등장 처리
    case 'play':
      return m.react(pick(['tickle', 'hop', 'spin', 'dance']), { text: '놀자는 말에 신이 났다! 같이 놀자는 뜻 같다' });
    case 'come':
      return m.run(async () => {
        m.say({ emotion: 'Happy', text: REACTIONS.come.text });
        await m.walkTo(cur.x + rand(-70, 70), cur.y + 70, m.def.speed * 3);
        m.face(app.cursor.x, app.cursor.y);
        app.fx.emote('hearts', m.center.x, m.center.y - 30);
        await m.playOnce(['Hop', 'Idle'], { times: 2 });
      });
    case 'follow':
      return m.run(async () => {
        m.say({ emotion: 'Happy', text: REACTIONS.follow.text });
        const end = performance.now() + 12000, off = rand(-60, 60);
        while (performance.now() < end) {
          const tx = app.cursor.x + off, ty = app.cursor.y + 70;
          const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
          if (d < 30) { m.setAnim('Idle'); await m.wait(150); continue; }
          const k = Math.min(1, 90 / d);
          await m.walkTo(m.x + dx * k, m.y + dy * k, m.def.speed * 3);
        }
      });
    case 'run':
      return m.run(async () => {
        m.say({ emotion: 'Joyous', text: '신나게 뛰어다닌다! 산책이 좋은가 보다' });
        for (let i = 0; i < 4; i++) await m.walkTo(rand(80, app.w - 80), rand(app.h * 0.3, app.h - 30), m.def.speed * 3);
      });
    default:
      return m.react('confused');
  }
}

const PROCESS_LABEL = {
  explorer: '파일 탐색기', chrome: '크롬', msedge: '엣지', claude: 'Claude', code: 'VS Code', notepad: '메모장',
  kakaotalk: '카카오톡', hwp: '한글', winword: '워드', excel: '엑셀', powerpnt: '파워포인트', windowsterminal: '터미널',
};
const SUPER = { electric: ['water', 'flying'], fire: ['grass', 'steel'], water: ['fire'], grass: ['water'] };
const WEAK = { electric: ['grass', 'electric'], fire: ['water', 'fire'], water: ['grass', 'water'], grass: ['fire', 'grass'] };

function clipRect(r) {
  const x = Math.max(0, r.x), y = Math.max(0, r.y);
  return { x, y, w: Math.max(20, Math.min(app.w, r.x + r.w) - x), h: Math.max(20, Math.min(app.h, r.y + r.h) - y) };
}

async function doAttack(actors, p) {
  let target = null;
  const wantsObject = p.targetKey != null || p.targetWords.length > 0;
  if (p.targetPokemon) {
    const tm = await ensureMon(p.targetPokemon, { announce: false });
    target = { kind: 'pokemon', mon: tm, name: tm.name };
  } else if (wantsObject) {
    app.log('🔍 화면을 살펴보는 중...', 'dim');
    const scan = await poke.scan();
    const o = scan.ok ? resolveTarget(p, scan.objects) : null;
    if (o) {
      const app_ = o.kind === 'window' && PROCESS_LABEL[(o.process || '').toLowerCase()];
      target = { kind: o.kind, name: app_ && !o.name.includes(app_) ? `${app_} · ${o.name}` : o.name, rect: clipRect(o) };
    }
    else {
      const word = p.targetWords[0] || '그것';
      actors.forEach((m) => m.react('lookaround', { text: `'${word}'이(가) 화면에 안 보여서 두리번거린다` }));
      if (!scan.ok) app.log(`화면 인식 실패: ${scan.error || '알 수 없음'}`, 'dim');
      return;
    }
  } else if (p.cursor) {
    const c = app.cursor;
    target = { kind: 'cursor', name: '마우스 커서', rect: { x: c.x - 30, y: c.y - 30, w: 60, h: 60 } };
  }

  let box = null;
  if (target && target.rect) {
    box = document.createElement('div');
    box.className = 'target-box';
    Object.assign(box.style, { left: target.rect.x + 'px', top: target.rect.y + 'px', width: target.rect.w + 'px', height: target.rect.h + 'px' });
    const label = target.name.length > 26 ? target.name.slice(0, 25) + '…' : target.name;
    box.innerHTML = `<span>🎯 ${label.replace(/</g, '&lt;')} ${target.kind === 'icon' ? '(아이콘)' : target.kind === 'window' ? '(창)' : ''}</span>`;
    $('#targets').appendChild(box);
    // 라벨이 화면 밖으로 나가지 않게 보정
    const span = box.querySelector('span'), sr = span.getBoundingClientRect();
    const dx = Math.max(8 - sr.left, 0) - Math.max(sr.right - (app.w - 8), 0);
    if (dx) span.style.marginLeft = dx + 'px';
    if (sr.top < 4) span.style.top = '6px';
  }

  await Promise.all(actors.map((m, i) => new Promise((res) => setTimeout(() => attack(m, p, target, box).then(res), i * 450))));
  if (box) setTimeout(() => box.remove(), 600);
}

function aimOf(m, target) {
  if (!target) {
    const a = (m.dir * Math.PI) / 4;
    const x = Math.max(60, Math.min(app.w - 60, m.center.x + Math.cos(a) * 280));
    const y = Math.max(60, Math.min(app.h - 60, m.center.y + Math.sin(a) * 200));
    return { x, y, rect: null };
  }
  if (target.mon) { const c = target.mon.center; return { x: c.x, y: c.y, rect: { x: c.x - 40, y: c.y - 40, w: 80, h: 80 } }; }
  const r = target.rect;
  return { x: r.x + r.w / 2, y: r.y + r.h / 2, rect: r };
}

function attack(m, p, target, box) {
  let moveId = p.move;
  if (!moveId) {
    const usable = m.def.moves.filter((id) => !MOVES[id].self);
    moveId = Math.random() < 0.6 ? m.def.signature : pick(usable);
  }
  const mv = MOVES[moveId];
  const can = m.def.moves.includes(moveId) || mv.type === m.def.type || (mv.type === 'normal' && !mv.self);
  if (!can) return m.react('cant', { text: `${mv.name}?! ${CANT_TEXT[mv.type] || CANT_TEXT.normal}` });

  if (mv.self) {
    return m.run(async () => {
      m.say({ emotion: 'Joyous', text: `${mv.name}! ${moveId === 'withdraw' ? '등껍질 속에 쏙 숨었다. 무서운 건 아닌 것 같다' : '꼬리를 귀엽게 흔들어 상대의 방어를 낮추려 한다'}` });
      await m.playOnce(mv.anims, { times: 2 });
    });
  }

  return m.run(async () => {
    const tname = target ? target.name.slice(0, 20) : null;
    m.say({ emotion: 'Determined', text: target ? `${tname}에게 ${mv.name}! 의욕이 넘친다` : `${mv.name}! 일단 허공에 기술을 써 본다` });
    let aim = aimOf(m, target);

    if (mv.melee) {
      const side = m.x < aim.x ? -1 : 1;
      const r = aim.rect;
      const edgeX = r ? (side < 0 ? Math.max(r.x - 10, aim.x - 260) : Math.min(r.x + r.w + 10, aim.x + 260)) : aim.x;
      await m.walkTo(edgeX + side * m.bodyW * 0.3, aim.y + m.bodyH * 0.3, m.def.speed * 4.5);
    } else {
      const c = m.center, d = Math.hypot(aim.x - c.x, aim.y - c.y);
      if (d > 520) {
        const k = (d - 420) / d;
        await m.walkTo(m.x + (aim.x - c.x) * k, m.y + (aim.y - c.y) * k, m.def.speed * 3.5);
      }
    }
    aim = aimOf(m, target);
    m.face(aim.x, aim.y);

    const from = m.center;
    await Promise.all([
      m.playOnce(mv.anims, { times: mv.melee ? 1 : 2 }),
      app.fx.move(mv.fx, mv.type, from, aim, aim.rect, () => onHit(m, mv, target, aim, box)),
    ]);
    await m.wait(250);
    const r = REACTIONS.proud;
    app.fx.emote(r.fx, m.center.x, m.center.y - 30);
    m.say({ emotion: r.emotion, text: target ? r.text : '허공에 기술을 날리고 뿌듯해한다' });
    await m.playOnce(r.anims);
  });
}

function onHit(attacker, mv, target, aim, box) {
  if (box) { box.classList.add('shake'); setTimeout(() => box.classList.remove('shake'), 650); }
  if (!target) return;
  let text = pick(HIT_TEXT);
  if (target.mon) {
    const tt = target.mon.def.type;
    if ((SUPER[mv.type] || []).includes(tt)) text = '효과는 굉장했다!';
    else if ((WEAK[mv.type] || []).includes(tt)) text = '효과가 별로인 듯하다...';
    target.mon.react('hurt', { text: `${attacker.name}의 ${mv.name}에 맞았다! 억울한 눈빛으로 쳐다본다` });
  }
  const el = document.createElement('div');
  el.className = 'hit-text';
  el.textContent = text;
  const top = aim.rect ? Math.max(40, aim.rect.y + Math.min(aim.rect.h, 300) * 0.3) : aim.y;
  Object.assign(el.style, { left: aim.x + 'px', top: top + 'px' });
  $('#targets').appendChild(el);
  setTimeout(() => el.remove(), 1700);
  app.log(`💥 ${attacker.name}의 ${mv.name} → ${target.name.slice(0, 30)}  ${text}`, 'sys');
}

// ---------- 명령창 & 음성 (텍스트 우선) ----------
const input = $('#cmd');
const bar = $('#bar');
let pendingVoice = null;
let lastTextAt = 0;

function setBar(open) {
  bar.classList.toggle('collapsed', !open);
  if (open) setTimeout(() => input.focus(), 30);
  else { input.blur(); poke.blur(); }
}
$('#ball').addEventListener('click', () => setBar(bar.classList.contains('collapsed')));
input.addEventListener('keydown', (e) => { if (e.key === 'Escape') setBar(false); });

function cancelPendingVoice(reason) {
  if (!pendingVoice) return;
  clearTimeout(pendingVoice.timer);
  app.log(`🎤 "${pendingVoice.text}" — ${reason}`, 'dim');
  pendingVoice = null;
  $('#partial').textContent = '';
}

input.addEventListener('input', () => {
  if (input.value.trim()) cancelPendingVoice('텍스트를 입력하기 시작해서 취소 (텍스트 우선)');
});

$('#cmd-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = input.value.trim();
  if (!t) return;
  cancelPendingVoice('텍스트 명령이 우선이라 취소');
  lastTextAt = performance.now();
  input.value = '';
  if (/^(종료|앱\s*종료|프로그램\s*종료|끝내기|exit|quit)$/i.test(t)) return quitApp();   // 텍스트로만 종료 (음성 오인식 방지)
  handleCommand(t, 'text');
});

const voice = new Voice({
  onResult(t) {
    if (input.value.trim()) { app.log(`🎤 "${t}" — 텍스트 입력 중이라 무시 (텍스트 우선)`, 'dim'); return; }
    if (performance.now() - lastTextAt < 2500) { app.log(`🎤 "${t}" — 방금 텍스트 명령이 있어 무시 (텍스트 우선)`, 'dim'); return; }
    if (pendingVoice) clearTimeout(pendingVoice.timer);
    $('#partial').textContent = `"${t}"`;
    // 잠깐 기다렸다 실행: 그 사이 텍스트가 들어오면 텍스트가 이긴다
    pendingVoice = { text: t, timer: setTimeout(() => { pendingVoice = null; $('#partial').textContent = ''; handleCommand(t, 'voice'); }, 900) };
  },
  onRejected(t, reason) {
    app.log(`🎤 (명령 아님: ${reason}) ${t.length > 30 ? t.slice(0, 30) + '…' : t}`, 'dim');
  },
  onPartial(t) { if (!pendingVoice) $('#partial').textContent = t ? `${t}…` : ''; },
  diagnose: () => poke.diagnoseMic(),
  onStatus(state, text, fix) {
    $('#mic-dot').className = state;
    $('#voice-status').textContent = text;
    $('#mic-fix').hidden = !fix;
    $('#mic-fix').dataset.fix = fix || '';
    if (state !== app.lastVoiceState || text !== app.lastVoiceText) app.log(`🎤 ${text}`, 'dim');
    app.lastVoiceState = state; app.lastVoiceText = text;
    $('#ball').classList.toggle('listening', state === 'on');
    $('#mic-btn').classList.toggle('muted', state !== 'on' && state !== 'loading');
  },
});

// 화면에 보이는 창/아이콘 이름도 음성 문법에 넣어 "휴지통" 같은 대상을 알아듣게 한다
async function startVoice() {
  let extra = [];
  try { extra = (await poke.scan()).objects.flatMap((o) => (o.name || '').split(/[\s\-_.()[\]]+/)); } catch { /* 스캔 실패 시 기본 단어만 */ }
  voice.start(extra);
}

// ---- 종료 / 메뉴 ----
function quitApp() {
  app.log('모두 몬스터볼로 돌아가는 중... 안녕! 👋', 'sys');
  app.mons.filter((m) => !m.hidden).forEach((m) => returnToBall(m, { save: false }));
  setTimeout(() => poke.quit(), 800);
}

const quitBtn = $('#quit-btn');
quitBtn.addEventListener('click', () => {
  // 실수로 누르는 것을 막기 위해 한 번 더 눌러야 종료
  if (quitBtn.classList.contains('confirm')) return quitApp();
  quitBtn.classList.add('confirm');
  quitBtn.textContent = '정말 종료?';
  clearTimeout(quitBtn.timer);
  quitBtn.timer = setTimeout(() => { quitBtn.classList.remove('confirm'); quitBtn.textContent = '✕ 종료'; }, 3000);
});
$('#menu-btn').addEventListener('click', () => poke.showMenu());
$('#ball').addEventListener('contextmenu', (e) => { e.preventDefault(); poke.showMenu(); });

$('#mic-fix').addEventListener('click', (e) => poke.openMicSettings(e.currentTarget.dataset.fix));

$('#mic-btn').addEventListener('click', () => {
  if (voice.enabled) { voice.stop(); poke.setConfig({ voice: false }); }
  else { startVoice(); poke.setConfig({ voice: true }); }
});

poke.onEvent(({ type, payload }) => {
  if (type === 'toggle-bar') setBar(payload === true ? true : bar.classList.contains('collapsed'));
  else if (type === 'party') syncParty(payload);
  else if (type === 'voice') (payload ? startVoice() : voice.stop());
  else if (type === 'summon') Object.keys(POKEMON).forEach((k) => ensureMon(k));
});

// ---------- 메인 루프 ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (const m of app.mons) { m.update(dt); m.render(); }
  app.fx.update(dt);
  app.fx.draw();
  requestAnimationFrame(frame);
}

(async function init() {
  app.config = await poke.getConfig();
  for (const k of app.config.party) await ensureMon(k);
  app.log('포켓몬을 클릭·드래그·쓰다듬어 보세요! 명령 예) "피카츄 크롬 10만볼트"', 'sys');
  requestAnimationFrame(frame);
  if (app.config.voice) startVoice();
  else voice.stop();
  Object.assign(window, { app, handleCommand, voice });   // 개발자 도구에서 확인용
})();
