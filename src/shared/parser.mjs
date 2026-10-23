// 음성/텍스트 명령 해석기: "피카츄 크롬 10만볼트" → { pokemon, move, target... }
import { compact, similarity } from './hangul.mjs';
import {
  POKEMON, ALL_ALIASES, MOVES, ATTACK_WORDS, ACTIONS, TARGET_ALIASES,
  CURSOR_WORDS, ICON_HINT, WINDOW_HINT, PARTICLES,
} from './data.mjs';

function buildEntries() {
  const e = [];
  for (const [id, p] of Object.entries(POKEMON)) for (const a of p.aliases) e.push({ kind: 'pokemon', id, alias: a });
  for (const a of ALL_ALIASES) e.push({ kind: 'all', id: 'all', alias: a });
  // auto: 공식 기술 전부를 넣으며 자동으로 만든 기술 (moves.mjs). 이름이 짧고 흔해서 아래처럼 덜 너그럽게 찾는다
  for (const [id, m] of Object.entries(MOVES)) for (const a of m.aliases) e.push({ kind: 'move', id, alias: a, auto: !!m.auto });
  for (const a of ATTACK_WORDS) e.push({ kind: 'attack', id: 'attack', alias: a });
  for (const [id, list] of Object.entries(ACTIONS)) for (const a of list) e.push({ kind: 'action', id, alias: a });
  TARGET_ALIASES.forEach((t, i) => t.keys.forEach((a) => e.push({ kind: 'target', id: i, alias: a })));
  for (const a of CURSOR_WORDS) e.push({ kind: 'cursor', id: 'cursor', alias: a });
  for (const a of ICON_HINT) e.push({ kind: 'iconHint', id: 'icon', alias: a });
  for (const a of WINDOW_HINT) e.push({ kind: 'windowHint', id: 'window', alias: a });
  for (const x of e) x.alias = compact(x.alias);
  return e.sort((a, b) => b.alias.length - a.alias.length);
}
let ENTRIES, FUZZY_ENTRIES, ENTRY_OF;
/** 포켓몬 목록이 바뀌면(사용자가 추가·삭제) 별칭 표를 다시 만든다 */
export function refreshEntries() {
  ENTRIES = buildEntries();
  // 퍼지 매칭에 쓸 항목: 너무 짧으면 오탐이 많아 2글자 이상만. 자동 기술 700여 개는 빼서 창 이름 같은 말이 기술로 바뀌지 않게
  FUZZY_ENTRIES = ENTRIES.filter((x) => x.alias.length >= 2 && /[가-힣]/.test(x.alias) && !x.auto
    && ['pokemon', 'move', 'target', 'action', 'attack'].includes(x.kind));
  ENTRY_OF = new Map(ENTRIES.map((e) => [e.alias, e]));
}
refreshEntries();
/** 이미 다른 말(포켓몬·기술·행동·대상 등)로 쓰이는 별칭인지 */
export const aliasTaken = (alias) => ENTRY_OF.has(compact(alias));

export function stripParticle(word) {
  let w = word;
  for (let i = 0; i < 2 && w.length > 1; i++) {
    const n = w.replace(PARTICLES, '');
    if (n === w || !n) break;
    w = n;
  }
  return w;
}

