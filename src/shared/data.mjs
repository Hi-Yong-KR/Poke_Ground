// 포켓몬·기술·행동·리액션 정의
// 포켓몬 목록은 여기 한 곳에서 관리한다 (에셋 다운로드 스크립트·렌더러가 이 목록을 읽음). dex: 전국도감 번호
import { compact } from './hangul.mjs';
import { addAllMoves } from './moves.mjs';

const mon = (dex, name, type, aliases, cries, moves, extra = {}) =>
  ({ dex, name, type, scale: 3, speed: 65, aliases, cries, moves, signature: moves[0], ...extra });

export const POKEMON = {
  pikachu: {
    dex: 25, name: '피카츄', type: 'electric', scale: 3, speed: 75,
    aliases: ['피카츄', '피카추', '피카쮸', '삐카츄', '피카', 'pikachu'],
    cries: ['피카!', '피카피카!', '피카츄~!', '피-카-츄우!', '피카?', '피카아~'],
    moves: ['thunderbolt', 'thundershock', 'thunder', 'quickattack', 'irontail', 'tackle'],
    signature: 'thunderbolt',
  },
  charizard: {
    dex: 6, name: '리자몽', type: 'fire', scale: 2.6, speed: 65,
    aliases: ['리자몽', '리자', 'charizard'],
    cries: ['그오오!', '리자아!', '갸오오~', '리자몽!', '크르릉...'],
    moves: ['flamethrower', 'fireblast', 'ember', 'wingattack', 'dragonclaw', 'tackle'],
    signature: 'flamethrower',
  },
  squirtle: {
    dex: 7, name: '꼬부기', type: 'water', scale: 3, speed: 60,
    aliases: ['꼬부기', '꼬북이', '꼬북', '꼬부', 'squirtle'],
    cries: ['꼬북!', '꼬북꼬북!', '꼬부기~!', '꼬부욱?'],
    moves: ['watergun', 'hydropump', 'bubble', 'withdraw', 'tackle'],
    signature: 'watergun',
  },
  bulbasaur: {
    dex: 1, name: '이상해씨', type: 'grass', scale: 3, speed: 55,
    aliases: ['이상해씨', '이상해시', '이상해', 'bulbasaur'],
    cries: ['이상해~씨!', '씨-이!', '이상해!', '해씨~'],
    moves: ['vinewhip', 'razorleaf', 'solarbeam', 'tackle'],
    signature: 'vinewhip',
  },
  eevee: {
    dex: 133, name: '이브이', type: 'normal', scale: 3, speed: 70,
    aliases: ['이브이', '이부이', 'eevee'],
    cries: ['브이!', '브이브이!', '이브이~!', '브이?'],
    moves: ['swift', 'quickattack', 'tackle', 'tailwhip'],
    signature: 'swift',
  },
  // ---- 이브이 진화형 ----
  jolteon: mon(135, '쥬피썬더', 'electric', ['쥬피썬더', '쥬피선더', '쥬피'], ['썬더!', '쥬피~!', '쥬피썬더!', '찌릿?'],
    ['thunderbolt', 'discharge', 'thundershock', 'quickattack', 'tackle'], { speed: 90 }),
  sylveon: mon(700, '님피아', 'fairy', ['님피아', '님피'], ['님피~♪', '님피아!', '피아~', '님피?'],
    ['moonblast', 'dazzlinggleam', 'fairywind', 'drainingkiss', 'quickattack']),
  flareon: mon(136, '부스터', 'fire', ['부스터', '부스'], ['부스~!', '부스터!', '부스부스!', '후우...'],
    ['flamethrower', 'flamecharge', 'ember', 'fireblast', 'tackle']),
  glaceon: mon(471, '글레이시아', 'ice', ['글레이시아', '글레이시', '글레이'], ['글레이~', '시아!', '글레이시아~!', '시아?'],
    ['icebeam', 'blizzard', 'iceshard', 'icywind', 'quickattack']),
  leafeon: mon(470, '리피아', 'grass', ['리피아', '리피'], ['리피~', '리피아!', '피아~♪', '리피?'],
    ['leafblade', 'razorleaf', 'energyball', 'magicalleaf', 'quickattack']),
  umbreon: mon(197, '블래키', 'dark', ['블래키', '블랙키', '블래'], ['블래...', '블래키!', '키이...', '블래?'],
    ['darkpulse', 'bite', 'feintattack', 'moonlight', 'quickattack'], { speed: 60 }),
  espeon: mon(196, '에브이', 'psychic', ['에브이', '에브'], ['에브~', '에브이!', '브이~♪', '에브?'],
    ['psychic', 'psybeam', 'confusion', 'swift', 'quickattack']),
  vaporeon: mon(134, '샤미드', 'water', ['샤미드', '샤미'], ['샤미~', '샤미드!', '샤아~', '샤미?'],
    ['hydropump', 'scald', 'watergun', 'bubble', 'quickattack'], { speed: 60 }),
  // ---- 그 밖의 귀여운 친구들 ----
  riolu: mon(447, '리오르', 'fighting', ['리오르', '리올루', '리오'], ['리오!', '리오르!', '리오오~', '리오?'],
    ['aurasphere', 'forcepalm', 'vacuumwave', 'quickattack'], { speed: 80 }),
  zorua: mon(570, '조로아', 'dark', ['조로아', '조로'], ['조로?', '조로아~!', '조로조로!', '아~'],
    ['nightdaze', 'feintattack', 'scratch', 'bite'], { speed: 75 }),
  pachirisu: mon(417, '파치리스', 'electric', ['파치리스', '파치리', '파치'], ['파치파치!', '파치리~스!', '파치?', '리스~'],
    ['nuzzle', 'discharge', 'thundershock', 'quickattack'], { scale: 2.6, speed: 85 }),
  minccino: mon(572, '치라미', 'normal', ['치라미', '치라'], ['치라!', '치라미~', '치라치라!', '미~?'],
    ['tailslap', 'hypervoice', 'swift', 'tackle']),
  buneary: mon(427, '이어롤', 'normal', ['이어롤', '이어'], ['이어~', '이어롤!', '롤롤!', '이어?'],
    ['bounce', 'dizzypunch', 'quickattack', 'charm'], { scale: 2.7, speed: 75 }),
  corsola: mon(222, '코산호', 'water', ['코산호', '코산'], ['코산!', '코산호~', '산호?', '코오~'],
    ['powergem', 'spikecannon', 'bubble', 'watergun'], { speed: 45 }),
  emolga: mon(587, '에몽가', 'electric', ['에몽가', '에몽'], ['에몽!', '에몽가~!', '몽몽!', '에몽?'],
    ['acrobatics', 'nuzzle', 'discharge', 'thundershock'], { speed: 85 }),
  espurr: mon(677, '냐스퍼', 'psychic', ['냐스퍼', '냐스'], ['냐...', '냐스퍼.', '냐아?', '...냐'],
    ['psychic', 'confusion', 'disarmingvoice', 'fakeout'], { speed: 55 }),
  piplup: mon(393, '팽도리', 'water', ['팽도리', '팽도', '펭도리'], ['팽!', '팽도리!', '팽팽~', '도리?'],
    ['bubble', 'watergun', 'drillpeck', 'peck'], { speed: 55 }),
  snivy: mon(495, '주리비얀', 'grass', ['주리비얀', '주리비안', '주리비'], ['주리...', '주리비얀!', '비얀~', '흥.'],
    ['leafblade', 'leafstorm', 'vinewhip', 'magicalleaf'], { speed: 70 }),
  fennekin: mon(653, '푸호꼬', 'fire', ['푸호꼬', '푸호코', '푸호'], ['푸호!', '푸호꼬~', '꼬꼬!', '푸호?'],
    ['mysticalfire', 'flamethrower', 'ember', 'psybeam']),
  scorbunny: mon(813, '염버니', 'fire', ['염버니', '염버'], ['염버!', '염버니!', '버니버니!', '염버?'],
    ['pyroball', 'flamecharge', 'doublekick', 'ember'], { speed: 90 }),
  cyndaquil: mon(155, '브케인', 'fire', ['브케인', '브케'], ['브케!', '브케인~', '케인!', '브케?'],
    ['eruption', 'flamewheel', 'flamethrower', 'ember'], { speed: 60 }),
  alcremie: mon(869, '마휘핑', 'fairy', ['마휘핑', '마휘'], ['마휘~♪', '휘핑!', '마휘핑~', '휘?'],
    ['dazzlinggleam', 'drainingkiss', 'decorate', 'fairywind'], { speed: 50 }),
};

