// 포켓몬·기술·행동·리액션 정의

export const POKEMON = {
  pikachu: {
    name: '피카츄', type: 'electric', scale: 3, speed: 75,
    aliases: ['피카츄', '피카추', '피카쮸', '삐카츄', '피카', 'pikachu'],
    cries: ['피카!', '피카피카!', '피카츄~!', '피-카-츄우!', '피카?', '피카아~'],
    moves: ['thunderbolt', 'thundershock', 'thunder', 'quickattack', 'irontail', 'tackle'],
    signature: 'thunderbolt',
  },
  charizard: {
    name: '리자몽', type: 'fire', scale: 2.6, speed: 65,
    aliases: ['리자몽', '리자', 'charizard'],
    cries: ['그오오!', '리자아!', '갸오오~', '리자몽!', '크르릉...'],
    moves: ['flamethrower', 'fireblast', 'ember', 'wingattack', 'dragonclaw', 'tackle'],
    signature: 'flamethrower',
  },
  squirtle: {
    name: '꼬부기', type: 'water', scale: 3, speed: 60,
    aliases: ['꼬부기', '꼬북이', '꼬북', '꼬부', 'squirtle'],
    cries: ['꼬북!', '꼬북꼬북!', '꼬부기~!', '꼬부욱?'],
    moves: ['watergun', 'hydropump', 'bubble', 'withdraw', 'tackle'],
    signature: 'watergun',
  },
  bulbasaur: {
    name: '이상해씨', type: 'grass', scale: 3, speed: 55,
    aliases: ['이상해씨', '이상해시', '이상해', 'bulbasaur'],
    cries: ['이상해~씨!', '씨-이!', '이상해!', '해씨~'],
    moves: ['vinewhip', 'razorleaf', 'solarbeam', 'tackle'],
    signature: 'vinewhip',
  },
  eevee: {
    name: '이브이', type: 'normal', scale: 3, speed: 70,
    aliases: ['이브이', '이부이', 'eevee'],
    cries: ['브이!', '브이브이!', '이브이~!', '브이?'],
    moves: ['swift', 'quickattack', 'tackle', 'tailwhip'],
    signature: 'swift',
  },
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
  withdraw: { name: '껍질에숨기', type: 'water', self: true, anims: ['Withdraw', 'Sit'], aliases: ['껍질에숨기', '껍질', '등껍질'] },
  vinewhip: { name: '덩굴채찍', type: 'grass', fx: 'vine', anims: ['Shoot', 'Attack', 'Strike'], aliases: ['덩굴채찍', '덩굴', '채찍'] },
  razorleaf: { name: '잎날가르기', type: 'grass', fx: 'leaf', anims: ['Shoot', 'Attack'], aliases: ['잎날가르기', '잎날', '나뭇잎', '잎사귀'] },
  solarbeam: { name: '솔라빔', type: 'grass', fx: 'solarbeam', anims: ['Charge', 'Shoot', 'Attack'], aliases: ['솔라빔', '쏠라빔', '태양광선', '솔라'] },
  swift: { name: '스피드스타', type: 'normal', fx: 'stars', anims: ['Shoot', 'Attack'], aliases: ['스피드스타', '스타', '별'] },
  tailwhip: { name: '꼬리흔들기', type: 'normal', self: true, anims: ['TailWhip', 'Double', 'Swing'], aliases: ['꼬리흔들기', '꼬리'] },
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
};

export const HIT_TEXT = ['효과는 굉장했다!', '급소에 맞았다!', '효과가 굉장했다!', '효과는 별로인 듯하다...', '명중!'];
