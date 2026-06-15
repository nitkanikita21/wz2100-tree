<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { Branch } from '../types';
import { useUiStore } from '../stores/ui';

const { t } = useI18n();
const ui = useUiStore();

const BRANCHES: { branch: Branch; icon: string }[] = [
  { branch: 'weapon', icon: 'image_res_weapontech.png' },
  { branch: 'defence', icon: 'image_res_defence.png' },
  { branch: 'droid', icon: 'image_res_droidtech.png' },
  { branch: 'cyborg', icon: 'image_res_cyborgtech.png' },
  { branch: 'system', icon: 'image_res_systemtech.png' },
  { branch: 'structure', icon: 'image_res_structuretech.png' },
  { branch: 'power', icon: 'image_res_powertech.png' },
  { branch: 'computer', icon: 'image_res_computertech.png' },
];
</script>

<template>
  <nav class="branch-filter">
    <h2 class="heading">{{ t('branchFilter.heading') }}</h2>
    <label v-for="b in BRANCHES" :key="b.branch" class="row">
      <input
        type="checkbox"
        :checked="ui.enabledBranches.has(b.branch)"
        @change="ui.toggleBranch(b.branch)"
      />
      <img class="icon" :src="`/icons/${b.icon}`" :alt="t('branchFilter.' + b.branch)" />
      <span>{{ t('branchFilter.' + b.branch) }}</span>
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