export const ALL_ALIASES = ['모두', '다들', '전부', '얘들아', '모두들', '다같이', '다'];

// fx: 이펙트 종류, anims: 선호 애니메이션(앞에서부터 있는 것 사용), melee: 대상에게 달려가서 사용
export const MOVES = {
  thunderbolt: { name: '10만볼트', type: 'electric', fx: 'thunderbolt', anims: ['Shock', 'Shoot', 'Charge', 'Attack'], aliases: ['10만볼트', '십만볼트', '100000볼트', '만볼트', '백만볼트', '천만볼트', '볼트'] },
  thundershock: { name: '전기쇼크', type: 'electric', fx: 'spark', anims: ['Shoot', 'Charge', 'Attack'], aliases: ['전기쇼크', '전기충격', '전기', '찌릿찌릿'] },
  thunder: { name: '번개', type: 'electric', fx: 'thunder', anims: ['Charge', 'Shock', 'Shoot'], aliases: ['번개', '썬더', '천둥'] },
  quickattack: { name: '전광석화', type: 'normal', fx: 'dash', melee: true, anims: ['QuickStrike', 'Strike', 'Attack'], aliases: ['전광석화'] },
  irontail: { name: '아이언테일', type: 'steel', fx: 'slam', melee: true, anims: ['Swing', 'Attack', 'Strike'], aliases: ['아이언테일', '아이언', '꼬리치기'] },
  tackle: { name: '몸통박치기', type: 'normal', fx: 'dash', melee: true, anims: ['Attack', 'Strike', 'Head'], aliases: ['몸통박치기', '박치기', '몸통'] },
  flamethrower: { name: '화염방사', type: 'fire', fx: 'flame', anims: ['SpAttack', 'Shoot', 'Attack'], aliases: ['화염방사', '화염방사기', '화염', '불뿜어', '불꽃방사'] },
  fireblast: { name: '불대문자', type: 'fire', fx: 'fireblast', anims: ['SpAttack', 'Shoot', 'Charge'], aliases: ['불대문자', '대문자', '불의대문자'] },
  ember: { name: '불꽃세례', type: 'fire', fx: 'ember', anims: ['Shoot', 'Attack'], aliases: ['불꽃세례', '불꽃', '불씨', '불'] },
  wingattack: { name: '날개치기', type: 'flying', fx: 'slash', melee: true, anims: ['Strike', 'Attack'], aliases: ['날개치기', '날개'] },
  dragonclaw: { name: '드래곤클로', type: 'dragon', fx: 'slash', melee: true, anims: ['Strike', 'Attack'], aliases: ['드래곤클로', '드래곤크로', '용의발톱', '발톱'] },
  watergun: { name: '물대포', type: 'water', fx: 'water', anims: ['Shoot', 'Attack'], aliases: ['물대포', '물총', '워터건', '물'] },
  hydropump: { name: '하이드로펌프', type: 'water', fx: 'hydropump', anims: ['Shoot', 'Charge', 'Attack'], aliases: ['하이드로펌프', '하이드로', '펌프'] },
  bubble: { name: '거품', type: 'water', fx: 'bubble', anims: ['Shoot', 'Attack'], aliases: ['거품광선', '거품', '버블', '비눗방울', '방울'] },
  withdraw: { name: '껍질에숨기', type: 'water', self: true, selfText: '등껍질 속에 쏙 숨었다. 무서운 건 아닌 것 같다', anims: ['Withdraw', 'Sit'], aliases: ['껍질에숨기', '껍질', '등껍질'] },
  vinewhip: { name: '덩굴채찍', type: 'grass', fx: 'vine', anims: ['Shoot', 'Attack', 'Strike'], aliases: ['덩굴채찍', '덩굴', '채찍'] },
  razorleaf: { name: '잎날가르기', type: 'grass', fx: 'leaf', anims: ['Shoot', 'Attack'], aliases: ['잎날가르기', '잎날', '나뭇잎', '잎사귀'] },
  solarbeam: { name: '솔라빔', type: 'grass', fx: 'solarbeam', anims: ['Charge', 'Shoot', 'Attack'], aliases: ['솔라빔', '쏠라빔', '태양광선', '솔라'] },
  swift: { name: '스피드스타', type: 'normal', fx: 'stars', anims: ['Shoot', 'Attack'], aliases: ['스피드스타', '스타', '별'] },
  tailwhip: { name: '꼬리흔들기', type: 'normal', self: true, selfText: '꼬리를 귀엽게 흔들어 상대의 방어를 낮추려 한다', anims: ['TailWhip', 'Double', 'Swing'], aliases: ['꼬리흔들기', '꼬리'] },

  // ---- 전기 ----
  discharge: { name: '방전', type: 'electric', fx: 'thunder', anims: ['Charge', 'Shoot', 'Attack'], aliases: ['방전'] },
  nuzzle: { name: '볼부비부비', type: 'electric', fx: 'spark', melee: true, anims: ['Attack', 'Strike', 'Head'], aliases: ['볼부비부비', '볼부비'] },
  // ---- 불꽃 ----
  flamecharge: { name: '니트로차지', type: 'fire', fx: 'dash', melee: true, anims: ['Attack', 'Strike', 'Head'], aliases: ['니트로차지', '니트로'] },
  flamewheel: { name: '화염자동차', type: 'fire', fx: 'dash', melee: true, anims: ['Rotate', 'Attack', 'Strike'], aliases: ['화염자동차', '불바퀴'] },
  mysticalfire: { name: '매지컬플레임', type: 'fire', fx: 'orb', anims: ['Shoot', 'Charge', 'Attack'], aliases: ['매지컬플레임', '매지컬불꽃'] },
  pyroball: { name: '화염볼', type: 'fire', fx: 'fireblast', anims: ['Kick', 'Shoot', 'Attack', 'Strike'], aliases: ['화염볼', '파이어볼', '불공'] },
  eruption: { name: '분화', type: 'fire', fx: 'eruption', anims: ['Charge', 'Shoot', 'Attack'], aliases: ['분화', '폭발'] },
  // ---- 물 ----
  scald: { name: '열탕', type: 'water', fx: 'stream', anims: ['Shoot', 'Attack'], aliases: ['열탕', '뜨거운물'] },
  // ---- 풀 ----
  leafblade: { name: '리프블레이드', type: 'grass', fx: 'slash', melee: true, anims: ['Strike', 'Swing', 'Attack'], aliases: ['리프블레이드', '잎칼'] },
  leafstorm: { name: '리프스톰', type: 'grass', fx: 'blizzard', anims: ['Charge', 'Shoot', 'Attack'], aliases: ['리프스톰', '나뭇잎폭풍'] },
  magicalleaf: { name: '매지컬리프', type: 'grass', fx: 'leaf', anims: ['Shoot', 'Attack'], aliases: ['매지컬리프'] },
  energyball: { name: '에너지볼', type: 'grass', fx: 'orb', anims: ['Shoot', 'Charge', 'Attack'], aliases: ['에너지볼'] },
  // ---- 얼음 ----
  icebeam: { name: '냉동빔', type: 'ice', fx: 'beam', anims: ['Shoot', 'Charge', 'Attack'], aliases: ['냉동빔', '얼음빔', '아이스빔'] },
  blizzard: { name: '눈보라', type: 'ice', fx: 'blizzard', anims: ['Charge', 'Shoot', 'Attack'], aliases: ['눈보라', '블리자드'] },
  iceshard: { name: '얼음뭉치', type: 'ice', fx: 'shards', anims: ['Shoot', 'Attack'], aliases: ['얼음뭉치', '얼음'] },
  icywind: { name: '얼다바람', type: 'ice', fx: 'sparkle', anims: ['Shoot', 'Attack'], aliases: ['얼다바람', '찬바람'] },
  // ---- 페어리 ----
  moonblast: { name: '문포스', type: 'fairy', fx: 'orb', anims: ['Charge', 'Shoot', 'Attack'], aliases: ['문포스', '달의힘'] },
  dazzlinggleam: { name: '매지컬샤인', type: 'fairy', fx: 'beam', anims: ['Charge', 'Shoot', 'Attack'], aliases: ['매지컬샤인', '샤인'] },
  fairywind: { name: '요정의바람', type: 'fairy', fx: 'sparkle', anims: ['Shoot', 'Attack'], aliases: ['요정의바람', '요정바람'] },
  drainingkiss: { name: '드레인키스', type: 'fairy', fx: 'kiss', anims: ['Shoot', 'Attack', 'Hop'], aliases: ['드레인키스', '뽀뽀', '키스'] },
  disarmingvoice: { name: '차밍보이스', type: 'fairy', fx: 'ringwave', anims: ['Shoot', 'Attack'], aliases: ['차밍보이스'] },
  charm: { name: '애교부리기', type: 'fairy', self: true, selfText: '한껏 애교를 부린다. 귀여움으로 상대의 공격을 낮추려는 작전 같다', anims: ['Pose', 'Hop', 'Double'], aliases: ['애교부리기', '애교'] },
  decorate: { name: '데코레이션', type: 'fairy', self: true, selfText: '크림과 사탕으로 몸을 예쁘게 꾸민다. 칭찬받고 싶은 것 같다', anims: ['Pose', 'Rotate', 'Double'], aliases: ['데코레이션', '꾸미기'] },
  // ---- 악 ----
  darkpulse: { name: '악의파동', type: 'dark', fx: 'ringwave', anims: ['Charge', 'Shoot', 'Attack'], aliases: ['악의파동'] },
  nightdaze: { name: '나이트버스트', type: 'dark', fx: 'ringwave', anims: ['Charge', 'Shoot', 'Attack'], aliases: ['나이트버스트'] },
  bite: { name: '물기', type: 'dark', fx: 'bite', melee: true, anims: ['Attack', 'Strike', 'Head'], aliases: ['물기', '깨물어', '깨물기'] },
  feintattack: { name: '속여때리기', type: 'dark', fx: 'dash', melee: true, anims: ['Attack', 'Strike'], aliases: ['속여때리기'] },
  moonlight: { name: '달의불빛', type: 'fairy', self: true, selfText: '달빛을 받아 고리 무늬가 은은하게 빛난다. 기운을 회복하는 중', anims: ['Charge', 'Pose', 'Idle'], aliases: ['달의불빛', '달빛'] },
  // ---- 에스퍼 ----
  psychic: { name: '사이코키네시스', type: 'psychic', fx: 'psywave', anims: ['Charge', 'Shoot', 'Attack'], aliases: ['사이코키네시스', '사이코', '염력'] },
  confusion: { name: '염동력', type: 'psychic', fx: 'psywave', anims: ['Shoot', 'Charge', 'Attack'], aliases: ['염동력'] },
  psybeam: { name: '환상빔', type: 'psychic', fx: 'beam', anims: ['Shoot', 'Attack'], aliases: ['환상빔', '사이코빔'] },
  // ---- 격투 ----
  aurasphere: { name: '파동탄', type: 'fighting', fx: 'orb', anims: ['Charge', 'Shoot', 'Attack'], aliases: ['파동탄', '파동'] },
  forcepalm: { name: '발경', type: 'fighting', fx: 'slam', melee: true, anims: ['Strike', 'Attack'], aliases: ['발경', '장풍'] },
  vacuumwave: { name: '진공파', type: 'fighting', fx: 'shards', anims: ['Shoot', 'Attack'], aliases: ['진공파'] },
  doublekick: { name: '두번치기', type: 'fighting', fx: 'slam', melee: true, anims: ['Kick', 'Strike', 'Attack'], aliases: ['두번치기', '발차기'] },
  dizzypunch: { name: '잼잼펀치', type: 'normal', fx: 'slam', melee: true, anims: ['Strike', 'Attack'], aliases: ['잼잼펀치', '펀치'] },
  // ---- 노말 ----
  scratch: { name: '할퀴기', type: 'normal', fx: 'slash', melee: true, anims: ['Strike', 'Attack'], aliases: ['할퀴기', '할퀴어'] },
  tailslap: { name: '스위프뺨치기', type: 'normal', fx: 'slam', melee: true, anims: ['Swing', 'Strike', 'Attack'], aliases: ['스위프뺨치기', '뺨치기'] },
  hypervoice: { name: '하이퍼보이스', type: 'normal', fx: 'ringwave', anims: ['Shoot', 'Attack'], aliases: ['하이퍼보이스'] },
  bounce: { name: '뛰어오르다', type: 'flying', fx: 'slam', melee: true, anims: ['Hop', 'LeapForth', 'Attack'], aliases: ['뛰어오르다', '바운스'] },
  fakeout: { name: '속이다', type: 'normal', fx: 'dash', melee: true, anims: ['Attack', 'Strike'], aliases: ['속이다', '깜짝공격'] },
  // ---- 비행 ----
  acrobatics: { name: '애크러뱃', type: 'flying', fx: 'dash', melee: true, anims: ['Rotate', 'Attack', 'Strike'], aliases: ['애크러뱃', '아크로바틱'] },
  drillpeck: { name: '회오리부리', type: 'flying', fx: 'slam', melee: true, anims: ['Attack', 'Strike', 'Rotate'], aliases: ['회오리부리'] },
  peck: { name: '쪼기', type: 'flying', fx: 'dash', melee: true, anims: ['Attack', 'Strike'], aliases: ['쪼기', '쪼아'] },
  // ---- 바위 ----
  powergem: { name: '파워젬', type: 'rock', fx: 'shards', anims: ['Shoot', 'Charge', 'Attack'], aliases: ['파워젬', '보석'] },
  spikecannon: { name: '가시캐논', type: 'rock', fx: 'shards', anims: ['Shoot', 'Attack'], aliases: ['가시캐논', '가시'] },
};

