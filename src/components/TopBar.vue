<script setup lang="ts">
import { useSessionStore } from '../stores/session';

const session = useSessionStore();
</script>

<template>
  <header class="topbar">
    <h1 class="title">Warzone 2100 — Дерево досліджень</h1>
    <div class="search-slot">
      <!-- SearchBox зʼявиться тут у Task 14 -->
    </div>
    <label class="game-toggle" :class="{ on: session.gameMode }">
      <input
        type="checkbox"
        :checked="session.gameMode"
        @change="session.toggleGameMode()"
      />
      <span>▶ Гра</span>
    </label>
  </header>
</template>

<style scoped>
.topbar {
  display: flex; align-items: center; gap: 16px;
  height: 100%; padding: 0 16px; box-sizing: border-box;
  background: var(--bg-panel); border-bottom: 1px solid var(--border);
}
.title {
  margin: 0; font-size: 15px; font-weight: 600;
  color: var(--text); white-space: nowrap;
}
.search-slot { flex: 1; display: flex; justify-content: center; }
.game-toggle {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 12px; border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-dim); cursor: pointer; user-select: none; white-space: nowrap;
}
.game-toggle input { display: none; }
.game-toggle.on { border-color: var(--green); color: var(--green); }
</style>
