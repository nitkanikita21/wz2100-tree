import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { Branch } from '../types';
import { prereqClosure } from '../lib/graph';
import { useDataStore } from './data';

const ALL_BRANCHES: Branch[] = [
  'weapon', 'defence', 'droid', 'cyborg',
  'system', 'structure', 'power', 'computer',
];

export const useUiStore = defineStore('ui', () => {
  const data = useDataStore();

  const enabledBranches = ref<Set<Branch>>(new Set(ALL_BRANCHES));
  function toggleBranch(b: Branch): void {
    const next = new Set(enabledBranches.value);
    if (next.has(b)) next.delete(b);
    else next.add(b);
    enabledBranches.value = next; // заміна цілим Set — надійна реактивність
  }

  const selectedId = ref<string | null>(null);
  function select(id: string | null): void {
    selectedId.value = id;
  }

  const hoveredId = ref<string | null>(null);
  function setHovered(id: string | null): void {
    hoveredId.value = id;
  }

  const flyToRequest = ref<string | null>(null);
  function flyTo(id: string): void {
    flyToRequest.value = id;
  }
  function clearFlyTo(): void {
    flyToRequest.value = null;
  }

  const highlightSet = computed<Set<string>>(() => {
    const focus = hoveredId.value ?? selectedId.value;
    if (!focus) return new Set<string>();
    return prereqClosure(data.index, [focus]);
  });

  return {
    enabledBranches, toggleBranch,
    selectedId, select,
    hoveredId, setHovered,
    flyToRequest, flyTo, clearFlyTo,
    highlightSet,
  };
});
