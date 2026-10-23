// 오프라인 한국어 음성인식(Faster-Whisper small, CPU INT8)을 상주 파이썬 프로세스로 돌린다.
// 렌더러가 발화 하나(16kHz PCM)를 넘기면 whisper_worker.py에 보내고 받아쓴 문장을 돌려준다.
// 준비물(.venv, 모델)은 scripts/setup-whisper.py 가 만든다.
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const readline = require('node:readline');

const SAMPLE_RATE = 16000;

class Whisper {
  constructor(root) {
    // 오프라인 배포판(make-offline.ps1)은 휴대용 파이썬을 runtime\python 에 넣어 둔다
    const bundled = path.join(root, 'runtime', 'python', 'python.exe');
    this.python = fs.existsSync(bundled) ? bundled : path.join(root, '.venv', 'Scripts', 'python.exe');
    this.modelDir = path.join(root, 'assets', 'models', 'whisper-small');
    this.script = path.join(__dirname, 'whisper_worker.py');
    this.proc = null;
    this.ready = null;      // 모델 로드가 끝나면 resolve되는 Promise
    this.pending = new Map();
    this.nextId = 1;
    this.hotwords = '';
  }

  get available() {
    return fs.existsSync(this.python) && fs.existsSync(path.join(this.modelDir, 'model.bin'));
  }

  start() {
    if (this.proc || !this.available) return this.ready;
    const proc = spawn(this.python, ['-I', this.script, this.modelDir], { windowsHide: true });
    this.proc = proc;
    this.ready = new Promise((resolve, reject) => {
      readline.createInterface({ input: proc.stdout }).on('line', (line) => {
        let m;
        try { m = JSON.parse(line); } catch { return; }
        if (m.ready) { console.log(`[whisper] 준비됨 (CPU ${m.threads}스레드, INT8)`); resolve(); return; }
        const job = this.pending.get(m.id);
        if (!job) { if (m.error) { console.error('[whisper]', m.error); reject(new Error(m.error)); } return; }
        this.pending.delete(m.id);
        if (m.error) job.reject(new Error(m.error));
        else job.resolve({ text: m.text, ms: m.ms });
      });
    });
    this.ready.catch(() => {});
    proc.stderr.on('data', (d) => console.error('[whisper]', d.toString().trim()));
    proc.on('exit', (code) => {
      if (this.proc === proc) this.proc = null;
      for (const job of this.pending.values()) job.reject(new Error(`인식 프로세스 종료 (${code})`));
      this.pending.clear();
    });
    if (this.hotwords) this.write({ hotwords: this.hotwords });
    return this.ready;
  }

  write(obj) {
    if (this.proc) this.proc.stdin.write(JSON.stringify(obj) + '\n');
  }

  /** 인식 힌트: 포켓몬·기술 이름을 알려 주면 그 단어로 더 잘 받아쓴다 */
  setHotwords(list) {
    this.hotwords = [...new Set(list)].join(' ');
    this.write({ hotwords: this.hotwords });
  }

  /** pcm: 16kHz mono Int16 (ArrayBuffer/TypedArray) → { text, ms } */
  async transcribe(pcm) {
    if (!this.proc) this.start();
    if (!this.proc) throw new Error('음성인식 준비가 안 됐어요 (npm run fetch-whisper)');
    await this.ready;
    const id = this.nextId++;
    const buf = pcm instanceof ArrayBuffer ? Buffer.from(pcm) : Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.write({ id, pcm: buf.toString('base64') });
    });
  }

  stop() {
    if (this.proc) { this.proc.stdin.end(); this.proc = null; }
  }
}

module.exports = { Whisper, SAMPLE_RATE };
