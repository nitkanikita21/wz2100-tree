<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import * as THREE from 'three';
import { parsePieModel } from '../lib/pieModel';
import type { ModelGroup, ModelPart } from '../types';

const props = withDefaults(defineProps<{
  groups: ModelGroup[];
  compact?: boolean;
  rotate?: boolean;
  showTabs?: boolean;
  showOverlay?: boolean;
  scaleMode?: 'component' | 'research' | 'structure';
}>(), {
  compact: false,
  rotate: true,
  showTabs: true,
  showOverlay: true,
  scaleMode: 'research',
});

const emit = defineEmits<{
  ready: [];
}>();

const { t } = useI18n();
const host = ref<HTMLDivElement | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);
const renderer = shallowRef<THREE.WebGLRenderer | null>(null);
const scene = shallowRef<THREE.Scene | null>(null);
const camera = shallowRef<THREE.PerspectiveCamera | null>(null);
const mesh = shallowRef<THREE.Group | null>(null);
const frame = ref<number | null>(null);
const selected = ref(0);
const textureCache = new Map<string, THREE.Texture>();
const BLACK_TRANSPARENT_MODELS = new Set(['icamrhot.pie']);
const INITIAL_Y_ROTATION = Math.PI;
const Y_ROTATION_SPEED = -0.006;
const RETURN_Y_ROTATION_SPEED = 0.16;
const ROTATION_EPSILON = 0.003;
const COMPONENT_RADIUS = 64;
const COMPONENT_BUTTON_SCALE = 100;
const SMALL_STRUCTURE_SCALE = 55;
const MEDIUM_STRUCTURE_SCALE = 34;
const LARGE_STRUCTURE_SCALE = 25;
const COMPACT_CAMERA_POSITION = new THREE.Vector3(90, 60, 135);
let resizeObserver: ResizeObserver | null = null;
let worker: Worker | null = null;
let workerCanvas: HTMLCanvasElement | null = null;
let workerReady = false;
let targetYRotation = INITIAL_Y_ROTATION;

type WorkerResponse =
  | { type: 'loading'; value: boolean }
  | { type: 'error'; message: string | null }
  | { type: 'ready' };

function plainModelGroups(): ModelGroup[] {
  return props.groups.map((group) => ({
    id: group.id,
    models: [...group.models],
    parts: group.parts.map((part) => ({
      model: part.model,
      attachToPrevious: part.attachToPrevious,
    })),
    scaleMode: group.scaleMode,
    structureBasePlate: group.structureBasePlate,
    componentScaleMultiplier: group.componentScaleMultiplier,
  }));
}

function canUseWorkerRenderer(): boolean {
  return typeof Worker !== 'undefined'
    && typeof OffscreenCanvas !== 'undefined'
    && 'transferControlToOffscreen' in HTMLCanvasElement.prototype;
}

function currentSize(): { width: number; height: number; dpr: number } {
  const element = host.value;
  const dprScale = props.compact ? 2 : 1;
  const maxDpr = props.compact ? 4 : 2;
  return {
    width: Math.max(1, Math.floor(element?.clientWidth ?? 1)),
    height: Math.max(1, Math.floor(element?.clientHeight ?? 1)),
    dpr: Math.min(window.devicePixelRatio * dprScale, maxDpr),
  };
}

function postWorkerLoad(): void {
  if (!workerReady || !worker) return;
  worker.postMessage({
    type: 'load',
    groups: plainModelGroups(),
    selected: selected.value,
  });
}

function initWorkerRenderer(): boolean {
  if (!host.value || worker || !canUseWorkerRenderer()) return false;

  const canvas = document.createElement('canvas');
  canvas.className = 'worker-canvas';
  host.value.appendChild(canvas);

  const offscreen = canvas.transferControlToOffscreen();
  const nextWorker = new Worker(new URL('../workers/modelPreview.worker.ts', import.meta.url), {
    type: 'module',
  });
  nextWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    if (event.data.type === 'loading') loading.value = event.data.value;
    else if (event.data.type === 'error') error.value = event.data.message;
    else if (event.data.type === 'ready') {
      loading.value = false;
      error.value = null;
      emit('ready');
    }
  };
  nextWorker.onerror = () => {
    error.value = 'worker error';
    loading.value = false;
  };

  worker = nextWorker;
  workerCanvas = canvas;
  workerReady = true;

  nextWorker.postMessage({
    type: 'init',
    canvas: offscreen,
    ...currentSize(),
    compact: props.compact,
    rotate: props.rotate,
    scaleMode: props.scaleMode,
  }, [offscreen]);

  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host.value);
  resize();
  return true;
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const maybeMesh = child as THREE.Mesh;
    maybeMesh.geometry?.dispose();
    const material = maybeMesh.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose();
  });
}

