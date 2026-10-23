# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

바탕화면 위를 포켓몬이 돌아다니고, 음성/텍스트 명령("피카츄 크롬 10만볼트")으로 실제 창·바탕화면 아이콘에 기술을 쓰는 **Windows 전용 Electron 앱**. 사용자 대상 문서는 README.md, 사용자가 요청한 프롬프트 기록은 prompts.txt(요청이 생길 때마다 원문 그대로 이어 붙여 왔음). **prompts.txt는 사용자 개인용이라 .gitignore로 저장소에서 뺐다 — 다시 커밋하지 말 것.**

## 명령어

```bash
npm install                 # electron, vosk-browser
npm run setup               # fetch-assets(스프라이트·초상화·울음소리) + fetch-whisper(.venv에 faster-whisper 설치 + small 모델 480MB; 파이썬이 없으면 uv로 .python에 받음)
npm run fetch-voice         # 예비용 Vosk 한국어 모델 87MB (Whisper를 못 쓸 때만 필요)
npm start                   # 앱 실행
npm run fetch-dex           # 도감에서 추가할 수 있는 포켓몬 그림 → assets/dex (git 부분 받기, 약 300MB)
node scripts/build-movedex.mjs   # 기술 표·배우는 기술 표 다시 만들기 (PokeAPI CSV, 새 세대가 나올 때만)
npm run make-offline        # 오프라인 배포판 dist/PokeGround-offline.zip (받는 PC는 인터넷 불필요)
start.bat                   # 배포용 진입점: 준비가 다 됐으면 바로 실행, 아니면 scripts/setup.ps1(Node 없으면 .node에 받기 → npm install → 에셋 → Whisper)
npm test                    # node --test: test/parser·dex·creations.test.mjs
node --test --test-name-pattern="음성 필터" test/parser.test.mjs   # 테스트 하나만
```

빌드·린트 단계는 없다. 렌더러는 번들러 없이 ES 모듈(.mjs)을 그대로 서빙한다.

## 구조 (여러 파일에 걸친 흐름)

- **메인 프로세스** `src/main/main.js` (CommonJS)
  - 작업 영역 크기의 투명·항상 위 오버레이 창 하나. 평소엔 `setIgnoreMouseEvents(true, {forward:true})`로 클릭이 뒤로 통과하고, 렌더러가 마우스가 `.interactive` 요소(포켓몬 히트박스, 명령창) 위에 있을 때만 IPC `mouse-through`로 통과를 끈다.
  - 음성인식: `whisper.js`가 `.venv`의 파이썬으로 `whisper_worker.py`(Faster-Whisper small, `device='cpu'`, `compute_type='int8'`, 최대 4스레드)를 상주시키고, stdin/stdout JSON 한 줄(PCM은 base64)로 발화 하나씩 받아쓴다. 앱 시작 때 미리 띄워 모델을 올려 둔다. IPC `stt-info`/`stt-hotwords`/`stt-transcribe`.
  - 렌더러를 `http://127.0.0.1:<임의 포트>`의 내장 정적 서버로 띄운다 (마이크 보안 컨텍스트, Vosk 모델 fetch 때문). `node_modules`는 `vosk-browser`만 노출.
  - 트레이 메뉴는 명령창 열기/닫기(렌더러가 IPC `bar-state`로 알려 준 상태를 따라 바뀜)·음성인식·울음소리·개발자 도구·종료뿐이다(포켓몬 고르기는 명령창의 📖 도감 한 곳). 설정은 `userData/config.json` (`party` — 첫 실행은 피카츄만, `voice`, `sound`, `micLabel`, `speakerLabel`, `volume` — 울음소리 0~1, 없으면 0.55).
  - 화면 객체 인식: 상주 PowerShell `scanner.ps1`(+ `scanner.cs` Add-Type)에 stdin으로 `scan`을 보내면 JSON 한 줄로 창(EnumWindows+DWM 프레임)과 바탕화면 아이콘(SysListView32를 원격 메모리로 조회)을 돌려준다. 좌표는 물리 픽셀 → main에서 `screenToDipRect`로 DIP·오버레이 기준으로 변환.
  - 울음소리: 게임 원음이라 저장소·배포판에 넣지 않고, 창이 뜬 뒤 `fetchCries()`가 `src/main/cries.mjs`로 전국도감 전부(`pokedex.mjs`)를 PokeAPI cries에서 `userData/cries/<번호>.ogg`로 받는다(없는 것만, 8개씩 병렬, 인터넷이 없으면 일찍 그만두고 다음 실행 때 다시). 정적 서버가 `/cries/`로 내고, `Mon.playCry`는 `/cries/<dex>.ogg` → 앱에 든 `assets/pokemon/<key>/cry.ogg` 순으로 시도한다. 시작·끝은 IPC 이벤트 `cries`로 명령창 기록에 남긴다.
  - 마이크 진단(`mic-diagnose`)은 장치 상태와 Windows 개인정보 레지스트리를 **읽기만** 한다.
