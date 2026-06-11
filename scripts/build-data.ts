import { mkdir, writeFile } from 'node:fs/promises';
import ELK from 'elkjs/lib/elk.bundled.js';
import { normalize, validateGraph, type RawResearch } from './lib/normalize';
import type { ResearchData, ResearchNode } from '../src/types';

const VERSION = '4.7.0';
const URL = `https://raw.githubusercontent.com/Warzone2100/warzone2100/${VERSION}/data/mp/stats/research.json`;
const OUT_FILE = `src/data/research-${VERSION}.json`;
const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;

async function main(): Promise<void> {
  console.log(`Завантаження ${URL} ...`);
  const res = await fetch(URL);
  if (!res.ok) {
    throw new Error(`Не вдалося завантажити research.json: HTTP ${res.status} ${res.statusText}`);
  }
  const raw = (await res.json()) as Record<string, RawResearch>;

  const bare = normalize(raw);
  validateGraph(bare);

  const edges = bare.flatMap((n) =>
    n.prereqs.map((p) => ({ id: `${p}->${n.id}`, sources: [p], targets: [n.id] })),
  );
  console.log(`Вузлів: ${bare.length}, ребер: ${edges.length}`);

  const elk = new ELK();
  const t0 = performance.now();
  const layout = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.spacing.nodeNode': '24',
    },
    children: bare.map((n) => ({ id: n.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges,
  });
  console.log(`ELK layout: ${Math.round(performance.now() - t0)} мс`);

  const pos = new Map(layout.children!.map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]));
  const nodes: ResearchNode[] = bare.map((n) => ({ ...n, ...pos.get(n.id)! }));

  const data: ResearchData = { version: VERSION, nodeCount: nodes.length, nodes };
  await mkdir('src/data', { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(data));
  console.log(`Записано ${OUT_FILE} (${nodes.length} вузлів)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
