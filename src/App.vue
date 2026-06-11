<script setup lang="ts">
import TopBar from './components/TopBar.vue';
import BranchFilter from './components/BranchFilter.vue';
import TreeCanvas from './components/TreeCanvas.vue';
import DetailsPanel from './components/DetailsPanel.vue';
import GamePanel from './components/GamePanel.vue';
import PlanPanel from './components/PlanPanel.vue';
import { useSessionStore } from './stores/session';

const session = useSessionStore();
</script>

<template>
  <div class="app">
    <header class="area-topbar"><TopBar /></header>
    <aside class="area-sidebar"><BranchFilter /></aside>
    <main class="area-canvas"><TreeCanvas /></main>
    <aside class="area-right">
      <DetailsPanel />
      <GamePanel v-if="session.gameMode" />
      <PlanPanel />
    </aside>
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-rows: 48px 1fr;
  grid-template-columns: 200px 1fr 320px;
  grid-template-areas:
    'topbar topbar topbar'
    'sidebar canvas right';
  height: 100vh;
  background: var(--bg);
  color: var(--text);
}
.area-topbar { grid-area: topbar; min-width: 0; }
.area-sidebar {
  grid-area: sidebar; min-height: 0; overflow-y: auto;
  background: var(--bg-panel); border-right: 1px solid var(--border);
}
.area-canvas { grid-area: canvas; min-width: 0; min-height: 0; }
.area-right {
  grid-area: right; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column;
  background: var(--bg-panel); border-left: 1px solid var(--border);
}
</style>
