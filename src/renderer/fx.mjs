// 캔버스 이펙트: 감정 파티클과 기술 연출
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const lerp = (a, b, t) => a + (b - a) * t;

const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", sans-serif';
const TYPE_EMOJI = {
  electric: '⚡', fire: '🔥', water: '💧', grass: '🍃', normal: '⭐',
  ice: '❄️', fairy: '✨', dark: '🌙', psychic: '🔮', fighting: '👊',
  poison: '☠️', ground: '⛰️', bug: '🐛', ghost: '👻', rock: '🪨', steel: '⚙️', dragon: '🐉', flying: '🪶',
};
const TYPE_COLORS = {
  electric: ['#fff7a1', '#ffe23d', '#ffd000'],
  fire: ['#fff3a0', '#ffb030', '#ff5a1f', '#e8261a'],
  water: ['#e8f8ff', '#8fd8ff', '#3aa4ff', '#1f6fe0'],
  grass: ['#d9ff9e', '#7ed957', '#3aa83a'],
  normal: ['#fffbe0', '#ffe680', '#ffffff'],
  steel: ['#ffffff', '#d4dbe6', '#9aa6b8'],
  flying: ['#ffffff', '#d8ecff', '#a8d0ff'],
  dragon: ['#e0d0ff', '#9b6bff', '#6a3be0'],
  ice: ['#ffffff', '#d6f6ff', '#9be7ff', '#5cc8f0'],
  fairy: ['#fff0fa', '#ffb8e6', '#ff7fd0', '#e8a6ff'],
  dark: ['#8a6bb8', '#4b3270', '#2a1a40', '#6a4a8f'],
  psychic: ['#ffd6f0', '#ff8ad0', '#d65cff', '#ff5ca8'],
  fighting: ['#fff3c4', '#ffb35c', '#e85c2a', '#7fc8ff'],
  rock: ['#e8d8b0', '#c9a86a', '#8d7348'],
  poison: ['#f0c8ff', '#c070e0', '#9a48c8', '#6a2c90'],
  ground: ['#f5e2b0', '#d8b060', '#a8813a', '#7a5a2a'],
  bug: ['#eaffb0', '#b8d840', '#88a820', '#5f7a14'],
  ghost: ['#d8c8ff', '#9a80d8', '#5a4596', '#33285e'],
};

// 파티클 수 상한: 980마리가 저마다 감정 표현을 하면 수천 개가 쌓여 화면이 초당 몇 프레임으로 떨어진다(측정)
const MAX_PARTS = 1200;
const EMOTE_PARTS = 300;

