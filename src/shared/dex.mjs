// 사용자가 추가하는 포켓몬: 도감 번호만 저장해 두고(config.custom), 실행할 때 도감 표로 정의를 만들어 POKEMON에 넣는다.
// 그림은 scripts/fetch-dex.mjs 가 받아 둔 assets/dex/<4자리 번호>/ 를 쓴다.
// 사용자가 직접 그림을 넣은 포켓몬(config.creations)도 같은 방식으로 만든다.
// 메인 프로세스(트레이 메뉴)·렌더러·테스트가 함께 쓴다.
import { POKEDEX } from './pokedex.mjs';
import { POKEMON, MOVES } from './data.mjs';
import { refreshEntries, aliasTaken } from './parser.mjs';

export const DEX = new Map(POKEDEX.map(([dex, ko, en, ...types]) => [dex, { dex, ko, en, types }]));

// 기술 연출이 있는 타입. 없는 타입은 둘째 타입을 쓰고, 둘 다 없으면 비슷한 타입으로 대신한다
const MOVE_TYPES = new Set(Object.values(MOVES).map((m) => m.type));
const STAND_IN = { ghost: 'dark', poison: 'dark', bug: 'grass', ground: 'rock' };

export const TYPE_KO = {
  normal: '노말', fire: '불꽃', water: '물', grass: '풀', electric: '전기', ice: '얼음', fighting: '격투', poison: '독',
  ground: '땅', flying: '비행', psychic: '에스퍼', bug: '벌레', rock: '바위', ghost: '고스트', dragon: '드래곤',
  dark: '악', steel: '강철', fairy: '페어리',
};

const pad = (dex) => String(dex).padStart(4, '0');
export const customKey = (dex) => `dex${pad(dex)}`;
export const dexAssets = (dex) => `/assets/dex/${pad(dex)}/`;
export const isCustom = (key) => !!POKEMON[key]?.custom;

/** 기본으로 들어 있는 포켓몬의 도감 번호 → 키 */
export function builtinKeyOf(dex) {
  return Object.keys(POKEMON).find((k) => !POKEMON[k].custom && POKEMON[k].dex === dex) || null;
}

/** 이름·타입으로 포켓몬 정의를 만든다 (기본 27마리와 같은 모양). 도감 포켓몬과 사용자가 만든 포켓몬이 함께 쓴다 */
function buildMon({ name, en = null, types, dex = null }) {
  const type = types.find((t) => MOVE_TYPES.has(t))
    || types.map((t) => STAND_IN[t]).find((t) => MOVE_TYPES.has(t)) || 'normal';
  // 그 타입의 공격 기술 앞의 4개(데이터 순서상 대표 기술이 앞에 있다) + 몸통박치기
  const ofType = Object.keys(MOVES).filter((k) => MOVES[k].type === type && !MOVES[k].self);
  const moves = [...new Set([...ofType.slice(0, 4), 'tackle'])];
  // 다른 포켓몬·기술·행동 이름과 겹치는 별칭은 빼서 기존 명령을 망가뜨리지 않는다
  const aliases = [name, en && en.toLowerCase()].filter((a) => a && !aliasTaken(a));
  const head = [...name].slice(0, 2).join('');
  return {
    dex, name, type, scale: 3, speed: 65,
    aliases: aliases.length ? aliases : [`${name}${dex ?? ''}`],
    cries: [`${head}!`, `${name}~!`, `${head}${head}!`, `${head}?`],
    moves, signature: moves[0], custom: true,
  };
}

/** 도감 번호로 포켓몬 정의를 만든다 */
export function makeMon(dex) {
  const e = DEX.get(dex);
  if (!e) throw new Error(`도감에 없는 번호: ${dex}`);
  return { ...buildMon({ name: e.ko, en: e.en, types: e.types, dex }), assets: dexAssets(dex) };
}

/**
 * 사용자가 직접 그림을 넣은 포켓몬. c: config.creations 의 한 항목
 * { id, name, type, dex?, kind: 'pmd' | 'image', scale } — 그림은 메인이 /user/<id>/ 로 서빙한다
 */
export const creationKey = (id) => `user_${id}`;
export function makeCreation(c) {
  const en = c.dex ? DEX.get(c.dex)?.en : null;
  return {
    ...buildMon({ name: c.name, en, types: [c.type], dex: c.dex ?? null }),
    scale: c.scale ?? 3, assets: `/user/${c.id}/`, creation: c.id,
    simple: c.kind === 'image',   // 이미지 한 장: 렌더러가 통통 튀기기·흔들기로 움직임을 흉내 낸다
  };
}

/**
 * config.custom(도감 번호)과 config.creations(직접 넣은 그림)를 POKEMON에 반영한다.
 * 목록에 없는 사용자 포켓몬은 뺀다. 들어간 키 목록을 돌려준다
 */
export function applyCustom(dexList = [], creations = []) {
  const dexWant = (dexList || []).filter((d) => DEX.has(d) && !builtinKeyOf(d));
  const want = new Set([...dexWant.map(customKey), ...(creations || []).map((c) => creationKey(c.id))]);
  for (const k of Object.keys(POKEMON)) if (POKEMON[k].custom && !want.has(k)) delete POKEMON[k];
  refreshEntries();
  // 하나씩 넣어야 별칭 겹침을 바로 안다
  for (const d of dexWant) if (!POKEMON[customKey(d)]) { POKEMON[customKey(d)] = makeMon(d); refreshEntries(); }
  for (const c of creations || []) if (!POKEMON[creationKey(c.id)]) { POKEMON[creationKey(c.id)] = makeCreation(c); refreshEntries(); }
  return [...want];
}

/** 검색: 한글/영어 이름 일부 또는 도감 번호 → [{ dex, ko, en, types, builtin, added }] */
export function searchDex(query, limit = 8) {
  const q = query.trim().toLowerCase().replace(/\s+/g, '');
  if (!q) return [];
  const num = /^#?0*(\d{1,4})$/.exec(q);
  const hits = num ? [DEX.get(+num[1])].filter(Boolean)
    : [...DEX.values()].filter((e) => e.ko.includes(q) || e.en.toLowerCase().includes(q))
      .sort((a, b) => (b.ko.startsWith(q) || b.en.toLowerCase().startsWith(q)) - (a.ko.startsWith(q) || a.en.toLowerCase().startsWith(q)) || a.dex - b.dex);
  return hits.slice(0, limit).map((e) => ({ ...e, builtin: builtinKeyOf(e.dex), added: !!POKEMON[customKey(e.dex)] }));
}
