// PMD SpriteCollab(https://sprites.pmdcollab.org, CC BY-NC 4.0)에서 포켓몬 스프라이트/초상화를 받아온다.
// 사용법: node scripts/fetch-assets.mjs
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';

export const POKEMON = {
  pikachu: '0025',
  charizard: '0006',
  squirtle: '0007',
  bulbasaur: '0001',
  eevee: '0133',
};

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

  const credits = await get(`${RAW}/sprite/${id}/credits.txt`);
  const pcredits = await get(`${RAW}/portrait/${id}/credits.txt`);
  await writeFile(path.join(dir, 'CREDITS.txt'),
    `Source: PMD SpriteCollab (https://sprites.pmdcollab.org/#/${id})\nLicense: CC BY-NC 4.0\n\n[Sprite]\n${credits || ''}\n[Portrait]\n${pcredits || ''}`);

  await writeFile(path.join(dir, 'anims.json'), JSON.stringify({ id, anims, emotions: EMOTIONS.filter((e) => emotions.includes(e)) }, null, 1));
  console.log(`${key}: ${Object.keys(anims).length} anims, ${emotions.length} emotions`);
}

for (const [key, id] of Object.entries(POKEMON)) {
  await fetchPokemon(key, id);
}
console.log('done');
