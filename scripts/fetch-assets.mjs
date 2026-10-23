// PMD SpriteCollab(https://sprites.pmdcollab.org, CC BY-NC 4.0)에서 포켓몬 스프라이트/초상화를 받아온다.
// 사용법: node scripts/fetch-assets.mjs
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POKEMON as DEFS } from '../src/shared/data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';
const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest';

// 포켓몬 목록은 src/shared/data.mjs 한 곳에서 관리 (key → 4자리 도감 번호)
const POKEMON = Object.fromEntries(Object.entries(DEFS).map(([k, d]) => [k, String(d.dex).padStart(4, '0')]));

const EMOTIONS = [
  'Normal', 'Happy', 'Pain', 'Angry', 'Worried', 'Sad', 'Crying', 'Shouting',
  'Teary-Eyed', 'Determined', 'Joyous', 'Inspired', 'Surprised', 'Dizzy', 'Sigh', 'Stunned',
];

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (i === 2) throw e;
    }
  }
}

const exists = (p) => access(p).then(() => true, () => false);

function parseAnimData(xml) {
  const anims = {};
  const tag = (s, t) => (s.match(new RegExp(`<${t}>([^<]*)</${t}>`)) || [])[1];
  for (const block of xml.match(/<Anim>[\s\S]*?<\/Anim>/g) || []) {
    const name = tag(block, 'Name');
    const copyOf = tag(block, 'CopyOf');
    if (copyOf) { anims[name] = { copyOf }; continue; }
    anims[name] = {
      file: `${name}-Anim.png`,
      w: +tag(block, 'FrameWidth'),
      h: +tag(block, 'FrameHeight'),
      durations: [...block.matchAll(/<Duration>(\d+)<\/Duration>/g)].map((m) => +m[1]),
      hit: tag(block, 'HitFrame') != null ? +tag(block, 'HitFrame') : null,
    };
  }
  for (const [name, a] of Object.entries(anims)) {
    if (a.copyOf) anims[name] = { ...anims[a.copyOf] };
  }
  return anims;
}

async function fetchPokemon(key, id) {
  const dir = path.join(ROOT, 'assets', 'pokemon', key);
  await mkdir(path.join(dir, 'portrait'), { recursive: true });

  const xml = (await get(`${RAW}/sprite/${id}/AnimData.xml`)).toString('utf8');
  const anims = parseAnimData(xml);
  const files = [...new Set(Object.values(anims).map((a) => a.file))];
  await Promise.all(files.map(async (f) => {
    const out = path.join(dir, f);
    if (await exists(out)) return;
    const buf = await get(`${RAW}/sprite/${id}/${f}`);
    if (buf) await writeFile(out, buf);
  }));

  const emotions = [];
  await Promise.all(EMOTIONS.map(async (e) => {
    const out = path.join(dir, 'portrait', `${e}.png`);
    if (!(await exists(out))) {
      const buf = await get(`${RAW}/portrait/${id}/${e}.png`);
      if (!buf) return;
      await writeFile(out, buf);
    }
    emotions.push(e);
  }));

  // 울음소리: PokeAPI/cries (게임 원음, 저작권 Nintendo/Game Freak → 저장소에는 올리지 않음)
  const cryOut = path.join(dir, 'cry.ogg');
  if (!(await exists(cryOut))) {
    const cry = await get(`${CRIES}/${Number(id)}.ogg`);
    if (cry) await writeFile(cryOut, cry);
  }

  const credits = await get(`${RAW}/sprite/${id}/credits.txt`);
  const pcredits = await get(`${RAW}/portrait/${id}/credits.txt`);
  await writeFile(path.join(dir, 'CREDITS.txt'),
    `Source: PMD SpriteCollab (https://sprites.pmdcollab.org/#/${id})\nLicense: CC BY-NC 4.0\n\n[Sprite]\n${credits || ''}\n[Portrait]\n${pcredits || ''}`);

  await writeFile(path.join(dir, 'anims.json'), JSON.stringify({ id, anims, emotions: EMOTIONS.filter((e) => emotions.includes(e)) }, null, 1));
  console.log(`${key}: ${Object.keys(anims).length} anims, ${emotions.length} emotions`);
}

// 이미 받은 포켓몬은 건너뛰고, 4마리씩 동시에 받는다
const todo = Object.entries(POKEMON);
while (todo.length) {
  await Promise.all(todo.splice(0, 4).map(([key, id]) => fetchPokemon(key, id)));
}
console.log('done');
