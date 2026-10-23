// 기술 표(src/shared/movedex.mjs)와 포켓몬마다 배우는 기술 표(src/shared/learnsets.mjs)를 만든다.
// 기술은 어떤 포켓몬이라도 배우는 것만 넣는다(Z기술·다이맥스 기술·발버둥 등은 빠진다).
// 배우는 기술은 모든 세대·모든 방법(레벨업·기술머신·알·가르침)을 합치고, 지역 모습 등 다른 모습이 배우는 기술도 그 종에 합친다.
// 출처: PokeAPI 데이터 CSV (https://github.com/PokeAPI/pokeapi, BSD-3-Clause)
// 사용법: node scripts/build-movedex.mjs   (새 세대가 나와서 표를 갱신할 때만)
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSV = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const KO = '3', EN = '9';   // languages.csv: 3 = ko, 9 = en
const MAX_DEX = 1025;
const CLASS = { 1: 'status', 2: 'physical', 3: 'special' };   // move_damage_classes.csv
const CONTACT = '1';   // move_flags.csv: 1 = contact (몸이 닿는 기술)

async function csv(name) {
  const res = await fetch(`${CSV}/${name}.csv`);
  if (!res.ok) throw new Error(`${name}.csv: ${res.status}`);
  const [head, ...rows] = (await res.text()).trim().split(/\r?\n/);
  const cols = head.split(',');
  // 쓰는 칸에는 따옴표 속 쉼표가 없어서 단순 분리로 충분하다
  return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [cols[i], v])));
}

const [moves, names, flags, typeIds, pokemon, learn] = await Promise.all(
  ['moves', 'move_names', 'move_flag_map', 'types', 'pokemon', 'pokemon_moves'].map(csv));
const typeName = Object.fromEntries(typeIds.map((t) => [t.id, t.identifier]));
const speciesOf = Object.fromEntries(pokemon.map((p) => [p.id, +p.species_id]));
const contact = new Set(flags.filter((f) => f.move_flag_id === CONTACT).map((f) => f.move_id));
const name = {};
for (const n of names) {
  if (n.local_language_id === KO || n.local_language_id === EN) (name[n.move_id] ||= {})[n.local_language_id === KO ? 'ko' : 'en'] = n.name;
}

const learnt = new Map();   // 도감 번호 → Set(기술 id)
for (const l of learn) {
  const dex = speciesOf[l.pokemon_id];
  if (!dex || dex > MAX_DEX) continue;
  if (!learnt.has(dex)) learnt.set(dex, new Set());
  learnt.get(dex).add(l.move_id);
}
const used = new Set([...learnt.values()].flatMap((s) => [...s]));

// [키, 한글, 영어, 타입, 분류, 위력|0, 접촉 1|0] — 키는 PokeAPI 이름에서 '-'를 뺀 것 (data.mjs의 기술 키와 같은 규칙)
const rows = moves.filter((m) => used.has(m.id)).map((m) => [
  m.identifier.replace(/-/g, ''), name[m.id]?.ko, name[m.id]?.en, typeName[m.type_id],
  CLASS[m.damage_class_id], +m.power || 0, contact.has(m.id) ? 1 : 0, m.id,
]);
if (rows.some((r) => !r[1] || !r[2] || !r[3] || !r[4])) throw new Error('기술 표에 비어 있는 칸이 있어요');
const index = new Map(rows.map((r, i) => [r[7], i]));

// 배우는 기술은 MOVEDEX 순서의 비트(1 = 배움)를 base64로: 1025종 × 833개를 줄 수 있게 담는다
const bytes = Math.ceil(rows.length / 8);
const sets = [];
for (let dex = 1; dex <= MAX_DEX; dex++) {
  const b = Buffer.alloc(bytes);
  for (const id of learnt.get(dex) || []) { const i = index.get(id); b[i >> 3] |= 1 << (i & 7); }
  sets.push(b.toString('base64'));
}

await writeFile(path.join(ROOT, 'src', 'shared', 'movedex.mjs'),
  `// 자동 생성: node scripts/build-movedex.mjs (PokeAPI 데이터, BSD-3-Clause) — 손으로 고치지 말 것\n`
  + `// [키, 한글 이름, 영어 이름, 타입, 분류(physical·special·status), 위력(없으면 0), 몸이 닿으면 1]\n`
  + `export const MOVEDEX = [\n${rows.map((r) => `  ${JSON.stringify(r.slice(0, 7))},`).join('\n')}\n];\n`);
await writeFile(path.join(ROOT, 'src', 'shared', 'learnsets.mjs'),
  `// 자동 생성: node scripts/build-movedex.mjs (PokeAPI 데이터, BSD-3-Clause) — 손으로 고치지 말 것\n`
  + `// LEARNSETS[도감 번호 - 1] = 배우는 기술. MOVEDEX 순서의 비트(1 = 배움)를 base64로 담았다\n`
  + `export const LEARNSETS = [\n${sets.map((s) => `  '${s}',`).join('\n')}\n];\n`);
console.log(`기술 ${rows.length}개, 배우는 기술 표 ${MAX_DEX}종 (빈 종 ${sets.filter((_, i) => !learnt.has(i + 1)).length})`);
