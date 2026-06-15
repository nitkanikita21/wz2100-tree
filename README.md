# WZ2100 Research Tree

An interactive research tree for **Warzone 2100** — all 390 technologies from the
game's multiplayer data (tag `4.7.0`). A static, backend-free SPA built with
Vite, Vue 3, TypeScript, Pinia and Vue Flow; the graph layout is precomputed
with elkjs at data-build time, and node icons are rendered live with Three.js.

## Features

- **Full tree** — zoom and pan, prerequisite-chain highlighting on hover or
  select, per-branch filters, and search with fly-to.
- **Live 3D previews** — each node shows its in-game model, rendered with
  Three.js. A zoom-based level-of-detail falls back to static sprites when
  zoomed out, so panning the whole tree stays smooth.
- **Details panel** — prerequisites, what a tech unlocks, minimum research time,
  stat upgrades, what it makes obsolete, and an auto-generated summary.
- **Planner** — pick goals and get an ordered research queue with every
  prerequisite resolved; reorder by drag-and-drop with conflict checks; keep
  multiple plans; import/export as JSON.
- **Game mode** — mark techs researched during a match and track plan progress.
- **Localization** — English and Ukrainian, switchable in-app (auto-detected and
  remembered). State persists to `localStorage`.

## Getting started

```bash
pnpm install
pnpm build:data   # generates src/data/research-4.7.0.json (needs internet)
pnpm icons        # downloads game icons into public/icons/ (needs internet)
pnpm dev          # http://localhost:5173
```

The generated data file is committed, so `build:data` and `icons` are only
needed for a fresh setup without icons or after bumping the game version.

Other scripts: `pnpm test` (Vitest), `pnpm build` (vue-tsc + vite build),
`pnpm preview`.

## Updating to a new game version

1. Change the `4.7.0` tag in `scripts/build-data.ts` and
   `scripts/download-icons.ts` to the target version.
2. Run `pnpm build:data && pnpm icons` to regenerate data and icons.
3. If the data file name changed (`src/data/research-<version>.json`), update the
   import in `src/stores/data.ts`.
4. Run `pnpm test && pnpm build` to confirm everything is green.

## Data license

Research data and icons come from
[Warzone 2100](https://github.com/Warzone2100/warzone2100) (GPL-2.0+).
