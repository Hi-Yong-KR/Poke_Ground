// 사용자가 직접 넣는 그림: PMD 형식(AnimData.xml + *-Anim.png [+ 초상화])의 zip·폴더, 또는 이미지 한 장(PNG·GIF·WebP·JPG).
// PMD 형식은 SpriteCollab에 제출하는 모양 그대로 받는다: 스프라이트 zip + 초상화 시트(portrait-XXXX.png) 또는 감정별 PNG.
// userData/creations/<id>/ 에 앱이 쓰는 모양(anims.json, 애니메이션 PNG, portrait/)으로 정리해 둔다.
// 원본 파일은 건드리지 않고 복사만 한다. main.js가 /user/<id>/ 주소로 서빙한다.
import { mkdir, writeFile, readFile, copyFile, cp, rm, rename, readdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { EMOTIONS, parseAnimData, pickAnims } from '../shared/sprites.mjs';

const IMAGE_EXT = ['.png', '.gif', '.webp', '.jpg', '.jpeg'];
const MAX_IMAGE = 20 * 1024 * 1024;
const TARGET_H = 72;   // 이미지 한 장은 화면에서 이 정도 키가 되게 줄이거나 키운다

const fail = (message) => Object.assign(new Error(message), { user: true });

// SpriteCollab 초상화 시트(SpriteBot sprite_config.json): 40px 칸, 가로 5칸 × 세로 최대 8칸.
// 칸 번호(줄×5+칸)가 아래 감정 순서이고, 20번째부터(아래 4줄)는 좌우 반전본이라 쓰지 않는다
export const SHEET = {
  size: 40, cols: 5, rows: 8,
  emotions: ['Normal', 'Happy', 'Pain', 'Angry', 'Worried', 'Sad', 'Crying', 'Shouting', 'Teary-Eyed', 'Determined',
    'Joyous', 'Inspired', 'Surprised', 'Dizzy', 'Special0', 'Special1', 'Sigh', 'Stunned', 'Special2', 'Special3'],
};
const isSheet = (sz) => sz && sz.w % SHEET.size === 0 && sz.h % SHEET.size === 0
  && sz.w <= SHEET.size * SHEET.cols && sz.h <= SHEET.size * SHEET.rows && sz.w * sz.h > SHEET.size * SHEET.size;

/** 이미지 머리말에서 크기 읽기 (PNG, GIF, JPEG, WebP) */
export function imageSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length > 10 && b.toString('ascii', 0, 3) === 'GIF') return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') { const v = b.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
    if (kind === 'VP8X') return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** 폴더 안에서 이름이 맞는 파일들을 얕은 곳부터 찾는다 (zip을 풀면 한두 단계 안쪽에 있는 경우가 많다) */
async function findFiles(root, maxDepth = 4) {
  const out = [];
  async function walk(dir, depth) {
    for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && depth < maxDepth) await walk(p, depth + 1);
      else if (e.isFile()) out.push({ p, name: e.name, depth, dir });
    }
  }
  await walk(root, 0);
  return out.sort((a, b) => a.depth - b.depth);
}

function unzip(zip, dest) {
  // Windows 10 이상에 들어 있는 bsdtar는 zip도 푼다 (PATH의 다른 tar가 잡히지 않게 경로를 정한다)
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  return new Promise((resolve, reject) => execFile(tar, ['-xf', zip, '-C', dest], { windowsHide: true },
    (err) => (err ? reject(fail('zip 파일을 풀지 못했어요')) : resolve())));
}

async function importImage(src, tmp) {
  if ((await stat(src)).size > MAX_IMAGE) throw fail('그림 파일이 너무 커요 (20MB 이하)');
  const buf = await readFile(src);
  const size = imageSize(buf);
  if (!size || !size.w || !size.h) throw fail('그림 크기를 읽지 못했어요 (PNG, GIF, WebP, JPG만 돼요)');
  const file = `image${path.extname(src).toLowerCase()}`;
  await writeFile(path.join(tmp, file), buf);
  await writeFile(path.join(tmp, 'portrait', 'Normal.png'), buf);   // 말풍선 얼굴도 같은 그림 (브라우저는 확장자가 아니라 내용으로 그린다)
  // 한 프레임짜리 시트: 동작은 렌더러가 통통 튀기기·흔들기로 흉내 낸다 (def.simple)
  const one = (durations) => ({ file, w: size.w, h: size.h, durations, hit: null });
  const anims = { Idle: one([60]), Walk: one([12]), Attack: one([6, 6]) };
  const scale = Math.max(0.01, Math.min(4, TARGET_H / size.h, 110 / size.w));   // 넓은 그림은 너비 110px에 맞춘다
  return { kind: 'image', anims, emotions: ['Normal'], scale };
}

