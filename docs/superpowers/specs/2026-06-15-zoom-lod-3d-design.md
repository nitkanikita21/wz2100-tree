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

- In `ResearchNodeCard.vue`, read the reactive viewport via
  `useVueFlow().viewport` (the card is rendered inside `<VueFlow>`, so it shares
  the same store instance).
- Compute `showLive = selected || viewport.zoom >= LIVE_ZOOM_THRESHOLD`.
- `LIVE_ZOOM_THRESHOLD = 1.5` (Vue Flow `min-zoom` = 0.05, `max-zoom` = 2.0).
  Defined as a named constant so it is trivial to tune.
- Render `ResearchIconPreview` (live 3D) when `showLive`, otherwise the existing
  sprite block.
- Non-selected live nodes render **static** (`rotate` stays tied to
  `selected || hovered`), so the `requestAnimationFrame` loop in `ModelPreview`
  renders one frame and stops. Only the selected/hovered node animates.

### Why this is safe for CPU/GPU

- Vue Flow already has `:only-render-visible-elements="true"`, so off-screen
  cards unmount → their `ModelPreview` unmounts → worker terminates → WebGL
  context is freed. Only cards currently in the viewport hold a context.
- Static render = a single draw call per node, not a continuous loop.

### Known constraint (accepted, not solved here)

Each live preview is its own WebGL context (worker + `OffscreenCanvas`).
Browsers keep ~16 contexts before evicting the oldest. The 1.5 threshold keeps
the visible-node count low; if eviction flicker shows up in practice we raise
the threshold (or, as a later step, move to a single shared renderer that draws
all visible models onto one canvas). Out of scope for this change.

## Files touched

- `src/components/ResearchNodeCard.vue` — only file. Add the zoom read, the
  `showLive` computed + threshold constant, and switch the template condition
  from `selected` to `showLive` for the live/sprite branches.

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
