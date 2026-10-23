// 오프라인 한국어 음성인식. Faster-Whisper small(CPU INT8, 메인 프로세스의 파이썬 워커)을 기본으로 쓰고,
// 준비가 안 됐거나 오류가 나면 Vosk(WASM)로 대신한다. 둘 다 안 되면 텍스트 전용.
// - Whisper: 말소리 구간을 잘라 한 발화씩 받아쓴다. 포켓몬·기술 이름을 힌트로 주고, 받아쓴 문장을 명령 단어로 맞춰 거른다.
// - Vosk: 소형 모델이라 명령 단어로 문법을 제한하고 단어 신뢰도로 소음 오인식을 거른다.
// 마이크가 막혀 있으면 원인을 알려주고, 풀리는 즉시 자동으로 다시 연결한다.
import { voiceGrammar, voiceKeywords, acceptVoice, acceptTranscript } from '../shared/parser.mjs';

const MODEL_URL = '/assets/models/ko.tar.gz';
const RETRY_MS = 8000;
const LISTENING = '듣는 중 — 포켓몬 이름을 부르며 말해 보세요';
const ENGINE_NAME = { whisper: 'Whisper', vosk: 'Vosk' };

// Whisper에 넘길 발화 구간을 고르는 간단한 음량 기반 발화 감지 (16kHz, 1024샘플=64ms 단위)
const WHISPER_RATE = 16000;
const VAD_MIN_RMS = 0.012;   // 이보다 작으면 말소리로 보지 않는다
const VAD_NOISE_X = 3;       // 배경 소음의 몇 배를 넘어야 말소리로 보는지
const VAD_PREROLL = 5;       // 말 시작 직전 ~320ms도 함께 넣는다 (첫 음절이 잘리지 않게)
const VAD_HANG_MS = 700;     // 이만큼 조용하면 발화 끝
const VAD_MAX_MS = 8000;     // 명령은 짧으니 이보다 길면 끊어서 확정
const VAD_MIN_LOUD = 3;      // 큰 소리 조각이 이보다 적으면(~0.2초) 딸깍 소리로 보고 버린다

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('스크립트 로드 실패'));
    document.head.appendChild(s);
  });
}