export function parseCommand(text) {
  const tokens = text.toLowerCase().split(/\s+/).map(compact).filter(Boolean);
  const c = tokens.join('');
  const covered = new Array(c.length).fill(false);
  const matches = [];

  const tokenStarts = [];
  tokens.reduce((pos, t) => { tokenStarts.push(pos); return pos + t.length; }, 0);

  const mark = (entry, start, end, fuzzy = false) => {
    for (let i = start; i < end; i++) covered[i] = true;
    matches.push({ ...entry, start, end, fuzzy });
  };

  // 1단계: 띄어쓴 단어가 별칭과 통째로 같으면 먼저 인정 ("모두 들어가"가 "모두들|어가"로 잘리지 않게)
  tokens.forEach((t, i) => {
    const e = ENTRY_OF.get(t) || ENTRY_OF.get(stripParticle(t));
    if (e && e.alias.length > 1) mark(e, tokenStarts[i], tokenStarts[i] + e.alias.length);
  });

  // 2단계: 붙여 쓴 말 속에서 긴 별칭부터 찾기
  for (const entry of ENTRIES) {
    const a = entry.alias;
    if (entry.auto && a.length <= 2) continue;   // 짧은 자동 기술('물기', '지진')은 1단계처럼 띄어 쓴 단어일 때만
    if (a.length === 1) {
      // 한 글자 별칭('자', '물', '와'...)은 독립된 단어(조사 허용)일 때만 인정
      tokens.forEach((t, i) => {
        const s = tokenStarts[i];
        if ((t === a || stripParticle(t) === a) && !covered[s]) mark(entry, s, s + 1);
      });
      continue;
    }
    let idx = c.indexOf(a);
    while (idx !== -1) {
      let free = true;
      for (let i = idx; i < idx + a.length; i++) if (covered[i]) { free = false; break; }
      if (free) mark(entry, idx, idx + a.length);
      idx = c.indexOf(a, idx + 1);
    }
  }

  // 남은 조각 추출
  const leftovers = [];
  let cur = '', curStart = 0;
  for (let i = 0; i <= c.length; i++) {
    const boundary = i === c.length || covered[i] || tokenStarts.includes(i);
    if (boundary && cur) { leftovers.push({ text: cur, start: curStart }); cur = ''; }
    if (i < c.length && !covered[i]) { if (!cur) curStart = i; cur += c[i]; }
  }

  // 남은 조각에 대해 퍼지 매칭 (음성 오인식/오타 보정)
  const targetWords = [];
  for (const lo of leftovers) {
    const w = stripParticle(lo.text);
    if (w.length < 2) continue;
    let best = null, bestScore = 0;
    // 음성인식이 옆 단어의 한 글자를 붙여 받아쓰기도 해서("그롬싱만볼트") 앞/뒤 한 글자를 뗀 것도 맞춰 본다
    const tries = w.length >= 3 ? [w, w.slice(0, -1), w.slice(1)] : [w];
    for (const t of tries) {
      for (const entry of FUZZY_ENTRIES) {
        if (Math.abs(entry.alias.length - t.length) > 1) continue;
        const s = similarity(t, entry.alias);
        if (s > bestScore) { bestScore = s; best = entry; }
      }
    }
    if (best && bestScore >= 0.78) mark(best, lo.start, lo.start + lo.text.length, true);
    else targetWords.push(w);
  }

  matches.sort((a, b) => a.start - b.start);
  const of = (k) => matches.filter((m) => m.kind === k);
  const pokemon = [...new Set(of('pokemon').map((m) => m.id))];
  const moveM = of('move')[0];
  const actionM = of('action')[0];
  const targetM = of('target')[0];

  const result = {
    raw: text,
    pokemon,
    all: of('all').length > 0,
    move: moveM ? moveM.id : null,
    attack: of('attack').length > 0,
    action: actionM ? actionM.id : null,
    targetKey: targetM ? targetM.id : null,
    targetWords,
    targetPokemon: null,
    cursor: of('cursor').length > 0,
    preferIcon: of('iconHint').length > 0,
    preferWindow: of('windowHint').length > 0,
    fuzzy: matches.some((m) => m.fuzzy),
  };

  // "피카츄 꼬부기 공격" → 마지막에 불린 포켓몬이 공격 대상
  const offensive = result.move || result.attack;
  if (offensive && pokemon.length >= 2 && result.targetKey == null && !targetWords.length && !result.cursor) {
    result.targetPokemon = pokemon.pop();
  }
  // 기술이 있으면 행동 단어는 무시 (예: "꼬리흔들기" vs "흔들어")
  if (result.move) result.action = null;
  result.understood = !!(result.move || result.attack || result.action);
  return result;
}

