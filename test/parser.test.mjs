import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, resolveTarget, acceptVoice, acceptTranscript, voiceKeywords, voiceGrammar } from '../src/shared/parser.mjs';
import { POKEMON, MOVES, ACTIONS, ATTACK_WORDS } from '../src/shared/data.mjs';

test('데이터: 별칭이 서로 겹치지 않고, 포켓몬 기술은 모두 정의돼 있음', () => {
  const seen = new Map();
  const add = (alias, owner) => {
    const prev = seen.get(alias);
    assert.ok(!prev || prev === owner, `별칭 '${alias}'이(가) ${prev}와 ${owner}에 중복`);
    seen.set(alias, owner);
  };
  for (const [k, p] of Object.entries(POKEMON)) p.aliases.forEach((a) => add(a, 'pokemon:' + k));
  for (const [k, m] of Object.entries(MOVES)) m.aliases.forEach((a) => add(a, 'move:' + k));
  for (const [k, list] of Object.entries(ACTIONS)) list.forEach((a) => add(a, 'action:' + k));
  ATTACK_WORDS.forEach((a) => add(a, 'attack'));
  for (const [k, p] of Object.entries(POKEMON)) {
    for (const mv of p.moves) assert.ok(MOVES[mv], `${k}의 기술 ${mv}가 없음`);
    assert.ok(Number.isInteger(p.dex), `${k} 도감 번호 없음`);
  }
  assert.equal(Object.keys(POKEMON).length, 27);
});

test('새 포켓몬 명령', () => {
  let p = parseCommand('쥬피썬더 크롬 10만볼트');
  assert.deepEqual(p.pokemon, ['jolteon']);
  assert.equal(p.move, 'thunderbolt');
  p = parseCommand('글레이시아 휴지통 냉동빔');
  assert.deepEqual(p.pokemon, ['glaceon']);
  assert.equal(p.move, 'icebeam');
  assert.deepEqual(parseCommand('에브이 사이코키네시스').pokemon, ['espeon']);
  assert.deepEqual(parseCommand('이브이 스피드스타').pokemon, ['eevee']);
  p = parseCommand('님피아 피카츄 문포스');
  assert.deepEqual(p.pokemon, ['sylveon']);
  assert.equal(p.targetPokemon, 'pikachu');
  assert.equal(parseCommand('염버니 화염볼').move, 'pyroball');
  assert.equal(parseCommand('블래키 물기').move, 'bite');
  assert.deepEqual(parseCommand('주리비안 리프블레이드').pokemon, ['snivy']);
  assert.equal(parseCommand('마휘핑 나와').action, 'out');
  assert.equal(parseCommand('조로아 크롬 공격').attack, true);
});

test('띄어쓴 단어가 옆 단어에 먹히지 않음', () => {
  const p = parseCommand('모두 들어가');
  assert.equal(p.all, true);
  assert.equal(p.action, 'ball');
  assert.equal(parseCommand('모두들 들어가').action, 'ball');
  assert.equal(parseCommand('피카츄 크롬 십만 볼트').move, 'thunderbolt');
});

const w = (s) => s.split(' ').map((x) => { const [word, conf] = x.split(':'); return { word, conf: +conf }; });

test('음성 필터: 진짜 명령은 통과', () => {
  assert.equal(acceptVoice('', w('피카츄:1 크롬:1 만볼트:0.72')).ok, true);
  assert.equal(acceptVoice('', w('꼬부기:1 클로드:1 물대포:1')).ok, true);
  assert.equal(acceptVoice('', w('리자몽:1 이리와:1')).ok, true);
  assert.equal(acceptVoice('', w('모두:1 춤춰:1')).ok, true);
  assert.equal(acceptVoice('', w('피카츄:1 꼬부기:1 공격:1')).ok, true);
  assert.equal(acceptVoice('', w('피카츄:1')).ok, true);   // 이름만 부르기
});

