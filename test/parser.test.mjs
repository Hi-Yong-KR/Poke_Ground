import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, resolveTarget, acceptVoice } from '../src/shared/parser.mjs';

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

test('이해 못한 말', () => {
  const p = parseCommand('피카츄 오늘 날씨 어때');
  assert.deepEqual(p.pokemon, ['pikachu']);
  assert.equal(p.understood, false);
});
