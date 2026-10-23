// 울음소리 받기: 게임 원음이라 저장소·배포판에는 넣지 않고, 앱이 처음 실행될 때(인터넷이 되면) 전국도감 전부를
// PokeAPI cries 저장소에서 userData/cries/<도감 번호>.ogg 로 받아 둔다. main.js의 정적 서버가 /cries/ 로 낸다.
// 끊기거나 인터넷이 없으면 다음 실행 때 못 받은 것만 다시 받는다.
import { mkdir, writeFile, rename, readdir } from 'node:fs/promises';
import path from 'node:path';

const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest';
const PARALLEL = 8;

/**
 * dexList 중 아직 없는 울음소리를 받는다. onProgress(받은 수, 받을 수)
 * 돌려주는 값: { got, missing, failed } — failed가 있으면 인터넷 문제(다음 실행 때 다시 시도)
 */
export async function downloadCries(dexList, dir, onProgress = () => {}) {
  await mkdir(dir, { recursive: true });
  const have = new Set((await readdir(dir)).filter((f) => f.endsWith('.ogg')).map((f) => +f.slice(0, -4)));
  const todo = dexList.filter((n) => !have.has(n));
  const r = { got: 0, missing: 0, failed: 0 };
  let next = 0, done = 0;
  async function worker() {
    while (next < todo.length) {
      const n = todo[next++];
      try {
        const res = await fetch(`${CRIES}/${n}.ogg`, { signal: AbortSignal.timeout(20000) });
        if (res.status === 404) r.missing++;
        else if (!res.ok) throw new Error(`HTTP ${res.status}`);
        else {
          const file = path.join(dir, `${n}.ogg`);
          await writeFile(`${file}.part`, Buffer.from(await res.arrayBuffer()));
          await rename(`${file}.part`, file);   // 반쯤 받은 파일이 울음소리로 쓰이지 않게
          r.got++;
        }
      } catch {
        r.failed++;
        if (r.failed >= 20 && r.got === 0) { next = todo.length; return; }   // 인터넷이 없으면 일찍 그만둔다
      }
      onProgress(++done, todo.length);
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return { ...r, todo: todo.length };
}
