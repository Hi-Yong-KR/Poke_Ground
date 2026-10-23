# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

바탕화면 위를 포켓몬이 돌아다니고, 음성/텍스트 명령("피카츄 크롬 10만볼트")으로 실제 창·바탕화면 아이콘에 기술을 쓰는 **Windows 전용 Electron 앱**. 사용자 대상 문서는 README.md, 사용자가 요청한 프롬프트 기록은 prompts.txt(요청이 생길 때마다 원문 그대로 이어 붙여 왔음).

## 명령어

```bash
npm install                 # electron, vosk-browser
npm run setup               # fetch-assets(스프라이트·초상화·울음소리) + fetch-whisper(.venv에 faster-whisper 설치 + small 모델 480MB)
npm run fetch-voice         # 예비용 Vosk 한국어 모델 87MB (Whisper를 못 쓸 때만 필요)
npm start                   # 앱 실행 (start.bat은 위 과정을 필요할 때만 자동 수행)
npm test                    # node --test test/parser.test.mjs
node --test --test-name-pattern="음성 필터" test/parser.test.mjs   # 테스트 하나만
```

빌드·린트 단계는 없다. 렌더러는 번들러 없이 ES 모듈(.mjs)을 그대로 서빙한다.

## 구조 (여러 파일에 걸친 흐름)

- **메인 프로세스** `src/main/main.js` (CommonJS)
  - 작업 영역 크기의 투명·항상 위 오버레이 창 하나. 평소엔 `setIgnoreMouseEvents(true, {forward:true})`로 클릭이 뒤로 통과하고, 렌더러가 마우스가 `.interactive` 요소(포켓몬 히트박스, 명령창) 위에 있을 때만 IPC `mouse-through`로 통과를 끈다.
  - 음성인식: `whisper.js`가 `.venv`의 파이썬으로 `whisper_worker.py`(Faster-Whisper small, `device='cpu'`, `compute_type='int8'`, 최대 4스레드)를 상주시키고, stdin/stdout JSON 한 줄(PCM은 base64)로 발화 하나씩 받아쓴다. 앱 시작 때 미리 띄워 모델을 올려 둔다. IPC `stt-info`/`stt-hotwords`/`stt-transcribe`.
  - 렌더러를 `http://127.0.0.1:<임의 포트>`의 내장 정적 서버로 띄운다 (마이크 보안 컨텍스트, Vosk 모델 fetch 때문). `node_modules`는 `vosk-browser`만 노출.
  - `data.mjs`를 동적 import해서 트레이 메뉴의 포켓몬 목록을 만든다. 설정은 `userData/config.json` (`party`, `voice`, `sound`, `micLabel`, `speakerLabel`).
  - 화면 객체 인식: 상주 PowerShell `scanner.ps1`(+ `scanner.cs` Add-Type)에 stdin으로 `scan`을 보내면 JSON 한 줄로 창(EnumWindows+DWM 프레임)과 바탕화면 아이콘(SysListView32를 원격 메모리로 조회)을 돌려준다. 좌표는 물리 픽셀 → main에서 `screenToDipRect`로 DIP·오버레이 기준으로 변환.
  - 마이크 진단(`mic-diagnose`)은 장치 상태와 Windows 개인정보 레지스트리를 **읽기만** 한다.
- **공유 로직** `src/shared/` (렌더러·Node 테스트·스크립트가 함께 import)
  - `data.mjs`: 포켓몬(도감번호 `dex`, 타입, 별칭, 울음 글자, 기술), 기술(`fx` 연출 키, `melee`, `self`), 행동, 리액션, 타입 상성. **포켓몬 목록의 유일한 출처** — 다운로드 스크립트와 트레이 메뉴가 여기서 읽는다.
  - `parser.mjs`: `parseCommand`(띄어쓴 단어 정확 일치 → 긴 별칭 부분 일치 → 한글 자모 퍼지 매칭 순), `resolveTarget`(대상 키워드/창 제목/아이콘 이름 → 화면 객체), `voiceGrammar`(Vosk 문법 단어 목록), `voiceKeywords`(Whisper 힌트 단어), `acceptVoice`(음성 소음 필터), `acceptTranscript`(Whisper 받아쓰기를 명령 단어로 맞춘 뒤 같은 필터).
