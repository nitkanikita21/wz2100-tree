import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const VERSION = '4.7.0';
const BASE = `https://raw.githubusercontent.com/Warzone2100/warzone2100/${VERSION}/data/base/images/intfac`;
const OUT_DIR = 'public/icons';

const ICONS = [
  'image_res_weapontech.png',
  'image_res_defence.png',
  'image_res_droidtech.png',
  'image_res_cyborgtech.png',
  'image_res_systemtech.png',
  'image_res_structuretech.png',
  'image_res_powertech.png',
  'image_res_computertech.png',
  'image_res_grpacc.png',
  'image_res_grpdam.png',
  'image_res_grprep.png',
  'image_res_grprof.png',
  'image_res_grpupg.png',
];

const LICENSE =
  'Icons from Warzone 2100 (GPL-2.0+), https://github.com/Warzone2100/warzone2100\n';

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  for (const name of ICONS) {
    const res = await fetch(`${BASE}/${name}`);
    if (!res.ok) {
      throw new Error(`Не вдалося завантажити ${name}: HTTP ${res.status} ${res.statusText}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(OUT_DIR, name), buf);
    console.log(`OK ${name} (${buf.length} байт)`);
  }
  await writeFile(path.join(OUT_DIR, 'LICENSE.txt'), LICENSE);
  console.log(`Готово: ${ICONS.length} іконок + LICENSE.txt у ${OUT_DIR}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
