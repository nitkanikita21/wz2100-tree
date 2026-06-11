// src/lib/planner.ts
import type { Plan } from '../types';
import { prereqClosure, topoSort, type GraphIndex } from './graph';

// Queue = topoSort(prereqClosure(goals)) minus researched.
export function buildQueue(
  index: GraphIndex,
  goals: string[],
  researched: Set<string>,
): string[] {
  if (goals.length === 0) return [];
  const closure = prereqClosure(index, goals);
  return topoSort(index, closure).filter((id) => !researched.has(id));
}

// Removes the goal; prereqs not needed by remaining goals disappear
// automatically because the queue is rebuilt via buildQueue.
export function removeGoalFromPlan(
  index: GraphIndex,
  plan: Plan,
  goalId: string,
  researched: Set<string>,
): Plan {
  const goals = plan.goals.filter((g) => g !== goalId);
  return { ...plan, goals, queue: buildQueue(index, goals, researched) };
}

// Pure reorder: removes the item at fromIdx and inserts it at toIdx
// (index in the resulting array). Does not mutate the input.
export function moveItem(queue: string[], fromIdx: number, toIdx: number): string[] {
  const copy = [...queue];
  const [item] = copy.splice(fromIdx, 1);
  copy.splice(toIdx, 0, item);
  return copy;
}

// Checks the reordered queue: every node must come after all of its prereqs
// that are also in the queue. conflictId = the prereq that would end up
// after its dependant.
export function canMove(
  index: GraphIndex,
  queue: string[],
  fromIdx: number,
  toIdx: number,
): { ok: true } | { ok: false; conflictId: string } {
  const moved = moveItem(queue, fromIdx, toIdx);
  const inQueue = new Set(moved);
  const seen = new Set<string>();
  for (const id of moved) {
    const node = index.byId.get(id);
    if (!node) throw new Error(`Unknown research id in queue: ${id}`);
    for (const p of node.prereqs) {
      if (inQueue.has(p) && !seen.has(p)) return { ok: false, conflictId: p };
    }
    seen.add(id);
  }
  return { ok: true };
}
