// src/lib/nodeState.test.ts
import { describe, expect, it } from 'vitest';
import { buildIndex } from './graph';
import { computeStatuses } from './nodeState';
import { fixtureNodes } from './testFixture';

const index = buildIndex(fixtureNodes);

describe('computeStatuses', () => {
  it('empty researched: only nodes without prereqs are available', () => {
    const statuses = computeStatuses(index, new Set());
    expect(statuses.get('A')).toBe('available');
    expect(statuses.get('B')).toBe('available');
    expect(statuses.get('C')).toBe('locked');
    expect(statuses.get('D')).toBe('locked');
    expect(statuses.get('E')).toBe('locked');
    expect(statuses.get('F')).toBe('locked');
  });

  it('partially researched chain', () => {
    const statuses = computeStatuses(index, new Set(['B']));
    expect(statuses.get('B')).toBe('researched');
    expect(statuses.get('F')).toBe('available'); // its only prereq B is done
    expect(statuses.get('D')).toBe('locked'); // still needs A
    expect(statuses.get('A')).toBe('available');
    expect(statuses.get('E')).toBe('locked');
  });

  it('all prereqs researched -> available', () => {
    const statuses = computeStatuses(index, new Set(['A', 'B', 'C', 'D']));
    expect(statuses.get('E')).toBe('available');
    expect(statuses.get('F')).toBe('available');
    expect(statuses.get('C')).toBe('researched');
  });

  it('covers every node in the index', () => {
    const statuses = computeStatuses(index, new Set());
    expect(statuses.size).toBe(fixtureNodes.length);
  });
});
