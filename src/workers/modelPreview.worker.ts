import * as THREE from 'three';
import { parsePieModel } from '../lib/pieModel';
import type { ModelGroup, ModelPart } from '../types';

type ScaleMode = 'component' | 'research' | 'structure';

type InitMessage = {
  type: 'init';
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  dpr: number;
  compact: boolean;
  rotate: boolean;
  scaleMode: ScaleMode;
};

type LoadMessage = {
  type: 'load';
  groups: ModelGroup[];
  selected: number;
};

type ResizeMessage = {
  type: 'resize';
  width: number;
  height: number;
  dpr: number;
};

type PropsMessage = {
  type: 'props';
  rotate: boolean;
  scaleMode: ScaleMode;
};

type WorkerMessage = InitMessage | LoadMessage | ResizeMessage | PropsMessage | { type: 'dispose' };

type RenderPart = {
  mesh: THREE.Mesh;
  connectors: THREE.Vector3[];
  height: number;
  radius: number;
};

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

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let mesh: THREE.Group | null = null;
let frameId: number | null = null;
let compact = false;
let rotate = true;
let scaleMode: ScaleMode = 'research';
let loadToken = 0;
let targetYRotation = INITIAL_Y_ROTATION;
const textureCache = new Map<string, THREE.Texture>();

function emitLoading(value: boolean): void {
  self.postMessage({ type: 'loading', value });
}