- **공유 로직** `src/shared/` (렌더러·Node 테스트·스크립트가 함께 import)
  - `data.mjs`: 포켓몬(도감번호 `dex`, 타입, 별칭, 울음 글자, 기술), 기술(`fx` 연출 키, `melee`, `self`), 행동, 리액션, 18속성 상성(`effectiveness`). 손으로 다듬은 기술 66개를 정의한 뒤 파일 끝에서 `addAllMoves()`로 공식 기술 전부를 `MOVES`에 더한다.
  - `moves.mjs`: 공식 기술(`movedex.mjs`, 833개 — 아무 포켓몬도 배우지 않는 Z·다이맥스 기술 등은 뺌)과 배우는 기술(`learnsets.mjs`, 도감 번호마다 movedex 순서의 비트를 base64로). 둘 다 `scripts/build-movedex.mjs`가 만든다 — 손으로 고치지 말 것. 다듬은 기술은 이름·속성을 공식 것으로 바꾸고 예전 이름은 별칭으로 남기며, 다른 기술의 공식 이름이던 별칭은 그 기술에 돌려준다(박치기 → headbutt). 나머지는 `auto: true`로, 분류(변화 → `self`, 접촉 물리 → `melee`, 그 밖 → 원거리)와 영어 이름 단서·속성·위력으로 기존 `fx` 키를 고른다(애니메이션 이름도 기존 것만 써서 `fetch-dex`를 다시 돌릴 필요가 없다). `learns(dex, key)`/`learnset(dex)`. **울음소리·별칭·기술을 손으로 다듬은 포켓몬(27마리) 목록의 유일한 출처** (사용자에게는 다른 포켓몬과 구분 없이 보인다) — 다운로드 스크립트와 렌더러가 여기서 읽는다.
  - `dex.mjs`: 그 밖의 도감 포켓몬. 파티 창에는 그림이 있는 전부가 나오고, 한 번이라도 내보낸 것만 `config.custom`에 도감 번호로 저장해 등록한다(980마리를 다 등록하면 음성 문법·별칭 표가 너무 커짐). `applyCustom()`이 `pokedex.mjs`(전국도감 표, `scripts/build-pokedex.mjs`로 생성 — 손으로 고치지 말 것)로 정의를 만들어 `POKEMON`에 `dex0004` 같은 키로 넣는다(`custom: true`, `assets: /assets/dex/0004/`). 렌더러가 부르며, 넣고 빼면 `parser.refreshEntries()`로 별칭 표를 다시 만든다. 다른 말과 겹치는 별칭은 뺀다. 도감·내 그림 포켓몬의 정의는 `buildMon()`이 만든다: `types`·`moveTypes`(첫 번째가 대표 속성)를 갖고, 대표 기술(`moves`)은 도감 포켓몬이면 배우는 기술 중에서(다듬은 기술 먼저, 그다음 위력순) 속성마다 번갈아 4개 + 몸통박치기(배우면). 메타몽처럼 공격 기술이 없으면 변화 기술. 렌더러는 기술 허용을 도감 번호가 있으면 `learns()`로(내 그림 포켓몬은 `moveTypes`·노말), 상성을 상대의 속성 전부로 본다(기본 27마리는 `type` 하나라 도감 표의 속성을 쓴다). 그림은 `scripts/fetch-dex.mjs`가 SpriteCollab을 `.cache/`에 git sparse·blob:none으로 받아 앱이 쓰는 애니메이션(data.mjs의 모든 `anims` + 기본 동작)만 `assets/dex/<번호>/`에 복사하고, 쓸 수 있는 번호를 `assets/dex/index.json`에 적는다. 애니메이션 고르기·AnimData 해석은 `src/shared/sprites.mjs`(배포판에도 들어감).
  - 앱 안에서 받기: 배포판에 없는 종은 파티 창에서 찾을 때만 ⬇ 타일(`missing`)로 나오고, 누르면 `downloadDex` → IPC `dex-download` → `src/main/dexdownload.mjs`가 raw.githubusercontent에서 같은 규칙으로 받아 `userData/dex/<번호>/`에 저장(임시 폴더에 다 받고 이름 변경). main의 정적 서버는 `/assets/dex/` 파일이 앱 폴더에 없으면 `userData/dex`에서 찾고, `index.json`은 두 곳을 합쳐서 낸다 — 그래서 렌더러·`makeMon`은 그림이 어디 있는지 몰라도 된다.
  - 직접 그림 넣기(＋ 포켓몬의 내 그림으로 추가): IPC `creation-pick`(파일/폴더 대화상자) → `creation-import` → `src/main/creations.mjs`가 이미지 한 장(머리말로 크기 읽기, 한 프레임짜리 Idle·Walk·Attack을 만들고 키 72px 배율) 또는 PMD zip(System32 tar로 풂)·폴더(AnimData.xml을 얕은 곳부터 찾아 `pickAnims`, 초상화는 감정별 파일 이름으로 찾고 없으면 SpriteCollab 초상화 시트(40px 칸 5×8, 칸 번호=`SHEET.emotions` 순서, 아래 4줄은 반전본)를 메인의 `sliceSheet`(nativeImage crop)로 자름)·여러 개(스프라이트 zip + 시트를 함께 고르면 한 폴더에 모아 봄)를 `userData/creations/<id>/`에 앱 모양으로 복사. 목록은 `config.creations: [{ id, name, types: [...], dex?, kind: 'pmd'|'image', scale }]`(예전 항목은 `type` 하나 — `creationTypes()`가 둘 다 읽음), `dex.mjs`의 `makeCreation()`이 `user_<id>` 키·`/user/<id>/` 주소로 등록. 이미지 한 장은 `def.simple` — `pokemon.mjs`의 `simpleMotion()`이 통통 튀기·커지기·숨쉬기·좌우 뒤집기로 움직임을 흉내 내고, 발밑 여백이 없어 50% 올려 그린다. 초상화가 없으면 말풍선 얼굴을 숨긴다.
  - `parser.mjs`: `parseCommand`(띄어쓴 단어 정확 일치 → 긴 별칭 부분 일치 → 한글 자모 퍼지 매칭 순. 자동 기술은 덜 너그럽게: 두 글자 이하는 띄어 쓴 단어일 때만, 퍼지·Vosk 문법·Whisper 힌트에서는 빠짐 — 창 이름 같은 말이 기술로 먹히지 않게, 그리고 음성 필터 기준값을 잰 조건을 유지하려고), `resolveTarget`(대상 키워드/창 제목/아이콘 이름 → 화면 객체), `voiceGrammar`(Vosk 문법 단어 목록), `voiceKeywords`(Whisper 힌트 단어), `acceptVoice`(음성 소음 필터), `acceptTranscript`(Whisper 받아쓰기를 명령 단어로 맞춘 뒤 같은 필터).
