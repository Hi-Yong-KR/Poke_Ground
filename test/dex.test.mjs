import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEX, makeMon, applyCustom, searchDex, customKey, creationKey, builtinKeyOf } from '../src/shared/dex.mjs';
import { parseCommand, acceptTranscript } from '../src/shared/parser.mjs';
import { POKEMON, MOVES, CANT_TEXT } from '../src/shared/data.mjs';

const BUILTIN = Object.keys(POKEMON).length;

test('도감 표: 1025종, 이름과 타입이 모두 있음', () => {
  assert.equal(DEX.size, 1025);
  for (const e of DEX.values()) assert.ok(e.ko && e.en && e.types.length >= 1, e.dex);
  assert.equal(DEX.get(4).ko, '파이리');
  assert.equal(builtinKeyOf(25), 'pikachu');
});

test('추가 포켓몬 정의: 모든 종이 쓸 수 있는 기술·타입·별칭을 가짐', () => {
  for (const dex of DEX.keys()) {
    if (builtinKeyOf(dex)) continue;
    const m = makeMon(dex);
    assert.ok(m.moves.length >= 2 && m.moves.every((k) => MOVES[k]), `${dex} 기술`);
    assert.ok(CANT_TEXT[m.type], `${dex} 타입 ${m.type}`);
    assert.ok(m.aliases.length >= 1, `${dex} 별칭`);
  }
  assert.equal(makeMon(94).type, 'dark');   // 팬텀(고스트/독) → 비슷한 악 타입 기술
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