export const ATTACK_WORDS = ['공격', '어택', '때려', '혼내', '기술', '필살기', '부숴', '파괴'];

// 기술 외 일반 명령
export const ACTIONS = {
  come: ['이리와', '일루와', '이리온', '여기와', '와봐', '오렴', '컴온', '오세요', '와'],
  follow: ['따라와', '따라다녀', '쫓아와', '따라오', '따라'],
  sit: ['앉아', '앉자', '앉어', '앉아봐'],
  sleep: ['잘자', '자자', '잠자', '코자', '낮잠', '쉬어', '자'],
  wake: ['일어나', '깨어나', '기상', '일어'],
  jump: ['점프', '폴짝', '뛰어올라', '뛰어'],
  dance: ['춤춰', '춤', '댄스', '흔들어'],
  spin: ['한바퀴', '돌아', '빙글', '회전'],
  eat: ['밥먹자', '밥', '먹어', '간식', '먹자', '냠냠', '사료', '과자', '열매'],
  praise: ['잘했어', '착하지', '귀여워', '최고', '예쁘다', '이뻐', '사랑해', '좋아', '멋져', '짱', '착해'],
  scold: ['안돼', '하지마', '나빠', '바보', '멍청', '혼난다', '못됐', '미워'],
  greet: ['안녕', '하이', '반가워', '헬로', 'hello', 'hi'],
  stop: ['멈춰', '그만', '정지', '가만히', '스톱', '기다려', '스탑'],
  play: ['놀자', '놀아', '장난'],
  run: ['달려', '산책', '돌아다녀', '뛰어다녀'],
  pose: ['포즈', '멋있게', '폼'],
  ball: ['들어가', '돌아와', '몬스터볼', '쉬고있어'],
  out: ['나와', '너로정했다', '가라', '등장', '출동'],
};

