import type { ResearchNode } from '../types';

const MAX_RESULTS = 20;

/** Інкрементальний пошук: підрядок без урахування регістру по name та id, максимум 20 результатів. */
export function searchResearch(nodes: ResearchNode[], query: string): ResearchNode[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  const results: ResearchNode[] = [];
  for (const node of nodes) {
    if (node.name.toLowerCase().includes(q) || node.id.toLowerCase().includes(q)) {
      results.push(node);
      if (results.length === MAX_RESULTS) break;
    }
  }
  return results;
}
