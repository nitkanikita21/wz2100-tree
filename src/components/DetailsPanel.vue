<script setup lang="ts">
import { computed } from 'vue';
import { useDataStore } from '../stores/data';
import { usePlansStore } from '../stores/plans';
import { useSessionStore } from '../stores/session';
import { useUiStore } from '../stores/ui';
import type { Branch, NodeStatus, ResearchNode } from '../types';
import ResearchIconPreview from './ResearchIconPreview.vue';

const data = useDataStore();
const plans = usePlansStore();
const session = useSessionStore();
const ui = useUiStore();

const BRANCH_LABELS: Record<Branch, string> = {
  weapon: 'Зброя',
  defence: 'Оборона',
  droid: 'Дроїди',
  cyborg: 'Кіборги',
  system: 'Системи',
  structure: 'Будівлі',
  power: 'Енергія',
  computer: 'Компʼютери',
};

const STATUS_LABELS: Record<NodeStatus, string> = {
  researched: 'Вивчено',
  available: 'Доступно',
  locked: 'Недоступно',
};

const node = computed<ResearchNode | null>(() =>
  ui.selectedId ? data.index.byId.get(ui.selectedId) ?? null : null,
);

const status = computed<NodeStatus>(() =>
  node.value ? session.statuses.get(node.value.id) ?? 'locked' : 'locked',
);

const prereqNodes = computed<ResearchNode[]>(() => {
  if (!node.value) return [];
  return node.value.prereqs
    .map((id) => data.index.byId.get(id))
    .filter((n): n is ResearchNode => n !== undefined);
});

const unlockNodes = computed<ResearchNode[]>(() => {
  if (!node.value) return [];
  return (data.index.unlocks.get(node.value.id) ?? [])
    .map((id) => data.index.byId.get(id))
    .filter((n): n is ResearchNode => n !== undefined);
});

const alreadyGoal = computed(() =>
  node.value !== null &&
  plans.activePlan !== null &&
  plans.activePlan.goals.includes(node.value.id),
);

function onToggleResearched(): void {
  if (!node.value) return;
  session.toggle(node.value.id);
  plans.rebuildQueues();
}
</script>

<template>
  <section class="details">
    <p v-if="!node" class="empty">Клікни технологію на дереві</p>
    <template v-else>
      <h2>{{ node.name }}</h2>
      <p class="meta">
        {{ BRANCH_LABELS[node.branch] }}<span v-if="node.category"> · {{ node.category }}</span>
      </p>
      <p class="meta">Очки дослідження: {{ node.points }}</p>
      <p class="meta">Ціна: {{ node.cost }}</p>
      <p class="status" :class="status">{{ STATUS_LABELS[status] }}</p>

      <label v-if="session.gameMode" class="researched-toggle">
        <input
          type="checkbox"
          :checked="status === 'researched'"
          @change="onToggleResearched"
        />
        Вивчено
      </label>

      <button class="add-goal" :disabled="alreadyGoal" @click="plans.addGoal(node.id)">
        У план
      </button>

      <div v-if="prereqNodes.length" class="block">
        <h3>Потребує:</h3>
        <div class="link-list">
          <button
            v-for="p in prereqNodes"
            :key="p.id"
            class="link"
            @click="ui.flyTo(p.id)"
          >
            {{ p.name }}
          </button>
        </div>
      </div>

      <div v-if="unlockNodes.length" class="block">
        <h3>Відкриває:</h3>
        <div class="link-list">
          <button
            v-for="u in unlockNodes"
            :key="u.id"
            class="link"
            @click="ui.flyTo(u.id)"
          >
            {{ u.name }}
          </button>
        </div>
      </div>

      <div v-if="node.resultStructures.length" class="block">
        <h3>Споруди:</h3>
        <p class="results">{{ node.resultStructures.join(', ') }}</p>
      </div>

      <div v-if="node.models.length" class="block">
        <h3>Іконка:</h3>
        <ResearchIconPreview :node="node" />
      </div>
    </template>
  </section>
</template>

<style scoped>
.details {
  padding: 12px;
  border-bottom: 1px solid var(--border);
}
.empty {
  color: var(--text-dim);
  margin: 0;
}
h2 {
  margin: 0 0 4px;
  font-size: 16px;
  color: var(--text);
}
h3 {
  margin: 0 0 4px;
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-dim);
}
.meta {
  margin: 2px 0;
  font-size: 13px;
  color: var(--text-dim);
}
.status {
  margin: 8px 0;
  font-weight: 600;
}
.status.researched { color: var(--green); }
.status.available { color: var(--yellow); }
.status.locked { color: var(--text-dim); }
.researched-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0;
  color: var(--text);
  cursor: pointer;
}
.add-goal {
  margin: 4px 0 10px;
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  background: var(--blue);
  color: var(--bg);
  font-weight: 600;
  cursor: pointer;
}
.add-goal:disabled {
  background: var(--border);
  color: var(--text-dim);
  cursor: default;
}
.block {
  margin: 10px 0 0;
}
.link-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.link {
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-node);
  color: var(--blue);
  font-size: 12px;
  cursor: pointer;
}
.link:hover {
  border-color: var(--blue);
}
.results {
  margin: 0;
  font-size: 12px;
  color: var(--text);
  word-break: break-word;
}
</style>