// 대상 키워드 → 화면 객체 매칭 규칙 (match: 프로세스명/창 제목/아이콘 이름에 포함되는 문자열, 소문자)
export const TARGET_ALIASES = [
  { keys: ['크롬', '구글크롬', 'chrome', '구글'], match: ['chrome'], process: ['chrome'] },
  { keys: ['엣지', '에지', 'edge', '마이크로소프트엣지'], match: ['edge'], process: ['msedge'] },
  { keys: ['윈도우탐색기', '파일탐색기', '탐색기', '익스플로러', '폴더'], process: ['explorer'], cls: ['CabinetWClass'] },
  { keys: ['클로드', 'claude', '클로드코드'], match: ['claude'], process: ['claude'] },
  { keys: ['비주얼스튜디오코드', 'vs코드', 'vscode', '브이에스코드', '코드'], match: ['visual studio code', 'vscode'], process: ['code'] },
  { keys: ['메모장', 'notepad'], match: ['메모장', 'notepad'], process: ['notepad'] },
  { keys: ['카카오톡', '카톡'], match: ['kakaotalk', '카카오톡'], process: ['kakaotalk'] },
  { keys: ['한글', 'hwp', '한컴'], match: ['hwp', '한글'], process: ['hwp'] },
  { keys: ['워드'], match: ['word'], process: ['winword'] },
  { keys: ['엑셀', 'excel'], match: ['excel'], process: ['excel'] },
  { keys: ['파워포인트', '피피티', 'ppt'], match: ['powerpoint'], process: ['powerpnt'] },
  { keys: ['터미널', '파워쉘', '파워셸', '명령프롬프트', 'cmd'], match: ['powershell', 'terminal', '명령 프롬프트'], process: ['powershell', 'windowsterminal', 'cmd', 'pwsh'] },
  { keys: ['휴지통', '쓰레기통'], match: ['휴지통', 'recycle bin'] },
  { keys: ['내pc', '내컴퓨터', '컴퓨터'], match: ['내 pc', 'this pc', '내 컴퓨터'] },
  { keys: ['제어판'], match: ['제어판', 'control panel'] },
  { keys: ['고도', 'godot'], match: ['godot'] },
  { keys: ['디스코드'], match: ['discord'], process: ['discord'] },
  { keys: ['슬랙'], match: ['slack'], process: ['slack'] },
  { keys: ['팀즈'], match: ['teams'], process: ['ms-teams', 'teams'] },
];

