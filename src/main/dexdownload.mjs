// 앱 안에서 도감 포켓몬 그림 받기: 배포판을 만들 때 SpriteCollab에 그림이 없던 포켓몬도,
// 나중에 그림이 생기면 사용자가 ＋ 포켓몬에서 받아 쓸 수 있다 (이때만 인터넷 필요).
// userData/dex/<4자리 번호>/ 에 저장하고, main.js의 정적 서버가 /assets/dex/ 요청을 여기서도 찾아 준다.
import { mkdir, writeFile, rm, rename, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { EMOTIONS, parseAnimData, pickAnims } from '../shared/sprites.mjs';

const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';

async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * 한 종의 그림을 받는다. 'ok' | 'missing'(아직 쓸 수 있는 그림이 없음). 인터넷 문제는 예외로 던진다.
 * 임시 폴더에 다 받은 뒤 이름을 바꾸므로, 중간에 끊겨도 반쯤 받은 그림이 남지 않는다.
 */
export async function downloadDex(dex, root) {
  const id = String(dex).padStart(4, '0');
  const xml = await get(`${RAW}/sprite/${id}/AnimData.xml`);
  const anims = xml && pickAnims(parseAnimData(xml.toString('utf8')));
  if (!anims) return 'missing';

  const dir = path.join(root, id);
  const tmp = `${dir}.part`;
  await rm(tmp, { recursive: true, force: true });
  await mkdir(path.join(tmp, 'portrait'), { recursive: true });
  try {
    const got = new Set();
    await Promise.all([...new Set(Object.values(anims).map((a) => a.file))].map(async (f) => {
      const buf = await get(`${RAW}/sprite/${id}/${f}`);
      if (buf) { await writeFile(path.join(tmp, f), buf); got.add(f); }
    }));
    for (const [n, a] of Object.entries(anims)) if (!got.has(a.file)) delete anims[n];
    if (!anims.Walk && !anims.Idle) return 'missing';

    const have = new Set();
    await Promise.all(EMOTIONS.map(async (e) => {
      const buf = await get(`${RAW}/portrait/${id}/${e}.png`);
      if (buf) { await writeFile(path.join(tmp, 'portrait', `${e}.png`), buf); have.add(e); }
    }));
    const credits = (p) => get(`${RAW}/${p}/${id}/credits.txt`).then((b) => (b ? b.toString('utf8') : ''));
    await writeFile(path.join(tmp, 'CREDITS.txt'),
      `Source: PMD SpriteCollab (https://sprites.pmdcollab.org/#/${id})\nLicense: CC BY-NC 4.0\n\n[Sprite]\n${await credits('sprite')}\n[Portrait]\n${await credits('portrait')}`);
    await writeFile(path.join(tmp, 'anims.json'), JSON.stringify({ id, anims, emotions: EMOTIONS.filter((e) => have.has(e)) }));

    await rm(dir, { recursive: true, force: true });
    await rename(tmp, dir);
    return 'ok';
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

/** 앱에서 받아 둔 도감 번호들 */
export async function listDownloaded(root) {
  const names = await readdir(root).catch(() => []);
  const ok = await Promise.all(names.filter((n) => /^\d{4}$/.test(n))
    .map((n) => access(path.join(root, n, 'anims.json')).then(() => +n, () => null)));
  return ok.filter((n) => n != null);
}
