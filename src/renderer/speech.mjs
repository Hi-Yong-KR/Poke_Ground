// 오프라인 한국어 음성인식 (Vosk WASM). 마이크·모델이 없으면 텍스트 전용으로 동작한다.
// 소형 한국어 모델은 자유 발화 정확도가 낮아서, 명령 단어로 문법을 제한해 인식률을 높인다.
// 마이크가 막혀 있으면 원인을 알려주고, 풀리는 즉시 자동으로 다시 연결한다.
import { voiceGrammar, acceptVoice } from '../shared/parser.mjs';

const MODEL_URL = '/assets/models/ko.tar.gz';
const RETRY_MS = 8000;
const LISTENING = '듣는 중 — 포켓몬 이름을 부르며 말해 보세요';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('스크립트 로드 실패'));
    document.head.appendChild(s);
  });
}

export class Voice {
  /** diagnose: 마이크 실패 시 원인을 { text, fix } 로 돌려주는 함수 */
  constructor({ onResult, onRejected, onPartial, onStatus, diagnose }) {
    this.onResult = onResult;
    this.onRejected = onRejected;
    this.onPartial = onPartial;
    this.onStatus = onStatus;
    this.diagnose = diagnose;
    this.enabled = false;
    this.ready = false;
    this.retryTimer = null;
    navigator.mediaDevices.addEventListener('devicechange', () => this.retry());
  }

  /** extraWords: 화면에 보이는 창/아이콘 이름처럼 문법에 추가할 단어 */
  async start(extraWords = this.extraWords || []) {
    this.extraWords = extraWords;
    this.enabled = true;
    if (this.ready) { this.onStatus('on', LISTENING); return; }
    if (this.starting) return;
    this.starting = true;
    try {
      if (!this.model) {
        this.onStatus('loading', '음성 모델 불러오는 중... (처음 1회 수십 초)');
        const head = await fetch(MODEL_URL, { method: 'HEAD' });
        if (!head.ok) throw Object.assign(new Error('nomodel'), { user: '음성 모델이 없어요 (npm run fetch-voice). 텍스트로 명령하세요' });
        if (!window.Vosk) await loadScript('/node_modules/vosk-browser/dist/vosk.js');
        this.model = await window.Vosk.createModel(MODEL_URL);
      }

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

      const ctx = new AudioContext();
      const rec = new this.model.KaldiRecognizer(ctx.sampleRate, JSON.stringify(voiceGrammar(this.extraWords)));
      rec.setWords(true);   // 단어별 신뢰도로 소음 오인식을 거른다
      rec.on('result', (m) => {
        const t = (m.result.text || '').replace(/\[unk\]/g, '').replace(/\s+/g, ' ').trim();
        this.onPartial('');
        if (!t || !this.enabled) return;
        const v = acceptVoice(t, m.result.result);
        if (v.ok) this.onResult(v.text);
        else if (this.onRejected) this.onRejected(t, v.reason);
      });
      rec.on('partialresult', (m) => { if (this.enabled) this.onPartial((m.result.partial || '').replace(/\[unk\]/g, '').trim()); });

      const src = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = (e) => {
        if (!this.enabled) return;
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
      if (this.enabled) this.onStatus('on', LISTENING);
      else this.stop();
    } catch (e) {
      console.warn('[voice]', e.name || '', e.message);
      this.onStatus('off', e.user || `음성인식 사용 불가 (${e.message}) — 텍스트로 명령하세요`, e.fix);
    } finally {
      this.starting = false;
    }
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
      this.node.disconnect(); this.rec.remove(); this.ctx.close();
    } catch { /* 이미 정리됨 */ }
    this.ready = false;
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
    this.onPartial('');
    this.onStatus('idle', '음성인식 꺼짐 — 🎤 버튼으로 켜기');
  }
}
