import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEX, makeMon, applyCustom, searchDex, customKey, creationKey, builtinKeyOf } from '../src/shared/dex.mjs';
import { parseCommand, acceptTranscript } from '../src/shared/parser.mjs';
import { POKEMON, MOVES, CANT_TEXT, effectiveness } from '../src/shared/data.mjs';
import { learns, learnset } from '../src/shared/moves.mjs';
import { MOVEDEX } from '../src/shared/movedex.mjs';

const BUILTIN = Object.keys(POKEMON).length;

test('도감 표: 1025종, 이름과 타입이 모두 있음', () => {
  assert.equal(DEX.size, 1025);
  for (const e of DEX.values()) assert.ok(e.ko && e.en && e.types.length >= 1, e.dex);
  assert.equal(DEX.get(4).ko, '파이리');
  assert.equal(builtinKeyOf(25), 'pikachu');
});

test('추가 포켓몬 정의: 모든 종이 실제로 배우는 기술·타입·별칭을 가짐', () => {
  for (const dex of DEX.keys()) {
    if (builtinKeyOf(dex)) continue;
    const m = makeMon(dex);
    assert.ok(m.moves.length >= 1 && m.moves.every((k) => MOVES[k] && learns(dex, k)), `${dex} 기술`);
    assert.ok(CANT_TEXT[m.type], `${dex} 타입 ${m.type}`);
    assert.ok(m.aliases.length >= 1, `${dex} 별칭`);
  }
  assert.equal(makeMon(94).type, 'ghost');   // 팬텀(고스트/독): 고스트 기술도 이제 있다
  assert.ok(makeMon(94).moves.some((k) => MOVES[k].type === 'ghost'));
  assert.deepEqual(makeMon(132).moves, ['transform']);   // 메타몽은 변신만 배운다
});

test('기술 전부: 공식 기술이 모두 정의돼 있고, 포켓몬마다 배우는 기술을 앎', () => {
  assert.ok(MOVEDEX.length > 800);
  for (const [key] of MOVEDEX) {
    const m = MOVES[key];
    assert.ok(m && m.type && m.anims.length && (m.self ? m.selfText : m.fx), key);
    assert.ok(CANT_TEXT[m.type], `${key} 타입 ${m.type}`);
  }
  assert.equal(MOVES.flamewheel.name, '화염바퀴');                    // 다듬은 기술도 공식 이름으로,
  assert.ok(MOVES.flamewheel.aliases.includes('화염자동차'));         // 예전 이름은 별칭으로
  assert.ok(MOVES.headbutt.aliases.includes('박치기') && !MOVES.tackle.aliases.includes('박치기'));
  assert.equal(learns(25, 'thunderbolt'), true);
  assert.equal(learns(25, 'flamethrower'), false);
  assert.equal(learns(4, 'flamethrower'), true);
  assert.equal(learns(9999, 'tackle'), null);
  assert.deepEqual(learnset(132), ['transform']);
  for (const dex of DEX.keys()) assert.ok(learnset(dex).length >= 1, dex);
});

test('상성: 18속성, 속성이 둘이면 배율을 곱함', () => {
  assert.equal(effectiveness('electric', ['water', 'flying']), 4);
  assert.equal(effectiveness('electric', ['ground']), 0);
  assert.equal(effectiveness('fire', ['water']), 0.5);
  assert.equal(effectiveness('ghost', ['normal']), 0);
  assert.equal(effectiveness('normal', ['fire']), 1);
});

test('검색: 한글·영어·번호, 기본 포켓몬 표시', () => {
  assert.deepEqual(searchDex('파이').map((e) => e.ko).slice(0, 2), ['파이리', '파이어']);
  assert.equal(searchDex('gengar')[0].ko, '팬텀');
  assert.equal(searchDex('#004')[0].ko, '파이리');
  assert.equal(searchDex('피카츄')[0].builtin, 'pikachu');
  assert.deepEqual(searchDex('  '), []);
});

test('추가·삭제: 명령과 음성 필터가 새 이름을 알아듣고, 지우면 잊음', () => {
  try {
    assert.deepEqual(applyCustom([4, 94, 25]), [customKey(4), customKey(94)]);   // 기본 포켓몬(25)은 무시
    assert.equal(Object.keys(POKEMON).length, BUILTIN + 2);
    const p = parseCommand('파이리 크롬 화염방사');
    assert.deepEqual(p.pokemon, [customKey(4)]);
    assert.equal(p.move, 'flamethrower');
    assert.equal(acceptTranscript('팬텀 이리와').ok, true);
    assert.equal(parseCommand('피카츄 크롬 10만볼트').pokemon[0], 'pikachu');   // 기존 명령은 그대로

    applyCustom([4]);
    assert.equal(POKEMON[customKey(94)], undefined);
    assert.equal(acceptTranscript('팬텀 이리와').ok, false);
  } finally {
    applyCustom([]);
  }
  assert.equal(Object.keys(POKEMON).length, BUILTIN);
});

test('직접 그림을 넣은 포켓몬: 도감 포켓몬·창작 캐릭터 모두 명령으로 부를 수 있음', () => {
  try {
    const keys = applyCustom([4], [
      { id: 'abc1', name: '시비꼬', type: 'dragon', dex: 931, kind: 'pmd', scale: 3 },
      { id: 'abc2', name: '나비', type: 'normal', kind: 'image', scale: 0.4 },
    ]);
    assert.deepEqual(keys, [customKey(4), creationKey('abc1'), creationKey('abc2')]);
    const nabi = POKEMON[creationKey('abc2')];
    assert.equal(nabi.simple, true);
    assert.equal(nabi.assets, '/user/abc2/');
    assert.equal(nabi.scale, 0.4);
    assert.ok(nabi.aliases.includes('나비'));
    assert.ok(POKEMON[creationKey('abc1')].aliases.includes('squawkabilly'));   // 도감과 이어 두면 영어 이름도 별칭
    assert.equal(parseCommand('나비 이리와').pokemon[0], creationKey('abc2'));
    assert.equal(parseCommand('시비꼬 크롬 드래곤클로').move, 'dragonclaw');

    applyCustom([4], [{ id: 'abc2', name: '나비', type: 'normal', kind: 'image' }]);
    assert.equal(POKEMON[creationKey('abc1')], undefined);

    // 속성을 여러 개 고르면 대표 속성은 첫 번째, 기술은 속성마다 번갈아 고른다 (예전 설정의 type 하나도 읽는다)
    applyCustom([], [{ id: 'abc3', name: '불물이', types: ['fire', 'water'], kind: 'image' }]);
    const fw = POKEMON[creationKey('abc3')];
    assert.equal(fw.type, 'fire');
    assert.deepEqual(fw.types, ['fire', 'water']);
    assert.deepEqual([...new Set(fw.moves.filter((k) => k !== 'tackle').map((k) => MOVES[k].type))], ['fire', 'water']);
    applyCustom([], [{ id: 'abc2', name: '나비', type: 'normal', kind: 'image' }]);
    assert.equal(POKEMON[creationKey('abc1')], undefined);
  } finally {
    applyCustom([]);
  }
  assert.equal(Object.keys(POKEMON).length, BUILTIN);
});
