<script setup lang="ts">
import { computed } from 'vue';
import { useDataStore } from '../stores/data';
import { usePlansStore } from '../stores/plans';
import { useSessionStore } from '../stores/session';
import { prereqClosure } from '../lib/graph';
import type { ResearchNode } from '../types';

const data = useDataStore();
const plans = usePlansStore();
const session = useSessionStore();

const done = computed<number>(() => {
  const plan = plans.activePlan;
  if (!plan || plan.goals.length === 0) return 0;
  const closure = prereqClosure(data.index, plan.goals);
  let count = 0;
  for (const id of closure) {
    if (session.researched.has(id)) count += 1;
  }
  return count;
});

const total = computed<number>(() => {
  const plan = plans.activePlan;
  if (!plan) return 0;
  return plan.queue.length + done.value;
});

const percent = computed<number>(() =>
  total.value === 0 ? 0 : Math.round((done.value / total.value) * 100),
);

const nextNodes = computed<ResearchNode[]>(() => {
  const plan = plans.activePlan;
  if (!plan) return [];
  return plan.queue
    .slice(0, 5)
    .map((id) => data.index.byId.get(id))
    .filter((n): n is ResearchNode => n !== undefined);
});

function isAvailable(id: string): boolean {
  return session.statuses.get(id) === 'available';
}

function onMark(id: string): void {
  session.mark(id);
  plans.rebuildQueues();
}

function onNewGame(): void {
  if (!window.confirm('Почати нову гру? Весь прогрес досліджень буде скинуто.')) return;
  session.newGame();
  plans.rebuildQueues();
}
</script>

<template>
  <section class="game-panel">
    <h2>Режим гри</h2>

    <template v-if="plans.activePlan">
      <p class="progress-label">Прогрес плану: {{ done }} / {{ total }} ({{ percent }}%)</p>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: percent + '%' }"></div>
      </div>

      <h3>Наступні</h3>
      <ul class="next">
        <li
          v-for="n in nextNodes"
          :key="n.id"
          :class="{ available: isAvailable(n.id) }"
          title="Клік — відмітити вивченим"
          @click="onMark(n.id)"
        >
          {{ n.name }}
        </li>
      </ul>
      <p v-if="nextNodes.length === 0" class="hint">Черга порожня — план виконано</p>
    </template>
    <p v-else class="hint">Немає активного плану</p>

    <button class="new-game" @click="onNewGame">Нова гра</button>
  </section>
</template>

<style scoped>
.game-panel {
  padding: 12px;
  border-bottom: 1px solid var(--border);
}
h2 {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--text);
}
h3 {
  margin: 12px 0 6px;
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-dim);
}
.progress-label {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--text);
}
.progress-track {
  height: 10px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-node);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--green);
  transition: width 0.3s ease;
}
.next {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.next li {
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-dim);
  font-size: 13px;
  cursor: pointer;
}
.next li.available {
  border-color: var(--yellow);
  color: var(--yellow);
}
.next li:hover {
  background: var(--bg-node);
}
.hint {
  margin: 6px 0;
  color: var(--text-dim);
  font-size: 12px;
}
.new-game {
  margin-top: 12px;
  padding: 5px 12px;
  border: 1px solid var(--red);
  border-radius: 4px;
  background: transparent;
  color: var(--red);
  cursor: pointer;
}
</style>
