import { computed } from 'vue';
import { defineStore } from 'pinia';
import type { Node, Edge } from '@vue-flow/core';
import type { ResearchData, ResearchNode } from '../types';
import { buildIndex } from '../lib/graph';
import rawData from '../data/research-4.7.0.json';

const data = rawData as unknown as ResearchData;

export const useDataStore = defineStore('data', () => {
  // Статичні дані: нереактивні навмисно — граф не змінюється після завантаження.
  const nodes: ResearchNode[] = data.nodes;
  const index = buildIndex(nodes);
  const maxLabResearchPoints = data.maxLabResearchPoints;
  const componentNames = new Map<string, string>(Object.entries(data.componentNames ?? {}));

  const flowNodes = computed<Node[]>(() =>
    nodes.map((n) => ({
      id: n.id,
      position: { x: n.x, y: n.y },
      type: 'research',
      data: { node: n },
    })),
  );

  const flowEdges = computed<Edge[]>(() =>
    nodes.flatMap((n) =>
      n.prereqs.map((p) => ({
        id: `${p}->${n.id}`,
        source: p,
        target: n.id,
      })),
    ),
  );

  return { nodes, index, flowNodes, flowEdges, maxLabResearchPoints, componentNames };
});
