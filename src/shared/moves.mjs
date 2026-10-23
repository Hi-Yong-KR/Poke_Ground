// 공식 기술 전부(movedex.mjs)를 앱의 기술 정의로 바꾸고, 포켓몬마다 배우는 기술(learnsets.mjs)을 찾는다.
// 손으로 다듬은 기술(data.mjs의 MOVES)은 그대로 두고, 나머지는 속성·분류(물리·특수·변화)·영어 이름 단서로 연출을 고른다.
import { MOVEDEX } from './movedex.mjs';
import { LEARNSETS } from './learnsets.mjs';

export const TYPE_KO = {
  normal: '노말', fire: '불꽃', water: '물', grass: '풀', electric: '전기', ice: '얼음', fighting: '격투', poison: '독',
  ground: '땅', flying: '비행', psychic: '에스퍼', bug: '벌레', rock: '바위', ghost: '고스트', dragon: '드래곤',
  dark: '악', steel: '강철', fairy: '페어리',
};

// 몸이 닿는 물리 기술: 이름 단서 → 연출 (위에서부터 먼저 맞는 것)
const MELEE_FX = [
  [/fang|bite|crunch|jaw/, 'bite'],
  [/claw|slash|cut|blade|scratch|scissor|sword|razor|fury|cleave|chop/, 'slash'],
  [/punch|kick|slam|hammer|stomp|smash|press|drop|tail|fist|knuckle|arm|crash|bash|body|head|horn|wing|hit|strike|blow/, 'slam'],
];
// 멀리 쏘는 기술(특수, 닿지 않는 물리): 이름 단서 → 연출
const RANGED_FX = [
  [/beam|ray|laser|cannon|gleam|flash|prism|light/, 'beam'],
  [/pulse|wave|voice|sound|roar|boom|noise|song|sing|screech|howl|echo|chatter|uproar|vibe/, 'ringwave'],
  [/storm|wind|gust|hurricane|tornado|twister|blizzard|cyclone|breath/, 'wind'],
  [/ball|sphere|bomb|orb|blast|bullet|shot|meteor|moon|sun/, 'orb'],
  [/spike|shard|needle|stone|rock|gem|edge|pin|seed|tomb|slide|spear|arrow|star|dart|missile|leaf|petal|scale/, 'shards'],
];
// 단서가 없을 때 속성별 기본 연출 (위력이 크면 더 큰 연출)
const TYPE_FX = {
  electric: (p) => (p >= 110 ? 'thunder' : p >= 80 ? 'thunderbolt' : 'spark'),
  fire: (p) => (p >= 110 ? 'fireblast' : p >= 70 ? 'flame' : 'ember'),
  water: (p) => (p >= 110 ? 'hydropump' : 'water'),
  grass: (p) => (p >= 120 ? 'solarbeam' : 'leaf'),
  ice: (p) => (p >= 110 ? 'blizzard' : p >= 80 ? 'beam' : 'shards'),
  psychic: () => 'psywave', fairy: () => 'sparkle', dark: () => 'ringwave', normal: () => 'stars',
  ghost: () => 'orb', fighting: () => 'orb', dragon: () => 'stream', poison: () => 'stream', flying: () => 'stream',
  bug: () => 'shards', rock: () => 'shards', steel: () => 'shards', ground: () => 'slam',
};
// 변화 기술(자기에게 쓰는 것으로 보여 준다)의 말풍선 문구
const SELF_TEXT = [
  [/heal|recover|rest|roost|synthesis|moonlight|morning|wish|ingrain|aqua-ring|refresh|purify|milk|egg|life/, '기운을 회복하는 중이다'],
  [/protect|detect|shield|guard|endure|barrier|harden|defense|wall|screen|withdraw|cotton|iron|curl/, '몸을 단단히 지키며 버틴다'],
  [/dance|sword|growth|calm|bulk|nasty|agility|polish|shift|focus|meditate|sharpen|work|hone|plot|charge|coil|quiver|tail-glow|power/, '힘을 끌어올리며 능력을 높인다'],
  [/growl|leer|tail-whip|charm|tickle|screech|glare|scary|stare|fake-tears|captivate|eerie|taunt|torment|confide/, '상대를 노려보며 기를 꺾으려 한다'],
  [/powder|spore|sleep|hypnosis|sing|lullaby|yawn|toxic|poison|wisp|thunder-wave|glare|confuse|swagger|attract|leech/, '상대에게 수상한 기운을 날린다'],
];