function toPcm16(chunks) {
  const out = new Int16Array(chunks.reduce((n, c) => n + c.length, 0));
  let i = 0;
  for (const c of chunks) {
    for (const x of c) {
      const v = Math.max(-1, Math.min(1, x));
      out[i++] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
  }
  return out.buffer;
}

export class Voice {
  /**
   * diagnose: 마이크 실패 시 원인을 { text, fix } 로 돌려주는 함수
   * stt: 메인 프로세스의 Whisper 워커 (preload의 poke.stt)
   */
  constructor({ onResult, onRejected, onPartial, onStatus, diagnose, stt }) {
    this.onResult = onResult;
    this.onRejected = onRejected;
    this.onPartial = onPartial;
    this.onStatus = onStatus;
    this.diagnose = diagnose;
    this.stt = stt;
    this.engine = null;   // 'whisper' | 'vosk' (start 때 정함)
    this.enabled = false;
    this.ready = false;
    this.retryTimer = null;
    navigator.mediaDevices.addEventListener('devicechange', () => this.retry());
  }

  /** extraWords: 화면에 보이는 창/아이콘 이름처럼 Vosk 문법에 추가할 단어 */
  async start(extraWords = this.extraWords || []) {
    this.extraWords = extraWords;
    this.enabled = true;
    if (this.ready) { this.onStatus('on', this.listening()); return; }
    if (this.starting) return;
    this.starting = true;
    try {
      if (!this.engine) {
        const info = this.stt ? await this.stt.info().catch(() => null) : null;
        this.engine = info && info.available ? 'whisper' : 'vosk';
      }
      if (this.engine === 'whisper') this.stt.hotwords(voiceKeywords());
      else await this.loadVosk();

      let stream;
      const audio = { echoCancellation: true, noiseSuppression: true, channelCount: 1 };
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: this.deviceId ? { ...audio, deviceId: { exact: this.deviceId } } : audio });
        } catch (e) {
          if (!this.deviceId) throw e;
          // 고른 마이크가 사라졌으면 기본 마이크로 대신 연결
          stream = await navigator.mediaDevices.getUserMedia({ audio });
          console.warn('[voice] 선택한 마이크를 못 찾아 기본 마이크 사용', e.name);
        }
      } catch (e) {
        const why = this.diagnose ? await this.diagnose().catch(() => null) : null;
        this.scheduleRetry();
        throw Object.assign(e, {
          user: `${why ? why.text : '마이크를 사용할 수 없어요'} — 켜지면 자동으로 연결돼요. 그동안 텍스트로 명령하세요`,
          fix: why && why.fix,
        });
      }
      this.clearRetry();

      const whisper = this.engine === 'whisper';
      const ctx = whisper ? new AudioContext({ sampleRate: WHISPER_RATE }) : new AudioContext();
      const rec = whisper ? null : this.voskRecognizer(ctx.sampleRate);
      const src = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(whisper ? 1024 : 4096, 1, 1);
      if (whisper) Object.assign(this, { talking: false, noise: 0.003, preroll: [], utter: [] });
      node.onaudioprocess = (e) => {
        if (!this.enabled) return;
        if (whisper) { this.pushWhisper(e.inputBuffer.getChannelData(0)); return; }
        try { rec.acceptWaveform(e.inputBuffer); } catch { /* 인식기 준비 전 */ }
      };
      src.connect(node);
      node.connect(ctx.destination);
      const analyser = ctx.createAnalyser();   // 장치 설정의 입력 음량 표시용
      analyser.fftSize = 512;
      src.connect(analyser);
      this.analyser = analyser;
      this.levelBuf = new Float32Array(analyser.fftSize);
      // 마이크를 뽑거나 다시 막으면 재연결 대기로 전환
      stream.getAudioTracks().forEach((t) => t.addEventListener('ended', () => this.lost()));
      Object.assign(this, { ctx, rec, stream, node, ready: true });
      if (this.enabled) this.onStatus('on', this.listening());
      else this.stop();
    } catch (e) {
      console.warn('[voice]', e.name || '', e.message);
      this.onStatus('off', e.user || `음성인식 사용 불가 (${e.message}) — 텍스트로 명령하세요`, e.fix);
    } finally {
      this.starting = false;
    }
  }

  listening() { return `${LISTENING} (${ENGINE_NAME[this.engine]})`; }

  async loadVosk() {
    if (this.model) return;
    this.onStatus('loading', '음성 모델 불러오는 중... (처음 1회 수십 초)');
    const head = await fetch(MODEL_URL, { method: 'HEAD' });
    if (!head.ok) throw Object.assign(new Error('nomodel'), { user: '음성 모델이 없어요 (npm run fetch-whisper). 텍스트로 명령하세요' });
    if (!window.Vosk) await loadScript('/node_modules/vosk-browser/dist/vosk.js');
    this.model = await window.Vosk.createModel(MODEL_URL);
  }

  voskRecognizer(sampleRate) {
    const rec = new this.model.KaldiRecognizer(sampleRate, JSON.stringify(voiceGrammar(this.extraWords)));
    rec.setWords(true);   // 단어별 신뢰도로 소음 오인식을 거른다
    rec.on('result', (m) => {
      const t = (m.result.text || '').replace(/\[unk\]/g, '').replace(/\s+/g, ' ').trim();
      this.onPartial('');
      if (!t || !this.enabled) return;
      this.judge(t, acceptVoice(t, m.result.result));
    });
    rec.on('partialresult', (m) => { if (this.enabled) this.onPartial((m.result.partial || '').replace(/\[unk\]/g, '').trim()); });
    return rec;
  }

  judge(t, v) {
    if (v.ok) this.onResult(v.text);
    else if (this.onRejected) this.onRejected(t, v.reason);
  }

  /** 말소리 구간을 모았다가 끝나면 한 발화로 Whisper에 넘긴다 */
  pushWhisper(f32) {
    let sum = 0;
    for (const v of f32) sum += v * v;
    const rms = Math.sqrt(sum / f32.length);
    const loud = rms > Math.max(VAD_MIN_RMS, this.noise * VAD_NOISE_X);
    const chunk = f32.slice();
    const now = performance.now();
    if (!this.talking) {
      if (!loud) {
        this.noise = this.noise * 0.95 + rms * 0.05;   // 조용할 때 배경 소음 수준을 따라간다
        this.preroll.push(chunk);
        if (this.preroll.length > VAD_PREROLL) this.preroll.shift();
        return;
      }
      Object.assign(this, { talking: true, talkStart: now, lastLoud: now, loudCount: 0, utter: this.preroll.splice(0) });
    }
    this.utter.push(chunk);
    if (loud) { this.lastLoud = now; this.loudCount++; }
    if (now - this.lastLoud > VAD_HANG_MS || now - this.talkStart > VAD_MAX_MS) {
      this.talking = false;
      const utter = this.utter;
      this.utter = [];
      if (this.loudCount >= VAD_MIN_LOUD) this.transcribe(toPcm16(utter));
    }
  }

  /** 발화는 들어온 순서대로 하나씩 받아쓴다 */
  transcribe(pcm) {
    this.onPartial('알아듣는 중');
    this.queue = (this.queue || Promise.resolve()).then(async () => {
      try {
        const { text, ms } = await this.stt.transcribe(pcm);
        console.debug(`[voice] whisper ${ms}ms: ${text}`);
        this.onPartial('');
        const t = text.replace(/\s+/g, ' ').trim();
        if (t && this.enabled && this.engine === 'whisper') this.judge(t, acceptTranscript(t));
      } catch (e) {
        // 워커가 죽었거나 모델 로드 실패: 이번 실행 동안은 Vosk로 바꿔서 계속 듣는다
        console.warn('[voice] Whisper 오류', e.message);
        this.onPartial('');
        if (this.engine !== 'whisper') return;
        this.onStatus('loading', 'Whisper 음성인식 오류 — Vosk로 전환');
        this.useEngine('vosk');
      }
    });
  }

  /** 엔진을 바꾸거나(null이면 키 상태로 다시 고름) 다시 연결 */
  useEngine(engine = null) {
    this.teardown();
    this.engine = engine;
    if (this.enabled) this.start();
  }

  /** 현재 입력 음량 0~1 (연결 안 됐으면 0) */
  level() {
    if (!this.ready || !this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.levelBuf);
    let peak = 0;
    for (const v of this.levelBuf) peak = Math.max(peak, Math.abs(v));
    return Math.min(1, peak * 2);
  }

  /** 지금 쓰는 마이크 이름 */
  get deviceLabel() { return this.ready ? this.stream.getAudioTracks()[0]?.label || '' : ''; }

  /** 입력 장치 변경 (빈 값이면 Windows 기본 장치) */
  setDevice(deviceId) {
    if (deviceId === (this.deviceId || '')) return;
    this.deviceId = deviceId || '';
    this.teardown();
    if (this.enabled) this.start();
  }

  teardown() {
    if (!this.ready) return;
    try {
      this.stream.getTracks().forEach((t) => t.stop());
      this.node.disconnect(); this.ctx.close();
      if (this.rec) this.rec.remove();
    } catch { /* 이미 정리됨 */ }
    this.ready = false;
    this.talking = false;
  }

  /** 마이크 사용 중 연결이 끊긴 경우 */
  lost() {
    if (!this.ready) return;
    this.teardown();
    if (this.enabled) { this.onStatus('off', '마이크 연결이 끊겼어요 — 다시 연결을 기다리는 중'); this.scheduleRetry(); }
  }

  scheduleRetry() {
    if (!this.retryTimer) this.retryTimer = setInterval(() => this.retry(), RETRY_MS);
  }

  clearRetry() {
    clearInterval(this.retryTimer);
    this.retryTimer = null;
  }

  retry() {
    if (this.enabled && !this.ready && !this.starting) this.start();
  }

  stop() {
    this.enabled = false;
    this.clearRetry();
    this.talking = false;
    this.onPartial('');
    this.onStatus('idle', '음성인식 꺼짐 — 🎤 버튼으로 켜기');
  }
}
