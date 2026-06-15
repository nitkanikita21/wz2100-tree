import { describe, expect, it } from 'vitest';
import type { ResearchNode } from '../types';
import { searchResearch } from './search';

function makeNode(id: string, name: string): ResearchNode {
  return {
    id,
    name,
    points: 100,
    cost: 3,
    branch: 'weapon',
    icon: 'image_res_weapontech.png',
    subIcon: null,
    category: null,
    prereqs: [],
    resultComponents: [],
    resultStructures: [],
    results: [],
    requiredStructures: [],
    redComponents: [],
    redStructures: [],
    models: [],
    modelGroups: [],
    x: 0,
    y: 0,
  };
}

const nodes: ResearchNode[] = [
  makeNode('R-Wpn-Rocket01-LtAT', 'Lancer'),
  makeNode('R-Wpn-Cannon1Mk1', 'Light Cannon'),
  makeNode('R-Sys-Engineering01', 'Engineering'),
  makeNode('R-Defense-HardcreteWall', 'Hardcrete'),
];

describe('searchResearch', () => {
  it('знаходить за підрядком назви без урахування регістру', () => {
    const res = searchResearch(nodes, 'lAnCeR');
    expect(res.map((n) => n.id)).toEqual(['R-Wpn-Rocket01-LtAT']);
  });

  it('знаходить за підрядком id без урахування регістру', () => {
    const res = searchResearch(nodes, 'wpn-cannon');
    expect(res.map((n) => n.id)).toEqual(['R-Wpn-Cannon1Mk1']);
  });

  it('повертає кілька збігів у порядку вхідного масиву', () => {
    const res = searchResearch(nodes, 'r-');
    expect(res.map((n) => n.id)).toEqual([
      'R-Wpn-Rocket01-LtAT',
      'R-Wpn-Cannon1Mk1',
      'R-Sys-Engineering01',
      'R-Defense-HardcreteWall',
    ]);
  });

  it('повертає [] для порожнього запиту або самих пробілів', () => {
    expect(searchResearch(nodes, '')).toEqual([]);
    expect(searchResearch(nodes, '   ')).toEqual([]);
  });

  it('повертає [] коли збігів немає', () => {
    expect(searchResearch(nodes, 'zzz-not-there')).toEqual([]);
  });

  it('обмежує результат 20 записами', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      makeNode(`R-Test-${i}`, `Test ${i}`),
    );
    expect(searchResearch(many, 'test')).toHaveLength(20);
  });
});
