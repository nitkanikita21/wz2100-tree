// src/lib/testFixture.ts
import type { Branch, ResearchNode } from '../types';

export function makeNode(
  id: string,
  prereqs: string[] = [],
  points = 100,
  branch: Branch = 'weapon',
): ResearchNode {
  return {
    id,
    name: `Name of ${id}`,
    points,
    branch,
    icon: 'image_res_weapontech.png',
    subIcon: null,
    category: null,
    prereqs,
    resultComponents: [],
    resultStructures: [],
    x: 0,
    y: 0,
  };
}

// Граф фікстури (стрілка = "потрібен для"):
//   A ──> C ──> E        A(100) B(50) C(200)
//   A ──> D ──> E        D(150) E(300) F(80)
//   B ──> D
//   B ──> F
export const fixtureNodes: ResearchNode[] = [
  makeNode('A', [], 100),
  makeNode('B', [], 50),
  makeNode('C', ['A'], 200),
  makeNode('D', ['A', 'B'], 150, 'defence'),
  makeNode('E', ['C', 'D'], 300, 'system'),
  makeNode('F', ['B'], 80, 'power'),
];
