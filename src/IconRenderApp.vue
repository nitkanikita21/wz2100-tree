<script setup lang="ts">
import ResearchIconPreview from './components/ResearchIconPreview.vue';
import type { ResearchData, ResearchNode } from './types';
import rawData from './data/research-4.7.0.json';

const data = rawData as ResearchData;
const params = new URLSearchParams(window.location.search);
const id = params.get('renderResearchIcon') ?? '';
const node = data.nodes.find((item: ResearchNode) => item.id === id) ?? null;
</script>

<template>
  <main class="icon-render-app">
    <ResearchIconPreview
      v-if="node"
      :node="node"
      size="export"
      :show-frame="false"
      :show-icons="false"
      :show-cost-bar="false"
    />
    <div v-else class="missing">Missing research icon: {{ id }}</div>
  </main>
</template>

<style scoped>
.icon-render-app {
  width: 240px;
  height: 184px;
  margin: 0;
  overflow: hidden;
}
.missing {
  width: 240px;
  height: 184px;
  display: grid;
  place-items: center;
  background: #111322;
  color: #f4f5ff;
  font: 14px sans-serif;
}
:global(html.icon-render-mode),
:global(body.icon-render-mode),
:global(body.icon-render-mode #app) {
  width: 240px;
  height: 184px;
  margin: 0;
  overflow: hidden;
  background: transparent !important;
}
</style>
