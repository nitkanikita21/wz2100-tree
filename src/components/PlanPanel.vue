<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDataStore } from '../stores/data';
import { usePlansStore } from '../stores/plans';
import { useSessionStore } from '../stores/session';
import { useUiStore } from '../stores/ui';
import type { ResearchNode } from '../types';

const { t } = useI18n();
const data = useDataStore();
const plans = usePlansStore();
const session = useSessionStore();
const ui = useUiStore();

const fileInput = ref<HTMLInputElement | null>(null);
const dragFromIdx = ref<number | null>(null);
const conflictIds = ref<Set<string>>(new Set());

const goalNodes = computed<ResearchNode[]>(() => {
  const plan = plans.activePlan;
  if (!plan) return [];
  return plan.goals
    .map((id) => data.index.byId.get(id))
    .filter((n): n is ResearchNode => n !== undefined);
});

const queueNodes = computed<ResearchNode[]>(() => {
  const plan = plans.activePlan;
  if (!plan) return [];
  return plan.queue
    .map((id) => data.index.byId.get(id))
    .filter((n): n is ResearchNode => n !== undefined);
});

const queuePoints = computed(() => queueNodes.value.reduce((sum, node) => sum + node.points, 0));
const queueCost = computed(() => queueNodes.value.reduce((sum, node) => sum + node.cost, 0));

function onSelectPlan(event: Event): void {
  const id = (event.target as HTMLSelectElement).value;
  if (id) plans.setActive(id);
}

function onCreate(): void {
  const name = window.prompt(t('plan.promptName'), t('plan.newName'));
  if (name === null) return;
  plans.createPlan(name.trim() || t('plan.newName'));
}

function onRename(): void {
  const plan = plans.activePlan;
  if (!plan) return;
  const name = window.prompt(t('plan.promptRename'), plan.name);
  if (name === null) return;
  plans.renamePlan(plan.id, name.trim() || plan.name);
}

function onDelete(): void {
  const plan = plans.activePlan;
  if (!plan) return;
  if (window.confirm(t('plan.confirmDelete', { name: plan.name }))) {
    plans.deletePlan(plan.id);
  }
}

function onDragStart(idx: number): void {
  dragFromIdx.value = idx;
}

function onDrop(toIdx: number): void {
  const from = dragFromIdx.value;
  dragFromIdx.value = null;
  if (from === null || from === toIdx) return;
  const res = plans.moveQueueItem(from, toIdx);
  if (!res.ok) {
    conflictIds.value = new Set([res.conflictId]);
    window.setTimeout(() => {
      conflictIds.value = new Set();
    }, 1200);
  }
}

function onExport(): void {
  const json = plans.exportActive();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plan.json';
  a.click();
  URL.revokeObjectURL(url);
}

function onImportClick(): void {
  fileInput.value?.click();
}

function onImportFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const res = plans.importPlan(String(reader.result));
    if (!res.ok) window.alert(res.error);
  };
  reader.readAsText(file);
  input.value = '';
}

function onResetStorage(): void {
  plans.resetStorage();
  session.resetStorage();
}

function focusNode(id: string): void {
  ui.select(id);
  ui.flyTo(id);
}

function statusColor(id: string): string {
  const s = session.statuses.get(id) ?? 'locked';
  if (s === 'researched') return 'var(--green)';
  if (s === 'available') return 'var(--yellow)';
  return 'var(--border)';
}
</script>

