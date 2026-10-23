// 오프라인 한국어 음성인식 모델(Vosk small ko, Apache-2.0)을 받아 vosk-browser용 tar.gz로 다시 묶는다.
// 사용법: node scripts/fetch-voice-model.mjs
import { mkdir, writeFile, rm, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'vosk-model-small-ko-0.22';
const URL = `https://alphacephei.com/vosk/models/${NAME}.zip`;
const outDir = path.join(ROOT, 'assets', 'models');
const out = path.join(outDir, 'ko.tar.gz');

if (await access(out).then(() => true, () => false)) {
  console.log('이미 있음:', out);
  process.exit(0);
}

await mkdir(outDir, { recursive: true });
const tmp = path.join(outDir, '_tmp');
await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });

console.log('다운로드 중...', URL);
const res = await fetch(URL);
if (!res.ok) throw new Error(`다운로드 실패: ${res.status}`);
const zip = path.join(tmp, 'model.zip');
await writeFile(zip, Buffer.from(await res.arrayBuffer()));

// Windows 10 이상에 기본 포함된 bsdtar로 zip 해제 후 tar.gz로 재압축
execFileSync('tar', ['-xf', zip, '-C', tmp]);
execFileSync('tar', ['-czf', out, '-C', tmp, NAME]);
await rm(tmp, { recursive: true, force: true });
console.log('완료:', out);
