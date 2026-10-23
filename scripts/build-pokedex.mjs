// 전국도감 표(src/shared/pokedex.mjs)를 만든다: 도감 번호 → 한글 이름, 영어 이름, 타입.
// 사용자가 포켓몬을 검색해 추가할 때 쓰며, 앱에 넣어 두므로 검색은 인터넷 없이 된다.
// 출처: PokeAPI 데이터 CSV (https://github.com/PokeAPI/pokeapi, BSD-3-Clause)
// 사용법: node scripts/build-pokedex.mjs   (새 세대가 나와서 표를 갱신할 때만)
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSV = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const KO = '3', EN = '9';   // languages.csv: 3 = ko, 9 = en
const MAX_DEX = 1025;

async function csv(name) {
  const res = await fetch(`${CSV}/${name}.csv`);
  if (!res.ok) throw new Error(`${name}.csv: ${res.status}`);
  const [head, ...rows] = (await res.text()).trim().split(/\r?\n/);
  const cols = head.split(',');
  // 이 표들에는 따옴표 속 쉼표가 있는 칸(genus 등)이 뒤쪽에만 있어서 앞 칸만 쓰면 단순 분리로 충분하다
  return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [cols[i], v])));
}

const [names, types, typeIds] = await Promise.all([csv('pokemon_species_names'), csv('pokemon_types'), csv('types')]);
const typeName = Object.fromEntries(typeIds.map((t) => [t.id, t.identifier]));
const dex = {};
for (const n of names) {
  const id = +n.pokemon_species_id;
  if (id > MAX_DEX || (n.local_language_id !== KO && n.local_language_id !== EN)) continue;
  (dex[id] ||= { types: [] })[n.local_language_id === KO ? 'ko' : 'en'] = n.name;
}
// pokemon_id가 1~1025인 것은 각 종의 기본 모습이다
for (const t of types) {
  const id = +t.pokemon_id;
  if (dex[id]) dex[id].types[+t.slot - 1] = typeName[t.type_id];
}

const rows = Object.entries(dex).map(([id, d]) => [+id, d.ko, d.en, ...d.types]);
if (rows.length !== MAX_DEX || rows.some((r) => !r[1] || !r[2] || !r[3])) throw new Error('도감 표가 비어 있는 칸이 있어요');
await writeFile(path.join(ROOT, 'src', 'shared', 'pokedex.mjs'),
  `// 자동 생성: node scripts/build-pokedex.mjs (PokeAPI 데이터, BSD-3-Clause) — 손으로 고치지 말 것\n`
  + `// [도감 번호, 한글 이름, 영어 이름, 타입1, 타입2?]\n`
  + `export const POKEDEX = [\n${rows.map((r) => `  ${JSON.stringify(r)},`).join('\n')}\n];\n`);
console.log(`pokedex: ${rows.length}종`);