/** 감정별 PNG가 없으면 초상화 시트를 찾아 감정별로 잘라 쓴다. sliceSheet(file) → 칸 순서의 PNG Buffer|null 배열 (메인이 nativeImage로) */
async function portraitsFromSheet(files, tmp, sliceSheet) {
  const pngs = files.filter((f) => /\.png$/i.test(f.name) && !/-(Anim|Offsets|Shadow)\.png$/i.test(f.name));
  // 이름에 portrait가 든 것을 먼저 보고, 없으면 크기가 시트 모양인 PNG
  pngs.sort((a, b) => /portrait/i.test(b.name) - /portrait/i.test(a.name) || a.depth - b.depth);
  for (const f of pngs) {
    const head = await readFile(f.p).then((b) => b.subarray(0, 32)).catch(() => null);
    if (!head || !isSheet(imageSize(head))) continue;
    const tiles = await sliceSheet(f.p, SHEET);
    const emotions = [];
    for (const e of EMOTIONS) {
      const tile = tiles[SHEET.emotions.indexOf(e)];
      if (tile) { await writeFile(path.join(tmp, 'portrait', `${e}.png`), tile); emotions.push(e); }
    }
    if (emotions.length) return emotions;
  }
  return [];
}

async function importPmd(srcDir, tmp, { sliceSheet } = {}) {
  const files = await findFiles(srcDir);
  const xml = files.find((f) => f.name.toLowerCase() === 'animdata.xml');
  if (!xml) throw fail('AnimData.xml이 없어요 — PMD 형식 스프라이트 폴더나 zip을 골라 주세요');
  const anims = pickAnims(parseAnimData(await readFile(xml.p, 'utf8')));
  if (!anims) throw fail('걷기(Walk)나 서 있기(Idle) 애니메이션이 없어서 쓸 수 없어요');
  for (const [n, a] of Object.entries(anims)) {
    const f = files.find((x) => x.dir === xml.dir && x.name === a.file);
    if (f) await copyFile(f.p, path.join(tmp, a.file)); else delete anims[n];
  }
  if (!anims.Walk && !anims.Idle) throw fail('Walk-Anim.png나 Idle-Anim.png 파일이 없어요');
  // 초상화: 같은 폴더나 portrait 폴더 등에 Normal.png, Happy.png ... 가 있으면 쓰고, 없으면 초상화 시트를 잘라 쓴다 (없어도 된다)
  let emotions = [];
  for (const e of EMOTIONS) {
    const f = files.find((x) => x.name === `${e}.png`);
    if (f) { await copyFile(f.p, path.join(tmp, 'portrait', `${e}.png`)); emotions.push(e); }
  }
  if (!emotions.length && sliceSheet) emotions = await portraitsFromSheet(files, tmp, sliceSheet);
  return { kind: 'pmd', anims, emotions, scale: 3 };
}

/**
 * src: 이미지 파일, PMD zip, PMD 폴더 — 또는 그 여러 개(SpriteCollab에서 따로 받은 스프라이트 zip + 초상화 시트 등).
 * 성공하면 { id, kind, scale, emotions }
 * opts.sliceSheet: 초상화 시트를 칸별 PNG로 자르는 함수 (메인 프로세스가 Electron nativeImage로 넘겨준다)
 */
export async function importCreation(src, root, opts = {}) {
  const list = [src].flat();
  const id = Date.now().toString(36);
  const dir = path.join(root, id);
  const tmp = `${dir}.part`;
  await rm(tmp, { recursive: true, force: true });
  await mkdir(path.join(tmp, 'portrait'), { recursive: true });
  try {
    const kinds = await Promise.all(list.map(async (p) => ((await stat(p)).isDirectory() ? 'dir' : path.extname(p).toLowerCase())));
    let r;
    if (list.length === 1 && IMAGE_EXT.includes(kinds[0])) r = await importImage(list[0], tmp);
    else if (list.length === 1 && kinds[0] === 'dir') r = await importPmd(list[0], tmp, opts);
    else if (kinds.some((k) => k === 'dir' || k === '.zip')) {
      // zip은 풀고 폴더는 복사하고, 따로 고른 PNG(초상화 시트·감정별 얼굴)는 한곳에 모아 같이 본다
      const raw = path.join(tmp, '_src');
      await mkdir(raw);
      for (const [i, p] of list.entries()) {
        if (kinds[i] === 'dir') await cp(p, path.join(raw, String(i)), { recursive: true });
        else if (kinds[i] === '.zip') { await mkdir(path.join(raw, String(i))); await unzip(p, path.join(raw, String(i))); }
        else if (kinds[i] === '.png') await copyFile(p, path.join(raw, path.basename(p)));
        else throw fail(`${path.basename(p)}: PMD zip·폴더와 함께 고를 수 있는 건 PNG(초상화)뿐이에요`);
      }
      r = await importPmd(raw, tmp, opts);
      await rm(raw, { recursive: true, force: true });
    } else if (list.length > 1) throw fail('그림은 한 장만 고르거나, PMD zip·폴더와 초상화 시트를 함께 골라 주세요');
    else throw fail('그림(PNG·GIF·WebP·JPG), PMD zip, PMD 폴더 중 하나를 골라 주세요');
    await writeFile(path.join(tmp, 'anims.json'), JSON.stringify({ id, anims: r.anims, emotions: r.emotions }));
    await rename(tmp, dir);
    return { id, kind: r.kind, scale: r.scale, emotions: r.emotions.length };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

export function deleteCreation(id, root) {
  if (!/^[a-z0-9]+$/.test(id)) return Promise.resolve();
  return rm(path.join(root, id), { recursive: true, force: true });
}
