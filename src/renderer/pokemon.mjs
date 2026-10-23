// 포켓몬 개체: PMD 스프라이트 애니메이션, 자율 행동, 리액션, 말풍선
import { POKEMON, REACTIONS } from '../shared/data.mjs';

export const CANCEL = Symbol('cancel');
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// 시트의 행 순서: 아래, 오른아래, 오른, 오른위, 위, 왼위, 왼, 왼아래
const OCT_TO_ROW = [2, 1, 0, 7, 6, 5, 4, 3];
const CRY_PITCH = {
  Happy: 1.12, Joyous: 1.2, Inspired: 1.08, Surprised: 1.15,
  Sad: 0.86, Crying: 0.82, 'Teary-Eyed': 0.88, Pain: 0.9, Sigh: 0.85, Dizzy: 0.88, Worried: 0.95,
  Angry: 0.94, Shouting: 1.0, Determined: 1.0,
};
// 여러 마리가 한꺼번에 반응해도(모두 나와, 전부 내보내기) 울음소리가 쏟아지지 않게: 동시에 2마리까지, 시작 간격 0.4초.
// 못 운 포켓몬도 말풍선·글자는 그대로 보인다
const CRY_MAX_AT_ONCE = 2;
const CRY_GAP_MS = 400;
const cryGate = { playing: 0, last: 0 };

export async function loadSpecies(key) {
  const base = POKEMON[key]?.assets || `/assets/pokemon/${key}/`;   // 사용자가 추가한 포켓몬은 assets/dex/
  const data = await fetch(base + 'anims.json').then((r) => r.json());
  const sizes = {};
  await Promise.all([...new Set(Object.values(data.anims).map((a) => a.file))].map((f) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { sizes[f] = { w: im.naturalWidth, h: im.naturalHeight }; res(); };
    im.onerror = () => res();
    im.src = base + f;
  })));
  const anims = {};
  for (const [name, a] of Object.entries(data.anims)) {
    const s = sizes[a.file];
    if (!s) continue;
    anims[name] = { ...a, url: base + a.file, sheetW: s.w, sheetH: s.h, rows: Math.max(1, Math.round(s.h / a.h)), cols: Math.round(s.w / a.w) };
  }
  return { key, base, anims, emotions: data.emotions };
}

export class Mon {
  constructor(app, species) {
    this.app = app;
    this.key = species.key;
    this.sp = species;
    this.def = POKEMON[species.key];
    this.S = this.def.scale;
    const walk = species.anims.Walk || Object.values(species.anims)[0];
    this.bodyW = walk.w * this.S;
    this.bodyH = walk.h * this.S;

    this.x = rand(150, app.w - 150);
    this.y = rand(app.h * 0.45, app.h - 40);
    this.z = 0; this.vz = 0;
    this.dir = 0;
    this.mode = 'auto';
    this.goal = null;
    this.anim = null;
    this.taskId = 0;
    this.rejecters = [];
    this.nextThink = rand(0.5, 2);
    this.hidden = false;

    this.el = document.createElement('div');
    this.el.className = 'mon';
    this.el.innerHTML = '<div class="shadow"></div><div class="sprite"></div><div class="hit interactive"></div><div class="bubble"><img alt=""><div><div class="cry"></div><div class="sum"></div></div></div>';
    this.sprite = this.el.querySelector('.sprite');
    this.hit = this.el.querySelector('.hit');
    this.bubble = this.el.querySelector('.bubble');
    this.hit.mon = this;
    const sh = this.el.querySelector('.shadow');
    Object.assign(sh.style, { width: this.bodyW * 0.7 + 'px', height: this.bodyW * 0.28 + 'px' });
    Object.assign(this.hit.style, { width: this.bodyW * 0.85 + 'px', height: this.bodyH * 0.75 + 'px', top: -this.bodyH * 0.32 + 'px' });
    this.bubble.style.bottom = this.bodyH * 0.75 + 12 + 'px';
    app.stage.appendChild(this.el);
    // 사용자가 넣은 큰 그림을 줄일 때는 픽셀 모양보다 부드럽게 줄이는 편이 낫다
    if (this.def.simple && this.S < 2) this.sprite.style.imageRendering = 'auto';
    this.setAnim('Idle');
  }

  get name() { return this.def.name; }
  /** 기술이 나가는 몸 중심 좌표 */
  get center() { return { x: this.x, y: this.y - this.bodyH * 0.3 - this.z }; }
  has(name) { return !!this.sp.anims[name]; }
  firstAnim(list) { return (Array.isArray(list) ? list : [list]).find((n) => this.has(n)) || (this.has('Idle') ? 'Idle' : 'Walk'); }

