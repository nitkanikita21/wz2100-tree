<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import type { Edge, NodeMouseEvent, ViewportTransform } from '@vue-flow/core';
import ResearchNodeCard from './ResearchNodeCard.vue';
import { useDataStore } from '../stores/data';
import { useSessionStore } from '../stores/session';
import { useUiStore } from '../stores/ui';

const data = useDataStore();
const session = useSessionStore();
const ui = useUiStore();

const { fitView } = useVueFlow();

// Below this zoom the 3D model is too small to make out, so nodes fall back to
// the static sprite instead of spinning up a live WebGL render (avoids lag when
// many nodes are on screen). Tune freely — it's just a constant.
const LIVE_ZOOM_THRESHOLD = 0.67;

// Start below the threshold so the initial paint is sprite-only; `fit-view-on-init`
// fires `@viewport-change` immediately and sets the real zoom.
const currentZoom = ref(0);
// Flips only when crossing the threshold, so cards re-render at the boundary
// rather than on every zoom tick.
const showLive = computed(() => currentZoom.value >= LIVE_ZOOM_THRESHOLD);

function onViewportChange(viewport: ViewportTransform): void {
  currentZoom.value = viewport.zoom;
}

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

function onPaneClick(): void {
  ui.select(null);
}

function onNodeMouseEnter({ node }: NodeMouseEvent): void {
  ui.setHovered(node.id);
}

function onNodeMouseLeave(): void {
  ui.setHovered(null);
}

watch(
  () => ui.flyToRequest,
  (id) => {
    if (!id) return;
    fitView({ nodes: [id], padding: 4, duration: 600 });
    ui.clearFlyTo();
  },
);
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
      @pane-click="onPaneClick"
      @node-mouse-enter="onNodeMouseEnter"
      @node-mouse-leave="onNodeMouseLeave"
      @viewport-change="onViewportChange"
    >
      <template #node-research="nodeProps">
        <ResearchNodeCard :id="nodeProps.id" :data="nodeProps.data" :live="showLive" />
      </template>
    </VueFlow>
    <div class="zoom-indicator" aria-live="off">{{ currentZoom.toFixed(2) }}×</div>
  </div>
</template>

<style scoped>
.tree-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--bg);
}
.zoom-indicator {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 5;
  padding: 3px 8px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  background: var(--bg-node);
  border: 1px solid var(--border);
  border-radius: 4px;
  pointer-events: none;
  user-select: none;
}
</style>
