import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { imageSize, importCreation, deleteCreation } from '../src/main/creations.mjs';

// 2x3 PNG (머리말만 맞으면 된다)
const png = (w, h) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
};
const gif = (w, h) => { const b = Buffer.alloc(13); b.write('GIF89a', 0, 'ascii'); b.writeUInt16LE(w, 6); b.writeUInt16LE(h, 8); return b; };
const jpg = (w, h) => {
  const b = Buffer.alloc(30);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08]);
  b.writeUInt16BE(h, 13); b.writeUInt16BE(w, 15);
  return b;
};
const animXml = `<AnimData><Anims>
<Anim><Name>Walk</Name><FrameWidth>32</FrameWidth><FrameHeight>40</FrameHeight><Durations><Duration>8</Duration><Duration>8</Duration></Durations></Anim>
<Anim><Name>Idle</Name><CopyOf>Walk</CopyOf></Anim>
<Anim><Name>Special</Name><FrameWidth>32</FrameWidth><FrameHeight>40</FrameHeight><Durations><Duration>4</Duration></Durations></Anim>
</Anims></AnimData>`;

async function pmdFolder(dir, { portraits = true } = {}) {
  await mkdir(path.join(dir, 'portrait'), { recursive: true });
  await writeFile(path.join(dir, 'AnimData.xml'), animXml);
  await writeFile(path.join(dir, 'Walk-Anim.png'), png(64, 320));
  await writeFile(path.join(dir, 'Special-Anim.png'), png(32, 320));
  if (portraits) for (const e of ['Normal', 'Happy']) await writeFile(path.join(dir, 'portrait', `${e}.png`), png(40, 40));
}

const tmp = await mkdtemp(path.join(os.tmpdir(), 'poke-creations-'));
const root = path.join(tmp, 'creations');
test.after(() => rm(tmp, { recursive: true, force: true }));
const animsOf = async (id) => JSON.parse(await readFile(path.join(root, id, 'anims.json'), 'utf8'));

test('그림 크기 읽기: PNG, GIF, JPEG', () => {
  assert.deepEqual(imageSize(png(2, 3)), { w: 2, h: 3 });
  assert.deepEqual(imageSize(gif(120, 90)), { w: 120, h: 90 });
  assert.deepEqual(imageSize(jpg(640, 480)), { w: 640, h: 480 });
  assert.equal(imageSize(Buffer.from('not an image')), null);
});

test('이미지 한 장: 한 프레임 시트와 얼굴, 화면 키에 맞춘 배율', async () => {
  const src = path.join(tmp, 'cat.png');
  await writeFile(src, png(300, 360));
  const r = await importCreation(src, root);
  assert.equal(r.kind, 'image');
  assert.ok(Math.abs(r.scale - 0.2) < 0.01);   // 360px → 약 72px
  const a = await animsOf(r.id);
  assert.deepEqual(Object.keys(a.anims).sort(), ['Attack', 'Idle', 'Walk']);
  assert.equal(a.anims.Walk.w, 300);
  assert.deepEqual(a.emotions, ['Normal']);
  assert.ok((await readdir(path.join(root, r.id, 'portrait'))).includes('Normal.png'));
});

test('PMD 폴더: 쓰는 애니메이션만, 초상화 포함', async () => {
  const src = path.join(tmp, 'pmd');
  await pmdFolder(src);
  const r = await importCreation(src, root);
  assert.equal(r.kind, 'pmd');
  const a = await animsOf(r.id);
  assert.deepEqual(Object.keys(a.anims).sort(), ['Idle', 'Walk']);   // 앱이 안 쓰는 Special은 뺀다
  assert.deepEqual(a.emotions, ['Normal', 'Happy']);
  const files = await readdir(path.join(root, r.id));
  assert.ok(files.includes('Walk-Anim.png') && !files.includes('Special-Anim.png') && !files.includes('AnimData.xml'));
});

