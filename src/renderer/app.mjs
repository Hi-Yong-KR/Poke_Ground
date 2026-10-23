// 렌더러 진입점: 포켓몬 관리, 마우스 상호작용, 명령 실행, 음성/텍스트 입력
import { FX } from './fx.mjs';
import { Mon, loadSpecies, CRY_VOLUME } from './pokemon.mjs';
import { Voice } from './speech.mjs';
import { parseCommand, resolveTarget, aliasTaken } from '../shared/parser.mjs';
import { POKEMON, MOVES, REACTIONS, CLICK_POOL, CANT_TEXT, HIT_TEXT, SUPER, WEAK } from '../shared/data.mjs';
import { DEX, TYPE_KO, applyCustom, searchDex, customKey, dexAssets, creationKey, builtinKeyOf } from '../shared/dex.mjs';

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
let bulk = false;   // 여러 마리를 한꺼번에 내보내거나(시작할 때) 들여보내는(전부 들여보내기) 중: 한 마리마다 저장·다시 그리기·기록을 하지 않는다

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
      if (!bulk) {
        poke.setConfig({ party: app.config.party });
        renderParty();   // 음성·텍스트 명령으로 불러내도 파티 창이 따라간다
      }
    }
  }
  return m;
}

/**
 * 여러 마리를 한꺼번에 내보낸다: 그림은 8마리씩 함께 불러오고 불러온 것부터 나온다. 인사·설정 저장·파티 창 다시 그리기는
 * 한 마리마다 하지 않는다(부른 쪽이 끝에 한 번). 나온 수를 돌려준다
 */