function initScene(): void {
  if (!host.value || renderer.value || worker) return;
  if (initWorkerRenderer()) return;

  const nextScene = new THREE.Scene();
  nextScene.background = props.compact ? null : new THREE.Color(0x20223a);

  const nextCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 5000);
  nextCamera.position.set(120, 80, 180);

  const nextRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: props.compact });
  if (props.compact) nextRenderer.setClearAlpha(0);
  nextRenderer.setPixelRatio(currentSize().dpr);
  host.value.appendChild(nextRenderer.domElement);

  const ambient = new THREE.AmbientLight(0xc8d0ff, 1.35);
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  const fill = new THREE.DirectionalLight(0x93a8ff, 0.85);
  key.position.set(100, 160, 120);
  fill.position.set(-120, 80, -80);
  nextScene.add(ambient, key, fill);

  renderer.value = nextRenderer;
  scene.value = nextScene;
  camera.value = nextCamera;

  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host.value);
  resize();
}

function resize(): void {
  if (worker) {
    worker.postMessage({
      type: 'resize',
      ...currentSize(),
    });
    return;
  }

  if (!renderer.value || !camera.value) return;
  const { width: nextWidth, height: nextHeight } = currentSize();
  renderer.value.setSize(nextWidth, nextHeight, false);
  camera.value.aspect = nextWidth / nextHeight;
  camera.value.updateProjectionMatrix();
  renderScene();
}

function renderScene(): void {
  if (renderer.value && scene.value && camera.value) {
    renderer.value.render(scene.value, camera.value);
  }
}

function shortestAngleDelta(from: number, to: number): number {
  return THREE.MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
}

function needsReturnToInitial(): boolean {
  return Boolean(
    mesh.value
    && Math.abs(shortestAngleDelta(mesh.value.rotation.y, targetYRotation)) > ROTATION_EPSILON,
  );
}

function rotateTowardInitial(): boolean {
  if (!mesh.value) return false;
  const delta = shortestAngleDelta(mesh.value.rotation.y, targetYRotation);
  if (Math.abs(delta) <= ROTATION_EPSILON) {
    mesh.value.rotation.y = targetYRotation;
    return false;
  }
  mesh.value.rotation.y += Math.sign(delta) * Math.min(Math.abs(delta), RETURN_Y_ROTATION_SPEED);
  return true;
}

function updateRotation(): boolean {
  if (!mesh.value) return false;
  if (props.rotate) {
    mesh.value.rotation.y += Y_ROTATION_SPEED;
    return true;
  }
  return rotateTowardInitial();
}

function animate(): void {
  if (worker) return;
  const keepAnimating = updateRotation();
  renderScene();
  frame.value = props.rotate || keepAnimating ? requestAnimationFrame(animate) : null;
}

function fitCamera(group: THREE.Group, pivotMode: 'bbox' | 'base' | 'origin' = 'bbox'): number {
  if (!camera.value) return 1;
  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  const pivot = center.clone();

  if (pivotMode === 'origin') {
    pivot.x = 0;
    pivot.z = 0;
  } else if (pivotMode === 'base' && group.children[0]) {
    const baseCenter = new THREE.Vector3();
    new THREE.Box3().setFromObject(group.children[0]).getCenter(baseCenter);
    pivot.x = baseCenter.x;
    pivot.z = baseCenter.z;
  }

  for (const child of group.children) child.position.sub(pivot);

  const radius = Math.max(size.x, size.y, size.z, 1);
  if (props.compact) {
    camera.value.position.copy(COMPACT_CAMERA_POSITION);
  } else {
    camera.value.position.set(radius * 1.25, radius * 0.85, radius * 1.65);
  }
  camera.value.lookAt(0, 0, 0);
  camera.value.near = Math.max(0.1, radius / 100);
  camera.value.far = radius * 20;
  camera.value.updateProjectionMatrix();
  return radius;
}

function makeBlackTransparentTexture(image: HTMLImageElement): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext('2d');
  if (!context) return new THREE.Texture(image);

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) {
      data[i + 3] = 0;
    }
  }
  context.putImageData(imageData, 0, 0);

  return new THREE.CanvasTexture(canvas);
}

