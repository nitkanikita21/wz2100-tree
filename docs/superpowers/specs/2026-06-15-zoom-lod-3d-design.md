# Zoom-based LOD for live 3D node previews

## Problem

The research tree (`TreeCanvas` → `ResearchNodeCard`) renders live Three.js
previews only for the *selected* node; every other node shows a static sprite
from `/generated/research-models-sheet.png`.

We want the opposite gating to be driven by zoom:

- **Zoomed in enough** → render live 3D for *all visible* nodes.
- **Zoomed out** (you can't make out the model anyway) → no live 3D, just the
  static sprite. This is the performance win: at low zoom many nodes are on
  screen and spinning up a WebGL context per node lags.

## Approach

Gate the live preview on the current Vue Flow zoom level.

- `TreeCanvas.vue` owns the threshold. It already tracks `currentZoom` (from the
  `@viewport-change` event, also used by the on-screen zoom indicator) and
  derives `showLive = currentZoom >= LIVE_ZOOM_THRESHOLD`.
- `LIVE_ZOOM_THRESHOLD = 0.67` (Vue Flow `min-zoom` = 0.05, `max-zoom` = 2.0).
  Named constant, trivial to tune.
- `showLive` is passed to each card as the `:live` prop. Because it is a single
  boolean that flips only at the threshold boundary, visible cards re-render at
  the crossing — not on every fractional zoom tick.
- In `ResearchNodeCard.vue`, `showLive = props.live || selected`. The **selected**
  node stays live at any zoom (one node, one context — used for inspection).
- Render `ResearchIconPreview` (live 3D) when `showLive`, otherwise the existing
  sprite block. Sprite is shown until the live render emits `ready`, then the
  live layer crossfades in.
- Non-selected live nodes render **static** (`:rotate="selected"`), so the
  `requestAnimationFrame` loop in `ModelPreview` renders one frame and stops.
  Only the selected (and hovered) node animates.

### Why this is safe for CPU/GPU

- Vue Flow already has `:only-render-visible-elements="true"`, so off-screen
  cards unmount → their `ModelPreview` unmounts → worker terminates → WebGL
  context is freed. Only cards currently in the viewport hold a context.
- Static render = a single draw call per node, not a continuous loop.

### Known constraint (accepted, not solved here)

Each live preview is its own WebGL context (worker + `OffscreenCanvas`).
Browsers keep ~16 contexts before evicting the oldest. The 0.67 threshold is the
user's chosen feel; if eviction flicker shows up in practice we raise the
threshold (or, as a later step, move to a single shared renderer that draws all
visible models onto one canvas). Out of scope for this change.

## Files touched

- `src/components/TreeCanvas.vue` — threshold constant, `showLive` computed,
  pass `:live` to each card. (Already tracks `currentZoom` for the indicator.)
- `src/components/ResearchNodeCard.vue` — add `live` prop, `showLive` computed,
  switch the template conditions from `selected` to `showLive`.

## Out of scope

- Shared single-canvas renderer.
- Configurable-in-UI threshold (constant is enough for now).
- Changes to `ModelPreview` / the worker.

## Manual verification

1. `pnpm dev`, open the tree.
2. Fully zoomed out: cards show sprites, no jank when panning. No WebGL
   contexts spun up for non-selected nodes.
3. Zoom in past ~1.5: visible cards switch to live 3D; selected/hovered spins.
4. Zoom back out: live previews drop back to sprites.
5. Selecting a node still shows the rotating live 3D at any zoom.