  // ---------- 애니메이션 ----------
  setAnim(list, { loop = true, onEnd = null, speed = 1 } = {}) {
    const name = this.firstAnim(list);
    const a = this.sp.anims[name];
    if (this.anim && this.anim.name === name && loop && this.anim.loop) return name;
    this.anim = { name, a, frame: 0, t: 0, loop, onEnd, speed };
    Object.assign(this.sprite.style, {
      width: a.w * this.S + 'px', height: a.h * this.S + 'px',
      backgroundImage: `url("${a.url}")`,
      backgroundSize: `${a.sheetW * this.S}px ${a.sheetH * this.S}px`,
    });
    return name;
  }

  playOnce(list, { times = 1, speed = 1 } = {}) {
    return this.guard((resolve) => {
      let n = 0;
      const go = () => this.setAnim(list, { loop: false, speed, onEnd: () => (++n < times ? go() : resolve()) });
      go();
    });
  }

  face(x, y) {
    if (Math.hypot(x - this.x, y - this.center.y) < 70) { this.dir = 2; return; }   // 바로 위의 커서 → 정면
    const a = Math.atan2(y - this.y, x - this.x);
    this.dir = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  }

  // ---------- 작업(취소 가능한 비동기 행동) ----------
  guard(executor) {
    return new Promise((resolve, reject) => {
      this.rejecters.push(reject);
      executor((v) => { this.rejecters = this.rejecters.filter((r) => r !== reject); resolve(v); });
    });
  }

  cancel() {
    this.taskId++;
    const rs = this.rejecters; this.rejecters = [];
    rs.forEach((r) => r(CANCEL));
    this.goal = null;
    if (this.anim) this.anim.onEnd = null;
  }

  /** 새 작업 시작 (이전 작업은 취소). auto=true면 자율 행동이라 사용자 입력으로 언제든 끊긴다 */
  run(fn, { auto = false } = {}) {
    this.cancel();
    const id = this.taskId;
    this.mode = auto ? 'auto-task' : 'busy';
    return fn().catch((e) => { if (e !== CANCEL) console.error(e); }).finally(() => {
      if (this.taskId !== id) return;
      if (this.mode !== 'sleep' && this.mode !== 'ball') { this.mode = 'auto'; this.setAnim('Idle'); this.nextThink = rand(1.5, 4); }
    });
  }

  wait(ms) { return this.guard((resolve) => setTimeout(resolve, ms)); }

  walkTo(x, y, speed = this.def.speed) {
    x = Math.max(40, Math.min(this.app.w - 40, x));
    y = Math.max(this.bodyH * 0.8 + 110, Math.min(this.app.h - 10, y));   // 위쪽은 말풍선 자리 확보
    const b = this.app.blocked && this.app.blocked();   // 명령창 영역은 피한다
    if (b && x > b.left - 40 && y > b.top - 20) x = b.left - 50 - Math.random() * 120;
    return this.guard((resolve) => { this.goal = { x, y, speed, resolve }; });
  }

