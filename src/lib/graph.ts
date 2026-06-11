// src/lib/graph.ts
import type { ResearchNode } from '../types';

export interface GraphIndex {
  byId: Map<string, ResearchNode>;
  unlocks: Map<string, string[]>; // reverse edges: id -> nodes that list it in prereqs
}

export function buildIndex(nodes: ResearchNode[]): GraphIndex {
  const byId = new Map<string, ResearchNode>();
  const unlocks = new Map<string, string[]>();
  for (const node of nodes) {
    byId.set(node.id, node);
    if (!unlocks.has(node.id)) unlocks.set(node.id, []);
  }
  for (const node of nodes) {
    for (const p of node.prereqs) {
      const list = unlocks.get(p);
      if (list) list.push(node.id);
      else unlocks.set(p, [node.id]);
    }
  }
  return { byId, unlocks };
}

// Closure of prerequisites: targets INCLUDED + all transitive prereqs.
export function prereqClosure(index: GraphIndex, targetIds: string[]): Set<string> {
  const closure = new Set<string>();
  const stack = [...targetIds];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (closure.has(id)) continue;
    const node = index.byId.get(id);
    if (!node) throw new Error(`Unknown research id: ${id}`);
    closure.add(id);
    for (const p of node.prereqs) stack.push(p);
  }
  return closure;
}

// Deterministic Kahn toposort of a subset: among ready nodes picks the one
// with fewer points; on a tie — the lexicographically smaller id.
// Prereqs outside the subset are ignored.
export function topoSort(index: GraphIndex, ids: Set<string>): string[] {
  const inDegree = new Map<string, number>();
  for (const id of ids) {
    const node = index.byId.get(id);
    if (!node) throw new Error(`Unknown research id: ${id}`);
    inDegree.set(id, node.prereqs.filter((p) => ids.has(p)).length);
  }
  const result: string[] = [];
  while (result.length < ids.size) {
    let best: string | null = null;
    for (const [id, deg] of inDegree) {
      if (deg !== 0) continue;
      if (best === null) {
        best = id;
        continue;
      }
      const a = index.byId.get(id)!;
      const b = index.byId.get(best)!;
      if (a.points < b.points || (a.points === b.points && a.id < b.id)) best = id;
    }
    if (best === null) throw new Error('Cycle detected in research graph');
    inDegree.delete(best);
    result.push(best);
    for (const next of index.unlocks.get(best) ?? []) {
      if (inDegree.has(next)) inDegree.set(next, inDegree.get(next)! - 1);
    }
  }
  return result;
}