- **렌더러** `src/renderer/`
  - `app.mjs`: 명령 실행 흐름의 중심. 명령 → `parseCommand` → (대상이 필요하면) `poke.scan()` → `resolveTarget` → 포켓몬 `run()` 작업 → `fx.move()`. 클릭/드래그/쓰다듬기, 음성·텍스트 우선순위, 장치 선택 UI도 여기. 명령창 위쪽 창(📖 도감·＋ 포켓몬(내 그림으로 추가만)·⚙ 장치)은 `openPanel()`으로 하나만 열린다. `#panel`은 화면 높이를 넘지 않게 flex로 줄어들고 위쪽 창과 기록이 각자 스크롤한다. 파티(📖 도감) 창은 `renderParty()`가 POKEMON과 그림이 있는 도감 포켓몬 전부(`assets/dex/index.json`)를 구분 없이 도감 번호순으로 그리고(도감 포켓몬을 누르면 `addDex`로 데려온다, 찾는 중이면 칸에 도감 번호·속성도 표시) `ensureMon`/`returnToBall`로 바로 켜고 끈다(두 함수가 파티가 바뀔 때 `renderParty()`를 불러 창을 맞춘다). 기술 이름 없는 "공격"은 `attackPool(def)`(배우는 공격 기술 전부, 내 그림 포켓몬은 `moveTypes`의 기술 — `WeakMap`에 한 번만 계산)에서 무작위로 고르고, 공격 기술이 없으면 `signature`를 쓴다.
  - `pokemon.mjs`: `Mon` 클래스. PMD 시트(행 8개=8방향, `OCT_TO_ROW`)를 CSS 배경으로 재생. 모든 행동은 `run(async fn)`으로 실행되고 새 작업이 이전 작업을 `cancel()`(대기 중 Promise를 `CANCEL`로 reject)한다. 대기는 반드시 `walkTo`/`playOnce`/`wait`를 써야 취소된다.
  - `fx.mjs`: 전체 화면 캔버스 파티클. `MOVE_FX[키]`는 `{duration, hitAt, update, draw, onHit}`이고 마지막 인자로 타입을 받아 `TYPE_COLORS`로 색을 정한다. 적중 시 `aftermath`가 타입별 여운을 남긴다.
  - `speech.mjs`: 엔진 `whisper`(기본) / `vosk`(Whisper 준비 안 됨·오류 시 예비). Whisper는 16kHz로 받아 음량 기반 발화 감지(`VAD_*`)로 말소리 구간만 잘라 `poke.stt.transcribe` → `acceptTranscript`. Vosk는 WASM 문법 제한 인식기 + 단어 신뢰도(`setWords`) → `acceptVoice`. 마이크가 막히면 진단 후 8초마다/`devicechange` 시 재연결.

