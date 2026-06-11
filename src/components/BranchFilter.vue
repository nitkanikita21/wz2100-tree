<script setup lang="ts">
import type { Branch } from '../types';
import { useUiStore } from '../stores/ui';

const ui = useUiStore();

const BRANCHES: { branch: Branch; icon: string; label: string }[] = [
  { branch: 'weapon', icon: 'image_res_weapontech.png', label: 'Зброя' },
  { branch: 'defence', icon: 'image_res_defence.png', label: 'Захист' },
  { branch: 'droid', icon: 'image_res_droidtech.png', label: 'Корпуси й рушії' },
  { branch: 'cyborg', icon: 'image_res_cyborgtech.png', label: 'Кіборги' },
  { branch: 'system', icon: 'image_res_systemtech.png', label: 'Системи' },
  { branch: 'structure', icon: 'image_res_structuretech.png', label: 'Будівлі' },
  { branch: 'power', icon: 'image_res_powertech.png', label: 'Енергія' },
  { branch: 'computer', icon: 'image_res_computertech.png', label: 'Компʼютери' },
];
</script>

<template>
  <nav class="branch-filter">
    <h2 class="heading">Гілки</h2>
    <label v-for="b in BRANCHES" :key="b.branch" class="row">
      <input
        type="checkbox"
        :checked="ui.enabledBranches.has(b.branch)"
        @change="ui.toggleBranch(b.branch)"
      />
      <img class="icon" :src="`/icons/${b.icon}`" :alt="b.label" />
      <span>{{ b.label }}</span>
    </label>
  </nav>
</template>

<style scoped>
.branch-filter { padding: 12px; }
.heading {
  margin: 0 0 10px; font-size: 12px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim);
}
.row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 4px; border-radius: 4px;
  color: var(--text); font-size: 13px; cursor: pointer; user-select: none;
}
.row:hover { background: var(--bg-node); }
.row input { accent-color: var(--blue); margin: 0; }
.icon { width: 20px; height: 20px; image-rendering: pixelated; }
</style>