async function summonMany(keys, onProgress = () => {}) {
  const was = bulk;
  bulk = true;
  let next = 0, count = 0;
  const worker = async () => {
    while (next < keys.length) {
      const k = keys[next++];
      try { await ensureMon(k, { announce: false }); count++; } catch (e) { console.warn('[summon]', k, e.message); }
      onProgress(count, keys.length);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  bulk = was;
  return count;
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
  if (!bulk) app.log(`${m.name}: 몬스터볼로 돌아갔다`, 'sys');
  if (save) {
    app.config.party = app.config.party.filter((k) => k !== m.key);
    if (!bulk) {
      poke.setConfig({ party: app.config.party });
      renderParty();
    }
  }
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
      m.say({ emotion: 'Joyous', text: `${mv.name}! ${mv.selfText}` });
      app.fx.emote('sparkles', m.center.x, m.center.y - 30, m.def.type);
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
  stt: poke.stt,
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

// ---- 입력/출력 장치 선택 ----
// deviceId는 실행마다 바뀌는 로컬 서버 주소(origin)에 묶여 있어서, 장치 이름으로 저장하고 실행할 때 id를 다시 찾는다
function fillDevices(sel, devs, savedLabel) {
  const el = $(sel);
  el.innerHTML = '';
  el.append(new Option('Windows 기본 장치', ''));
  devs.filter((d) => d.deviceId !== 'default' && d.deviceId !== 'communications')
    .forEach((d, i) => el.append(new Option(d.label || `장치 ${i + 1}`, d.deviceId)));
  const match = [...el.options].find((o) => o.value && o.text === savedLabel);
  el.value = match ? match.value : '';
}

async function refreshDevices() {
  let list = [];
  try { list = await navigator.mediaDevices.enumerateDevices(); } catch { /* 장치 조회 불가 */ }
  fillDevices('#mic-sel', list.filter((d) => d.kind === 'audioinput'), app.config.micLabel);
  fillDevices('#spk-sel', list.filter((d) => d.kind === 'audiooutput'), app.config.speakerLabel);
  app.speakerId = $('#spk-sel').value;
  return $('#mic-sel').value;
}
navigator.mediaDevices.addEventListener('devicechange', refreshDevices);

function testCry() {
  const m = (app.focus && !app.focus.hidden) ? app.focus : app.mons.find((x) => !x.hidden);
  if (m) { m.playCry('Happy', { force: true }); app.fx.emote('notes', m.center.x, m.center.y - 30); }
}

// ---- 명령창 위쪽 창(파티·＋ 포켓몬·장치)은 한 번에 하나만 연다 ----
const PANELS = { party: ['#party', '#party-btn'], dex: ['#dex', '#dex-btn'], dev: ['#devices', '#dev-btn'] };
/** name 창을 열거나(open) 닫고 나머지는 닫는다. 열렸으면 true */
function openPanel(name, open = $(PANELS[name][0]).hidden) {
  for (const [k, [box, btn]] of Object.entries(PANELS)) {
    const show = k === name && open;
    $(box).hidden = !show;
    $(btn).classList.toggle('on', show);
  }
  return open;
}

$('#dev-btn').addEventListener('click', () => {
  if (openPanel('dev')) { refreshDevices(); refreshSttInfo(); showVolume(); }
});
$('#mic-sel').addEventListener('change', (e) => {
  const o = e.target.selectedOptions[0];
  app.config.micLabel = o.value ? o.text : '';
  poke.setConfig({ micLabel: app.config.micLabel });
  app.log(`🎤 입력 장치: ${o.text}`, 'sys');
  voice.setDevice(o.value);
});
$('#spk-sel').addEventListener('change', (e) => {
  const o = e.target.selectedOptions[0];
  app.speakerId = o.value;
  app.config.speakerLabel = o.value ? o.text : '';
  poke.setConfig({ speakerLabel: app.config.speakerLabel });
  app.log(`🔊 출력 장치: ${o.text}`, 'sys');
  testCry();
});
$('#spk-test').addEventListener('click', testCry);

// ---- 울음소리 볼륨 (config.volume 0~1) — 끌면 바로 바뀌고, 손을 떼면 저장하고 한 번 울려 본다 ----
const showVolume = () => {
  const v = Math.round((app.config.volume ?? CRY_VOLUME) * 100);
  $('#vol').value = v;
  $('#vol-val').textContent = `${v}%`;
};
$('#vol').addEventListener('input', (e) => {
  app.config.volume = e.target.value / 100;
  $('#vol-val').textContent = `${e.target.value}%`;
});
$('#vol').addEventListener('change', () => {
  poke.setConfig({ volume: app.config.volume });
  testCry();
});

// ---- 지금 쓰는 음성인식 엔진 표시 ----
async function refreshSttInfo() {
  const info = await poke.stt.info();
  $('#stt-engine').textContent = voice.engine === 'whisper' ? 'Faster-Whisper small (오프라인, CPU INT8)'
    : voice.engine === 'vosk' ? `Vosk 소형 모델${info.available ? '' : ' — npm run fetch-whisper 로 Whisper 설치하면 더 정확해요'}`
      : '꺼짐';
}

// ---- 도감 검색: 그림은 assets/dex(배포판에 미리 들어 있음), 한 번 부른 포켓몬은 config.custom 에 도감 번호로 저장 ----
// 배포판에 그림이 없던 포켓몬은 [받아서 내보내기]로 SpriteCollab에서 그때 받는다 (메인 프로세스가 userData/dex 에 저장)
let dexReady = null;   // 그림이 준비된 도감 번호들 (assets/dex/index.json — 메인이 받아 둔 것까지 합쳐 준다)
let dexHave = [];      // 마지막으로 읽은 그 목록(번호순) — 파티 창이 기다리지 않고 바로 그린다
function dexAvailable() {
  dexReady ||= fetch('/assets/dex/index.json').then((r) => (r.ok ? r.json() : [])).catch(() => [])
    .then((l) => { dexHave = [...new Set(l)].sort((a, b) => a - b); return new Set(l); });
  return dexReady;
}

function dexNote(text) {
  const d = document.createElement('div');
  d.className = 'dex-empty'; d.textContent = text;
  return d;
}

/** e: { dex, ko, types, builtin? } — 직접 그림을 넣은 포켓몬은 imgSrc로 그 그림을 보여 준다 */
function dexRow(e, button, imgSrc = null) {
  const row = document.createElement('div');
  row.className = 'dex-row';
  const img = new Image();
  img.alt = '';
  img.src = imgSrc || (e.builtin ? `/assets/pokemon/${e.builtin}/portrait/Normal.png` : `${dexAssets(e.dex)}portrait/Normal.png`);
  img.onerror = () => { img.style.visibility = 'hidden'; };
  const nm = document.createElement('div');
  nm.className = 'nm';
  const ty = document.createElement('span');
  ty.className = 'ty';
  ty.textContent = e.types.map((t) => TYPE_KO[t] || t).join('·');
  nm.append(`${e.dex ? `#${String(e.dex).padStart(3, '0')}` : '★'} ${e.ko}  `, ty);
  row.append(img, nm, button);
  return row;
}

function dexButton(text, onClick, cls = '') {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = text; b.className = cls;
  if (onClick) b.addEventListener('click', onClick); else b.disabled = true;
  return b;
}

async function renderDex() {
  const avail = await dexAvailable();
  const box = $('#dex-results');
  box.replaceChildren();
  const q = $('#dex-q').value;
  if (q.trim()) {
    const hits = searchDex(q, 6);
    if (!hits.length) box.append(dexNote('찾는 포켓몬이 없어요'));
    for (const e of hits) {
      const key = e.builtin || customKey(e.dex);
      const b = app.mons.some((m) => m.key === key && !m.hidden) ? dexButton('나와 있음')
        : e.builtin || avail.has(e.dex) ? dexButton('내보내기', () => addDex(e.dex))
          : dexButton('받아서 내보내기', (ev) => downloadDex(e, ev.currentTarget));
      box.append(dexRow(e, b));
    }
  }
  const mine = $('#dex-mine');   // 직접 그림을 넣어 만든 포켓몬만 따로 지울 수 있다 (도감 포켓몬은 파티 창에서 넣고 뺀다)
  mine.replaceChildren();
  const made = app.config.creations || [];
  if (!made.length) mine.append(dexNote('아직 없어요 — 위에서 그림을 골라 만들어 보세요'));
  for (const c of made) {
    mine.append(dexRow({ dex: c.dex, ko: c.name, types: [c.type] }, dexButton('삭제', () => removeCreation(c), 'del'), `/user/${c.id}/portrait/Normal.png`));
  }
}

async function downloadDex(e, button) {
  button.disabled = true;
  button.textContent = '받는 중…';
  const r = await poke.dexDownload(e.dex);
  if (r.status === 'ok') {
    dexReady = null;   // 받은 것까지 다시 읽는다
    await addDex(e.dex);
    return;
  }
  app.log(r.status === 'missing'
    ? `${e.ko}: 아직 SpriteCollab에 쓸 수 있는 그림이 없어요. 그림이 생기면 다시 시도해 보세요`
    : `${e.ko}: 그림을 받지 못했어요 — 인터넷 연결을 확인해 주세요 (${r.message})`, 'sys');
  renderDex();
}

/** 도감 번호로 포켓몬을 내보낸다. 처음 부르는 포켓몬은 config.custom 에 등록해 이름으로도 부를 수 있게 한다 */
async function addDex(dex, { announce = true } = {}) {
  registerDex([dex]);
  await ensureMon(builtinKeyOf(dex) || customKey(dex), { announce });   // 바로 화면에 등장하고 파티에도 들어간다
  renderDex();
}

/** 아직 등록 안 된 도감 포켓몬을 등록한다 (여러 마리면 한 번에: 별칭 표·음성 단어를 한 번만 다시 만든다) */
function registerDex(list) {
  const add = list.filter((d) => !builtinKeyOf(d) && !POKEMON[customKey(d)]);
  if (!add.length) return;
  app.config.custom = [...new Set([...(app.config.custom || []), ...add])];
  applyCustom(app.config.custom, app.config.creations);
  poke.setConfig({ custom: app.config.custom });
  voice.refreshWords();
}

/** 화면에서 지우고 파티에서 뺀다 (직접 넣은 포켓몬을 지울 때) */
function dropMon(key) {
  const m = app.mons.find((x) => x.key === key);
  if (m) {
    m.cancel();
    m.el.remove();
    app.mons = app.mons.filter((x) => x !== m);
    if (app.focus === m) app.focus = null;
  }
  delete app.species[key];
  app.config.party = app.config.party.filter((k) => k !== key);
}

function removeCreation(c) {
  dropMon(creationKey(c.id));
  app.config.creations = (app.config.creations || []).filter((x) => x.id !== c.id);
  applyCustom(app.config.custom, app.config.creations);
  poke.setConfig({ creations: app.config.creations, party: app.config.party });
  poke.creationDelete(c.id);   // 앱이 복사해 둔 그림만 지운다 (원본 파일은 그대로)
  voice.refreshWords();
  app.log(`－ ${c.name} — 떠나보냈다`, 'sys');
  renderDex();
}

// ---- 내 그림으로 추가: 이미지 한 장 또는 PMD 형식 zip·폴더. 메인이 userData/creations 에 복사해 둔다 ----
let makeSrc = null;   // 고른 파일·폴더 경로 배열
let makeDex = null;   // 이름이 도감 이름과 같으면 그 포켓몬으로 본다 (영어 이름 별칭, 기본 타입)
for (const [k, v] of Object.entries(TYPE_KO)) $('#make-type').append(new Option(v, k));
$('#make-type').value = 'normal';

function makeCheck() {
  const name = $('#make-name').value.trim();
  const e = [...DEX.values()].find((x) => x.ko === name);
  if (e && e.dex !== makeDex) $('#make-type').value = e.types[0];
  makeDex = e ? e.dex : null;
  const msg = name && aliasTaken(name) ? '이미 쓰는 이름이에요 (다른 포켓몬·기술·명령어와 겹쳐요)' : '';
  $('#make-msg').textContent = msg;
  $('#make-add').disabled = !makeSrc || !name || !!msg;
}

async function makePick(folder) {
  const picked = await poke.creationPick(folder);   // 경로 배열 (파일은 여러 개 고를 수 있다)
  if (picked && picked.length) {
    makeSrc = picked;
    const first = picked[0].split(/[\\/]/).pop();
    $('#make-src').textContent = picked.length > 1 ? `${first} 외 ${picked.length - 1}개` : first;
    $('#make-src').title = picked.join('\n');
  }
  makeCheck();
}

async function makeAdd() {
  const btn = $('#make-add');
  btn.disabled = true;
  btn.textContent = '가져오는 중…';
  const r = await poke.creationImport(makeSrc);
  btn.textContent = '추가';
  if (!r.ok) { makeCheck(); $('#make-msg').textContent = r.error; return; }
  const c = { id: r.id, kind: r.kind, scale: r.scale, name: $('#make-name').value.trim(), type: $('#make-type').value, dex: makeDex };
  app.config.creations = [...(app.config.creations || []), c];
  applyCustom(app.config.custom, app.config.creations);
  poke.setConfig({ creations: app.config.creations });
  voice.refreshWords();
  await ensureMon(creationKey(c.id));
  app.log(`＋ ${c.name} — 내 그림으로 새 친구가 왔다! 이름을 불러 명령해 보세요`, 'sys');
  makeSrc = null; makeDex = null;
  $('#make-name').value = '';
  $('#make-src').textContent = '그림 한 장 또는 PMD 스프라이트';
  makeCheck();
  renderDex();
}

$('#make-file').addEventListener('click', () => makePick(false));
$('#make-folder').addEventListener('click', () => makePick(true));
$('#make-name').addEventListener('input', makeCheck);
$('#make-type').addEventListener('change', makeCheck);
$('#make-add').addEventListener('click', makeAdd);

$('#dex-btn').addEventListener('click', () => {
  if (openPanel('dex')) { renderDex(); poke.focus(); setTimeout(() => $('#dex-q').focus(), 30); }
});

// ---- 파티: 화면에 내보낼 포켓몬을 한 창에서 여러 마리 바로 켜고 끈다 (트레이 메뉴는 누를 때마다 닫혀서 불편했다) ----
const portraitOf = (k) => `${POKEMON[k].assets || `/assets/pokemon/${k}/`}portrait/Normal.png`;

/**
 * 파티 창에 보일 포켓몬 — 그림이 있는 모든 포켓몬을 구분 없이 도감 번호순으로 (번호 없는 내 그림은 맨 뒤).
 * key가 없는 것은 아직 한 번도 안 불러 본 도감 포켓몬: 누르면 addDex가 등록하고 내보낸다
 */
function partyEntries(q) {
  const num = /^#?0*(\d{1,4})$/.exec(q);
  const hit = (dex, names) => !q || (num ? dex === +num[1] : names.some((a) => a && a.toLowerCase().includes(q)));
  const list = [];
  for (const k of Object.keys(POKEMON)) {
    const d = POKEMON[k];
    if (hit(d.dex, [d.name, ...d.aliases])) list.push({ key: k, dex: d.dex, name: d.name, src: portraitOf(k) });
  }
  for (const n of dexHave) {
    const e = DEX.get(n);
    if (!e || builtinKeyOf(n) || POKEMON[customKey(n)]) continue;
    if (hit(n, [e.ko, e.en])) list.push({ key: null, dex: n, name: e.ko, src: `${dexAssets(n)}portrait/Normal.png` });
  }
  return list.sort((a, b) => (a.dex ?? Infinity) - (b.dex ?? Infinity));
}

function renderParty() {
  if ($('#party').hidden || bulk) return;
  const q = $('#party-q').value.trim().toLowerCase();
  const list = partyEntries(q);
  $('#party-grid').replaceChildren(...list.map((p) => {
    const on = !!p.key && app.config.party.includes(p.key);
    const tile = partyTile(p.name, p.src, on, on ? '누르면 몬스터볼로' : '누르면 화면에 내보내기');
    tile.addEventListener('click', () => toggleParty(p, tile));
    return tile;
  }));
  $('#party-count').textContent = `${app.config.party.length}/${q ? list.length : partyEntries('').length}`;
}

function partyTile(label, src, on, hint) {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = `party-tile${on ? ' on' : ''}`;
  tile.title = `${label} — ${hint}`;
  const img = new Image();
  img.alt = ''; img.loading = 'lazy'; img.src = src;   // 천 마리 가까이 되므로 보이는 것만 불러온다
  img.onerror = () => { img.style.visibility = 'hidden'; };
  const name = document.createElement('span');
  name.textContent = label;
  tile.append(img, name);
  return tile;
}

async function toggleParty(p, tile) {
  if (tile.classList.contains('busy')) return;
  tile.classList.add('busy');
  if (!p.key) return addDex(p.dex);   // 파티에 들어가며 renderParty가 다시 그린다
  const m = app.mons.find((x) => x.key === p.key);
  if (app.config.party.includes(p.key)) {
    if (m && !m.hidden) returnToBall(m);
    else { app.config.party = app.config.party.filter((k) => k !== p.key); poke.setConfig({ party: app.config.party }); }
  } else await ensureMon(p.key);   // 처음 내보내는 포켓몬은 그림을 불러오느라 잠깐 걸린다
  renderParty();
}

/**
 * 목록(검색 중이면 검색 결과)에서 화면에 나와 있는 포켓몬을 모두 들여보낸다.
 * 한꺼번에 처리하는 동안(bulk)은 한 마리마다 설정 저장·파티 창 다시 그리기·기록을 하지 않고 끝에 한 번만 한다
 */
function partyNone() {
  const keys = new Set(partyEntries($('#party-q').value.trim().toLowerCase()).map((p) => p.key));
  bulk = true;
  let count = 0;
  for (const m of app.mons) if (keys.has(m.key) && !m.hidden) { returnToBall(m); count++; }
  bulk = false;
  poke.setConfig({ party: app.config.party });
  if (count) app.log(`🎒 ${count}마리가 몬스터볼로 돌아갔다`, 'sys');
  renderParty();
  renderDex();
}

$('#party-btn').addEventListener('click', () => {
  if (openPanel('party')) { renderParty(); poke.focus(); }
});
dexAvailable().then(renderParty);
$('#party-q').addEventListener('input', renderParty);
$('#party-none').addEventListener('click', partyNone);
$('#dex-q').addEventListener('input', renderDex);

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
  else if (type === 'voice') (payload ? startVoice() : voice.stop());
  else if (type === 'sound') app.config.sound = payload;
  else if (type === 'cries') {   // 처음 실행할 때 메인이 울음소리를 받는다 (src/main/cries.mjs)
    if (payload.phase === 'start') app.log(`🔊 포켓몬 울음소리를 받는 중이에요 (${payload.todo}마리, 처음 한 번만)`, 'sys');
    else if (payload.got) app.log(`🔊 울음소리 ${payload.got}마리를 받았어요${payload.failed ? ` — 못 받은 ${payload.failed}마리는 다음 실행 때 다시 받아요` : ''}`, 'sys');
    else if (payload.failed) app.log('🔊 인터넷 연결이 안 돼서 울음소리를 못 받았어요 — 다음 실행 때 다시 받아요', 'sys');
  }
});

// ---------- 메인 루프 ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (const m of app.mons) { m.update(dt); m.render(); }
  app.fx.update(dt);
  app.fx.draw();
  if (!$('#devices').hidden) $('#meter-bar').style.width = `${Math.round(voice.level() * 100)}%`;
  requestAnimationFrame(frame);
}

(async function init() {
  app.config = await poke.getConfig();
  applyCustom(app.config.custom, app.config.creations);   // 도감에서 추가한 포켓몬, 직접 그림을 넣은 포켓몬
  app.config.party = app.config.party.filter((k) => POKEMON[k]);
  Object.assign(window, { app, handleCommand, voice });   // 개발자 도구에서 확인용
  requestAnimationFrame(frame);
  // 파티가 많으면 하나씩 인사하지 않고 함께 불러온 뒤 한 줄로 알린다. 그동안 음성인식도 준비한다
  const party = [...app.config.party];
  const loading = party.length <= 5 ? (async () => { for (const k of party) await ensureMon(k); })()
    : summonMany(party).then((n) => app.log(`🎒 ${n}마리가 몬스터볼에서 나왔다!`, 'sys'));
  voice.deviceId = await refreshDevices();
  if (app.config.voice) startVoice();
  else voice.stop();
  await loading;
  app.log('포켓몬을 클릭·드래그·쓰다듬어 보세요! 명령 예) "피카츄 크롬 10만볼트"', 'sys');
})();