async function loadTexture(texture: string | null, blackTransparent: boolean): Promise<THREE.Texture | null> {
  if (!texture) return null;
  const cacheKey = blackTransparent ? `${texture}:black-transparent` : texture;
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const loadedImage = await new THREE.ImageLoader().loadAsync(`/texpages/${texture}`) as HTMLImageElement;
  const loaded = blackTransparent
    ? makeBlackTransparentTexture(loadedImage)
    : new THREE.Texture(loadedImage);
  loaded.needsUpdate = true;
  loaded.colorSpace = THREE.SRGBColorSpace;
  loaded.magFilter = THREE.NearestFilter;
  loaded.minFilter = THREE.NearestFilter;
  loaded.generateMipmaps = false;
  loaded.wrapS = THREE.ClampToEdgeWrapping;
  loaded.wrapT = THREE.ClampToEdgeWrapping;
  textureCache.set(cacheKey, loaded);
  return loaded;
}

type RenderPart = {
  mesh: THREE.Mesh;
  connectors: THREE.Vector3[];
  height: number;
  radius: number;
};

async function createModelMesh(model: string): Promise<RenderPart> {
  const res = await fetch(`/models/${model.toLowerCase()}`);
  if (!res.ok) throw new Error(`${model}: ${res.status} ${res.statusText}`);
  const parsed = parsePieModel(await res.text());
  if (!parsed.vertices.length || !parsed.indices.length) throw new Error(`${model}: empty model`);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(parsed.vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(parsed.uvs, 2));
  geometry.setIndex(parsed.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const blackTransparent = BLACK_TRANSPARENT_MODELS.has(model.toLowerCase());
  const texture = await loadTexture(parsed.texture, blackTransparent);
  const material = new THREE.MeshStandardMaterial({
    map: texture ?? undefined,
    color: texture ? 0xffffff : 0x9aa7d9,
    roughness: 0.92,
    metalness: 0.04,
    side: THREE.DoubleSide,
    transparent: blackTransparent,
    alphaTest: blackTransparent ? 0.5 : 0,
  });

  return {
    mesh: new THREE.Mesh(geometry, material),
    connectors: parsed.connectors.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    height: (geometry.boundingBox?.max.y ?? 0) - (geometry.boundingBox?.min.y ?? 0),
    radius: parsed.radius,
  };
}

function rescaleButtonObject(radius: number, baseScale: number, baseRadius: number): number {
  const scaled = (100 * baseRadius) / Math.max(radius, 1);
  return baseScale > 0 ? (scaled + baseScale) / 2 : scaled;
}

function gameIconScale(
  radius: number,
  scaleMode: 'component' | 'research' | 'structure',
  structureBasePlate = 1,
  componentScaleMultiplier = 1,
): number {
  if (scaleMode === 'component') {
    return rescaleButtonObject(radius, COMPONENT_BUTTON_SCALE, COMPONENT_RADIUS) * componentScaleMultiplier;
  }

  if (scaleMode === 'structure') {
    if (structureBasePlate === 1) return SMALL_STRUCTURE_SCALE;
    if (structureBasePlate === 2) return MEDIUM_STRUCTURE_SCALE;
    return LARGE_STRUCTURE_SCALE;
  }
  if (radius <= 100) return rescaleButtonObject(radius, COMPONENT_BUTTON_SCALE, COMPONENT_RADIUS);
  if (radius <= 128) return SMALL_STRUCTURE_SCALE;
  if (radius <= 256) return MEDIUM_STRUCTURE_SCALE;
  return LARGE_STRUCTURE_SCALE;
}

function isWallHardpointBase(model: string): boolean {
  return model.toLowerCase() === 'blguard1.pie';
}

async function addPart(group: THREE.Group, modelPart: ModelPart, previousConnector: THREE.Vector3 | null): Promise<{ connector: THREE.Vector3 | null; hasConnector: boolean; height: number; radius: number }> {
  const rendered = await createModelMesh(modelPart.model);
  if (modelPart.attachToPrevious && previousConnector) {
    rendered.mesh.position.copy(previousConnector);
  }

  group.add(rendered.mesh);

  if (rendered.connectors.length) {
    return {
      connector: rendered.connectors[0]!.clone().add(rendered.mesh.position),
      hasConnector: true,
      height: rendered.height,
      radius: rendered.radius,
    };
  }

  return {
    connector: previousConnector,
    hasConnector: false,
    height: rendered.height,
    radius: rendered.radius,
  };
}

async function loadModels(): Promise<void> {
  await nextTick();
  initScene();
  if (worker) {
    loading.value = true;
    error.value = null;
    postWorkerLoad();
    return;
  }

  const groupToLoad = props.groups[selected.value] ?? props.groups[0];
  if (!scene.value || !groupToLoad) return;

  loading.value = true;
  error.value = null;

  try {
    if (mesh.value) {
      scene.value.remove(mesh.value);
      disposeObject(mesh.value);
    }

    const group = new THREE.Group();
    group.rotation.y = INITIAL_Y_ROTATION;
    let previousConnector: THREE.Vector3 | null = null;
    let iconRadius = 1;
    let buttonOffsetY = 0;
    let buttonScaleMultiplier = 1;
    for (const modelPart of groupToLoad.parts.slice(0, 16)) {
      const result = await addPart(group, modelPart, previousConnector);
      if (
        group.children.length === 1
        && groupToLoad.scaleMode === 'structure'
        && groupToLoad.structureBasePlate === 1
        && isWallHardpointBase(modelPart.model)
        && result.hasConnector
        && result.height > 100
      ) {
        buttonOffsetY = -10;
        buttonScaleMultiplier = 1;
      }
      previousConnector = result.connector;
      iconRadius = result.radius;
    }
    if (groupToLoad.scaleMode === 'structure' && groupToLoad.structureBasePlate === 2) {
      buttonOffsetY += 8;
    }
    targetYRotation = INITIAL_Y_ROTATION;
    scene.value.add(group);
    mesh.value = group;
    fitCamera(
      group,
      groupToLoad.scaleMode === 'structure'
        ? 'base'
        : groupToLoad.scaleMode === 'research'
          ? 'origin'
          : groupToLoad.parts.some((part) => part.attachToPrevious)
            ? 'origin'
            : 'bbox',
    );
    if (props.compact) {
      const activeScaleMode = groupToLoad.scaleMode ?? props.scaleMode;
      group.scale.setScalar(gameIconScale(
        iconRadius,
        activeScaleMode,
        groupToLoad.structureBasePlate,
        groupToLoad.componentScaleMultiplier,
      ) * buttonScaleMultiplier / 100);
      group.position.y += buttonOffsetY;
    }
    renderScene();
    emit('ready');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'error';
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.groups,
  () => {
    selected.value = 0;
    void loadModels();
  },
  { deep: true, immediate: true },
);

watch(selected, loadModels);

watch(
  () => [props.rotate, props.scaleMode] as const,
  ([nextRotate, nextScaleMode], [, previousScaleMode]) => {
    if (worker) {
      worker.postMessage({
        type: 'props',
        rotate: nextRotate,
        scaleMode: nextScaleMode,
      });
    }
    if (!worker && frame.value === null && (nextRotate || needsReturnToInitial())) {
      frame.value = requestAnimationFrame(animate);
    }
    if (nextScaleMode !== previousScaleMode) void loadModels();
  },
);

onBeforeUnmount(() => {
  if (frame.value !== null) cancelAnimationFrame(frame.value);
  resizeObserver?.disconnect();
  worker?.postMessage({ type: 'dispose' });
  worker?.terminate();
  worker = null;
  workerReady = false;
  workerCanvas?.remove();
  workerCanvas = null;
  if (mesh.value) disposeObject(mesh.value);
  for (const texture of textureCache.values()) texture.dispose();
  renderer.value?.dispose();
  renderer.value?.domElement.remove();
});

nextTick(() => {
  initScene();
  animate();
});
</script>

<template>
  <div class="model-preview">
    <div ref="host" class="viewport" :class="{ compact }">
      <div v-if="showOverlay && loading" class="overlay">{{ t('model.loading') }}</div>
      <div v-else-if="showOverlay && error" class="overlay">{{ t('model.noModel') }}</div>
    </div>
    <div v-if="showTabs && groups.length > 1" class="model-tabs" :aria-label="t('model.variants')">
      <button
        v-for="(group, index) in groups"
        :key="group.id"
        class="model-tab"
        :class="{ active: index === selected }"
        :title="group.id"
        @click="selected = index"
      >
        {{ index + 1 }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.model-preview {
  display: grid;
  gap: 6px;
}
.viewport {
  position: relative;
  height: 160px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-node);
}
.viewport.compact {
  height: 100%;
  border: none;
  border-radius: 0;
  background: transparent;
}
.viewport :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--text-dim);
  font-size: 12px;
  background: rgba(31, 35, 53, 0.72);
}
.model-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.model-tab {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-node);
  color: var(--text);
  cursor: pointer;
}
.model-tab.active {
  border-color: var(--blue);
  color: var(--blue);
}
</style>