export const CURSOR_WORDS = ['마우스', '커서', '여기', '나한테', '나에게', '나'];
export const ICON_HINT = ['아이콘', '바로가기'];
export const WINDOW_HINT = ['창', '윈도우', '프로그램'];

// 조사·어미 (대상 이름에서 제거)
export const PARTICLES = /(에게|한테|으로|를|을|이|가|에|로|좀|해줘|해봐|해라|해|써줘|써|사용|날려|발사|공격해|맞춰)$/;

// 클릭/상호작용 리액션 (anims: 선호 순서, emotion: 초상화, fx: 파티클, text: 리액션 요약)
export const REACTIONS = {
  hop: { anims: ['Hop', 'LeapForth'], emotion: 'Happy', fx: 'hearts', text: '기분이 좋아서 깡총깡총 뛴다' },
  spin: { anims: ['Rotate', 'Swing'], emotion: 'Joyous', fx: 'sparkles', text: '신이 나서 빙글빙글 돈다' },
  surprised: { anims: ['Cringe', 'Hurt', 'LookUp'], emotion: 'Surprised', fx: 'exclaim', text: '깜짝 놀란 것 같다' },
  shy: { anims: ['Sit', 'Cringe', 'Idle'], emotion: 'Inspired', fx: 'blush', text: '부끄러운지 몸을 배배 꼰다' },
  yawn: { anims: ['DeepBreath', 'Sleep', 'Idle'], emotion: 'Sigh', fx: 'zzz', text: '졸린지 하품을 쩌억 한다' },
  dance: { anims: ['Dance', 'Double', 'Swing', 'Rotate'], emotion: 'Joyous', fx: 'notes', text: '흥얼거리며 춤을 춘다' },
  pose: { anims: ['Pose', 'Appeal', 'Charge'], emotion: 'Determined', fx: 'sparkles', text: '자신만만한 포즈를 취한다. 멋있다는 말을 기다리는 것 같다' },
  tickle: { anims: ['Tumble', 'Rotate', 'Hop'], emotion: 'Joyous', fx: 'notes', text: '간지러운지 데굴데굴 구르며 웃는다' },
  grumpy: { anims: ['Swing', 'Idle'], emotion: 'Angry', fx: 'anger', text: '귀찮게 하지 말라는 것 같다' },
  dizzy: { anims: ['LostBalance', 'Tumble', 'Rotate'], emotion: 'Dizzy', fx: 'stars', text: '어지러워서 비틀거린다' },
  eat: { anims: ['Eat', 'Nod', 'Idle'], emotion: 'Happy', fx: 'food', text: '무언가를 오물오물 먹는다. 맛있나 보다' },
  nod: { anims: ['Nod', 'Hop'], emotion: 'Normal', fx: 'none', text: '고개를 끄덕인다. 대충 알겠다는 뜻 같다' },
  lookaround: { anims: ['LookUp', 'Idle'], emotion: 'Worried', fx: 'sweat', text: '눈치를 보며 두리번거린다' },
  charge: { anims: ['Charge', 'Pose'], emotion: 'Determined', fx: 'type', text: '기운을 모으며 힘자랑을 한다' },
  sneeze: { anims: ['Cringe', 'Hurt'], emotion: 'Surprised', fx: 'type', text: '에취! 재채기와 함께 기술이 살짝 새어 나왔다' },
  love: { anims: ['Hop', 'Pose'], emotion: 'Happy', fx: 'bigheart', text: '당신이 정말 좋다는 것 같다' },
  pout: { anims: ['Sit', 'Pain', 'Idle'], emotion: 'Sad', fx: 'tear', text: '삐친 것 같다... 더 놀아달라는 뜻인 듯' },
  stretch: { anims: ['DeepBreath', 'Pose', 'Charge'], emotion: 'Normal', fx: 'sparkles', text: '기지개를 쭈욱 켠다' },
  playdead: { anims: ['Faint', 'Laying', 'Sleep'], emotion: 'Dizzy', fx: 'none', text: '쓰러진 척 장난을 친다. 연기력이 수준급이다' },
  jump: { anims: ['LeapForth', 'Hop'], emotion: 'Joyous', fx: 'sparkles', hop: 60, text: '높이 점프한다! 칭찬해 달라는 것 같다' },
  greet: { anims: ['Pose', 'Hop', 'Swing'], emotion: 'Happy', fx: 'hearts', text: '반갑다고 인사하는 것 같다' },
  wag: { anims: ['TailWhip', 'Double', 'Swing'], emotion: 'Inspired', fx: 'hearts', text: '꼬리를 살랑살랑 흔든다' },
  curious: { anims: ['LookUp', 'Sit', 'Idle'], emotion: 'Inspired', fx: 'question', text: '호기심 가득한 눈으로 당신을 바라본다' },
  showoff: { anims: ['Shoot', 'Attack'], emotion: 'Determined', fx: 'type', text: '작게 기술을 선보이며 자랑한다' },
  trip: { anims: ['Trip', 'Tumble', 'Hurt'], emotion: 'Pain', fx: 'stars', text: '발이 꼬여 넘어졌다... 민망한지 웃는다' },
  float: { anims: ['Float', 'Hop'], emotion: 'Joyous', fx: 'notes', text: '둥실둥실 떠오르는 기분인가 보다' },
  sit: { anims: ['Sit', 'Idle'], emotion: 'Normal', fx: 'none', text: '얌전히 앉았다. 대충 알겠다는 뜻' },
  // 상호작용 전용
  cry: { anims: ['Pain', 'Hurt', 'Cringe'], emotion: 'Crying', fx: 'tear', text: '너무 많이 눌러서 울먹인다... 살살 해달라는 뜻' },
  angry: { anims: ['Swing', 'Attack', 'Idle'], emotion: 'Shouting', fx: 'anger', text: '화가 잔뜩 났다! 그만 누르라는 것 같다' },
  pet: { anims: ['Idle', 'Sit'], emotion: 'Joyous', fx: 'hearts', text: '쓰다듬어 주니 눈을 감고 행복해한다' },
  lifted: { anims: ['Hurt', 'Cringe', 'Float'], emotion: 'Surprised', fx: 'sweat', text: '들어 올려져서 발을 동동 구른다' },
  dropped: { anims: ['HitGround', 'Tumble', 'Hurt'], emotion: 'Dizzy', fx: 'stars', text: '쿵! 떨어져서 어질어질하다' },
  wake: { anims: ['Wake', 'DeepBreath', 'Idle'], emotion: 'Sigh', fx: 'none', text: '잠에서 깨어 눈을 비빈다. 더 자고 싶은 것 같다' },
  confused: { anims: ['LookUp', 'Idle'], emotion: 'Worried', fx: 'question', text: '무슨 말인지 몰라 고개를 갸웃거린다. 눈치를 보는 것 같다' },
  called: { anims: ['LookUp', 'Hop', 'Idle'], emotion: 'Normal', fx: 'exclaim', text: '자기를 부른 걸 알아듣고 쳐다본다' },
  cant: { anims: ['Cringe', 'LookUp', 'Idle'], emotion: 'Teary-Eyed', fx: 'sweat', text: '' },
  proud: { anims: ['Pose', 'Hop', 'Charge'], emotion: 'Determined', fx: 'sparkles', text: '의기양양하게 가슴을 편다. 해냈다는 뜻 같다' },
  hurt: { anims: ['Hurt', 'Pain', 'Cringe'], emotion: 'Pain', fx: 'stars', text: '아야! 공격을 맞고 억울해한다' },
  scolded: { anims: ['Sit', 'Pain', 'Idle'], emotion: 'Sad', fx: 'tear', text: '혼나서 풀이 죽었다... 반성하는 것 같다' },
  praised: { anims: ['Hop', 'Pose', 'Double'], emotion: 'Joyous', fx: 'hearts', text: '칭찬을 받아서 무척 기뻐한다' },
  stop: { anims: ['Idle', 'Sit'], emotion: 'Normal', fx: 'none', text: '그 자리에 멈춰 섰다. 알겠다는 뜻' },
  follow: { anims: ['Hop'], emotion: 'Happy', fx: 'notes', text: '신나서 졸졸 따라온다' },
  come: { anims: ['Hop'], emotion: 'Happy', fx: 'hearts', text: '쪼르르 달려왔다! 부른 이유가 궁금한 것 같다' },
  sleep: { anims: ['Sleep', 'EventSleep', 'Laying'], emotion: 'Sigh', fx: 'zzz', text: '새근새근 잠이 들었다' },
};

