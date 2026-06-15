<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ResearchNode } from '../types';
import { asset } from '../lib/asset';
import ModelPreview from './ModelPreview.vue';

const props = withDefaults(defineProps<{
  node: ResearchNode;
  size?: 'normal' | 'node' | 'export';
  showFrame?: boolean;
  showIcons?: boolean;
  showCostBar?: boolean;
  showOverlay?: boolean;
  rotate?: boolean;
}>(), {
  size: 'normal',
  showFrame: true,
  showIcons: true,
  showCostBar: true,
  showOverlay: true,
  rotate: false,
});

const emit = defineEmits<{
  ready: [];
}>();

const hovered = ref(false);
const costBarPercent = computed(() => Math.min(100, Math.floor(props.node.cost / 5)));
const frameStyle = computed(() =>
  props.showFrame ? { backgroundImage: `url('${asset('interface/image_but0_up.png')}')` } : {},
);
</script>

<template>
  <div
    class="research-icon"
    :class="[size, { frameless: !showFrame }]"
    :style="frameStyle"
    :title="node.name"
    tabindex="0"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
    @focusin="hovered = true"
    @focusout="hovered = false"
  >
    <ModelPreview
      v-if="node.modelGroups.length"
      class="model"
      :groups="node.modelGroups"
      compact
      :show-tabs="false"
      :show-overlay="showOverlay"
      scale-mode="research"
      :rotate="rotate || hovered"
      @ready="emit('ready')"
    />
    <img v-if="showIcons" class="main-icon" :src="asset(`icons/${node.icon}`)" alt="" />
    <img
      v-if="showIcons && node.subIcon"
      class="sub-icon"
      :src="asset(`icons/${node.subIcon}`)"
      alt=""
    />
    <div v-if="showCostBar" class="cost-bar" aria-hidden="true">
      <div class="cost-bar-fill" :style="{ width: `${costBarPercent}%` }"></div>
    </div>
  </div>
</template>

<style scoped>
.research-icon {
  position: relative;
  width: 120px;
  aspect-ratio: 60 / 46;
  overflow: hidden;
  /* background-image is set inline (base-aware) when showFrame is true. */
  background-position: center;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  image-rendering: pixelated;
}
.research-icon.node {
  width: 60px;
  flex: 0 0 60px;
}
.research-icon.frameless {
  background: transparent;
}
.research-icon.export {
  width: 240px;
}
.model {
  position: absolute;
  inset: 0;
}
.main-icon,
.sub-icon {
  position: absolute;
  width: auto;
  height: auto;
  image-rendering: pixelated;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.8));
  transform: scale(2);
}
.main-icon {
  top: 6px;
  left: 6px;
  transform-origin: top left;
}
.sub-icon {
  top: 6px;
  right: 0;
  transform-origin: top right;
}
.cost-bar {
  position: absolute;
  left: 6px;
  top: 78px;
  width: 104px;
  height: 8px;
  overflow: hidden;
}
.cost-bar-fill {
  height: 100%;
  background: #e7f220;
  image-rendering: pixelated;
}
.research-icon.node .main-icon,
.research-icon.node .sub-icon {
  transform: none;
}
.research-icon.node .main-icon {
  top: 3px;
  left: 3px;
}
.research-icon.node .sub-icon {
  top: 3px;
  right: 0;
}
.research-icon.node .cost-bar {
  left: 3px;
  top: 39px;
  width: 52px;
  height: 4px;
}
.research-icon.export .main-icon,
.research-icon.export .sub-icon {
  transform: scale(4);
}
.research-icon.export .main-icon {
  top: 12px;
  left: 12px;
}
.research-icon.export .sub-icon {
  top: 12px;
}
.research-icon.export .cost-bar {
  left: 12px;
  top: 156px;
  width: 208px;
  height: 16px;
}
</style>
