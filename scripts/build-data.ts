import { mkdir, writeFile } from 'node:fs/promises';
import ELK from 'elkjs/lib/elk.bundled.js';
import { normalize, validateGraph, type RawResearch } from './lib/normalize';
import type { ModelGroup, ModelPart, ResearchData, ResearchNode } from '../src/types';

const VERSION = '4.7.0';
const BASE_URL = `https://raw.githubusercontent.com/Warzone2100/warzone2100/${VERSION}/data/mp/stats`;
const URL = `${BASE_URL}/research.json`;
const OUT_FILE = `src/data/research-${VERSION}.json`;
const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;
const MODEL_STAT_FILES = [
  'body.json',
  'brain.json',
  'construction.json',
  'ecm.json',
  'propulsion.json',
  'repair.json',
  'sensor.json',
  'structure.json',
  'weapons.json',
];

type RawStat = {
  id?: string;
  model?: string;
  mountModel?: string;
  sensorModel?: string;
  baseModel?: string;
  structureModel?: string[];
  width?: number;
  breadth?: number;
  ecmID?: string;
  sensorID?: string;
  turret?: string;
  weapons?: string[];
  [key: string]: unknown;
};

type IndexedModelGroup = ModelGroup & {
  scaleMode: 'component' | 'structure';
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Не вдалося завантажити ${url}: HTTP ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

function part(model: string | undefined, attachToPrevious: boolean): ModelPart[] {
  return typeof model === 'string' && model.length > 0 ? [{ model, attachToPrevious }] : [];
}

function mountedParts(stat: RawStat, attachMountToPrevious = false): ModelPart[] {
  const graphicModel = stat.model ?? stat.sensorModel;
  return [
    ...part(stat.mountModel, attachMountToPrevious),
    ...part(graphicModel, Boolean(stat.mountModel) || attachMountToPrevious),
  ];
}

function componentParts(stat: RawStat): ModelPart[] {
  if (stat.mountModel) return mountedParts(stat);
  return [
    ...part(stat.model, false),
    ...part(stat.sensorModel, false),
    ...part(stat.baseModel, false),
    ...part(stat.structureModel?.[0], false),
  ];
}

function componentScaleMultiplier(id: string): number | undefined {
  if (id === 'SuperTransportBody') return 0.4;
  if (id === 'TransporterBody') return 0.6;
  return undefined;
}

function indexedGroup(file: string, id: string, stat: RawStat, parts: ModelPart[]): IndexedModelGroup {
  if (file === 'structure.json') {
    return {
      id,
      parts,
      models: parts.map((item) => item.model),
      scaleMode: 'structure',
      structureBasePlate: Math.max(Number(stat.width) || 1, Number(stat.breadth) || 1),
    };
  }

  return {
    id,
    parts,
    models: parts.map((item) => item.model),
    scaleMode: 'component',
    componentScaleMultiplier: componentScaleMultiplier(id),
  };
}

async function buildModelIndex(): Promise<Map<string, IndexedModelGroup>> {
  const index = new Map<string, IndexedModelGroup>();
  const files = await Promise.all(
    MODEL_STAT_FILES.map(async (file) => [file, await fetchJson<Record<string, RawStat>>(`${BASE_URL}/${file}`)] as const),
  );
  const statsByFile = new Map(files);
  const ecms = statsByFile.get('ecm.json') ?? {};
  const weapons = statsByFile.get('weapons.json') ?? {};
  const sensors = statsByFile.get('sensor.json') ?? {};

  for (const [file, stats] of files) {
    for (const [id, stat] of Object.entries(stats)) {
      const parts = file === 'weapons.json' ? mountedParts(stat) : componentParts(stat);

      if (file === 'structure.json') {
        for (const weaponId of stat.weapons ?? []) {
          const weapon = weapons[weaponId];
          if (weapon) parts.push(...mountedParts(weapon, true));
        }
        const sensor = stat.sensorID ? sensors[stat.sensorID] : undefined;
        if (sensor) parts.push(...mountedParts(sensor, true));
        const ecm = stat.ecmID ? ecms[stat.ecmID] : undefined;
        if (ecm) parts.push(...mountedParts(ecm, true));
      }
      if (file === 'brain.json' && stat.turret) {
        const weapon = weapons[stat.turret];
        if (weapon) parts.push(...mountedParts(weapon));
      }

      if (parts.length) {
        const statId = stat.id ?? id;
        index.set(statId, indexedGroup(file, statId, stat, parts));
      }
    }
  }

  return index;
}

function uniqueIds(ids: (string | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

function hideVtolVariantsWhenGroundExists(ids: string[]): string[] {
  const hasGroundVariant = ids.some((id) => !/vtol/i.test(id));
  return hasGroundVariant ? ids.filter((id) => !/vtol/i.test(id)) : ids;
}

function groupSignature(group: ModelGroup): string {
  return [
    group.scaleMode ?? 'none',
    group.structureBasePlate ?? 0,
    group.componentScaleMultiplier ?? 1,
    ...group.parts.map((part) => `${part.model.toLowerCase()}:${part.attachToPrevious ? 1 : 0}`),
  ].join('|');
}

function uniqueGroups(groups: ModelGroup[]): ModelGroup[] {
  const seen = new Set<string>();
  return groups.filter((group) => {
    const signature = groupSignature(group);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function attachModels(
  nodes: Omit<ResearchNode, 'x' | 'y'>[],
  raw: Record<string, RawResearch>,
  modelIndex: Map<string, IndexedModelGroup>,
): void {
  for (const node of nodes) {
    const research = raw[node.id];
    const directParts = part(research?.imdName as string | undefined, false);
    const primaryIds = uniqueIds([research?.statID as string | undefined]);
    const fallbackIds = uniqueIds([
      ...node.resultStructures,
      ...hideVtolVariantsWhenGroundExists(node.resultComponents),
    ]);
    const directGroups = directParts.length
      ? [{
        id: research?.imdName as string,
        parts: directParts,
        models: directParts.map((item) => item.model),
        scaleMode: 'research' as const,
      }]
      : [];
    const primaryGroups = [
      ...directGroups,
      ...primaryIds
      .map((id) => {
        return modelIndex.get(id) ?? { id, parts: [], models: [] };
      })
      .filter((group) => group.parts.length > 0),
    ];
    const fallbackGroups = fallbackIds
      .map((id) => {
        return modelIndex.get(id) ?? { id, parts: [], models: [] };
      })
      .filter((group) => group.parts.length > 0);

    node.modelGroups = uniqueGroups(primaryGroups.length ? primaryGroups : fallbackGroups);
    node.models = [...new Set(node.modelGroups.flatMap((group) => group.models))];
  }
}

async function main(): Promise<void> {
  console.log(`Завантаження ${URL} ...`);
  const raw = await fetchJson<Record<string, RawResearch>>(URL);
  const modelIndex = await buildModelIndex();

  const bare = normalize(raw);
  attachModels(bare, raw, modelIndex);
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