## 포켓몬·기술 추가

`data.mjs`의 `POKEMON`에 `mon(dex, 이름, 타입, 별칭[], 울음[], 기술[], {scale, speed})` 한 줄 → 필요한 기술을 `MOVES`에 추가(기존 `fx` 키 재사용 가능) → `npm run fetch-assets`. 18속성 모두 `CANT_TEXT`·상성표·fx.mjs의 `TYPE_COLORS`/`TYPE_EMOJI`가 이미 있다. 공식 기술에 있는 기술을 다듬으려면 같은 키(PokeAPI 이름에서 `-`를 뺀 것)로 `MOVES`에 적으면 자동 기술 대신 쓰인다. 테스트가 별칭 중복, 기술 누락, 포켓몬 수(현재 27)를 검사하므로 수를 바꾸면 테스트도 고친다. 애니메이션 이름은 포켓몬마다 있는 것이 달라서 `anims`는 항상 대체 후보를 여러 개 나열한다.

## 함정

- **인코딩(PowerShell 5.1)**: `Get-Content`/`Set-Content`로 한글 파일을 고치면 깨진다 — 파일 편집은 Edit/Write 도구로. `scanner.ps1`·`scanner.cs`는 **UTF-8 BOM**이어야 PowerShell 5.1이 읽는다. 한글 커밋 메시지는 PowerShell 인자로 넘기면 실패하므로 파일로 써서 `git commit -F`.
- **DPI**: 이 PC는 125% 배율. 렌더러 좌표(CSS px) × `devicePixelRatio` = 물리 좌표. 스캐너는 물리 좌표를 낸다.
- **장치 ID**: 서버 포트가 매번 바뀌어 origin이 달라지므로 `deviceId`가 실행마다 바뀐다 → 장치는 **이름(label)으로 저장**하고 실행 시 id를 다시 찾는다.
- **Whisper 환각 필터**(`whisper_worker.py`의 `MIN_LOGPROB` 등): 힌트 단어를 주면 소음에서 "피카츄"/"크롬"을 지어낸다(로그확률 -1.1~-2.2). 명령은 -0.5 이상. 기준을 풀면 소음이 이름 부르기 명령으로 통과하니 주의.
- **음성 필터 기준값**(`VOICE_MIN_CONF` 등)은 TTS로 만든 명령/잡담 샘플을 실제 엔진에 넣어 측정해 정했다. 바꿀 때는 test의 "실제로 측정된 잡담 오인식" 케이스가 계속 거부되는지 확인.
- **파이썬**: `setup-whisper.ps1`이 `.venv` → 시스템 `python` → `py -3` 순으로 3.9+를 찾고, 없으면 uv(버전·SHA256 고정)로 `.python`에 3.12를 받아 `setup-whisper.py`를 실행한다(`-Private`로 그 경로 강제 테스트). WindowsApps의 가짜 python.exe는 실행해 봐서 걸러낸다. 시스템 파이썬은 설치 스크립트 실행에만 쓰고, 워커는 항상 `.venv\Scripts\python.exe -I`로 돈다. 워커 출력은 `json.dumps` 기본(ASCII 이스케이프)이라 콘솔 코드페이지(cp949)와 무관하다.
- **오프라인 배포판**(`make-offline.ps1`): venv는 base 파이썬의 절대 경로에 묶여 옮길 수 없어서, uv의 휴대용 파이썬(`setup-whisper.ps1 -Private -PythonOnly`)을 `runtime\python`에 복사하고 거기에 직접 pip 설치한다(uv가 붙인 `EXTERNALLY-MANAGED` 삭제). VC++ DLL은 python.exe 옆에 app-local로 둔다. `whisper.js`는 `runtime\python\python.exe`가 있으면 그것을, 없으면 `.venv`를 쓴다. Electron 실행에 Node는 필요 없어 넣지 않는다. 울음소리는 `-IncludeCries` 때만(처음 27마리분). 평소에는 앱이 첫 실행 때 받는다(구조의 울음소리 항목).
- **Visual C++ 런타임**: ctranslate2·onnxruntime이 `msvcp140.dll`/`msvcp140_1.dll`을 쓰는데 휠에 들어 있지 않다(새 Windows엔 없을 수 있음). `setup.ps1`이 System32에 없으면 `aka.ms/vs/17/release/vc_redist.x64.exe`를 받아 Authenticode 서명(Microsoft Corporation)을 확인하고 UAC로 설치, 끝나면 `.venv` 파이썬으로 `import faster_whisper`를 실제로 해 봐서 실패하면 Vosk를 받는다. 출처가 불분명한 PyPI `msvc-runtime` 패키지는 일부러 쓰지 않았다.
- **start.bat**: cmd는 UTF-8 한글을 cp949로 읽어 줄이 깨질 수 있으므로 ASCII만 쓰고, CRLF여야 `goto`가 동작한다(.gitattributes로 고정). 한글 안내 문구는 `setup.ps1`(UTF-8 BOM)에서 낸다. `-PrivateNode`로 개인 Node 경로를 강제 테스트할 수 있다. 배포판용 `scripts/offline/start.bat`은 따로 있는 파일로, `chcp 65001` 뒤 한글 안내를 직접 낸다(`goto` 없음).
- **이름**: 화면의 버튼은 📖 도감이지만 코드·설정은 예전 이름 그대로 `party`(`#party`, `renderParty`, `config.party`)다. ＋ 포켓몬 창이 `#dex`.
- **예전 설정 가져오기**: `loadConfig`는 `userData/config.json`이 없으면 `%APPDATA%\poke-action\config.json`(옛 앱 이름)을 한 번 가져온다. 그래서 이 PC에서는 빈 프로필로 띄워도 첫 실행이 피카츄 한 마리가 아닐 수 있다.
- **저장소에 넣지 않는 것**(.gitignore): `node_modules/`, `.node/`, `.python/`, `.venv/`, `.cache/`, `assets/models/`(Whisper·Vosk), `assets/dex/`(약 280MB, fetch-dex로 생성), `assets/pokemon/*/cry.ogg`(게임 원음, 저작권). 스프라이트·초상화는 CC BY-NC 4.0이라 `CREDITS.txt`와 함께 커밋한다.
- 시스템 설정(Windows 마이크 개인정보·장치 사용 여부)은 앱이 바꾸지 않는다. 원인 표시와 `ms-settings:` 열기까지만 한다.