test('PMD zip: 한 단계 안쪽 폴더에 있어도 찾고, 초상화가 없어도 됨', async () => {
  const src = path.join(tmp, 'zipsrc', 'sprite-0931');
  await pmdFolder(src, { portraits: false });
  const zip = path.join(tmp, 'sprite.zip');
  execFileSync(path.join(process.env.SystemRoot, 'System32', 'tar.exe'), ['-a', '-c', '-f', zip, '-C', path.dirname(src), 'sprite-0931']);
  const r = await importCreation(zip, root);
  const a = await animsOf(r.id);
  assert.ok(a.anims.Walk && a.anims.Idle);
  assert.deepEqual(a.emotions, []);
  assert.ok(!(await readdir(path.join(root, r.id))).includes('_zip'));   // 푼 원본은 남기지 않는다
});

// 칸 번호 → 그 칸이 무슨 감정인지 알 수 있는 가짜 PNG (실제 자르기는 메인의 nativeImage가 한다)
const fakeSlice = (filled) => async (file, sheet) => {
  assert.deepEqual([sheet.size, sheet.cols, sheet.rows], [40, 5, 8]);
  return Array.from({ length: sheet.cols * sheet.rows }, (_, i) => (filled.includes(i) ? Buffer.from(`tile${i}`) : null));
};

test('초상화 시트(SpriteCollab portrait-XXXX.png): 칸 순서대로 감정에 맞춰 자름, 반전 칸은 안 씀', async () => {
  const src = path.join(tmp, 'sheet-pmd');
  await pmdFolder(src, { portraits: false });
  await writeFile(path.join(src, 'portrait-0931.png'), png(200, 320));
  // 0 Normal, 1 Happy, 13 Dizzy, 14 Special0(앱에서 안 씀), 20 Normal^(반전)
  const r = await importCreation(src, root, { sliceSheet: fakeSlice([0, 1, 13, 14, 20]) });
  const a = await animsOf(r.id);
  assert.deepEqual(a.emotions, ['Normal', 'Happy', 'Dizzy']);
  assert.equal((await readFile(path.join(root, r.id, 'portrait', 'Dizzy.png'))).toString(), 'tile13');
});

test('여러 개 고르기: 따로 받은 스프라이트 zip + 초상화 시트를 한 번에', async () => {
  const src = path.join(tmp, 'multi', 'sprites');
  await pmdFolder(src, { portraits: false });
  const zip = path.join(tmp, 'multi', 'sprites.zip');
  execFileSync(path.join(process.env.SystemRoot, 'System32', 'tar.exe'), ['-a', '-c', '-f', zip, '-C', src, '.']);
  const sheet = path.join(tmp, 'multi', 'portrait-0931.png');
  await writeFile(sheet, png(200, 80));   // 두 줄만 있는 시트도 된다
  const r = await importCreation([zip, sheet], root, { sliceSheet: fakeSlice([0, 5]) });
  assert.deepEqual((await animsOf(r.id)).emotions, ['Normal', 'Sad']);
  const two = [path.join(tmp, 'cat.png'), path.join(tmp, 'dog.gif')];
  await writeFile(two[1], gif(10, 10));
  await assert.rejects(importCreation(two, root), /한 장만/);
});

test('잘못된 파일은 알기 쉬운 오류, 반쯤 만든 폴더는 남지 않음', async () => {
  const txt = path.join(tmp, 'note.txt');
  await writeFile(txt, 'hello');
  await assert.rejects(importCreation(txt, root), (e) => e.user && /골라 주세요/.test(e.message));
  const empty = path.join(tmp, 'empty');
  await mkdir(empty);
  await assert.rejects(importCreation(empty, root), /AnimData\.xml/);
  assert.ok((await readdir(root)).every((n) => !n.endsWith('.part')));
});

test('삭제: 앱이 복사해 둔 그림 폴더만 지움', async () => {
  const src = path.join(tmp, 'dog.gif');
  await writeFile(src, gif(50, 50));
  const r = await importCreation(src, root);
  await deleteCreation(r.id, root);
  assert.ok(!(await readdir(root)).includes(r.id));
  await deleteCreation('../../etc', root);   // 이상한 id는 무시
  assert.ok((await readFile(src)).length > 0);   // 원본은 그대로
});
