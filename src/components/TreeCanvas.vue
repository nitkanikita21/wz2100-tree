<script setup lang="ts">
import { computed } from 'vue';
import { VueFlow } from '@vue-flow/core';
import type { Edge, NodeMouseEvent } from '@vue-flow/core';
import ResearchNodeCard from './ResearchNodeCard.vue';
import { useDataStore } from '../stores/data';
import { useSessionStore } from '../stores/session';
import { useUiStore } from '../stores/ui';

const data = useDataStore();
const session = useSessionStore();
const ui = useUiStore();

const edges = computed<Edge[]>(() => {
  const hl = ui.highlightSet;
  return data.flowEdges.map((e) => {
    const highlighted = hl.has(e.source) && hl.has(e.target);
    return {
      ...e,
      style: highlighted
        ? { stroke: 'var(--blue)', strokeWidth: 2.5 }
        : { stroke: 'var(--edge)', strokeWidth: 1.5 },
    };
  });
});

function onNodeClick({ node }: NodeMouseEvent): void {
  if (session.gameMode) session.toggle(node.id);
  else ui.select(node.id);
}

function onNodeMouseEnter({ node }: NodeMouseEvent): void {
  ui.setHovered(node.id);
}

function onNodeMouseLeave(): void {
  ui.setHovered(null);
}
</script>

<template>
  <div class="tree-canvas">
    <VueFlow
      :nodes="data.flowNodes"
      :edges="edges"
      :only-render-visible-elements="true"
      :min-zoom="0.05"
      :max-zoom="2"
      fit-view-on-init
      @node-click="onNodeClick"
      @node-mouse-enter="onNodeMouseEnter"
      @node-mouse-leave="onNodeMouseLeave"
    >
      <template #node-research="nodeProps">
        <ResearchNodeCard :id="nodeProps.id" :data="nodeProps.data" />
      </template>
    </VueFlow>
  </div>
</template>

<style scoped>
.tree-canvas {
  width: 100%;
  height: 100%;
  background: var(--bg);
}
</style>
