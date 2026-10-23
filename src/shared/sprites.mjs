// PMD SpriteCollab 공통: 초상화 감정 목록, AnimData.xml 해석, 앱이 쓰는 애니메이션 목록
// (scripts/fetch-assets.mjs, scripts/fetch-dex.mjs, 메인 프로세스의 그림 받기가 함께 쓴다)
import * as DATA from './data.mjs';

// 앱이 쓰는 애니메이션: data.mjs의 모든 anims 목록 + pokemon.mjs가 이름으로 부르는 기본 동작.
// 추가 포켓몬은 이것만 받아 둔다 (크기와 불러오는 시간을 줄이려고)
export const USED_ANIMS = new Set(['Walk', 'Idle', 'Sleep', 'EventSleep', 'Wake', 'Hop', 'Nod', 'Hurt', 'Faint']);
(function collect(v) {
  if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (k === 'anims' && Array.isArray(x)) x.forEach((a) => USED_ANIMS.add(a));
      else collect(x);
    }
  }
})(Object.values(DATA));

/** AnimData에서 앱이 쓰는 것만 남긴다. 걷거나 서 있을 수도 없으면 null (쓸 수 없는 그림) */
export function pickAnims(all) {
  const anims = Object.fromEntries(Object.entries(all).filter(([n, a]) => USED_ANIMS.has(n) && a.file));
  return anims.Walk || anims.Idle ? anims : null;
}

export const EMOTIONS = [
  'Normal', 'Happy', 'Pain', 'Angry', 'Worried', 'Sad', 'Crying', 'Shouting',
  'Teary-Eyed', 'Determined', 'Joyous', 'Inspired', 'Surprised', 'Dizzy', 'Sigh', 'Stunned',
];

export function parseAnimData(xml) {
  const anims = {};
  const tag = (s, t) => (s.match(new RegExp(`<${t}>([^<]*)</${t}>`)) || [])[1];
  for (const block of xml.match(/<Anim>[\s\S]*?<\/Anim>/g) || []) {
    const name = tag(block, 'Name');
    const copyOf = tag(block, 'CopyOf');
    if (copyOf) { anims[name] = { copyOf }; continue; }
    anims[name] = {
      file: `${name}-Anim.png`,
      w: +tag(block, 'FrameWidth'),
      h: +tag(block, 'FrameHeight'),
      durations: [...block.matchAll(/<Duration>(\d+)<\/Duration>/g)].map((m) => +m[1]),
      hit: tag(block, 'HitFrame') != null ? +tag(block, 'HitFrame') : null,
    };
  }
  for (const [name, a] of Object.entries(anims)) {
    if (a.copyOf) anims[name] = { ...anims[a.copyOf] };
  }
  return anims;
}