## 릴리즈

GitHub 릴리즈(`gh release`)에 `dist/PokeGround-offline.zip` 하나를 올린다. 제목 `포켓몬 그라운드 vX.Y.Z (오프라인 배포판)`, 본문은 이전 릴리즈와 같은 틀(받아서 바로 실행 / 새로 바뀐 점 / 사양·출처). 순서: 커밋·푸시 → `npm run make-offline`(시작할 때 이전 zip을 먼저 지움, 약 860MB) → 빈 폴더에 System32 `tar`로 풀어 `start.bat` 실행 확인 → `gh release create vX.Y.Z dist\PokeGround-offline.zip --target <커밋 전체 SHA> --title ... --notes-file ...`. `--target`에 짧은 SHA를 주면 HTTP 422로 거절된다. make-offline의 휴대용 파이썬 단계(`uv python find`)가 가끔 이유 없이 실패하는데, 다시 돌리면 된다.

## 실행 중인 앱 디버깅

`node_modules\electron\dist\electron.exe . --remote-debugging-port=9223`로 띄우면 CDP(`http://127.0.0.1:9223/json`)로 렌더러에서 JS를 실행할 수 있다. 렌더러는 `window.app`(포켓몬 `app.mons`, `app.fx`, `app.config`), `window.handleCommand(text, 'text'|'voice')`, `window.voice`를 노출한다. 렌더러 콘솔 경고/에러는 main의 stdout으로도 나온다. 트레이 메뉴의 '개발자 도구'로도 열 수 있다.

- 빈 프로필로 시험하려면 `--user-data-dir=<빈 폴더>`를 준다(`APPDATA` 환경변수는 Electron이 무시한다).
- 메인 프로세스는 `--inspect=9229`를 더하면 CDP로 볼 수 있다(`includeCommandLineAPI: true`면 `require('electron')`을 쓸 수 있음). 트레이·메뉴처럼 변수로 닿지 않는 객체는 `Runtime.queryObjects`(예: `Menu.prototype`)로 찾아 `items[0].label`을 읽거나 `click()`을 부른다. 네이티브 메뉴를 SendKeys로 누르지 말 것: 메뉴가 늦게 뜨면 키가 다른 창으로 가고, '종료'가 눌려 앱이 꺼지기도 한다. 디버거 안에서 `popUpContextMenu()`를 바로 부르면 앱이 죽으니 `setTimeout`으로 미룬다.
