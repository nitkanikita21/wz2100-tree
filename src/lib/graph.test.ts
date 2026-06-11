// src/lib/graph.test.ts
import { describe, expect, it } from 'vitest';
import { buildIndex, prereqClosure, topoSort } from './graph';
import { fixtureNodes, makeNode } from './testFixture';

describe('buildIndex', () => {
  it('indexes nodes by id', () => {
    const index = buildIndex(fixtureNodes);
    expect(index.byId.size).toBe(6);
    expect(index.byId.get('C')?.prereqs).toEqual(['A']);
  });

  it('builds reverse edges (unlocks) for every node', () => {
    const index = buildIndex(fixtureNodes);
    expect(index.unlocks.get('A')).toEqual(['C', 'D']);
    expect(index.unlocks.get('B')).toEqual(['D', 'F']);
    expect(index.unlocks.get('C')).toEqual(['E']);
    expect(index.unlocks.get('D')).toEqual(['E']);
    expect(index.unlocks.get('E')).toEqual([]);
    expect(index.unlocks.get('F')).toEqual([]);
  });
});

describe('prereqClosure', () => {
  it('includes the target itself plus all transitive prereqs', () => {
    const index = buildIndex(fixtureNodes);
    expect(prereqClosure(index, ['E'])).toEqual(new Set(['A', 'B', 'C', 'D', 'E']));
  });

  it('merges closures of multiple targets without duplicates', () => {
    const index = buildIndex(fixtureNodes);
    expect(prereqClosure(index, ['C', 'F'])).toEqual(new Set(['A', 'B', 'C', 'F']));
  });

  it('node without prereqs closes onto itself only', () => {
    const index = buildIndex(fixtureNodes);
    expect(prereqClosure(index, ['B'])).toEqual(new Set(['B']));
  });
});

describe('topoSort', () => {
  it('places every node after all of its prereqs', () => {
    const index = buildIndex(fixtureNodes);
    const order = topoSort(index, new Set(['A', 'B', 'C', 'D', 'E', 'F']));
    const pos = new Map(order.map((id, i) => [id, i]));
    for (const node of fixtureNodes) {
      for (const p of node.prereqs) {
        expect(pos.get(p)!).toBeLessThan(pos.get(node.id)!);
      }
    }
  });

  it('is deterministic: among ready nodes picks the one with fewer points', () => {
    const index = buildIndex(fixtureNodes);
    const order = topoSort(index, new Set(['A', 'B', 'C', 'D', 'E', 'F']));
    expect(order).toEqual(['B', 'F', 'A', 'D', 'C', 'E']);
  });

  it('breaks point ties by lexicographically smaller id', () => {
    const index = buildIndex([makeNode('Z'), makeNode('Y'), makeNode('X')]);
    expect(topoSort(index, new Set(['Z', 'Y', 'X']))).toEqual(['X', 'Y', 'Z']);
  });

  it('sorts only the given subset, ignoring prereqs outside it', () => {
    const index = buildIndex(fixtureNodes);
    expect(topoSort(index, prereqClosure(index, ['E']))).toEqual(['B', 'A', 'D', 'C', 'E']);
  });
});