  // ---------- 말풍선 & 리액션 ----------
  say({ emotion = 'Normal', text = '', cry = true }) {
    // 그 감정의 얼굴이 없으면 보통 얼굴, 그것도 없으면(직접 넣은 그림) 있는 얼굴 아무거나
    const emo = this.sp.emotions.includes(emotion) ? emotion : this.sp.emotions.includes('Normal') ? 'Normal' : this.sp.emotions[0];
    const img = this.bubble.querySelector('img');
    img.hidden = !this.sp.emotions.length;   // 초상화 없이 넣은 PMD 그림은 얼굴 없이 말한다
    if (!img.hidden) img.src = `${this.sp.base}portrait/${emo}.png`;
    this.bubble.querySelector('.cry').textContent = cry ? pick(this.def.cries) : '';
    if (cry) this.playCry(emo);
    this.bubble.querySelector('.sum').textContent = text;
    this.bubble.classList.add('show');
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => this.bubble.classList.remove('show'), 4200);
    if (text) this.app.log(`${this.name}: ${text}`, 'sys');
  }

  /** 울음소리 재생. 감정에 따라 높낮이를 바꿔 기쁘면 높게, 슬프면 낮게 운다 */
  playCry(emotion = 'Normal', { force = false } = {}) {
    if (!this.app.config.sound && !force) return;
    const now = performance.now();
    if (now - (this.lastCry || 0) < 700 && !force) return;   // 연달아 겹쳐 울지 않게
    if (!force && (cryGate.playing >= CRY_MAX_AT_ONCE || now - cryGate.last < CRY_GAP_MS)) return;
    this.lastCry = now;
    cryGate.last = now;
    // 처음 실행 때 받아 둔 울음소리(/cries/<도감 번호>.ogg)가 먼저, 아직 못 받았으면 앱에 들어 있는 것
    const srcs = [this.def.dex && `/cries/${this.def.dex}.ogg`, `${this.sp.base}cry.ogg`].filter(Boolean);
    const sink = this.app.speakerId;   // 장치 설정에서 고른 출력 장치
    const play = (i) => {
      if (i >= srcs.length) return;   // 울음소리 파일이 없으면 조용히 넘어감
      const a = new Audio(srcs[i]);
      a.preservesPitch = false;
      a.playbackRate = CRY_PITCH[emotion] ?? 1;
      a.volume = 0.55;
      (sink && a.setSinkId ? a.setSinkId(sink).catch(() => {}) : Promise.resolve())
        .then(() => a.play())
        .then(() => {
          cryGate.playing++;
          let done = false;
          const end = () => { if (!done) { done = true; cryGate.playing--; } };
          a.addEventListener('ended', end);
          a.addEventListener('error', end);
          setTimeout(end, 3000);   // ended가 안 오더라도 자리를 계속 차지하지 않게
        }, () => play(i + 1));
    };
    play(0);
  }

  /** 리액션 실행: 애니메이션 + 감정 파티클 + 요약 텍스트 */
  react(key, { text, faceCursor = true, quiet = false } = {}) {
    const r = REACTIONS[key];
    return this.run(async () => {
      if (this.mode === 'sleep') this.mode = 'busy';
      if (faceCursor) this.face(this.app.cursor.x, this.app.cursor.y);
      const c = this.center;
      this.app.fx.emote(r.fx, c.x, c.y - this.bodyH * 0.3, this.def.type);
      if (!quiet) this.say({ emotion: r.emotion, text: text ?? r.text });
      if (r.hop) this.vz = Math.sqrt(2 * 1400 * r.hop);
      const name = this.firstAnim(r.anims);
      const short = this.sp.anims[name].durations.reduce((s, d) => s + d, 0) < 40;
      await this.playOnce(r.anims, { times: short ? 2 : 1 });
      if (key === 'sleep') return this.fallAsleep();
      await this.wait(500);
    });
  }

  fallAsleep() {
    this.mode = 'sleep';
    this.setAnim(['Sleep', 'EventSleep', 'Laying']);
    this.sleepUntil = performance.now() + rand(15000, 30000);
  }

  // ---------- 자율 행동 ----------
  think() {
    const r = Math.random();
    const app = this.app;
    if (r < 0.55) {
      this.run(async () => {
        await this.walkTo(this.x + rand(-350, 350), this.y + rand(-200, 200));
        this.setAnim('Idle');
        await this.wait(rand(800, 2500));
      }, { auto: true });
    } else if (r < 0.7) {
      this.run(async () => { this.setAnim('Idle'); await this.wait(rand(2000, 4000)); }, { auto: true });
    } else if (r < 0.78) {
      this.run(async () => { this.setAnim(['Sit', 'Idle']); await this.wait(rand(3000, 6000)); }, { auto: true });
    } else if (r < 0.82) {
      this.run(async () => { this.app.fx.emote('zzz', this.center.x, this.center.y - 20); this.fallAsleep(); }, { auto: true });
    } else if (r < 0.92) {
      // 혼자 노는 작은 동작 (말풍선 없음)
      const k = pick(['hop', 'spin', 'dance', 'stretch', 'wag', 'float', 'lookaround', 'eat']);
      this.run(async () => {
        this.app.fx.emote(REACTIONS[k].fx, this.center.x, this.center.y - 30, this.def.type);
        await this.playOnce(REACTIONS[k].anims, { times: 2 });
      }, { auto: true });
    } else {
      // 다른 포켓몬이나 커서 쪽으로 다가가기
      const other = pick(app.mons.filter((m) => m !== this && !m.hidden));
      const tx = other ? other.x + rand(-80, 80) : app.cursor.x;
      const ty = other ? other.y + rand(-30, 30) : app.cursor.y + 60;
      this.run(async () => {
        await this.walkTo(tx, ty);
        if (other) { this.face(other.x, other.y); this.app.fx.emote(pick(['hearts', 'notes', 'question']), this.center.x, this.center.y - 30); }
        await this.playOnce(['Nod', 'Hop', 'Idle']);
      }, { auto: true });
    }
  }

  // ---------- 매 프레임 ----------
  update(dt) {
    if (this.hidden) return;
    if (this.mode === 'auto') {
      this.nextThink -= dt;
      if (this.nextThink <= 0) this.think();
    } else if (this.mode === 'sleep' && performance.now() > this.sleepUntil) {
      this.react('wake', { quiet: true });
    }

    if (this.goal && this.mode !== 'drag') {
      const dx = this.goal.x - this.x, dy = this.goal.y - this.y, d = Math.hypot(dx, dy);
      const step = this.goal.speed * dt;
      this.face(this.goal.x, this.goal.y);
      this.setAnim('Walk', { speed: Math.max(1, this.goal.speed / this.def.speed * 0.8) });
      if (d <= step) {
        this.x = this.goal.x; this.y = this.goal.y;
        const g = this.goal; this.goal = null; g.resolve();
      } else { this.x += (dx / d) * step; this.y += (dy / d) * step; }
    }

    if (this.mode !== 'drag' && (this.z > 0 || this.vz > 0)) {
      this.vz -= 1400 * dt; this.z = Math.max(0, this.z + this.vz * dt);
      if (this.z === 0) this.vz = 0;
    }

    const an = this.anim;
    if (an) {
      an.t += dt * 60 * an.speed;
      let dur = an.a.durations[an.frame] || 4;
      while (an.t >= dur) {
        an.t -= dur;
        an.frame++;
        if (an.frame >= an.a.durations.length) {
          if (an.loop) an.frame = 0;
          else {
            an.frame = an.a.durations.length - 1;
            const cb = an.onEnd; an.onEnd = null; an.t = 0;
            if (cb) cb();
            break;
          }
        }
        dur = an.a.durations[an.frame] || 4;
      }
    }
  }

  /**
   * 이미지 한 장짜리(def.simple)는 프레임이 없으니 움직임을 흉내 낸다:
   * 걸을 때 통통 튀기, 기술·리액션 때 쑥 커졌다 돌아오기, 가만히 있을 때 숨쉬기, 가는 쪽으로 돌아보기
   */
  simpleMotion(an) {
    const t = performance.now() / 1000;
    let lift = 0, sx = 1, sy = 1;
    if (an.name === 'Walk') lift = Math.abs(Math.sin(t * 9)) * 6;
    else if (!an.loop) {
      const total = an.a.durations.reduce((a, b) => a + b, 0);
      const done = an.a.durations.slice(0, an.frame).reduce((a, b) => a + b, 0) + an.t;
      const k = Math.sin(Math.min(1, done / total) * Math.PI);
      sx = 1 + 0.18 * k; sy = 1 + 0.18 * k; lift = 8 * k;
    } else sy = 1 + 0.025 * Math.sin(t * 2.4);
    // 공식 그림처럼 왼쪽을 보고 있다고 보고, 오른쪽으로 갈 때 뒤집는다
    if ([7, 0, 1].includes(this.dir)) sx = -sx;
    return `translateY(${-lift}px) scale(${sx}, ${sy})`;
  }

  render() {
    if (this.hidden) { this.el.classList.add('hidden'); return; }
    this.el.classList.remove('hidden');
    const an = this.anim;
    const row = an.a.rows >= 8 ? OCT_TO_ROW[this.dir] : 0;
    this.sprite.style.backgroundPosition = `${-an.frame * an.a.w * this.S}px ${-row * an.a.h * this.S}px`;
    if (this.def.simple) this.sprite.style.transform = `translate(-50%, -50%) ${this.simpleMotion(an)}`;
    // PMD 프레임은 발밑에 여백이 있어 30%만 올리고, 여백 없는 이미지 한 장은 아랫변이 그림자에 닿게 절반 올린다
    this.sprite.style.top = -(this.bodyH * (this.def.simple ? 0.5 : 0.3) + this.z) + 'px';
    this.el.style.transform = `translate(${this.x}px, ${this.y}px)`;
    this.el.style.zIndex = Math.round(this.y);
    // 화면 가장자리에서 말풍선이 잘리지 않게
    const half = 150;
    const shift = Math.max(half - this.x, 0) - Math.max(this.x + half - this.app.w, 0);
    this.bubble.style.marginLeft = shift + 'px';
    this.bubble.style.bottom = this.bodyH * 0.75 + 12 + this.z + 'px';
  }
}
