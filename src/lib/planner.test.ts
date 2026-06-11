// src/lib/planner.test.ts
import { describe, expect, it } from 'vitest';
import type { Plan } from '../types';
import { buildIndex } from './graph';
import { buildQueue, canMove, moveItem, removeGoalFromPlan } from './planner';
import { fixtureNodes } from './testFixture';

const index = buildIndex(fixtureNodes);
const none = new Set<string>();

describe('buildQueue', () => {
  it('single goal: goal plus all transitive prereqs in topo order', () => {
    expect(buildQueue(index, ['E'], none)).toEqual(['B', 'A', 'D', 'C', 'E']);
  });

  it('two goals: shared prereqs appear exactly once', () => {
    // C and D share prereq A
    const queue = buildQueue(index, ['C', 'D'], none);
    expect(queue).toEqual(['B', 'A', 'D', 'C']);
    expect(queue.filter((id) => id === 'A')).toHaveLength(1);
  });

  it('researched nodes are excluded from the queue', () => {
    expect(buildQueue(index, ['E'], new Set(['A', 'B']))).toEqual(['D', 'C', 'E']);
  });
});

describe('removeGoalFromPlan', () => {
  const plan: Plan = {
    id: 'p1',
    name: 'Test plan',
    goals: ['E', 'F'],
    queue: ['B', 'F', 'A', 'D', 'C', 'E'], // = buildQueue(index, ['E','F'], none)
  };

  it('drops the goal and prereqs not needed by remaining goals', () => {
    const next = removeGoalFromPlan(index, plan, 'E', none);
    expect(next.goals).toEqual(['F']);
    expect(next.queue).toEqual(['B', 'F']); // A, C, D, E gone; B kept for F
  });

  it('keeps prereqs still needed by another goal', () => {
    const next = removeGoalFromPlan(index, plan, 'F', none);
    expect(next.goals).toEqual(['E']);
    expect(next.queue).toEqual(['B', 'A', 'D', 'C', 'E']); // B stays: E needs it via D
  });

  it('does not mutate the input plan', () => {
    removeGoalFromPlan(index, plan, 'E', none);
    expect(plan.goals).toEqual(['E', 'F']);
    expect(plan.queue).toEqual(['B', 'F', 'A', 'D', 'C', 'E']);
  });
});

describe('canMove', () => {
  const queue = ['B', 'A', 'D', 'C', 'E'];

  it('moving an item before its prereq is rejected with conflictId', () => {
    // C (idx 3) moved to idx 1 lands before its prereq A
    expect(canMove(index, queue, 3, 1)).toEqual({ ok: false, conflictId: 'A' });
  });

  it('a valid move is allowed', () => {
    // B (idx 0) -> idx 1: nothing between depends on B
    expect(canMove(index, queue, 0, 1)).toEqual({ ok: true });
  });
});

describe('moveItem', () => {
  it('returns a new array with the item moved to the target index', () => {
    expect(moveItem(['A', 'B', 'C'], 0, 2)).toEqual(['B', 'C', 'A']);
    expect(moveItem(['A', 'B', 'C'], 2, 0)).toEqual(['C', 'A', 'B']);
  });

  it('does not mutate the input array', () => {
    const queue = ['A', 'B', 'C'];
    moveItem(queue, 0, 2);
    expect(queue).toEqual(['A', 'B', 'C']);
  });
});
