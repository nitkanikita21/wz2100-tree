// src/lib/nodeState.ts
import type { NodeStatus } from '../types';
import type { GraphIndex } from './graph';

// researched -> 'researched'; otherwise all prereqs researched -> 'available';
// otherwise 'locked'.
export function computeStatuses(
  index: GraphIndex,
  researched: Set<string>,
): Map<string, NodeStatus> {
  const statuses = new Map<string, NodeStatus>();
  for (const node of index.byId.values()) {
    if (researched.has(node.id)) statuses.set(node.id, 'researched');
    else if (node.prereqs.every((p) => researched.has(p))) statuses.set(node.id, 'available');
    else statuses.set(node.id, 'locked');
  }
  return statuses;
}
