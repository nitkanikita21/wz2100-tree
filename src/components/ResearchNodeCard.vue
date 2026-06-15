<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Handle, Position } from '@vue-flow/core';
import type { ResearchNode } from '../types';
import { useSessionStore } from '../stores/session';
import { usePlansStore } from '../stores/plans';
import { useUiStore } from '../stores/ui';
import { useDataStore } from '../stores/data';
import { asset } from '../lib/asset';
import ResearchIconPreview from './ResearchIconPreview.vue';

const props = withDefaults(defineProps<{
  id: string;
  data: { node: ResearchNode };
  /** Render live 3D when zoomed in past the LOD threshold (driven by the parent). */
  live?: boolean;
}>(), {
  live: false,
});

const { t } = useI18n();
const session = useSessionStore();
const plans = usePlansStore();
const ui = useUiStore();
const dataStore = useDataStore();
const SPRITE_COLUMNS = 20;
const SPRITE_WIDTH = 60;
const SPRITE_HEIGHT = 46;
const SPRITE_URL = asset('generated/research-models-sheet.png');
const FRAME_URL = asset('interface/image_but0_up.png');

const status = computed(() => session.statuses.get(props.id) ?? 'locked');
const planned = computed(() => plans.plannedSet.has(props.id));
const selected = computed(() => ui.selectedId === props.id);
// Live 3D for the selected node always (cheap, single context), otherwise only
// when the parent says we're zoomed in enough.
const showLive = computed(() => props.live || selected.value);
const useSpriteSheet = ref(true);
const liveReady = ref(false);
const costBarPercent = computed(() => Math.min(100, Math.floor(props.data.node.cost / 5)));
function modelSpriteKey(node: ResearchNode): string {
  return JSON.stringify(
    node.modelGroups.map((group) =>
      group.parts.map((part) => part.model.toLowerCase()),
    ),
  );
}
const spriteIndex = computed(() => {
  const keys = new Map<string, number>();
  for (const node of dataStore.nodes) {
    const key = modelSpriteKey(node);
    if (!keys.has(key)) keys.set(key, keys.size);
  }
  return keys.get(modelSpriteKey(props.data.node)) ?? 0;
});
const spriteStyle = computed(() => {
  const index = Math.max(0, spriteIndex.value);
  const col = index % SPRITE_COLUMNS;
  const row = Math.floor(index / SPRITE_COLUMNS);
  const rows = Math.ceil(new Set(dataStore.nodes.map(modelSpriteKey)).size / SPRITE_COLUMNS);
  return {
    backgroundImage: `url("${SPRITE_URL}")`,
    backgroundPosition: `-${col * SPRITE_WIDTH}px -${row * SPRITE_HEIGHT}px`,
    backgroundSize: `${SPRITE_COLUMNS * SPRITE_WIDTH}px ${rows * SPRITE_HEIGHT}px`,
  };
});
const dimmed = computed(() => {
  const branchOff = !ui.enabledBranches.has(props.data.node.branch);
  const hl = ui.highlightSet;
  const outsideHighlight = hl.size > 0 && !hl.has(props.id);
  return branchOff || outsideHighlight;
});

watch(() => props.id, () => {
  useSpriteSheet.value = true;
  liveReady.value = false;
});

// When we leave live mode the preview unmounts; reset so re-entering shows the
// sprite again until the fresh render emits `ready`.
watch(showLive, (now) => {
  if (!now) liveReady.value = false;
});
</script>

<template>
  <div class="card" :class="[status, { planned, selected, dimmed }]" :title="data.node.name">
    <Handle type="target" :position="Position.Top" />
    <div class="icon-slot">
      <img
        v-if="useSpriteSheet"
        class="sprite-probe"
        :src="SPRITE_URL"
        alt=""
        @error="useSpriteSheet = false"
      />
      <div
        v-if="useSpriteSheet && (!showLive || !liveReady)"
        class="icon node-icon"
        :style="{ backgroundImage: `url('${FRAME_URL}')` }"
      >
        <div class="model-sprite" :style="spriteStyle"></div>
        <img class="main-icon" :src="asset(`icons/${data.node.icon}`)" alt="" />
        <img
          v-if="data.node.subIcon"
          class="sub-icon"
          :src="asset(`icons/${data.node.subIcon}`)"
          alt=""
        />
        <div class="cost-bar" aria-hidden="true">
          <div class="cost-bar-fill" :style="{ width: `${costBarPercent}%` }"></div>
        </div>
      </div>
      <ResearchIconPreview
        v-if="showLive"
        class="icon live-icon"
        :class="{ ready: liveReady }"
        :node="data.node"
        size="node"
        :rotate="selected"
        :show-overlay="false"
        @ready="liveReady = true"
      />
      <ResearchIconPreview
        v-else-if="!useSpriteSheet"
        class="icon fallback-icon"
        :node="data.node"
        size="node"
      />
    </div>
    <div class="body">
      <div class="name">{{ data.node.name }}</div>
      <div class="points">{{ t('node.pts', { n: data.node.points }) }} · {{ t('node.cost', { n: data.node.cost }) }}</div>
    </div>
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
.card.selected { outline: 2px solid var(--blue); outline-offset: 2px; }
.card.dimmed { opacity: 0.25; }
.icon { pointer-events: auto; }
.icon-slot {
  position: relative;
  width: 60px;
  height: 46px;
  flex: 0 0 60px;
}
.sprite-probe {
  display: none;
}
.node-icon {
  position: absolute;
  inset: 0;
  width: 60px;
  height: 46px;
  overflow: hidden;
  /* background-image set inline (base-aware). */
  background-position: center;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  image-rendering: pixelated;
}
.live-icon {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}
.live-icon.ready {
  opacity: 1;
  pointer-events: auto;
}
.fallback-icon {
  position: absolute;
  inset: 0;
}
.model-sprite {
  position: absolute;
  inset: 0;
  background-repeat: no-repeat;
}
.main-icon,
.sub-icon {
  position: absolute;
  width: auto;
  height: auto;
  image-rendering: pixelated;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.8));
}
.main-icon {
  top: 3px;
  left: 3px;
}
.sub-icon {
  top: 3px;
  right: 0;
}
.cost-bar {
  position: absolute;
  left: 3px;
  top: 39px;
  width: 52px;
  height: 4px;
  overflow: hidden;
}
.cost-bar-fill {
  height: 100%;
  background: #e7f220;
}
.body { flex: 1; min-width: 0; }
.name {
  font-size: 12px; line-height: 1.2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.points { font-size: 10px; color: var(--text-dim); }
.card :deep(.vue-flow__handle) {
  width: 6px; height: 6px; background: var(--border); border: none;
}
</style>