function emitError(message: string | null): void {
  self.postMessage({ type: 'error', message });
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

function disposeSceneMesh(): void {
  if (!scene || !mesh) return;
  scene.remove(mesh);
  disposeObject(mesh);
  mesh = null;
}

function makeBlackTransparentTexture(image: ImageBitmap): THREE.Texture {
  const canvas = new OffscreenCanvas(image.width, image.height);
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

  const response = await fetch(`/texpages/${texture}`);
  if (!response.ok) throw new Error(`${texture}: ${response.status} ${response.statusText}`);
  const blob = await response.blob();
  const loaded = blackTransparent
    ? makeBlackTransparentTexture(await createImageBitmap(blob))
    : new THREE.Texture(await createImageBitmap(blob, { imageOrientation: 'flipY' }));
  if (!blackTransparent) loaded.flipY = false;
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
  nextScaleMode: ScaleMode,
  structureBasePlate = 1,
  componentScaleMultiplier = 1,
): number {
  if (nextScaleMode === 'component') {
    return rescaleButtonObject(radius, COMPONENT_BUTTON_SCALE, COMPONENT_RADIUS) * componentScaleMultiplier;
  }

  if (nextScaleMode === 'structure') {
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

function fitCamera(group: THREE.Group, pivotMode: 'bbox' | 'base' | 'origin' = 'bbox'): number {
  if (!camera) return 1;
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
  if (compact) {
    camera.position.copy(COMPACT_CAMERA_POSITION);
  } else {
    camera.position.set(radius * 1.25, radius * 0.85, radius * 1.65);
  }
  camera.lookAt(0, 0, 0);
  camera.near = Math.max(0.1, radius / 100);
  camera.far = radius * 20;
  camera.updateProjectionMatrix();
  return radius;
}

function resize(width: number, height: number, dpr: number): void {
  if (!renderer || !camera) return;
  const nextWidth = Math.max(1, Math.floor(width));
  const nextHeight = Math.max(1, Math.floor(height));
  renderer.setPixelRatio(Math.min(dpr, compact ? 4 : 2));
  renderer.setSize(nextWidth, nextHeight, false);
  camera.aspect = nextWidth / nextHeight;
  camera.updateProjectionMatrix();
}

function render(): void {
  if (renderer && scene && camera) renderer.render(scene, camera);
}

function shortestAngleDelta(from: number, to: number): number {
  return THREE.MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
}

function needsReturnToInitial(): boolean {
  return Boolean(
    mesh
    && Math.abs(shortestAngleDelta(mesh.rotation.y, targetYRotation)) > ROTATION_EPSILON,
  );
}

function rotateTowardInitial(): boolean {
  if (!mesh) return false;
  const delta = shortestAngleDelta(mesh.rotation.y, targetYRotation);
  if (Math.abs(delta) <= ROTATION_EPSILON) {
    mesh.rotation.y = targetYRotation;
    return false;
  }
  mesh.rotation.y += Math.sign(delta) * Math.min(Math.abs(delta), RETURN_Y_ROTATION_SPEED);
  return true;
}

function updateRotation(): boolean {
  if (!mesh) return false;
  if (rotate) {
    mesh.rotation.y += Y_ROTATION_SPEED;
    return true;
  }
  return rotateTowardInitial();
}

function scheduleFrame(): void {
  if ((!rotate && !needsReturnToInitial()) || frameId !== null) return;
  const scope = self as typeof self & {
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame?: (handle: number) => void;
  };
  if (scope.requestAnimationFrame) {
    frameId = scope.requestAnimationFrame(animate);
  } else {
    frameId = self.setTimeout(animate, 16);
  }
}

function cancelFrame(): void {
  if (frameId === null) return;
  const scope = self as typeof self & {
    cancelAnimationFrame?: (handle: number) => void;
  };
  if (scope.cancelAnimationFrame) scope.cancelAnimationFrame(frameId);
  else clearTimeout(frameId);
  frameId = null;
}

function animate(): void {
  frameId = null;
  const keepAnimating = updateRotation();
  render();
  if (rotate || keepAnimating) scheduleFrame();
}

function init(message: InitMessage): void {
  compact = message.compact;
  rotate = message.rotate;
  scaleMode = message.scaleMode;

  scene = new THREE.Scene();
  scene.background = compact ? null : new THREE.Color(0x20223a);

  camera = new THREE.PerspectiveCamera(35, 1, 0.1, 5000);
  camera.position.set(120, 80, 180);

  renderer = new THREE.WebGLRenderer({
    canvas: message.canvas,
    antialias: true,
    alpha: compact,
  });
  if (compact) renderer.setClearAlpha(0);

  const ambient = new THREE.AmbientLight(0xc8d0ff, 1.35);
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  const fill = new THREE.DirectionalLight(0x93a8ff, 0.85);
  key.position.set(100, 160, 120);
  fill.position.set(-120, 80, -80);
  scene.add(ambient, key, fill);

  resize(message.width, message.height, message.dpr);
  render();
  scheduleFrame();
}

async function loadModels(groups: ModelGroup[], selected: number): Promise<void> {
  const token = ++loadToken;
  const groupToLoad = groups[selected] ?? groups[0];
  if (!scene || !groupToLoad) return;

  emitLoading(true);
  emitError(null);

  try {
    disposeSceneMesh();

    const group = new THREE.Group();
    group.rotation.y = INITIAL_Y_ROTATION;
    let previousConnector: THREE.Vector3 | null = null;
    let iconRadius = 1;
    let buttonOffsetY = 0;
    let buttonScaleMultiplier = 1;
    for (const modelPart of groupToLoad.parts.slice(0, 16)) {
      const result = await addPart(group, modelPart, previousConnector);
      if (token !== loadToken) {
        disposeObject(group);
        return;
      }
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
    scene.add(group);
    mesh = group;
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
    if (compact) {
      const activeScaleMode = groupToLoad.scaleMode ?? scaleMode;
      group.scale.setScalar(gameIconScale(
        iconRadius,
        activeScaleMode,
        groupToLoad.structureBasePlate,
        groupToLoad.componentScaleMultiplier,
      ) * buttonScaleMultiplier / 100);
      group.position.y += buttonOffsetY;
    }
    render();
    self.postMessage({ type: 'ready' });
  } catch (err) {
    emitError(err instanceof Error ? err.message : 'error');
  } finally {
    if (token === loadToken) emitLoading(false);
  }
}

function dispose(): void {
  cancelFrame();
  disposeSceneMesh();
  for (const texture of textureCache.values()) texture.dispose();
  textureCache.clear();
  renderer?.dispose();
  renderer = null;
  scene = null;
  camera = null;
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (message.type === 'init') {
    init(message);
    return;
  }
  if (message.type === 'resize') {
    resize(message.width, message.height, message.dpr);
    render();
    return;
  }
  if (message.type === 'props') {
    rotate = message.rotate;
    scaleMode = message.scaleMode;
    if (rotate) scheduleFrame();
    else {
      cancelFrame();
      if (needsReturnToInitial()) scheduleFrame();
      else render();
    }
    return;
  }
  if (message.type === 'load') {
    void loadModels(message.groups, message.selected);
    return;
  }
  dispose();
};