// 일반 클릭 시 무작위로 고르는 리액션 (20가지 이상)
export const CLICK_POOL = [
  'hop', 'spin', 'surprised', 'shy', 'yawn', 'dance', 'pose', 'tickle', 'grumpy', 'dizzy',
  'eat', 'nod', 'lookaround', 'charge', 'sneeze', 'love', 'pout', 'stretch', 'playdead', 'jump',
  'greet', 'wag', 'curious', 'showoff', 'trip', 'float', 'sit',
];

export const CANT_TEXT = {
  electric: '전기는 안 나온다며 당황해서 눈치를 본다',
  fire: '불은 못 뿜는다고 억울한 표정을 짓는다',
  water: '물은 못 쏜다며 고개를 도리도리 젓는다',
  grass: '풀 기술은 모른다며 머쓱해한다',
  flying: '날개가 없다며 시무룩해한다',
  dragon: '그런 멋진 기술은 아직 못 배웠다는 것 같다',
  steel: '그 기술은 못 쓴다며 꼬리만 흔든다',
  normal: '그 기술은 모른다며 갸웃거린다',
  ice: '얼음은 못 만든다며 몸을 부르르 떤다',
  fairy: '그렇게 반짝이는 기술은 모른다며 수줍어한다',
  dark: '그런 음흉한 기술은 못 쓴다며 고개를 젓는다',
  psychic: '아무리 집중해도 초능력이 안 나와서 머쓱해한다',
  fighting: '주먹을 휘둘러 보지만 기술이 안 나와 민망해한다',
  rock: '돌덩이는 못 던진다며 눈만 깜빡인다',
  poison: '독은 못 만든다며 고개를 젓는다',
  ground: '땅을 파 보지만 아무 일도 일어나지 않아 머쓱해한다',
  bug: '벌레 기술은 모른다며 더듬이 대신 귀만 쫑긋한다',
  ghost: '유령 흉내를 내 보지만 기술은 안 나온다',
};
// 같은 속성인데 그 포켓몬이 배우지 않는 기술을 시켰을 때
export const NOT_LEARNED_TEXT = '그 기술은 아직 배우지 않았다며 고개를 갸웃거린다';

// 타입 상성 (대상이 포켓몬일 때 "효과는 굉장했다!" 판정용): 공격 속성 → { 방어 속성: 배율 } (적지 않은 것은 1배)
const CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};
/** 기술 속성이 상대 속성들(여럿이면 곱한다)에 주는 배율 */
export const effectiveness = (moveType, types) => types.reduce((k, t) => k * (CHART[moveType]?.[t] ?? 1), 1);

export const HIT_TEXT = ['효과는 굉장했다!', '급소에 맞았다!', '효과가 굉장했다!', '효과는 별로인 듯하다...', '명중!'];

// ---- 공식 기술 전부 (movedex.mjs): 위의 다듬은 기술은 그대로 두고 나머지를 자동으로 만든다 ----
// 포켓몬·행동·대상 등 다른 말과 겹치는 기술 이름은 별칭에서 뺀다
addAllMoves(MOVES, [
  ...Object.values(POKEMON).flatMap((p) => p.aliases), ...ALL_ALIASES, ...ATTACK_WORDS, ...Object.values(ACTIONS).flat(),
  ...TARGET_ALIASES.flatMap((t) => t.keys), ...CURSOR_WORDS, ...ICON_HINT, ...WINDOW_HINT,
].map(compact), compact);
