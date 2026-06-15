<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDataStore } from '../stores/data';
import { usePlansStore } from '../stores/plans';
import { useSessionStore } from '../stores/session';
import { useUiStore } from '../stores/ui';
import type { NodeStatus, ResearchNode } from '../types';
import {
  describeNode,
  formatDuration,
  formatResult,
  minResearchSeconds,
  resolveName,
} from '../lib/researchResults';
import ResearchIconPreview from './ResearchIconPreview.vue';

const { t } = useI18n();
const data = useDataStore();
const plans = usePlansStore();
const session = useSessionStore();
const ui = useUiStore();

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

const minTime = computed(() =>
  node.value
    ? formatDuration(minResearchSeconds(node.value.points, data.maxLabResearchPoints))
    : '',
);

const description = computed(() =>
  node.value ? describeNode(node.value, data.componentNames, t) : '',
);

const upgrades = computed<string[]>(() =>
  node.value ? node.value.results.map((r) => formatResult(r, data.componentNames, t)) : [],
);

const requiredStructureNames = computed<string[]>(() =>
  node.value ? node.value.requiredStructures.map((id) => resolveName(id, data.componentNames)) : [],
);

const resultStructureNames = computed<string[]>(() =>
  node.value ? node.value.resultStructures.map((id) => resolveName(id, data.componentNames)) : [],
);

const obsoleteNames = computed<string[]>(() =>
  node.value
    ? [...node.value.redComponents, ...node.value.redStructures].map((id) =>
        resolveName(id, data.componentNames),
      )
    : [],
);

function onToggleResearched(): void {
  if (!node.value) return;
  session.toggle(node.value.id);
  plans.rebuildQueues();
}
</script>

<template>
  <section class="details">
    <p v-if="!node" class="empty">{{ t('details.empty') }}</p>
    <template v-else>
      <h2>{{ node.name }}</h2>
      <p class="meta">
        {{ t('branch.' + node.branch) }}<span v-if="node.category"> · {{ node.category }}</span>
      </p>
      <p class="meta">{{ t('details.points', { n: node.points }) }}</p>
      <p class="meta">{{ t('details.cost', { n: node.cost }) }}</p>
      <p class="meta">{{ t('details.minTime', { time: minTime }) }}</p>
      <p v-if="description" class="description">{{ description }}</p>
      <p class="status" :class="status">{{ t('status.' + status) }}</p>

      <label v-if="session.gameMode" class="researched-toggle">
        <input
          type="checkbox"
          :checked="status === 'researched'"
          @change="onToggleResearched"
        />
        {{ t('details.researchedToggle') }}
      </label>

      <button class="add-goal" :disabled="alreadyGoal" @click="plans.addGoal(node.id)">
        {{ t('details.addToPlan') }}
      </button>

      <div v-if="prereqNodes.length" class="block">
        <h3>{{ t('details.requires') }}</h3>
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
        <h3>{{ t('details.opens') }}</h3>
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

      <div v-if="upgrades.length" class="block">
        <h3>{{ t('details.upgrades') }}</h3>
        <ul class="upgrade-list">
          <li v-for="(u, i) in upgrades" :key="i">{{ u }}</li>
        </ul>
      </div>

      <div v-if="requiredStructureNames.length" class="block">
        <h3>{{ t('details.researchedIn') }}</h3>
        <p class="results">{{ requiredStructureNames.join(', ') }}</p>
      </div>

      <div v-if="obsoleteNames.length" class="block">
        <h3>{{ t('details.obsoletes') }}</h3>
        <p class="results">{{ obsoleteNames.join(', ') }}</p>
      </div>

      <div v-if="resultStructureNames.length" class="block">
        <h3>{{ t('details.structures') }}</h3>
        <p class="results">{{ resultStructureNames.join(', ') }}</p>
      </div>

      <div v-if="node.models.length" class="block">
        <h3>{{ t('details.icon') }}</h3>
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
.description {
  margin: 8px 0;
  font-size: 13px;
  line-height: 1.35;
  color: var(--text);
}
.upgrade-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--text);
}
.upgrade-list li {
  margin: 1px 0;
}
</style>