test('음성 필터: 실제로 측정된 잡담 오인식은 거부', () => {
  for (const s of [
    '꼬리:1 클로드:1 슬랙:0.51 산책:0.48 산책:0.82 스탑:0.51 다:0.66',
    '점프:0.8 한바퀴:0.86 못됐:0.44 버블:1 따라오:1 꼬리치기:1 어택:1',
    '버블:0.96 스탑:0.93 스탑:0.39 앉어:1 안돼:1 볼트:1 출동:0.57 오세요:0.57',
    '한바퀴:1 슬랙:1 달려:1 하이:0.58 번개:0.58 볼트:0.8 쉬어:0.8',
    '날개:1 스톱:0.62 예쁘다:0.62 최고:1 아이언:0.85 예쁘다:0.52',
    '공격:1 이상해:1 이브이:1 놀아:1 헬로:1 오세요:1',
  ]) assert.equal(acceptVoice('', w(s)).ok, false, s);
  assert.equal(acceptVoice('', w('이브이:1 휴지통:1 폼:0.86 귀여워:0.78')).ok, false);   // 지시 2개 섞임
  assert.equal(acceptVoice('', w('피카츄:0.5 점프:1')).ok, false);
});

test('받아쓰기 필터(Whisper): 조사·어미가 붙어도 명령은 통과', () => {
  for (const s of ['피카츄 크롬 십만 볼트', '피카츄야 크롬 공격해', '꼬부기 물대포!', '모두 이리와', '피카츄']) {
    assert.equal(acceptTranscript(s).ok, true, s);
  }
  const v = acceptTranscript('피카츄야 크롬 공격해');
  assert.equal(parseCommand(v.text).attack, true);
  assert.deepEqual(parseCommand(acceptTranscript('피카츄 크롬 십만 볼트').text).move, 'thunderbolt');
  // 실제 Whisper 출력: 대상과 기술을 붙여 받아씀 ("크롬 십만볼트" → "그롬싱만볼트")
  const glued = parseCommand(acceptTranscript('피카츄 그롬싱만볼트').text);
  assert.equal(glued.move, 'thunderbolt');
  assert.equal(glued.targetKey, parseCommand('피카츄 크롬 공격').targetKey);
});

test('받아쓰기 필터(Whisper): 잡담은 거부', () => {
  for (const s of [
    '오늘 점심 뭐 먹을까',
    '크롬 공격해 피카츄',
    '피카츄 점프 춤춰',
    '피카츄 진짜 귀엽다 그치 오늘 날씨도 좋고',
    '',
  ]) assert.equal(acceptTranscript(s).ok, false, s);
});

test('Whisper 힌트 단어: 한글만, 100개 이하, 포켓몬 이름 포함', () => {
  const k = voiceKeywords();
  assert.ok(k.length > 0 && k.length <= 100);
  assert.ok(k.every((w) => /^[가-힣]{2,20}$/.test(w)));
  assert.ok(k.includes('피카츄') && k.includes('꼬부기'));
});

const objects = [
  { kind: 'window', name: '새 탭 - Chrome', process: 'chrome', cls: 'Chrome_WidgetWin_1', z: 1, x: 0, y: 0, w: 800, h: 600 },
  { kind: 'window', name: 'Claude', process: 'claude', cls: 'Chrome_WidgetWin_1', z: 0, x: 0, y: 0, w: 800, h: 600 },
  { kind: 'window', name: 'd_5', process: 'explorer', cls: 'CabinetWClass', z: 2, x: 0, y: 0, w: 800, h: 600 },
  { kind: 'icon', name: '휴지통', x: 0, y: 0, w: 90, h: 90 },
  { kind: 'icon', name: 'Google Chrome', x: 0, y: 100, w: 90, h: 90 },
  { kind: 'icon', name: '보고서 최종본', x: 0, y: 200, w: 90, h: 90 },
];

test('피카츄 크롬 공격', () => {
  const p = parseCommand('피카츄 크롬 공격!');
  assert.deepEqual(p.pokemon, ['pikachu']);
  assert.equal(p.attack, true);
  assert.equal(resolveTarget(p, objects).process, 'chrome');
});

