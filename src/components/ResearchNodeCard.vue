<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import type { ResearchNode } from '../types';
import { useSessionStore } from '../stores/session';
import { usePlansStore } from '../stores/plans';
import { useUiStore } from '../stores/ui';

const props = defineProps<{
  id: string;
  data: { node: ResearchNode };
}>();

const session = useSessionStore();
const plans = usePlansStore();
const ui = useUiStore();

const status = computed(() => session.statuses.get(props.id) ?? 'locked');
const planned = computed(() => plans.plannedSet.has(props.id));
const dimmed = computed(() => {
  const branchOff = !ui.enabledBranches.has(props.data.node.branch);
  const hl = ui.highlightSet;
  const outsideHighlight = hl.size > 0 && !hl.has(props.id);
  return branchOff || outsideHighlight;
});
</script>

<template>
  <div class="card" :class="[status, { planned, dimmed }]" :title="data.node.name">
    <Handle type="target" :position="Position.Top" />
    <img class="icon" :src="`/icons/${data.node.icon}`" :alt="data.node.branch" />
    <div class="body">
      <div class="name">{{ data.node.name }}</div>
      <div class="points">{{ data.node.points }} оч.</div>
    </div>
    <img
      v-if="data.node.subIcon"
      class="sub-icon"
      :src="`/icons/${data.node.subIcon}`"
      alt=""
    />
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<style scoped>
.card {
  position: relative;
  width: 180px; height: 56px; box-sizing: border-box;
  display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  background: var(--bg-node);
  border: 2px solid var(--border); border-radius: 6px;
  color: var(--text); cursor: pointer;
  transition: opacity 0.15s ease;
}
.card.researched { border-color: var(--green); }
.card.available { border-color: var(--yellow); }
.card.locked { border-color: var(--border); }
.card.planned { box-shadow: inset 4px 0 0 0 var(--blue); }
.card.dimmed { opacity: 0.25; }
.icon { width: 28px; height: 28px; image-rendering: pixelated; }
.body { flex: 1; min-width: 0; }
.name {
  font-size: 12px; line-height: 1.2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.points { font-size: 10px; color: var(--text-dim); }
.sub-icon {
  position: absolute; top: -8px; right: -8px;
  width: 20px; height: 20px; image-rendering: pixelated;
}
.card :deep(.vue-flow__handle) {
  width: 6px; height: 6px; background: var(--border); border: none;
}
</style>