/** 음성인식 문법: 명령에 쓰이는 단어만 인식하도록 후보를 제한한다 (extra: 화면에 보이는 창/아이콘 이름 등) */
export function voiceGrammar(extra = []) {
  const words = new Set();
  // 자동 기술은 넣지 않는다: 단어가 수백 개 늘면 잡담이 명령으로 끼워 맞춰지기 쉽고, 필터 기준값은 넣기 전에 잰 것이다
  for (const e of ENTRIES) if (!e.auto && /^[가-힣0-9 ]+$/.test(e.alias)) words.add(e.alias);
  for (const w of extra) if (/^[가-힣]{2,}$/.test(w)) words.add(w);
  return [...words, '[unk]'];
}

// 음성 필터 기준 (TTS 명령/잡담 측정값 기반: 명령은 2~4단어·신뢰도≈1, 잡담은 6단어 이상·신뢰도 0.4~0.6 섞임)
const VOICE_MIN_CONF = 0.65;   // 이보다 낮은 단어는 버린다
const VOICE_MIN_AVG = 0.8;     // 남은 단어 평균 신뢰도
const VOICE_MAX_WORDS = 5;
const KIND_OF = { get: (alias) => ENTRY_OF.get(alias)?.kind };

/**
 * 음성 인식 결과가 진짜 명령인지 판단한다. 주변 대화가 명령 단어로 끼워 맞춰지는 것을 막기 위해
 * "포켓몬 이름(또는 모두)으로 시작 + 짧음 + 할 일 1가지 + 높은 신뢰도"인 문장만 통과시킨다.
 * words: [{ word, conf }] (Vosk setWords). 없으면 신뢰도 검사는 건너뛴다.
 */
export function acceptVoice(text, words = null) {
  let list = words && words.length ? words : text.split(/\s+/).filter(Boolean).map((w) => ({ word: w, conf: 1 }));
  list = list.filter((w) => w.word !== '[unk]');
  const reject = (reason) => ({ ok: false, reason });
  if (!list.length) return reject('빈 결과');
  if (list.length > VOICE_MAX_WORDS) return reject(`너무 김(${list.length}단어)`);

  const first = list[0];
  const firstKind = KIND_OF.get(compact(first.word));
  if (firstKind !== 'pokemon' && firstKind !== 'all') return reject('포켓몬 이름으로 시작하지 않음');
  if (first.conf < 0.8) return reject('포켓몬 이름이 불확실');

  const kept = list.filter((w) => w.conf >= VOICE_MIN_CONF);
  const avg = kept.reduce((s, w) => s + w.conf, 0) / kept.length;
  if (avg < VOICE_MIN_AVG) return reject(`신뢰도 낮음(${avg.toFixed(2)})`);
  const texts = kept.map((w) => compact(w.word));
  if (new Set(texts).size !== texts.length) return reject('같은 단어 반복');

  // 할 일(기술/공격/행동)은 정확히 한 가지여야 한다. 기술+"공격"은 같은 의도로 본다.
  const intents = new Set();
  for (const t of texts) {
    const k = KIND_OF.get(t);
    if (k === 'move' || k === 'attack') intents.add('attack');
    else if (k === 'action') intents.add('action:' + ENTRY_OF.get(t).id);
  }
  const cleaned = kept.map((w) => w.word).join(' ');
  if (intents.size > 1) return reject('서로 다른 지시가 섞임');
  if (intents.size === 0 && !(texts.length === 1 && first.conf >= 0.95)) return reject('할 일이 없음');
  return { ok: true, text: cleaned };
}

