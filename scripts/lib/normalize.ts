import type { Branch, ResearchNode } from '../../src/types';

/** Сирий запис із data/mp/stats/research.json (Warzone 2100). */
export interface RawResearch {
  id: string;
  name: string;
  iconID?: string;
  researchPoints: number;
  requiredResearch?: string[];
  resultComponents?: string[];
  resultStructures?: string[];
  subgroupIconID?: string;
  category?: string;
  [key: string]: unknown;
}

const ICON_TO_BRANCH: Record<string, Branch> = {
  IMAGE_RES_WEAPONTECH: 'weapon',
  IMAGE_RES_DEFENCE: 'defence',
  IMAGE_RES_DROIDTECH: 'droid',
  IMAGE_RES_CYBORGTECH: 'cyborg',
  IMAGE_RES_SYSTEMTECH: 'system',
  IMAGE_RES_STRUCTURETECH: 'structure',
  IMAGE_RES_POWERTECH: 'power',
  IMAGE_RES_COMPUTERTECH: 'computer',
};

const KNOWN_BRANCHES = new Set<string>(Object.values(ICON_TO_BRANCH));

export function normalize(raw: Record<string, RawResearch>): Omit<ResearchNode, 'x' | 'y'>[] {
  return Object.values(raw).map((r) => ({
    id: r.id,
    name: r.name,
    points: r.researchPoints,
    // Невідомий iconID дає undefined у branch — це ловить validateGraph.
    branch: ICON_TO_BRANCH[r.iconID ?? ''],
    icon: (r.iconID ?? '').toLowerCase() + '.png',
    subIcon: r.subgroupIconID ? r.subgroupIconID.toLowerCase() + '.png' : null,
    category: r.category ?? null,
    prereqs: r.requiredResearch ?? [],
    resultComponents: r.resultComponents ?? [],
    resultStructures: r.resultStructures ?? [],
  }));
}

export function validateGraph(nodes: Omit<ResearchNode, 'x' | 'y'>[]): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  for (const n of nodes) {
    if (!KNOWN_BRANCHES.has(n.branch as string)) {
      const iconId = n.icon.replace(/\.png$/, '').toUpperCase();
      throw new Error(`Unknown iconID "${iconId}" in research "${n.id}"`);
    }
    for (const p of n.prereqs) {
      if (!byId.has(p)) {
        throw new Error(`Research "${n.id}" requires missing prerequisite "${p}"`);
      }
    }
  }

  // Пошук циклів: DFS по prereqs, сірий вузол у стеку = цикл (шлях у повідомленні).
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];

  function visit(id: string): void {
    color.set(id, GRAY);
    stack.push(id);
    for (const p of byId.get(id)!.prereqs) {
      const c = color.get(p) ?? WHITE;
      if (c === GRAY) {
        const cycle = [...stack.slice(stack.indexOf(p)), p].join(' -> ');
        throw new Error(`Cycle detected in research graph: ${cycle}`);
      }
      if (c === WHITE) visit(p);
    }
    stack.pop();
    color.set(id, BLACK);
  }

  for (const n of nodes) {
    if ((color.get(n.id) ?? WHITE) === WHITE) visit(n.id);
  }
}
