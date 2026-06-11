<script setup lang="ts">
import { computed, ref } from 'vue';
import { searchResearch } from '../lib/search';
import { useDataStore } from '../stores/data';
import { useUiStore } from '../stores/ui';

const data = useDataStore();
const ui = useUiStore();

const query = ref('');
const results = computed(() => searchResearch(data.nodes, query.value));

function pick(id: string): void {
  ui.select(id);
  ui.flyTo(id);
  query.value = '';
}
</script>

<template>
  <div class="search-box">
    <input
      v-model="query"
      class="input"
      type="text"
      placeholder="Пошук дослідження…"
    />
    <ul v-if="results.length > 0" class="dropdown">
      <li v-for="r in results" :key="r.id" class="item" @click="pick(r.id)">
        <span class="name">{{ r.name }}</span>
        <span class="rid">{{ r.id }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.search-box { position: relative; width: 320px; }
.input {
  width: 100%; box-sizing: border-box; padding: 6px 10px;
  background: var(--bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px; outline: none;
  font-size: 13px;
}
.input::placeholder { color: var(--text-dim); }
.input:focus { border-color: var(--blue); }
.dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 50;
  margin: 0; padding: 4px; list-style: none;
  background: var(--bg-panel); border: 1px solid var(--border); border-radius: 6px;
  max-height: 360px; overflow-y: auto;
}
.item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 6px 8px; border-radius: 4px; cursor: pointer;
}
.item:hover { background: var(--bg-node); }
.name { color: var(--text); font-size: 13px; }
.rid { color: var(--text-dim); font-size: 11px; }
</style>