<template>
  <section class="plan-panel">
    <div v-if="plans.storageCorrupt || session.storageCorrupt" class="corrupt-banner">
      <span>{{ t('plan.corrupt') }}</span>
      <button class="reset-btn" @click="onResetStorage">{{ t('plan.reset') }}</button>
    </div>

    <h2>{{ t('plan.title') }}</h2>

    <div class="plan-bar">
      <select :value="plans.activePlanId ?? ''" @change="onSelectPlan">
        <option v-for="p in plans.plans" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <button :title="t('plan.createTitle')" @click="onCreate">+</button>
      <button :title="t('plan.renameTitle')" :disabled="!plans.activePlan" @click="onRename">✎</button>
      <button :title="t('plan.deleteTitle')" :disabled="!plans.activePlan" @click="onDelete">🗑</button>
    </div>

    <template v-if="plans.activePlan">
      <div class="goals">
        <span v-for="g in goalNodes" :key="g.id" class="chip">
          {{ g.name }}
          <button class="chip-x" :title="t('plan.removeGoalTitle')" @click="plans.removeGoal(g.id)">✕</button>
        </span>
        <p v-if="goalNodes.length === 0" class="hint">
          {{ t('plan.goalsHint') }}
        </p>
      </div>

      <ol class="queue">
        <li v-if="queueNodes.length" class="queue-total">
          <span>{{ t('plan.total') }}</span>
          <span>{{ t('node.pts', { n: queuePoints }) }}</span>
          <span>{{ t('node.cost', { n: queueCost }) }}</span>
        </li>
        <li
          v-for="(n, idx) in queueNodes"
          :key="n.id"
          draggable="true"
          :class="{ conflict: conflictIds.has(n.id) }"
          @dragstart="onDragStart(idx)"
          @dragover.prevent
          @drop="onDrop(idx)"
        >
          <span class="num">{{ idx + 1 }}.</span>
          <span class="dot" :style="{ background: statusColor(n.id) }"></span>
          <button class="name" @click="focusNode(n.id)">{{ n.name }}</button>
          <span class="pts">{{ t('node.pts', { n: n.points }) }}</span>
          <span class="pts">{{ t('node.cost', { n: n.cost }) }}</span>
        </li>
      </ol>
    </template>
    <p v-else class="hint">{{ t('plan.noPlans') }}</p>

    <div class="io">
      <button :disabled="!plans.activePlan" @click="onExport">{{ t('plan.export') }}</button>
      <button @click="onImportClick">{{ t('plan.import') }}</button>
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="hidden-input"
        @change="onImportFile"
      />
    </div>
  </section>
</template>

<style scoped>
.plan-panel {
  padding: 12px;
}
h2 {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--text);
}
.corrupt-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  padding: 8px;
  border: 1px solid var(--red);
  border-radius: 4px;
  color: var(--red);
  font-size: 13px;
}
.reset-btn {
  padding: 4px 10px;
  border: 1px solid var(--red);
  border-radius: 4px;
  background: transparent;
  color: var(--red);
  cursor: pointer;
}
.plan-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
}
.plan-bar select {
  flex: 1;
  min-width: 0;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-node);
  color: var(--text);
}
.plan-bar button {
  width: 28px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-node);
  color: var(--text);
  cursor: pointer;
}
.plan-bar button:disabled {
  color: var(--text-dim);
  cursor: default;
}
.goals {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 8px;
  border: 1px solid var(--blue);
  border-radius: 10px;
  color: var(--blue);
  font-size: 12px;
}
.chip-x {
  border: none;
  background: transparent;
  color: var(--blue);
  cursor: pointer;
  font-size: 11px;
  padding: 0;
}
.hint {
  margin: 4px 0;
  color: var(--text-dim);
  font-size: 12px;
}
.queue {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
}
.queue li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: grab;
}
.queue li:hover {
  background: var(--bg-node);
}
.queue li.conflict {
  border-color: var(--red);
}
.queue-total {
  justify-content: flex-end;
  cursor: default;
  color: var(--text-dim);
  font-size: 11px;
}
.queue-total:hover {
  background: transparent;
}
.num {
  color: var(--text-dim);
  font-size: 12px;
  min-width: 22px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.name {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--text);
  text-align: left;
  font-size: 13px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name:hover {
  color: var(--blue);
}
.pts {
  color: var(--text-dim);
  font-size: 11px;
}
.io {
  display: flex;
  gap: 6px;
}
.io button {
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-node);
  color: var(--text);
  cursor: pointer;
}
.io button:disabled {
  color: var(--text-dim);
  cursor: default;
}
.hidden-input {
  display: none;
}
</style>
