// 사용자가 추가할 수 있는 모든 포켓몬의 스프라이트·초상화를 assets/dex/<4자리 번호>/ 에 준비한다.
// PMD SpriteCollab(CC BY-NC 4.0) 저장소에서 필요한 파일만 git 부분 받기(sparse + blob:none)로 .cache/ 에 받은 뒤,
// 앱이 실제로 쓰는 애니메이션만 골라 복사한다. 기본 포켓몬(data.mjs)은 assets/pokemon 에 있으므로 건너뛴다.
// 결과 목록은 assets/dex/index.json ([도감 번호...]) — 앱이 이걸로 추가할 수 있는 포켓몬을 안다.
// 사용법: npm run fetch-dex   (git 필요, 처음 1회 약 300MB)
import { mkdir, writeFile, readFile, copyFile, rm, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POKEMON as BUILTIN } from '../src/shared/data.mjs';
import { POKEDEX } from '../src/shared/pokedex.mjs';
import { EMOTIONS, parseAnimData, pickAnims, USED_ANIMS } from '../src/shared/sprites.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache', 'SpriteCollab');
const OUT = path.join(ROOT, 'assets', 'dex');
const REPO = 'https://github.com/PMDCollab/SpriteCollab.git';
const SPARSE = ['/tracker.json', '/sprite/*/AnimData.xml', '/sprite/*/*-Anim.png', '/sprite/*/credits.txt',
  '/portrait/*/*.png', '/portrait/*/credits.txt'];

const exists = (p) => access(p).then(() => true, () => false);
const git = (...args) => execFileSync('git', args, { cwd: CACHE, stdio: 'inherit' });

if (!(await exists(path.join(CACHE, '.git')))) {
  console.log('SpriteCollab에서 필요한 파일만 받는 중 (처음 1회, 몇 분)...');
  await mkdir(path.dirname(CACHE), { recursive: true });
  execFileSync('git', ['clone', '-q', '--depth', '1', '--filter=blob:none', '--no-checkout', '--sparse', REPO, CACHE], { stdio: 'inherit' });
  git('sparse-checkout', 'set', '--no-cone', ...SPARSE);
  git('checkout', '-q', 'master');
}

const builtin = new Set(Object.values(BUILTIN).map((p) => p.dex));
await rm(OUT, { recursive: true, force: true });
const ok = [];
let skipped = 0;

async function one(dex) {
  const id = String(dex).padStart(4, '0');
  const src = path.join(CACHE, 'sprite', id);
  const xmlPath = path.join(src, 'AnimData.xml');
  if (!(await exists(xmlPath))) { skipped++; return; }
  const anims = pickAnims(parseAnimData(await readFile(xmlPath, 'utf8')));
  if (!anims) { skipped++; return; }

  const dir = path.join(OUT, id);
  await mkdir(path.join(dir, 'portrait'), { recursive: true });
  const files = [...new Set(Object.values(anims).map((a) => a.file))];
  const present = [];
  for (const f of files) if (await exists(path.join(src, f))) { await copyFile(path.join(src, f), path.join(dir, f)); present.push(f); }
  for (const [n, a] of Object.entries(anims)) if (!present.includes(a.file)) delete anims[n];

  const emotions = [];
  for (const e of EMOTIONS) {
    const p = path.join(CACHE, 'portrait', id, `${e}.png`);
    if (await exists(p)) { await copyFile(p, path.join(dir, 'portrait', `${e}.png`)); emotions.push(e); }
  }
  const read = (p) => readFile(p, 'utf8').catch(() => '');
  await writeFile(path.join(dir, 'CREDITS.txt'),
    `Source: PMD SpriteCollab (https://sprites.pmdcollab.org/#/${id})\nLicense: CC BY-NC 4.0\n\n[Sprite]\n${await read(path.join(src, 'credits.txt'))}\n[Portrait]\n${await read(path.join(CACHE, 'portrait', id, 'credits.txt'))}`);
  await writeFile(path.join(dir, 'anims.json'), JSON.stringify({ id, anims, emotions }));
  ok.push(dex);
}

const todo = POKEDEX.map(([dex]) => dex).filter((d) => !builtin.has(d));
while (todo.length) await Promise.all(todo.splice(0, 16).map(one));
ok.sort((a, b) => a - b);
await writeFile(path.join(OUT, 'index.json'), JSON.stringify(ok));
console.log(`dex: ${ok.length}종 준비 (그림이 없어 건너뜀 ${skipped}종, 애니메이션 ${USED_ANIMS.size}종류만 사용)`);
