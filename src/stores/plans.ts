import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import type { Plan } from '../types';
import { buildQueue, removeGoalFromPlan, canMove, moveItem } from '../lib/planner';
import { load, save, clear } from '../lib/storage';
import { globalT } from '../i18n';
import { useDataStore } from './data';
import { useSessionStore } from './session';

interface PlansPersist {
  plans: Plan[];
  activePlanId: string | null;
}

export const usePlansStore = defineStore('plans', () => {
  const dataStore = useDataStore();

  const plans = ref<Plan[]>([]);
  const activePlanId = ref<string | null>(null);
  const storageCorrupt = ref(false);

  // Відновлення з localStorage у момент створення стора.
  const restored = load<PlansPersist>('plans');
  if (restored.ok) {
    plans.value = restored.value.plans;
    activePlanId.value = restored.value.activePlanId;
  } else if (restored.reason === 'corrupt') {
    storageCorrupt.value = true;
  }

  // Будь-яка зміна (включно з мутаціями всередині планів) → save.
  watch(
    [plans, activePlanId],
    () => {
      save('plans', { plans: plans.value, activePlanId: activePlanId.value });
    },
    { deep: true },
  );

  const activePlan = computed<Plan | null>(
    () => plans.value.find((p) => p.id === activePlanId.value) ?? null,
  );

  const plannedSet = computed<Set<string>>(
    () => new Set(activePlan.value?.queue ?? []),
  );

  // Прогрес береться з session store; виклик лінивий (усередині функції),
  // тому циклічний імпорт plans ↔ session безпечний.
  function researchedSet(): Set<string> {
    return useSessionStore().researched;
  }

  function createPlan(name: string): void {
    const plan: Plan = { id: crypto.randomUUID(), name, goals: [], queue: [] };
    plans.value.push(plan);
    activePlanId.value = plan.id;
  }

  function renamePlan(id: string, name: string): void {
    const plan = plans.value.find((p) => p.id === id);
    if (plan) plan.name = name;
  }

  function deletePlan(id: string): void {
    plans.value = plans.value.filter((p) => p.id !== id);
    if (activePlanId.value === id) {
      activePlanId.value = plans.value.length > 0 ? plans.value[0].id : null;
    }
  }

  function setActive(id: string): void {
    if (plans.value.some((p) => p.id === id)) activePlanId.value = id;
  }

  function addGoal(researchId: string): void {
    if (!dataStore.index.byId.has(researchId)) return;
    if (activePlan.value === null) createPlan(globalT('plan.newName'));
    const plan = activePlan.value!;
    if (!plan.goals.includes(researchId)) plan.goals.push(researchId);
    plan.queue = buildQueue(dataStore.index, plan.goals, researchedSet());
  }

  function removeGoal(researchId: string): void {
    const plan = activePlan.value;
    if (plan === null) return;
    const updated = removeGoalFromPlan(dataStore.index, plan, researchId, researchedSet());
    const idx = plans.value.findIndex((p) => p.id === plan.id);
    plans.value[idx] = updated;
  }

  function moveQueueItem(
    fromIdx: number,
    toIdx: number,
  ): { ok: true } | { ok: false; conflictId: string } {
    const plan = activePlan.value;
    if (plan === null) return { ok: true };
    const check = canMove(dataStore.index, plan.queue, fromIdx, toIdx);
    if (!check.ok) return check;
    plan.queue = moveItem(plan.queue, fromIdx, toIdx);
    return { ok: true };
  }

  function exportActive(): string {
    return JSON.stringify(activePlan.value, null, 2);
  }

  function importPlan(json: string): { ok: true } | { ok: false; error: string } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ok: false, error: globalT('plan.errBadJson') };
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return { ok: false, error: globalT('plan.errBadFormat') };
    }
    const candidate = parsed as { name?: unknown; goals?: unknown };
    if (typeof candidate.name !== 'string' || !Array.isArray(candidate.goals)) {
      return { ok: false, error: globalT('plan.errBadFields') };
    }
    const goals: string[] = [];
    for (const goal of candidate.goals) {
      if (typeof goal !== 'string' || !dataStore.index.byId.has(goal)) {
        return { ok: false, error: globalT('plan.errUnknownResearch', { id: String(goal) }) };
      }
      goals.push(goal);
    }
    const plan: Plan = {
      id: crypto.randomUUID(),
      name: candidate.name,
      goals,
      queue: buildQueue(dataStore.index, goals, researchedSet()),
    };
    plans.value.push(plan);
    activePlanId.value = plan.id;
    return { ok: true };
  }

  function rebuildQueues(): void {
    const researched = researchedSet();
    for (const plan of plans.value) {
      plan.queue = buildQueue(dataStore.index, plan.goals, researched);
    }
  }

  function resetStorage(): void {
    clear('plans');
    plans.value = [];
    activePlanId.value = null;
    storageCorrupt.value = false;
  }

  return {
    plans,
    activePlanId,
    activePlan,
    plannedSet,
    storageCorrupt,
    createPlan,
    renamePlan,
    deletePlan,
    setActive,
    addGoal,
    removeGoal,
    moveQueueItem,
    exportActive,
    importPlan,
    rebuildQueues,
    resetStorage,
  };
});
