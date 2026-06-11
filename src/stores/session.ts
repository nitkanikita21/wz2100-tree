import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import type { NodeStatus } from '../types';
import { computeStatuses } from '../lib/nodeState';
import { load, save, clear } from '../lib/storage';
import { useDataStore } from './data';
import { usePlansStore } from './plans';

interface SessionPersist {
  researched: string[];
  gameMode: boolean;
}

export const useSessionStore = defineStore('session', () => {
  const dataStore = useDataStore();

  const researched = ref(new Set<string>());
  const gameMode = ref(false);
  const storageCorrupt = ref(false);

  // Відновлення з localStorage у момент створення стора.
  const restored = load<SessionPersist>('session');
  if (restored.ok) {
    researched.value = new Set(restored.value.researched);
    gameMode.value = restored.value.gameMode;
  } else if (restored.reason === 'corrupt') {
    storageCorrupt.value = true;
  }

  watch(
    [researched, gameMode],
    () => {
      save('session', {
        researched: [...researched.value],
        gameMode: gameMode.value,
      });
    },
    { deep: true },
  );

  const statuses = computed<Map<string, NodeStatus>>(() =>
    computeStatuses(dataStore.index, researched.value),
  );

  function mark(id: string): void {
    researched.value.add(id);
    usePlansStore().rebuildQueues();
  }

  function unmark(id: string): void {
    researched.value.delete(id);
    usePlansStore().rebuildQueues();
  }

  function toggle(id: string): void {
    if (researched.value.has(id)) {
      unmark(id);
    } else {
      mark(id);
    }
  }

  function toggleGameMode(): void {
    gameMode.value = !gameMode.value;
  }

  // confirm перед очищенням робить UI, не стор.
  function newGame(): void {
    researched.value = new Set();
    usePlansStore().rebuildQueues();
  }

  function resetStorage(): void {
    clear('session');
    researched.value = new Set();
    gameMode.value = false;
    storageCorrupt.value = false;
  }

  return {
    researched,
    gameMode,
    statuses,
    storageCorrupt,
    mark,
    unmark,
    toggle,
    toggleGameMode,
    newGame,
    resetStorage,
  };
});