/** Whisper 인식 힌트(hotwords): 포켓몬·기술 이름 등 대표 단어 하나씩 (한글만, 최대 100개) */
export function voiceKeywords() {
  const first = (list) => list.map(compact).find((a) => /^[가-힣]{2,20}$/.test(a));
  // 포켓몬 이름은 40개까지: 전부 내보내기로 980마리가 등록돼도 기술·행동 단어가 100개 한도에서 밀려나지 않게
  return [
    ...Object.values(POKEMON).map((p) => first(p.aliases)).filter(Boolean).slice(0, 40),
    first(ALL_ALIASES), first(ATTACK_WORDS),
    ...Object.values(MOVES).filter((m) => !m.auto).map((m) => first(m.aliases)),   // 손으로 다듬은 기술만 (100개 한도)
    ...Object.values(ACTIONS).map(first),
  ].filter(Boolean).slice(0, 100);
}

/** 받아쓴 단어를 아는 명령 단어로 맞춘다: "피카츄야" → "피카츄", "공격해" → "공격" */
function snapWord(w) {
  const c = compact(w);
  if (ENTRY_OF.has(c)) return c;
  const s = stripParticle(c);
  if (ENTRY_OF.has(s)) return s;
  const e = ENTRIES.find((x) => x.alias.length >= (x.auto ? 3 : 2) && c.startsWith(x.alias));   // 긴 별칭부터
  if (e) return e.alias;
  // 붙여 받아쓴 말 속의 할 일 ("그롬싱만볼트" → "만볼트"). 대상 이름은 parseCommand가 퍼지로 찾는다
  const inner = ENTRIES.find((x) => x.alias.length >= 2 && !x.auto && INTENT_KINDS.has(x.kind) && c.includes(x.alias));
  return inner ? inner.alias : w;
}
const INTENT_KINDS = new Set(['move', 'attack', 'action']);

/**
 * 받아쓰기형 엔진(Whisper) 결과용 필터. 문법 제한·단어 신뢰도가 없으므로
 * 단어를 명령 단어로 맞춰 acceptVoice와 같은 기준(포켓몬 이름으로 시작, 짧게, 할 일 1가지)으로 거른다.
 */
export function acceptTranscript(text) {
  const clean = text.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ').filter(Boolean).map((w) => ({ word: snapWord(w), conf: 1 }));
  const v = acceptVoice(clean, words);
  // 통과하면 원문을 넘긴다: 맞춰 본 단어만 넘기면 "그롬"(크롬) 같은 대상이 빠진다
  return v.ok ? { ok: true, text: clean } : v;
}

/** 해석 결과와 화면 객체 목록으로 공격 대상을 고른다. objects: [{kind,name,process,cls,x,y,w,h,z}] */
export function resolveTarget(parsed, objects) {
  const windows = objects.filter((o) => o.kind === 'window').sort((a, b) => a.z - b.z);
  const icons = objects.filter((o) => o.kind === 'icon');
  const order = parsed.preferIcon ? [...icons, ...windows] : [...windows, ...icons];
  const lname = (o) => (o.name || '').toLowerCase();

  if (parsed.targetKey != null) {
    const rule = TARGET_ALIASES[parsed.targetKey];
    const hit = order.find((o) =>
      (o.kind === 'window' && rule.process && rule.process.includes((o.process || '').toLowerCase())
        && (!rule.cls || rule.cls.includes(o.cls)))
      || (rule.match && rule.match.some((m) => lname(o).includes(m))));
    if (hit) return hit;
  }

  for (const word of parsed.targetWords) {
    const exact = order.find((o) => {
      const n = compact(o.name || '');
      return n && (n.includes(word) || (n.length >= 2 && word.includes(n)));
    });
    if (exact) return exact;
  }
  let best = null, bestScore = 0;
  for (const word of parsed.targetWords) {
    for (const o of order) {
      const parts = [compact(o.name || ''), ...(o.name || '').toLowerCase().split(/[\s\-_.()]+/).map(compact)];
      for (const p of parts) {
        if (p.length < 2) continue;
        const s = similarity(word, p);
        if (s > bestScore) { bestScore = s; best = o; }
      }
    }
  }
  return bestScore >= 0.7 ? best : null;
}
