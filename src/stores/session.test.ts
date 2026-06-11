import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import { useSessionStore } from './session';
import { usePlansStore } from './plans';

// Реальні id з research-4.7.0.json (як у plans.test.ts).
const ENG = 'R-Sys-Engineering01';
const WALL = 'R-Defense-HardcreteWall';

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

describe('useSessionStore', () => {
  it('mark робить вузол researched, а залежний стає available', () => {
    const session = useSessionStore();
    expect(session.statuses.get(ENG)).toBe('available'); // без пререквізитів
    expect(session.statuses.get(WALL)).toBe('locked');
    session.mark(ENG);
    expect(session.researched.has(ENG)).toBe(true);
    expect(session.statuses.get(ENG)).toBe('researched');
    expect(session.statuses.get(WALL)).toBe('available');
  });

  it('mark скорочує чергу активного плану', () => {
    const plans = usePlansStore();
    const session = useSessionStore();
    plans.addGoal(WALL);
    expect(plans.activePlan?.queue).toEqual([ENG, WALL]);
    session.mark(ENG);
    expect(plans.activePlan?.queue).toEqual([WALL]);
    session.unmark(ENG);
    expect(plans.activePlan?.queue).toEqual([ENG, WALL]);
  });

  it('toggle перемикає статус туди й назад', () => {
    const session = useSessionStore();
    session.toggle(ENG);
    expect(session.researched.has(ENG)).toBe(true);
    session.toggle(ENG);
    expect(session.researched.has(ENG)).toBe(false);
    expect(session.statuses.get(ENG)).toBe('available');
  });

  it('toggleGameMode перемикає режим гри', () => {
    const session = useSessionStore();
    expect(session.gameMode).toBe(false);
    session.toggleGameMode();
    expect(session.gameMode).toBe(true);
  });

  it('newGame очищає researched і перебудовує черги планів', () => {
    const plans = usePlansStore();
    const session = useSessionStore();
    plans.addGoal(WALL);
    session.mark(ENG);
    expect(plans.activePlan?.queue).toEqual([WALL]);
    session.newGame();
    expect(session.researched.size).toBe(0);
    expect(plans.activePlan?.queue).toEqual([ENG, WALL]);
  });

  it('персистенс: новий pinia відновлює researched і gameMode', async () => {
    const session = useSessionStore();
    session.mark(ENG);
    session.toggleGameMode();
    await nextTick(); // watch має flush 'pre' — чекаємо мікротаск
    setActivePinia(createPinia());
    const fresh = useSessionStore();
    expect(fresh.researched.has(ENG)).toBe(true);
    expect(fresh.gameMode).toBe(true);
  });

  it('corrupt у localStorage → storageCorrupt, resetStorage повертає дефолт', () => {
    localStorage.setItem('wz2100-tree:v1:session', '???not json');
    const session = useSessionStore();
    expect(session.storageCorrupt).toBe(true);
    expect(session.researched.size).toBe(0);
    session.resetStorage();
    expect(session.storageCorrupt).toBe(false);
    expect(session.gameMode).toBe(false);
  });
});
