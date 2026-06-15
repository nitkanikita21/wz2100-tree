# Research detail panel: time, upgrades, descriptions

Port the useful per-research info from the betaguide
(`betaguide.wz2100.net/research.html`) into our `DetailsPanel`.

## Features (all approved)

1. **Minimum research time** — single value: `researchPoints / maxLabPower`.
2. **Result upgrades** — the stat modifiers from the game `results` field,
   rendered as readable Ukrainian lines (e.g. "Кіборги · Теплова броня +45%").
3. **Buildings / obsoletes** — `requiredStructures` (where it is researched) and
   `redComponents` / `redStructures` (what it renders obsolete).
4. **Auto description** — a short generated one-liner from upgrades + unlocks.

"Where it leads" already exists in the panel as the "Відкриває" block
(`data.index.unlocks`) — not re-implemented.

## Min research time formula

In WZ2100 a single research topic is worked by exactly one lab, so multiple labs
do not speed up one topic. The fastest a single topic can finish:

```
maxLabPower = (A0ResearchFacility.researchPoints + A0ResearchModule1.researchPoints)
              * (1 + sum(R-Struc-Research-Upgrade NN ResearchPoints %) / 100)
            = (14 + 12) * (1 + 270/100) = 26 * 3.7 = 96.2  (points/sec, v4.7.0)

minSeconds = researchPoints / maxLabPower
```

`maxLabPower` is computed at build time from the game stats and stored on
`ResearchData.maxLabResearchPoints`, so it stays correct if the version bumps.

## Data layer (build-time, regenerated)

- `src/types.ts`
  - new `ResearchResult { class: string; parameter: string; value: number; filterParameter?: string; filterValue?: string }`
  - `ResearchNode` gains `results`, `requiredStructures`, `redComponents`, `redStructures`
  - `ResearchData` gains `maxLabResearchPoints: number` and
    `componentNames: Record<string, string>`
- `scripts/lib/normalize.ts` — carry the new raw fields onto each node.
- `scripts/build-data.ts`
  - compute `maxLabResearchPoints` from `structure.json` + research-upgrade results
  - harvest `componentNames` for every id referenced by
    requiredStructures / redComponents / redStructures / resultComponents /
    resultStructures, reading `name` from the already-loaded stat files
    (~224 ids). Ids with no stat name are simply omitted (UI falls back to id).
- Re-run `pnpm build:data`. **Verify the diff adds only the new fields** —
  `modelGroups`, `x`, `y`, node order unchanged (source pinned to tag 4.7.0, ELK
  deterministic) so the prerendered sprite sheet stays valid.

## Logic layer — new `src/lib/researchResults.ts` (+ `.test.ts`)

- `minResearchSeconds(points, rate)` → number.
- `formatDuration(seconds)` → "м:сс" (e.g. "2:30").
- `formatResult(result, names)` → one readable UK line.
- `describeNode(node, names)` → short auto-description string ("" if nothing).
- Ukrainian label dictionaries for the 7 classes, 23 parameters, and the
  filter values (BodyClass / ImpactClass / Type / Id) that actually appear.
  Unknown keys fall back to the raw token so nothing crashes on a version bump.

## Store — `src/stores/data.ts`

Expose `maxLabResearchPoints` (number) and `componentNames` (as a `Map` for
lookups) from the loaded data.

## View — `src/components/DetailsPanel.vue`

Under the existing points/cost lines add, in order:

- **Мін. час** — `formatDuration(minResearchSeconds(node.points, rate))`.
- **Опис** — `describeNode(...)` (only if non-empty).
- **Покращення** — list of `formatResult(...)` for each `node.results`.
- **Досліджується в** — `requiredStructures` mapped through names.
- **Робить застарілим** — `redComponents` + `redStructures` mapped through names.

Names resolved via the store map, falling back to the raw id.

## Out of scope

- Full timeline simulation (betaguide's "time from game start").
- Pulling betaguide's GPL `properties_desription.js` — own labels instead.
- Friendly names for ids absent from the loaded stat files.

## Verification

- `pnpm build:data` diff is additive only (spot-check a node's modelGroups/x/y).
- `vue-tsc` clean, `vitest` green (incl. new `researchResults.test.ts`).
- `pnpm dev`: select R-Sys-Autorepair-General and a weapon-damage node; confirm
  time, upgrades, obsoletes, and description render with readable names.
