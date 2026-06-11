import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import { usePlansStore } from './plans';

// Реальні id з research-4.7.0.json:
// R-Sys-Engineering01 — без пререквізитів; R-Defense-HardcreteWall — prereq: R-Sys-Engineering01.
const ENG = 'R-Sys-Engineering01';
const WALL = 'R-Defense-HardcreteWall';

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

describe('usePlansStore', () => {
  it('addGoal створює план, якщо його нема, і будує чергу з пререквізитами', () => {
    const store = usePlansStore();
    expect(store.plans).toHaveLength(0);
    store.addGoal(WALL);
    expect(store.plans).toHaveLength(1);
    expect(store.activePlan?.goals).toEqual([WALL]);
    expect(store.activePlan?.queue).toEqual([ENG, WALL]);
    expect(store.plannedSet.has(ENG)).toBe(true);
  });

  it('повторний addGoal тієї самої цілі не дублює її', () => {
    const store = usePlansStore();
    store.addGoal(WALL);
    store.addGoal(WALL);
    expect(store.activePlan?.goals).toEqual([WALL]);
    expect(store.activePlan?.queue).toEqual([ENG, WALL]);
  });

  it('createPlan стає активним, setActive перемикає, deletePlan скидає активний', () => {
    const store = usePlansStore();
    store.createPlan('Перший');
    const firstId = store.activePlanId!;
    store.createPlan('Другий');
    expect(store.activePlan?.name).toBe('Другий');
    store.setActive(firstId);
    expect(store.activePlan?.name).toBe('Перший');
    store.deletePlan(firstId);
    expect(store.plans).toHaveLength(1);
    expect(store.activePlan?.name).toBe('Другий');
  });

  it('removeGoal прибирає ціль і непотрібні пререквізити з черги', () => {
    const store = usePlansStore();
    store.addGoal(WALL);
    store.removeGoal(WALL);
    expect(store.activePlan?.goals).toEqual([]);
    expect(store.activePlan?.queue).toEqual([]);
  });

  it('moveQueueItem відхиляє конфліктне переміщення і не змінює чергу', () => {
    const store = usePlansStore();
    store.addGoal(WALL);
    // Спроба поставити пререквізит (ENG, idx 0) після залежного (WALL, idx 1).
    const res = store.moveQueueItem(0, 1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect([ENG, WALL]).toContain(res.conflictId);
    expect(store.activePlan?.queue).toEqual([ENG, WALL]);
  });

  it('exportActive → importPlan: round-trip створює еквівалентний план', () => {
    const store = usePlansStore();
    store.addGoal(WALL);
    store.renamePlan(store.activePlanId!, 'Мій план');
    const json = store.exportActive();
    const res = store.importPlan(json);
    expect(res).toEqual({ ok: true });
    expect(store.plans).toHaveLength(2);
    expect(store.activePlan?.name).toBe('Мій план');
    expect(store.activePlan?.goals).toEqual([WALL]);
    expect(store.activePlan?.queue).toEqual([ENG, WALL]);
    expect(store.plans[0].id).not.toBe(store.plans[1].id);
  });

  it('importPlan з невідомим id повертає помилку, що містить цей id', () => {
    const store = usePlansStore();
    const res = store.importPlan(
      JSON.stringify({ id: 'x', name: 'Поганий', goals: ['R-Fake-Tech'], queue: [] }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('R-Fake-Tech');
    expect(store.plans).toHaveLength(0);
  });

  it('персистенс: новий pinia відновлює плани з localStorage', async () => {
    const store = usePlansStore();
    store.addGoal(WALL);
    const savedActiveId = store.activePlanId;
    await nextTick(); // watch має flush 'pre' — чекаємо мікротаск
    setActivePinia(createPinia());
    const fresh = usePlansStore();
    expect(fresh.plans).toHaveLength(1);
    expect(fresh.activePlanId).toBe(savedActiveId);
    expect(fresh.activePlan?.queue).toEqual([ENG, WALL]);
  });

  it('corrupt у localStorage → storageCorrupt, resetStorage повертає чистий стан', async () => {
    localStorage.setItem('wz2100-tree:v1:plans', '{broken json');
    const store = usePlansStore();
    expect(store.storageCorrupt).toBe(true);
    expect(store.plans).toEqual([]);
    store.resetStorage();
    expect(store.storageCorrupt).toBe(false);
    await nextTick();
    setActivePinia(createPinia());
    const fresh = usePlansStore();
    expect(fresh.storageCorrupt).toBe(false);
    expect(fresh.plans).toEqual([]);
  });
});