test('피카츄 크롬 10만볼트 / 십만 볼트', () => {
  for (const t of ['피카츄 크롬 10만볼트', '피카츄 크롬에 십만 볼트']) {
    const p = parseCommand(t);
    assert.equal(p.move, 'thunderbolt', t);
    assert.equal(resolveTarget(p, objects).process, 'chrome');
  }
});

test('리자몽 윈도우탐색기 불대문자', () => {
  const p = parseCommand('리자몽 윈도우탐색기 불대문자');
  assert.deepEqual(p.pokemon, ['charizard']);
  assert.equal(p.move, 'fireblast');
  assert.equal(resolveTarget(p, objects).cls, 'CabinetWClass');
});

test('꼬부기 클로드 물대포', () => {
  const p = parseCommand('꼬부기야 클로드한테 물대포 쏴');
  assert.deepEqual(p.pokemon, ['squirtle']);
  assert.equal(p.move, 'watergun');
  assert.equal(resolveTarget(p, objects).process, 'claude');
});

test('아이콘 지정과 임의 이름', () => {
  let p = parseCommand('피카츄 크롬 아이콘 공격');
  assert.equal(resolveTarget(p, objects).kind, 'icon');
  p = parseCommand('이상해씨 보고서 덩굴채찍');
  assert.equal(p.move, 'vinewhip');
  assert.equal(resolveTarget(p, objects).name, '보고서 최종본');
  p = parseCommand('리자몽 휴지통 화염방사');
  assert.equal(resolveTarget(p, objects).name, '휴지통');
});

test('포켓몬끼리 공격', () => {
  const p = parseCommand('피카츄 꼬부기 공격');
  assert.deepEqual(p.pokemon, ['pikachu']);
  assert.equal(p.targetPokemon, 'squirtle');
});

test('일반 행동', () => {
  assert.equal(parseCommand('피카츄 이리와').action, 'come');
  assert.equal(parseCommand('리자몽 자').action, 'sleep');
  assert.equal(parseCommand('모두 춤춰').action, 'dance');
  assert.equal(parseCommand('모두 춤춰').all, true);
  assert.equal(parseCommand('이브이 꼬리흔들기').move, 'tailwhip');
});

test('음성 오인식 보정', () => {
  const p = parseCommand('피카추 크롬 십만볼뜨');
  assert.deepEqual(p.pokemon, ['pikachu']);
  assert.equal(p.move, 'thunderbolt');
  assert.equal(parseCommand('꼬부지 물대포').pokemon[0], 'squirtle');
});

test('공식 기술 전부: 이름으로 부르고, 짧은 이름은 띄어 쓴 단어일 때만', () => {
  assert.equal(parseCommand('피카츄 크롬 아이언테일').move, 'irontail');
  assert.equal(parseCommand('리자몽 크롬 오버히트').move, 'overheat');
  assert.equal(parseCommand('팬텀 섀도볼').move, 'shadowball');
  assert.equal(parseCommand('잠만보 휴지통 지진').move, 'earthquake');
  assert.equal(parseCommand('잠만보 휴지통 지진').targetKey, parseCommand('잠만보 휴지통 공격').targetKey);
  assert.equal(parseCommand('피카츄 크롬 thunderbolt').move, 'thunderbolt');
  assert.equal(parseCommand('피카츄 크롬 박치기').move, 'headbutt');
  // 대상 이름 속의 짧은 기술 이름('독침' 등)을 기술로 잘라 먹지 않는다
  const p = parseCommand('피카츄 독침맞은사과 공격');
  assert.equal(p.move, null);
  assert.ok(p.targetWords.includes('독침맞은사과'));
});

test('음성: 자동 기술은 Vosk 문법·Whisper 힌트에 넣지 않음', () => {
  assert.ok(!voiceGrammar().includes('오버히트'));
  assert.ok(voiceGrammar().includes('화염방사'));
  assert.ok(!voiceKeywords().includes('오버히트'));
});

test('이해 못한 말', () => {
  const p = parseCommand('피카츄 오늘 날씨 어때');
  assert.deepEqual(p.pokemon, ['pikachu']);
  assert.equal(p.understood, false);
});