export class FX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.parts = [];
    this.effects = [];
    this.flash = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = devicePixelRatio || 1;
    this.w = innerWidth; this.h = innerHeight;
    this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr;
    this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  get busy() { return this.parts.length > 0 || this.effects.length > 0 || this.flash > 0; }

  spawn(p) {
    if (this.parts.length >= MAX_PARTS) return;   // 수백 마리가 나와 있어도 그리기가 밀리지 않게
    this.parts.push({ vx: 0, vy: 0, ax: 0, ay: 0, drag: 0, t: 0, life: 1, size: 6, rot: 0, vr: 0, shape: 'dot', glow: false, alpha: 1, grow: 0, ...p });
  }

  addEffect(e) { this.effects.push({ t: 0, ...e }); }

  update(dt) {
    for (const p of this.parts) {
      p.t += dt;
      if (p.t < 0) continue;   // 지연 등장 파티클
      p.vx += p.ax * dt; p.vy += p.ay * dt;
      if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.size += p.grow * dt;
      if (p.wobble) p.x += Math.sin(p.t * p.wobble) * 0.8;
    }
    this.parts = this.parts.filter((p) => p.t < p.life && p.size > 0);
    for (const e of this.effects) { e.t += dt; e.update && e.update(e, dt); }
    this.effects = this.effects.filter((e) => e.t < e.duration);
    this.flash = Math.max(0, this.flash - dt * 2.5);
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,240,${Math.min(0.45, this.flash)})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    for (const e of this.effects) e.draw && e.draw(ctx, e);
    for (const p of this.parts) {
      if (p.t < 0) continue;
      const k = 1 - p.t / p.life;
      ctx.save();
      ctx.globalAlpha = p.alpha * (p.fadeIn ? Math.min(1, p.t / p.fadeIn) : 1) * (p.noFade ? 1 : Math.min(1, k * 2));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.glow) ctx.globalCompositeOperation = 'lighter';
      const s = Math.max(0.1, p.size);
      switch (p.shape) {
        case 'text':
          ctx.font = `${p.bold ? '900 ' : ''}${s}px ${p.font || EMOJI_FONT}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          if (p.stroke) { ctx.lineWidth = 3; ctx.strokeStyle = p.stroke; ctx.strokeText(p.text, 0, 0); }
          ctx.fillStyle = p.color || '#fff';
          ctx.fillText(p.text, 0, 0);
          break;
        case 'leaf':
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(30,90,30,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke();
          break;
        case 'star':
          ctx.fillStyle = p.color; starPath(ctx, s); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
          break;
        case 'bubble': {
          ctx.strokeStyle = 'rgba(160,220,255,.95)'; ctx.lineWidth = 2;
          ctx.fillStyle = 'rgba(120,200,255,.25)';
          ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.35, s * 0.22, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'ring':
          ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.stroke();
          break;
        case 'line':
          ctx.strokeStyle = p.color; ctx.lineWidth = p.width || 4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke();
          break;
        default: {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
          g.addColorStop(0, p.color); g.addColorStop(1, p.color.slice(0, 7) + '00');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // ---------- 감정 표현 파티클 ----------
  emote(kind, x, y, type = 'normal') {
    if (this.parts.length >= EMOTE_PARTS) return;   // 감정 표현은 장식이라 먼저 줄이고, 기술 연출에 자리를 남긴다
    const up =(text, n = 3, opts = {}) => {
      for (let i = 0; i < n; i++) {
        this.spawn({ shape: 'text', text: typeof text === 'function' ? text(i) : text, x: x + rand(-28, 28), y: y + rand(-10, 10),
          vx: rand(-15, 15), vy: rand(-70, -40), size: rand(18, 26), life: rand(1.2, 1.8), fadeIn: 0.15, t: -i * 0.15, ...opts });
      }
    };
    switch (kind) {
      case 'hearts': up(() => pick(['💕', '💗', '❤️']), 4); break;
      case 'bigheart': up('💖', 1, { size: 44, vy: -35, life: 1.8 }); up('💕', 3); break;
      case 'sparkles': up('✨', 4); break;
      case 'exclaim': up('❗', 1, { size: 34, vy: -25, vx: 0, x }); break;
      case 'question': up('❓', 1, { size: 32, vy: -20, vx: 0, x }); break;
      case 'blush': up('🌸', 3); break;
      case 'notes': up(() => pick(['🎵', '🎶']), 4); break;
      case 'anger': up('💢', 2, { size: 30 }); break;
      case 'stars': up('💫', 3); break;
      case 'sweat': up('💦', 2); break;
      case 'tear': up('💧', 2, { vy: rand(20, 40), ay: 60 }); break;
      case 'food': up(() => pick(['🍎', '🍓', '🍒', '🍪', '🥕']), 1, { size: 30, vy: -10, life: 2 }); break;
      case 'zzz':
        for (let i = 0; i < 3; i++) {
          this.spawn({ shape: 'text', text: 'Z', font: 'Arial Black, sans-serif', bold: true, color: '#7fb2ff', stroke: '#fff',
            x: x + 10, y, vx: 22, vy: -30, size: 14 + i * 5, life: 2, t: -i * 0.5, fadeIn: 0.2 });
        }
        break;
      case 'type': up(TYPE_EMOJI[type] || '⭐', 3); this.burst(x, y, type, 12, 120); break;
      default: break;
    }
  }

  burst(x, y, type = 'normal', n = 16, speed = 220) {
    const cols = TYPE_COLORS[type] || TYPE_COLORS.normal;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(speed * 0.3, speed);
      this.spawn({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, size: rand(5, 11), color: pick(cols), glow: true, life: rand(0.4, 0.8) });
    }
  }

  hitText(x, y, text) {
    this.spawn({ shape: 'text', text, x, y, vy: -30, size: 28, life: 1.4, bold: true, font: 'Malgun Gothic, sans-serif', color: '#fff', stroke: '#c01818', noFade: false });
  }

  // ---------- 기술 연출 ----------
  /**
   * from/to: {x, y}, rect: 대상 사각형 {x,y,w,h}. 맞는 순간 onHit 호출, 연출이 끝나면 resolve.
   */
  move(fx, type, from, to, rect, onHit) {
    const spec = MOVE_FX[fx] || MOVE_FX.dash;
    return new Promise((resolve) => {
      let hit = false;
      const r = rect || { x: to.x - 40, y: to.y - 40, w: 80, h: 80 };
      this.addEffect({
        duration: spec.duration,
        update: (e, dt) => {
          spec.update && spec.update(this, e, dt, from, to, r, type);
          if (!hit && e.t >= spec.hitAt) {
            hit = true;
            spec.onHit && spec.onHit(this, from, to, r, type);
            aftermath(this, type, r, to);
            onHit && onHit();
          }
          if (e.t + dt >= spec.duration) setTimeout(resolve, 50);
        },
        draw: (ctx, e) => spec.draw && spec.draw(this, ctx, e, from, to, r, type),
      });
    });
  }
}

function starPath(ctx, s) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? s * 0.45 : s;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

function jagged(ctx, x1, y1, x2, y2, amp, color, width) {
  const n = Math.max(6, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 28));
  const nx = -(y2 - y1), ny = x2 - x1, len = Math.hypot(nx, ny) || 1;
  const pts = [[x1, y1]];
  for (let i = 1; i < n; i++) {
    const t = i / n, o = rand(-amp, amp);
    pts.push([lerp(x1, x2, t) + (nx / len) * o, lerp(y1, y2, t) + (ny / len) * o]);
  }
  pts.push([x2, y2]);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const [w, c, blur] of [[width * 3, color, 18], [width, '#ffffff', 6]]) {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.shadowColor = color; ctx.shadowBlur = blur;
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  }
  ctx.restore();
  return pts;
}

const randIn = (r) => ({ x: r.x + rand(0.1, 0.9) * r.w, y: r.y + rand(0.1, 0.9) * r.h });

// 대상에 남는 여운 (타입별)
function aftermath(fx, type, r, to) {
  const area = { x: Math.max(r.x, to.x - 250), y: Math.max(r.y, to.y - 200), w: Math.min(r.w, 500), h: Math.min(r.h, 400) };
  const cols = TYPE_COLORS[type] || TYPE_COLORS.normal;
  for (let i = 0; i < 26; i++) {
    const p = randIn(area);
    switch (type) {
      case 'fire':
        fx.spawn({ ...p, vy: rand(-90, -40), vx: rand(-10, 10), size: rand(8, 18), color: pick(cols), glow: true, life: rand(0.8, 1.6), t: -rand(0, 0.8), grow: -6 });
        if (i % 3 === 0) fx.spawn({ ...p, vy: -40, vx: rand(-10, 10), size: 10, grow: 14, color: '#55555588', life: 2, t: -rand(0.3, 1.2) });
        break;
      case 'water':
        fx.spawn({ ...p, vx: rand(-40, 40), vy: rand(-160, -60), ay: 600, size: rand(4, 8), color: pick(cols), life: 1.1, t: -rand(0, 0.4) });
        break;
      case 'grass':
        fx.spawn({ ...p, shape: 'leaf', vx: rand(-60, 60), vy: rand(-80, 20), ay: 60, vr: rand(-6, 6), size: rand(6, 10), color: pick(cols), life: 1.5, t: -rand(0, 0.4) });
        break;
      case 'electric':
        fx.spawn({ ...p, size: rand(4, 9), color: pick(cols), glow: true, life: rand(0.15, 0.4), t: -rand(0, 0.9) });
        break;
      case 'ice':   // 눈송이가 내려앉음
        if (i < 14) fx.spawn({ ...p, shape: 'text', text: '❄', color: '#e8fbff', stroke: '#5cc8f0', vx: rand(-20, 20), vy: rand(10, 40), vr: rand(-2, 2), size: rand(12, 20), life: 1.8, t: -rand(0, 0.6) });
        break;
      case 'fairy':
        if (i < 14) fx.spawn({ ...p, shape: 'text', text: pick(['✨', '💗', '⭐']), vy: rand(-50, -20), size: rand(14, 22), life: 1.5, t: -rand(0, 0.5) });
        break;
      case 'psychic':
        if (i < 8) fx.spawn({ ...p, shape: 'ring', color: pick(cols), size: 4, grow: 90, life: 0.6, t: -rand(0, 0.7) });
        break;
      case 'dark':   // 어두운 연기가 피어오름
      case 'ghost':
        fx.spawn({ ...p, vy: rand(-60, -20), vx: rand(-15, 15), size: rand(10, 18), grow: 16, color: pick(cols), life: rand(0.9, 1.5), t: -rand(0, 0.6) });
        break;
      case 'poison':   // 독 거품이 보글보글
        fx.spawn({ ...p, shape: 'ring', vy: rand(-50, -15), color: pick(cols), size: rand(4, 9), grow: 8, life: rand(0.7, 1.2), t: -rand(0, 0.7) });
        break;
      case 'rock':
      case 'ground':
        fx.spawn({ ...p, vx: rand(-60, 60), vy: rand(-140, -40), ay: 700, size: rand(4, 8), color: pick(cols), life: 1, t: -rand(0, 0.3) });
        break;
      default:
        if (i < 10) fx.spawn({ ...p, shape: 'star', vx: rand(-80, 80), vy: rand(-120, -20), ay: 200, vr: rand(-5, 5), size: rand(7, 12), color: pick(cols), life: 1 });
    }
  }
  fx.burst(to.x, to.y, type, 24, 320);
  fx.spawn({ x: to.x, y: to.y, shape: 'ring', color: (cols[1] || '#fff'), size: 10, grow: 420, life: 0.35 });
}

// 발사형: 매 프레임 파티클을 대상 방향으로 흘려보낸다
function stream(fx, from, to, dt, { rate, speed, spread, cols, size, glow = true, grow = 0, shape = 'dot', extra = {} }) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
  const n = Math.ceil(rate * dt);
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(dy, dx) + rand(-spread, spread), v = speed * rand(0.85, 1.1);
    fx.spawn({ x: from.x, y: from.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: rand(size * 0.6, size), color: pick(cols), glow, grow, shape, life: d / v, ...extra });
  }
}

const MOVE_FX = {
  thunderbolt: {
    duration: 1.2, hitAt: 0.2,
    draw(fx, ctx, e, from, to, r) {
      if (e.t > 0.95) return;
      for (let i = 0; i < 2; i++) jagged(ctx, from.x, from.y, to.x + rand(-20, 20), to.y + rand(-20, 20), 26, '#ffe23d', 3);
      if (e.t > 0.2) {
        for (let i = 0; i < 3; i++) { const p = randIn(r); jagged(ctx, p.x + rand(-60, 60), p.y - rand(80, 160), p.x, p.y, 14, '#ffe23d', 2); }
        ctx.fillStyle = `rgba(255,240,80,${0.12 + Math.random() * 0.12})`; ctx.fillRect(r.x, r.y, r.w, r.h);
      }
    },
    update(fx, e, dt, from) { if (Math.random() < 0.5) fx.burst(from.x, from.y, 'electric', 2, 160); },
  },
  spark: {
    duration: 0.6, hitAt: 0.15,
    draw(fx, ctx, e, from, to) { if (e.t < 0.45) jagged(ctx, from.x, from.y, to.x, to.y, 16, '#ffe23d', 2); },
  },
  thunder: {
    duration: 1.1, hitAt: 0.3,
    onHit(fx) { fx.flash = 0.6; },
    draw(fx, ctx, e, from, to, r) {
      if (e.t < 0.25) { jagged(ctx, from.x, from.y, from.x + rand(-10, 10), from.y - 120, 10, '#ffe23d', 2); return; }
      if (e.t > 0.85) return;
      jagged(ctx, to.x + rand(-30, 30), 0, to.x, to.y, 60, '#fff36b', 6);
      jagged(ctx, to.x + rand(-80, 80), 0, to.x + rand(-40, 40), to.y, 40, '#ffe23d', 3);
      ctx.fillStyle = 'rgba(255,250,150,.2)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    },
  },
  flame: {
    duration: 1.5, hitAt: 0.35,
    update(fx, e, dt, from, to) {
      if (e.t < 1.1) stream(fx, from, to, dt, { rate: 160, speed: 700, spread: 0.12, cols: TYPE_COLORS.fire, size: 14, grow: 26 });
    },
  },
  fireblast: {
    duration: 2.0, hitAt: 0.55,
    draw(fx, ctx, e, from, to) {
      if (e.t >= 0.55) return;
      const k = e.t / 0.55, x = lerp(from.x, to.x, k), y = lerp(from.y, to.y, k) - Math.sin(k * Math.PI) * 60;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 34);
      g.addColorStop(0, '#fff6c0'); g.addColorStop(0.4, '#ff9a20'); g.addColorStop(1, '#ff300000');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      fx.spawn({ x, y, size: 12, color: pick(TYPE_COLORS.fire), glow: true, life: 0.35, grow: -20 });
    },
    update(fx, e, dt, from, to, r) {
      if (e.t < 0.55 || e.t > 1.6) return;
      // '大' 모양 불꽃
      const R = Math.max(70, Math.min(150, Math.min(r.w, r.h) * 0.45));
      const strokes = [[[0, -1], [0, -0.25]], [[-0.95, -0.3], [0.95, -0.3]], [[0, -0.3], [-0.85, 1]], [[0, -0.3], [0.85, 1]]];
      for (let i = 0; i < 14; i++) {
        const [[ax, ay], [bx, by]] = pick(strokes), t = Math.random();
        fx.spawn({ x: to.x + lerp(ax, bx, t) * R + rand(-6, 6), y: to.y + lerp(ay, by, t) * R + rand(-6, 6),
          vy: rand(-50, -20), size: rand(10, 18), grow: -8, color: pick(TYPE_COLORS.fire), glow: true, life: rand(0.4, 0.7) });
      }
    },
    onHit(fx) { fx.flash = 0.25; },
  },
  ember: {
    duration: 1.0, hitAt: 0.4,
    update(fx, e, dt, from, to) {
      if (e.t < 0.4 && Math.random() < dt * 14) {
        const d = Math.hypot(to.x - from.x, to.y - from.y), v = d / 0.38;
        const a = Math.atan2(to.y - from.y, to.x - from.x) + rand(-0.08, 0.08);
        fx.spawn({ x: from.x, y: from.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 13, color: '#ff8a20', glow: true, life: 0.38 });
      }
    },
  },
  water: {
    duration: 1.4, hitAt: 0.35,
    update(fx, e, dt, from, to) {
      if (e.t < 1.0) stream(fx, from, to, dt, { rate: 170, speed: 800, spread: 0.05, cols: TYPE_COLORS.water, size: 9, glow: false });
    },
  },
  hydropump: {
    duration: 1.8, hitAt: 0.3,
    draw(fx, ctx, e, from, to) {
      if (e.t > 1.4) return;
      const k = Math.min(1, e.t / 0.3);
      const x = lerp(from.x, to.x, k), y = lerp(from.y, to.y, k);
      ctx.save(); ctx.lineCap = 'round';
      for (const [w, c] of [[30, 'rgba(40,130,255,.55)'], [18, 'rgba(120,200,255,.8)'], [6, 'rgba(255,255,255,.9)']]) {
        ctx.strokeStyle = c; ctx.lineWidth = w * (0.9 + Math.random() * 0.2);
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(x, y); ctx.stroke();
      }
      ctx.restore();
    },
    update(fx, e, dt, from, to) {
      if (e.t > 0.3 && e.t < 1.4) {
        for (let i = 0; i < 6; i++) fx.spawn({ x: to.x, y: to.y, vx: rand(-260, 260), vy: rand(-320, -60), ay: 900, size: rand(4, 9), color: pick(TYPE_COLORS.water), life: 0.9 });
      }
    },
  },
  bubble: {
    duration: 1.6, hitAt: 0.9,
    update(fx, e, dt, from, to) {
      if (e.t < 0.5 && Math.random() < dt * 22) {
        const v = Math.hypot(to.x - from.x, to.y - from.y) / 0.9;
        const a = Math.atan2(to.y - from.y, to.x - from.x) + rand(-0.15, 0.15);
        fx.spawn({ shape: 'bubble', x: from.x, y: from.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, wobble: 9, size: rand(7, 15), life: 0.9, noFade: true });
      }
    },
    onHit(fx, from, to) { for (let i = 0; i < 10; i++) fx.spawn({ shape: 'ring', x: to.x + rand(-40, 40), y: to.y + rand(-40, 40), color: '#bfe8ff', size: 4, grow: 60, life: 0.35, t: -rand(0, 0.5) }); },
  },
  vine: {
    duration: 1.2, hitAt: 0.35,
    draw(fx, ctx, e, from, to) {
      if (e.t > 1.0) return;
      const grow = Math.min(1, e.t / 0.3);
      for (const side of [-1, 1]) {
        const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
        const nx = -(to.y - from.y), ny = to.x - from.x, l = Math.hypot(nx, ny) || 1;
        const swing = Math.sin(e.t * 18) * 40 + side * 90;
        const cx = mx + (nx / l) * swing, cy = my + (ny / l) * swing;
        ctx.save(); ctx.lineCap = 'round';
        for (const [w, c] of [[9, '#2f7d32'], [4, '#7ed957']]) {
          ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(from.x, from.y);
          const N = 24;
          for (let i = 1; i <= N * grow; i++) {
            const t = i / N, it = 1 - t;
            ctx.lineTo(it * it * from.x + 2 * it * t * cx + t * t * to.x, it * it * from.y + 2 * it * t * cy + t * t * to.y);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
    },
    onHit(fx, from, to) { fx.burst(to.x, to.y, 'grass', 20, 260); },
  },
  leaf: {
    duration: 1.2, hitAt: 0.45,
    update(fx, e, dt, from, to) {
      if (e.t < 0.35 && Math.random() < dt * 28) {
        const v = Math.hypot(to.x - from.x, to.y - from.y) / 0.45;
        const a = Math.atan2(to.y - from.y, to.x - from.x) + rand(-0.12, 0.12);
        fx.spawn({ shape: 'leaf', x: from.x, y: from.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vr: 18, size: 10, color: pick(TYPE_COLORS.grass), life: 0.45, noFade: true });
      }
    },
  },
  solarbeam: {
    duration: 2.1, hitAt: 1.05,
    update(fx, e, dt, from) {
      if (e.t < 0.95) {
        for (let i = 0; i < 4; i++) {
          const a = rand(0, Math.PI * 2), d = rand(60, 120);
          fx.spawn({ x: from.x + Math.cos(a) * d, y: from.y + Math.sin(a) * d, vx: -Math.cos(a) * d / 0.4, vy: -Math.sin(a) * d / 0.4, size: rand(3, 6), color: pick(['#ffffff', '#fffbb0', '#d9ff9e']), glow: true, life: 0.4 });
        }
      }
    },
    draw(fx, ctx, e, from, to) {
      if (e.t < 0.95 || e.t > 1.85) return;
      const k = Math.min(1, (e.t - 0.95) / 0.12), x = lerp(from.x, to.x, k), y = lerp(from.y, to.y, k);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const [w, c] of [[60, 'rgba(180,255,120,.35)'], [36, 'rgba(255,255,170,.7)'], [14, 'rgba(255,255,255,1)']]) {
        ctx.strokeStyle = c; ctx.lineWidth = w * (0.92 + Math.random() * 0.16);
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(x, y); ctx.stroke();
      }
      ctx.restore();
    },
    onHit(fx) { fx.flash = 0.35; },
  },
  stars: {
    duration: 1.2, hitAt: 0.45,
    update(fx, e, dt, from, to) {
      if (e.t < 0.3 && Math.random() < dt * 22) {
        const v = Math.hypot(to.x - from.x, to.y - from.y) / 0.45;
        const a = Math.atan2(to.y - from.y, to.x - from.x) + rand(-0.15, 0.15);
        fx.spawn({ shape: 'star', x: from.x, y: from.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vr: 10, size: 12, color: '#ffe23d', life: 0.45, noFade: true });
      }
    },
  },
  dash: {
    duration: 0.7, hitAt: 0.02,
    onHit(fx, from, to) { fx.spawn({ shape: 'text', text: '💥', x: to.x, y: to.y, size: 46, grow: 30, life: 0.5 }); },
  },
  slam: {
    duration: 0.8, hitAt: 0.02,
    onHit(fx, from, to) { fx.flash = 0.2; fx.spawn({ shape: 'text', text: '💥', x: to.x, y: to.y, size: 56, grow: 40, life: 0.6 }); },
  },
  slash: {
    duration: 0.8, hitAt: 0.05,
    onHit(fx, from, to) {
      for (let i = 0; i < 3; i++) {
        fx.spawn({ shape: 'line', x: to.x + (i - 1) * 22, y: to.y + (i - 1) * 8, rot: -0.9, size: 60, width: 5, color: '#ffffff', life: 0.35, t: -i * 0.06 });
      }
    },
  },

  // ---------- 타입 색을 따르는 범용 연출 (새 포켓몬 기술용) ----------
  // 줄기: 열탕 등
  stream: {
    duration: 1.4, hitAt: 0.35,
    update(fx, e, dt, from, to, r, type) {
      if (e.t < 1.0) stream(fx, from, to, dt, { rate: 160, speed: 760, spread: 0.07, cols: TYPE_COLORS[type] || TYPE_COLORS.normal, size: 10, glow: type !== 'water' });
    },
  },
  // 빛나는 구체가 날아가 터짐: 파동탄·문포스·에너지볼·매지컬플레임
  orb: {
    duration: 1.3, hitAt: 0.55,
    draw(fx, ctx, e, from, to, r, type) {
      const cols = TYPE_COLORS[type] || TYPE_COLORS.normal;
      if (e.t < 0.2) {   // 손끝에 힘을 모음
        const s = 6 + (e.t / 0.2) * 16;
        glowBall(ctx, from.x, from.y, s, cols);
        return;
      }
      if (e.t >= 0.55) return;
      const k = (e.t - 0.2) / 0.35, x = lerp(from.x, to.x, k), y = lerp(from.y, to.y, k);
      glowBall(ctx, x, y, 22 + Math.sin(e.t * 40) * 3, cols);
      fx.spawn({ x, y, size: 9, color: pick(cols), glow: true, life: 0.3, grow: -18 });
    },
    onHit(fx, from, to, r, type) { fx.burst(to.x, to.y, type, 40, 380); fx.flash = 0.15; },
  },
  // 굵은 광선: 냉동빔·매지컬샤인·환상빔
  beam: {
    duration: 1.3, hitAt: 0.15,
    draw(fx, ctx, e, from, to, r, type) {
      if (e.t > 1.05) return;
      const cols = TYPE_COLORS[type] || TYPE_COLORS.normal;
      const k = Math.min(1, e.t / 0.12), x = lerp(from.x, to.x, k), y = lerp(from.y, to.y, k);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const [w, c] of [[34, cols[cols.length - 1]], [20, cols[1] || cols[0]], [7, '#ffffff']]) {
        ctx.globalAlpha = w > 30 ? 0.45 : 0.9;
        ctx.strokeStyle = c; ctx.lineWidth = w * (0.9 + Math.random() * 0.2);
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(x, y); ctx.stroke();
      }
      ctx.restore();
      if (type === 'psychic') {   // 환상빔은 고리가 빔을 따라 흐름
        const t = (e.t * 3) % 1;
        fx.spawn({ shape: 'ring', x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), color: '#ff8ad0', size: 10, grow: 20, life: 0.2 });
      }
    },
    update(fx, e, dt, from, to, r, type) {
      if (e.t > 0.15 && e.t < 1.05 && Math.random() < 0.6) fx.burst(to.x, to.y, type, 2, 200);
    },
  },
  // 작은 탄 여러 개: 얼음뭉치·진공파·파워젬·가시캐논
  shards: {
    duration: 1.0, hitAt: 0.4,
    update(fx, e, dt, from, to, r, type) {
      if (e.t < 0.35 && Math.random() < dt * 20) {
        const v = Math.hypot(to.x - from.x, to.y - from.y) / 0.38;
        const a = Math.atan2(to.y - from.y, to.x - from.x) + rand(-0.1, 0.1);
        fx.spawn({ shape: 'star', x: from.x, y: from.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vr: 14, size: 9, color: pick(TYPE_COLORS[type] || TYPE_COLORS.normal), life: 0.38, noFade: true });
      }
    },
  },
  // 휘몰아치는 폭풍: 눈보라(눈송이)·리프스톰(나뭇잎)
  blizzard: {
    duration: 1.9, hitAt: 0.5,
    update(fx, e, dt, from, to, r, type) {
      if (e.t > 1.4) return;
      const d = Math.hypot(to.x - from.x, to.y - from.y), base = Math.atan2(to.y - from.y, to.x - from.x);
      for (let i = 0; i < 5; i++) {
        const a = base + rand(-0.3, 0.3), v = rand(500, 750);
        const p = { x: from.x, y: from.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: d / v + 0.3, vr: rand(-8, 8), wobble: 12 };
        if (type === 'grass') fx.spawn({ ...p, shape: 'leaf', size: rand(6, 10), color: pick(TYPE_COLORS.grass) });
        else if (i % 2) fx.spawn({ ...p, shape: 'text', text: '❄', color: '#ffffff', stroke: '#5cc8f0', size: rand(12, 18) });
        else fx.spawn({ ...p, size: rand(3, 6), color: '#ffffff', glow: true });
      }
    },
    onHit(fx) { fx.flash = 0.12; },
  },
  // 대상 주위로 염력 고리가 조여듦: 사이코키네시스·염동력
  psywave: {
    duration: 1.4, hitAt: 0.45,
    draw(fx, ctx, e, from, to) {
      if (e.t > 1.2) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      // 시전자의 눈이 빛남
      glowBall(ctx, from.x, from.y - 6, 10 + Math.sin(e.t * 30) * 3, TYPE_COLORS.psychic);
      for (let i = 0; i < 3; i++) {
        const k = ((e.t * 1.6 + i / 3) % 1);
        ctx.strokeStyle = `rgba(255,120,210,${0.9 * (1 - k)})`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.ellipse(to.x, to.y, 140 * (1 - k) + 10, 90 * (1 - k) + 8, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    },
  },
  // 동심원 파동이 퍼져 나감: 악의파동·나이트버스트·하이퍼보이스·차밍보이스
  ringwave: {
    duration: 1.3, hitAt: 0.45,
    update(fx, e, dt, from, to, r, type) {
      if (e.t < 0.6 && Math.random() < dt * 14) {
        const v = Math.hypot(to.x - from.x, to.y - from.y) / 0.45;
        const a = Math.atan2(to.y - from.y, to.x - from.x);
        const cols = TYPE_COLORS[type] || TYPE_COLORS.normal;
        fx.spawn({ shape: 'ring', x: from.x, y: from.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 12, grow: 70, color: type === 'dark' ? cols[0] : pick(cols), life: 0.45, noFade: true });
        if (type === 'fairy') fx.spawn({ shape: 'text', text: '♪', color: '#ff7fd0', x: from.x, y: from.y, vx: Math.cos(a) * v * 0.8, vy: Math.sin(a) * v * 0.8 - 30, size: 20, life: 0.5 });
      }
    },
  },
  // 반짝이는 바람: 요정의바람·얼다바람
  sparkle: {
    duration: 1.3, hitAt: 0.45,
    update(fx, e, dt, from, to, r, type) {
      if (e.t > 0.9) return;
      const emoji = type === 'ice' ? ['❄', '✦'] : ['✨', '💗', '✦'];
      if (Math.random() < dt * 30) {
        const v = Math.hypot(to.x - from.x, to.y - from.y) / 0.5;
        const a = Math.atan2(to.y - from.y, to.x - from.x) + rand(-0.2, 0.2);
        fx.spawn({ shape: 'text', text: pick(emoji), color: type === 'ice' ? '#e8fbff' : '#ff9ad8', x: from.x, y: from.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, wobble: 10, vr: 4, size: rand(14, 22), life: 0.5, noFade: true });
      }
    },
  },
  // 하트 뽀뽀: 드레인키스
  kiss: {
    duration: 1.5, hitAt: 0.5,
    update(fx, e, dt, from, to) {
      if (e.t < 0.4 && Math.random() < dt * 12) {
        const v = Math.hypot(to.x - from.x, to.y - from.y) / 0.5;
        const a = Math.atan2(to.y - from.y, to.x - from.x) + rand(-0.12, 0.12);
        fx.spawn({ shape: 'text', text: pick(['💋', '💗']), x: from.x, y: from.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 24, life: 0.5, noFade: true });
      }
    },
    onHit(fx, from, to) {   // 기운을 쪽 빨아와 시전자에게 돌아감
      for (let i = 0; i < 6; i++) fx.spawn({ shape: 'text', text: '💖', x: to.x, y: to.y, vx: (from.x - to.x) / 0.8, vy: (from.y - to.y) / 0.8, size: 16, life: 0.8, t: -i * 0.08 });
    },
  },
  // 콱 깨물기
  bite: {
    duration: 0.8, hitAt: 0.15,
    draw(fx, ctx, e, from, to) {
      if (e.t > 0.45) return;
      const k = Math.min(1, e.t / 0.15), gap = 46 * (1 - k) + 4;
      ctx.save(); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#3a2350'; ctx.lineWidth = 2;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const x = to.x - 50 + i * 25, y = to.y + dir * gap;
          ctx.moveTo(x, y); ctx.lineTo(x + 12.5, y - dir * 22); ctx.lineTo(x + 25, y);
        }
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    },
    onHit(fx, from, to) { fx.spawn({ shape: 'text', text: '💢', x: to.x + 40, y: to.y - 40, size: 34, life: 0.6 }); },
  },
  // 하늘에서 불덩이가 쏟아짐: 분화
  eruption: {
    duration: 2.0, hitAt: 0.6,
    update(fx, e, dt, from, to, r) {
      if (e.t < 0.5) {   // 등에서 불기둥이 솟음
        for (let i = 0; i < 4; i++) fx.spawn({ x: from.x + rand(-10, 10), y: from.y - 10, vx: rand(-60, 60), vy: rand(-420, -260), ay: 300, size: rand(8, 14), color: pick(TYPE_COLORS.fire), glow: true, life: 0.6 });
      } else if (e.t < 1.5 && Math.random() < dt * 18) {
        const p = randIn(r);
        fx.spawn({ x: p.x + rand(-80, 80), y: -20, vx: rand(-40, 40), vy: 900, size: rand(12, 20), color: pick(TYPE_COLORS.fire), glow: true, life: (p.y + 20) / 900 });
      }
    },
    onHit(fx) { fx.flash = 0.3; },
  },
};

function glowBall(ctx, x, y, s, cols) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, s);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, cols[1] || cols[0]); g.addColorStop(1, (cols[cols.length - 1]).slice(0, 7) + '00');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