/** movedex 한 줄 → 기술 정의 (손으로 다듬은 기술이 없을 때) */
function autoMove([, ko, en, type, cls, power, contact]) {
  const id = en.toLowerCase().replace(/\s+/g, '-');
  const base = { name: ko, type, cls, power, auto: true, aliases: [ko, en.toLowerCase().replace(/[^a-z0-9]/g, '')] };
  if (cls === 'status') {
    const text = SELF_TEXT.find(([re]) => re.test(id))?.[1] || `${TYPE_KO[type]} 기운이 몸을 감싼다`;
    return { ...base, self: true, selfText: text, anims: ['Pose', 'Charge', 'Double'] };
  }
  if (cls === 'physical' && contact) {
    const fx = MELEE_FX.find(([re]) => re.test(id))?.[1] || 'dash';
    const anims = /kick|stomp/.test(id) ? ['Kick', 'Strike', 'Attack']
      : fx === 'slash' ? ['Strike', 'Swing', 'Attack'] : fx === 'slam' ? ['Strike', 'Swing', 'Attack'] : ['Attack', 'Strike', 'Head'];
    return { ...base, fx, melee: true, anims };
  }
  let fx = RANGED_FX.find(([re]) => re.test(id))?.[1] || TYPE_FX[type](power);
  if (fx === 'wind') fx = type === 'ice' || type === 'grass' ? 'blizzard' : 'stream';   // 눈보라 연출은 얼음·풀만 모양이 맞는다
  if (/bubble/.test(id)) fx = 'bubble';
  return { ...base, fx, anims: power >= 90 ? ['Charge', 'Shoot', 'Attack'] : ['Shoot', 'Attack'] };
}

/**
 * 손으로 다듬은 기술(moves)에 공식 기술을 모두 더한다.
 * - 다듬은 기술: 이름·속성은 공식 것을 따르고, 예전 이름은 별칭으로 남긴다 (영어 이름도 별칭)
 * - 다른 기술의 공식 이름을 별칭으로 쓰던 것은 그 기술에 돌려준다 (예: 박치기 → 몸통박치기가 아니라 박치기)
 * - taken: 포켓몬·행동·대상 등 다른 말로 이미 쓰는 별칭(compact 된 것). 겹치는 별칭은 기술에서 뺀다
 */
export function addAllMoves(moves, taken, compact) {
  const official = new Map(MOVEDEX.map((r) => [compact(r[1]), r[0]]));
  for (const [k, m] of Object.entries(moves)) {
    m.aliases = m.aliases.filter((a) => (official.get(compact(a)) ?? k) === k);
  }
  for (const row of MOVEDEX) {
    const [key, ko, en, type, cls, power] = row;
    const m = moves[key];
    if (m) {
      if (m.name !== ko && !m.aliases.includes(m.name)) m.aliases.push(m.name);
      Object.assign(m, { name: ko, type, cls, power });
      m.aliases = [ko, ...m.aliases.filter((a) => a !== ko), en.toLowerCase().replace(/[^a-z0-9]/g, '')];
    } else moves[key] = autoMove(row);
  }
  const seen = new Set(taken);
  for (const m of Object.values(moves)) {
    m.aliases = m.aliases.filter((a) => {
      const c = compact(a);
      if (!c || seen.has(c)) return false;
      seen.add(c);
      return true;
    });
  }
  return moves;
}

// ---- 배우는 기술 ----
const INDEX = new Map(MOVEDEX.map((r, i) => [r[0], i]));
const BITS = new Map();   // 도감 번호 → 풀어 둔 비트 문자열 (필요할 때 한 번만 푼다)
function bits(dex) {
  if (!BITS.has(dex)) BITS.set(dex, LEARNSETS[dex - 1] ? atob(LEARNSETS[dex - 1]) : null);
  return BITS.get(dex);
}

/** 그 도감 번호의 포켓몬이 key 기술을 배우는지. 자료가 없는 번호면 null */
export function learns(dex, key) {
  const b = Number.isInteger(dex) ? bits(dex) : null;
  if (!b) return null;
  const i = INDEX.get(key);
  return i != null && ((b.charCodeAt(i >> 3) >> (i & 7)) & 1) === 1;
}

/** 그 도감 번호의 포켓몬이 배우는 기술 키 전부 (movedex 순서). 자료가 없으면 null */
export function learnset(dex) {
  const b = Number.isInteger(dex) ? bits(dex) : null;
  if (!b) return null;
  return MOVEDEX.filter((_, i) => ((b.charCodeAt(i >> 3) >> (i & 7)) & 1) === 1).map((r) => r[0]);
}