- **렌더러** `src/renderer/`
  - `app.mjs`: 명령 실행 흐름의 중심. 명령 → `parseCommand` → (대상이 필요하면) `poke.scan()` → `resolveTarget` → 포켓몬 `run()` 작업 → `fx.move()`. 클릭/드래그/쓰다듬기, 음성·텍스트 우선순위, 장치 선택 UI도 여기.
  - `pokemon.mjs`: `Mon` 클래스. PMD 시트(행 8개=8방향, `OCT_TO_ROW`)를 CSS 배경으로 재생. 모든 행동은 `run(async fn)`으로 실행되고 새 작업이 이전 작업을 `cancel()`(대기 중 Promise를 `CANCEL`로 reject)한다. 대기는 반드시 `walkTo`/`playOnce`/`wait`를 써야 취소된다.
  - `fx.mjs`: 전체 화면 캔버스 파티클. `MOVE_FX[키]`는 `{duration, hitAt, update, draw, onHit}`이고 마지막 인자로 타입을 받아 `TYPE_COLORS`로 색을 정한다. 적중 시 `aftermath`가 타입별 여운을 남긴다.
  - `speech.mjs`: 엔진 `whisper`(기본) / `vosk`(Whisper 준비 안 됨·오류 시 예비). Whisper는 16kHz로 받아 음량 기반 발화 감지(`VAD_*`)로 말소리 구간만 잘라 `poke.stt.transcribe` → `acceptTranscript`. Vosk는 WASM 문법 제한 인식기 + 단어 신뢰도(`setWords`) → `acceptVoice`. 마이크가 막히면 진단 후 8초마다/`devicechange` 시 재연결.

## 포켓몬·기술 추가

`data.mjs`의 `POKEMON`에 `mon(dex, 이름, 타입, 별칭[], 울음[], 기술[], {scale, speed})` 한 줄 → 필요한 기술을 `MOVES`에 추가(기존 `fx` 키 재사용 가능) → 새 타입이면 `CANT_TEXT`·`SUPER`/`WEAK`·fx.mjs의 `TYPE_COLORS`/`TYPE_EMOJI`/`aftermath` → `npm run fetch-assets`. 테스트가 별칭 중복, 기술 누락, 포켓몬 수(현재 27)를 검사하므로 수를 바꾸면 테스트도 고친다. 애니메이션 이름은 포켓몬마다 있는 것이 달라서 `anims`는 항상 대체 후보를 여러 개 나열한다.

## 함정

- **인코딩(PowerShell 5.1)**: `Get-Content`/`Set-Content`로 한글 파일을 고치면 깨진다 — 파일 편집은 Edit/Write 도구로. `scanner.ps1`·`scanner.cs`는 **UTF-8 BOM**이어야 PowerShell 5.1이 읽는다. 한글 커밋 메시지는 PowerShell 인자로 넘기면 실패하므로 파일로 써서 `git commit -F`.
- **DPI**: 이 PC는 125% 배율. 렌더러 좌표(CSS px) × `devicePixelRatio` = 물리 좌표. 스캐너는 물리 좌표를 낸다.
- **장치 ID**: 서버 포트가 매번 바뀌어 origin이 달라지므로 `deviceId`가 실행마다 바뀐다 → 장치는 **이름(label)으로 저장**하고 실행 시 id를 다시 찾는다.
- **음성 필터 기준값**(`VOICE_MIN_CONF` 등)은 TTS로 만든 명령/잡담 샘플을 실제 엔진에 넣어 측정해 정했다. 바꿀 때는 test의 "실제로 측정된 잡담 오인식" 케이스가 계속 거부되는지 확인.
- **파이썬**: 시스템 파이썬은 `scripts/setup-whisper.py` 실행에만 쓰고, 워커는 항상 `.venv\Scripts\python.exe -I`로 돈다. 워커 출력은 `json.dumps` 기본(ASCII 이스케이프)이라 콘솔 코드페이지(cp949)와 무관하다.
- **저장소에 넣지 않는 것**(.gitignore): `node_modules/`, `.venv/`, `assets/models/`(Whisper·Vosk), `assets/pokemon/*/cry.ogg`(게임 원음, 저작권). 스프라이트·초상화는 CC BY-NC 4.0이라 `CREDITS.txt`와 함께 커밋한다.
- 시스템 설정(Windows 마이크 개인정보·장치 사용 여부)은 앱이 바꾸지 않는다. 원인 표시와 `ms-settings:` 열기까지만 한다.

## 실행 중인 앱 디버깅

`node_modules\electron\dist\electron.exe . --remote-debugging-port=9223`로 띄우면 CDP(`http://127.0.0.1:9223/json`)로 렌더러에서 JS를 실행할 수 있다. 렌더러는 `window.app`(포켓몬 `app.mons`, `app.fx`, `app.config`), `window.handleCommand(text, 'text'|'voice')`, `window.voice`를 노출한다. 렌더러 콘솔 경고/에러는 main의 stdout으로도 나온다. 트레이 메뉴의 '개발자 도구'로도 열 수 있다.
