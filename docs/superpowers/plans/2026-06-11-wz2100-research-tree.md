# WZ2100 Research Tree — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Веб-апка для Warzone 2100: графічне дерево всіх 390 досліджень (скірміш/MP, дані гри 4.7.0) з планувальником «цілі → автоплан» і лайв-режимом ручного відмічання прогресу.

**Architecture:** Статична SPA без бекенду. Дані й розкладка дерева прекомпʼютяться build-скриптом (fetch research.json з репозиторію гри → нормалізація → валідація → ELK layered layout → JSON з готовими координатами). Рантайм: Pinia-стори (data/plans/session/ui) + Vue Flow канвас із кастомними вузлами; плани і лайв-сесія персистяться у localStorage. Чиста логіка (граф, автоплан, статуси) — окремі тестовані модулі.

**Tech Stack:** Vite, Vue 3 (Composition API, TypeScript), Pinia, @vue-flow/core, elkjs (лише build-скрипт), Vitest, tsx.

**Spec:** docs/superpowers/specs/2026-06-11-wz2100-research-tree-app-design.md

---

### Task 1: Scaffold проєкту (Vite + Vue 3 + TS + Pinia)

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/vite-env.d.ts`
- Create: `src/main.ts`
- Create: `src/style.css`
- Create: `src/App.vue`
- Create: `src/types.ts`
- Test: `src/smoke.test.ts`

- [ ] **Step 1: Створити package.json** — без залежностей у json (їх додасть `npm install` на Step 4), скрипти зафіксовані:

```json
{
  "name": "wz2100-tree",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "build:data": "tsx scripts/build-data.ts",
    "icons": "tsx scripts/download-icons.ts"
  }
}
```

- [ ] **Step 2: Створити index.html, tsconfig.json, tsconfig.node.json, vite.config.ts, src/vite-env.d.ts**

`index.html`:

```html
<!doctype html>
<html lang="uk">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WZ2100 Research Tree</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`tsconfig.json` — головний проєкт для `src/`. ВАЖЛИВО: свідомо БЕЗ `"references"` — TypeScript вимагає від referenced-проєктів `composite: true` і ввімкнений emit (помилки TS6306/TS6310), а спільний `src/types.ts` у двох проєктах ламає збірку (TS6305). Тому `vue-tsc -b` перевіряє лише `src/`, а `tsconfig.node.json` живе окремо — для редактора і ручної перевірки скриптів (`npx tsc -p tsconfig.node.json --noEmit`). Не «виправляй» це на project references:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue"]
}
```

`tsconfig.node.json` — окремий standalone-проєкт для build-скриптів і vite.config (включає `src/types.ts`, бо скрипти імпортують типи звідти):

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "noEmit": true,
    "strict": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "scripts/**/*.ts", "src/types.ts"]
}
```

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
  },
});
```

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 3: Створити src/types.ts, src/style.css, src/App.vue, src/main.ts**

`src/types.ts` — спільні типи всього проєкту (точний код, не міняти):

```ts
export type Branch =
  | 'weapon' | 'defence' | 'droid' | 'cyborg'
  | 'system' | 'structure' | 'power' | 'computer';

export interface ResearchNode {
  id: string;                // "R-Wpn-Cannon1Mk1"
  name: string;              // "Light Cannon" (EN, з даних гри)
  points: number;            // researchPoints
  branch: Branch;            // з iconID
  icon: string;              // "image_res_weapontech.png"
  subIcon: string | null;    // "image_res_grpdam.png" | null
  category: string | null;   // "Cannon Damage" | null
  prereqs: string[];         // requiredResearch
  resultComponents: string[];
  resultStructures: string[];
  x: number;                 // прекомпʼючені ELK-координати
  y: number;
}

export interface ResearchData {
  version: string;           // "4.7.0"
  nodeCount: number;
  nodes: ResearchNode[];
}

export interface Plan {
  id: string;                // crypto.randomUUID()
  name: string;
  goals: string[];           // research ids — цілі
  queue: string[];           // повна впорядкована черга (цілі + пререквізити)
}

export type NodeStatus = 'researched' | 'available' | 'locked';
```

`src/style.css` — токени теми Tokyo Night + CSS Vue Flow (Vite резолвить bare-імпорти пакетів у CSS):

```css
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';

:root {
  --bg: #1a1b26;
  --bg-panel: #16161e;
  --bg-node: #1f2335;
  --border: #3b4261;
  --text: #c0caf5;
  --text-dim: #565f89;
  --edge: #3b4261;
  --green: #9ece6a;  /* researched */
  --yellow: #e0af68; /* available */
  --blue: #7aa2f7;   /* planned / accent */
  --red: #f7768e;    /* конфлікти, скидання */
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, sans-serif;
}
```

`src/App.vue` — тимчасова заглушка (заміниться на сітку панелей у наступних задачах):

```vue
<script setup lang="ts"></script>

<template>
  <div class="splash">
    <h1>WZ2100 Research Tree</h1>
  </div>
</template>

<style scoped>
.splash {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}
</style>
```

`src/main.ts`:

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style.css';

createApp(App).use(createPinia()).mount('#app');
```

- [ ] **Step 4: Встановити залежності** — дві команди, останні версії (НЕ вписувати версії в package.json вручну):

Run:
```bash
npm install vue pinia @vue-flow/core elkjs
npm install -D vite @vitejs/plugin-vue typescript vue-tsc vitest happy-dom tsx @types/node
```
Expected: обидві завершуються `added N packages ... found 0 vulnerabilities`; у `package.json` зʼявилися секції `dependencies` (4 пакети) і `devDependencies` (8 пакетів); зʼявився `package-lock.json`.

- [ ] **Step 5: Запустити dev-сервер і перевірити очима**

Run:
```bash
npm run dev
```
Expected: у терміналі `VITE vX.Y.Z ready in ...ms` і `Local: http://localhost:5173/`. Відкрити http://localhost:5173 у браузері: темна сторінка (фон `#1a1b26`), по центру екрана світлий заголовок «WZ2100 Research Tree», у консолі браузера нема помилок. Зупинити сервер: `Ctrl+C`.

- [ ] **Step 6: Створити smoke-тест** `src/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('1 + 1 = 2', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Запустити тести**

Run:
```bash
npm test
```
Expected: PASS —
```
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

- [ ] **Step 8: Commit**

Run:
```bash
git add -A
git commit -m "chore: scaffold Vite + Vue 3 + TypeScript + Pinia project" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
Expected: коміт створено, `git status` чистий (node_modules/ і dist/ уже в .gitignore).

---

### Task 2: normalize() + validateGraph() (TDD)

**Files:**
- Create: `scripts/lib/normalize.ts`
- Test: `scripts/lib/normalize.test.ts`

Контекст для виконавця: сирий `research.json` гри — це обʼєкт `{id: запис}` із 390 записів. Поля `requiredResearch`/`resultComponents`/`resultStructures`/`subgroupIconID`/`category` опціональні. `normalize()` перетворює його на масив вузлів нашого формату (без координат), `validateGraph()` перевіряє цілісність графа і кидає `Error` з людським поясненням. Vitest за замовчуванням підхоплює `*.test.ts` і поза `src/`.

- [ ] **Step 1: Написати failing-тест** `scripts/lib/normalize.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalize, validateGraph, type RawResearch } from './normalize';

function fixture(): Record<string, RawResearch> {
  return {
    'R-Sys-Engineering01': {
      id: 'R-Sys-Engineering01',
      name: 'Engineering',
      iconID: 'IMAGE_RES_SYSTEMTECH',
      researchPoints: 600,
    },
    'R-Defense-HardcreteWall': {
      id: 'R-Defense-HardcreteWall',
      name: 'Hardcrete',
      iconID: 'IMAGE_RES_DEFENCE',
      researchPoints: 600,
      requiredResearch: ['R-Sys-Engineering01'],
      resultStructures: ['A0HardcreteMk1Wall'],
      category: 'Wall',
    },
    'R-Wpn-MG1Mk1': {
      id: 'R-Wpn-MG1Mk1',
      name: 'Machinegun',
      iconID: 'IMAGE_RES_WEAPONTECH',
      researchPoints: 100,
      resultComponents: ['MG1Mk1'],
      subgroupIconID: 'IMAGE_RES_GRPDAM',
      category: 'Machinegun',
    },
    'R-Wpn-MG2Mk1': {
      id: 'R-Wpn-MG2Mk1',
      name: 'Twin Machinegun',
      iconID: 'IMAGE_RES_WEAPONTECH',
      researchPoints: 500,
      requiredResearch: ['R-Wpn-MG1Mk1'],
      resultComponents: ['MG2Mk1'],
    },
  };
}

describe('normalize', () => {
  it('вузол без опціональних полів отримує дефолти', () => {
    const nodes = normalize(fixture());
    const eng = nodes.find((n) => n.id === 'R-Sys-Engineering01')!;
    expect(eng).toEqual({
      id: 'R-Sys-Engineering01',
      name: 'Engineering',
      points: 600,
      branch: 'system',
      icon: 'image_res_systemtech.png',
      subIcon: null,
      category: null,
      prereqs: [],
      resultComponents: [],
      resultStructures: [],
    });
  });

  it('переносить prereqs з requiredResearch', () => {
    const nodes = normalize(fixture());
    const wall = nodes.find((n) => n.id === 'R-Defense-HardcreteWall')!;
    expect(wall.prereqs).toEqual(['R-Sys-Engineering01']);
    expect(wall.branch).toBe('defence');
    expect(wall.category).toBe('Wall');
    expect(wall.resultStructures).toEqual(['A0HardcreteMk1Wall']);
  });

  it('мапить subgroupIconID у lowercase-файл і зберігає resultComponents', () => {
    const nodes = normalize(fixture());
    const mg = nodes.find((n) => n.id === 'R-Wpn-MG1Mk1')!;
    expect(mg.subIcon).toBe('image_res_grpdam.png');
    expect(mg.icon).toBe('image_res_weapontech.png');
    expect(mg.branch).toBe('weapon');
    expect(mg.resultComponents).toEqual(['MG1Mk1']);
  });
});

describe('validateGraph', () => {
  it('не кидає на коректному графі', () => {
    expect(() => validateGraph(normalize(fixture()))).not.toThrow();
  });

  it('кидає на невідомому iconID', () => {
    const raw = fixture();
    raw['R-Wpn-MG1Mk1']!.iconID = 'IMAGE_RES_LASERTECH';
    expect(() => validateGraph(normalize(raw))).toThrow(/IMAGE_RES_LASERTECH/);
  });

  it('кидає на відсутньому prereq-id', () => {
    const raw = fixture();
    raw['R-Wpn-MG2Mk1']!.requiredResearch = ['R-Wpn-Missing'];
    expect(() => validateGraph(normalize(raw))).toThrow(/R-Wpn-Missing/);
  });

  it('кидає на циклі A→B→A', () => {
    const raw = fixture();
    raw['R-Wpn-MG1Mk1']!.requiredResearch = ['R-Wpn-MG2Mk1'];
    expect(() => validateGraph(normalize(raw))).toThrow(/[Cc]ycle/);
  });
});
```

- [ ] **Step 2: Запустити тест, переконатися що падає**

Run:
```bash
npm test
```
Expected: FAIL — `scripts/lib/normalize.test.ts` падає з помилкою резолву імпорту: `Failed to resolve import "./normalize" from "scripts/lib/normalize.test.ts"` (файлу ще нема); `src/smoke.test.ts` проходить. Підсумок: `Test Files  1 failed | 1 passed (2)`.

- [ ] **Step 3: Мінімальна імплементація** `scripts/lib/normalize.ts`:

```ts
import type { Branch, ResearchNode } from '../../src/types';

/** Сирий запис із data/mp/stats/research.json (Warzone 2100). */
export interface RawResearch {
  id: string;
  name: string;
  iconID?: string;
  researchPoints: number;
  requiredResearch?: string[];
  resultComponents?: string[];
  resultStructures?: string[];
  subgroupIconID?: string;
  category?: string;
  [key: string]: unknown;
}

const ICON_TO_BRANCH: Record<string, Branch> = {
  IMAGE_RES_WEAPONTECH: 'weapon',
  IMAGE_RES_DEFENCE: 'defence',
  IMAGE_RES_DROIDTECH: 'droid',
  IMAGE_RES_CYBORGTECH: 'cyborg',
  IMAGE_RES_SYSTEMTECH: 'system',
  IMAGE_RES_STRUCTURETECH: 'structure',
  IMAGE_RES_POWERTECH: 'power',
  IMAGE_RES_COMPUTERTECH: 'computer',
};

const KNOWN_BRANCHES = new Set<string>(Object.values(ICON_TO_BRANCH));

export function normalize(raw: Record<string, RawResearch>): Omit<ResearchNode, 'x' | 'y'>[] {
  return Object.values(raw).map((r) => ({
    id: r.id,
    name: r.name,
    points: r.researchPoints,
    // Невідомий iconID дає undefined у branch — це ловить validateGraph.
    branch: ICON_TO_BRANCH[r.iconID ?? ''],
    icon: (r.iconID ?? '').toLowerCase() + '.png',
    subIcon: r.subgroupIconID ? r.subgroupIconID.toLowerCase() + '.png' : null,
    category: r.category ?? null,
    prereqs: r.requiredResearch ?? [],
    resultComponents: r.resultComponents ?? [],
    resultStructures: r.resultStructures ?? [],
  }));
}

export function validateGraph(nodes: Omit<ResearchNode, 'x' | 'y'>[]): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  for (const n of nodes) {
    if (!KNOWN_BRANCHES.has(n.branch as string)) {
      const iconId = n.icon.replace(/\.png$/, '').toUpperCase();
      throw new Error(`Unknown iconID "${iconId}" in research "${n.id}"`);
    }
    for (const p of n.prereqs) {
      if (!byId.has(p)) {
        throw new Error(`Research "${n.id}" requires missing prerequisite "${p}"`);
      }
    }
  }

  // Пошук циклів: DFS по prereqs, сірий вузол у стеку = цикл (шлях у повідомленні).
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];

  function visit(id: string): void {
    color.set(id, GRAY);
    stack.push(id);
    for (const p of byId.get(id)!.prereqs) {
      const c = color.get(p) ?? WHITE;
      if (c === GRAY) {
        const cycle = [...stack.slice(stack.indexOf(p)), p].join(' -> ');
        throw new Error(`Cycle detected in research graph: ${cycle}`);
      }
      if (c === WHITE) visit(p);
    }
    stack.pop();
    color.set(id, BLACK);
  }

  for (const n of nodes) {
    if ((color.get(n.id) ?? WHITE) === WHITE) visit(n.id);
  }
}
```

- [ ] **Step 4: Запустити тести, переконатися що проходять**

Run:
```bash
npm test
npx tsc -p tsconfig.node.json --noEmit
```
Expected: PASS — `Test Files  2 passed (2)`, `Tests  8 passed (8)`; `tsc` завершується без виводу, код виходу 0.

- [ ] **Step 5: Commit**

Run:
```bash
git add scripts/lib/normalize.ts scripts/lib/normalize.test.ts
git commit -m "feat: add research data normalization and graph validation" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: build-data — fetch + normalize + ELK layout + JSON

**Files:**
- Create: `scripts/build-data.ts`
- Create: `src/data/research-4.7.0.json` (генерується скриптом, комітиться)

Контекст: ELK-розкладка рахується ОДИН раз на етапі збірки даних, координати записуються в JSON — у рантаймі браузер нічого не розкладає. elkjs (0.11+) має типи для `lib/elk.bundled.js` (чистий JS без worker), тому імпорт типобезпечний.

- [ ] **Step 1: Написати** `scripts/build-data.ts`:

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import ELK from 'elkjs/lib/elk.bundled.js';
import { normalize, validateGraph, type RawResearch } from './lib/normalize';
import type { ResearchData, ResearchNode } from '../src/types';

const VERSION = '4.7.0';
const URL = `https://raw.githubusercontent.com/Warzone2100/warzone2100/${VERSION}/data/mp/stats/research.json`;
const OUT_FILE = `src/data/research-${VERSION}.json`;
const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;

async function main(): Promise<void> {
  console.log(`Завантаження ${URL} ...`);
  const res = await fetch(URL);
  if (!res.ok) {
    throw new Error(`Не вдалося завантажити research.json: HTTP ${res.status} ${res.statusText}`);
  }
  const raw = (await res.json()) as Record<string, RawResearch>;

  const bare = normalize(raw);
  validateGraph(bare);

  const edges = bare.flatMap((n) =>
    n.prereqs.map((p) => ({ id: `${p}->${n.id}`, sources: [p], targets: [n.id] })),
  );
  console.log(`Вузлів: ${bare.length}, ребер: ${edges.length}`);

  const elk = new ELK();
  const t0 = performance.now();
  const layout = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.spacing.nodeNode': '24',
    },
    children: bare.map((n) => ({ id: n.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges,
  });
  console.log(`ELK layout: ${Math.round(performance.now() - t0)} мс`);

  const pos = new Map(layout.children!.map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]));
  const nodes: ResearchNode[] = bare.map((n) => ({ ...n, ...pos.get(n.id)! }));

  const data: ResearchData = { version: VERSION, nodeCount: nodes.length, nodes };
  await mkdir('src/data', { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(data));
  console.log(`Записано ${OUT_FILE} (${nodes.length} вузлів)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Запустити генерацію даних**

Run:
```bash
npm run build:data
```
Expected (час layout може відрізнятися, порядок — сотні мс; кількості — точні):
```
Завантаження https://raw.githubusercontent.com/Warzone2100/warzone2100/4.7.0/data/mp/stats/research.json ...
Вузлів: 390, ребер: 547
ELK layout: ~400 мс
Записано src/data/research-4.7.0.json (390 вузлів)
```

- [ ] **Step 3: Перевірити згенерований файл і типи скрипта**

Run:
```bash
node -e "
const d = require('./src/data/research-4.7.0.json');
console.log('version:', d.version, '| nodeCount:', d.nodeCount, '| nodes.length:', d.nodes.length);
console.log('всі мають x/y:', d.nodes.every(n => typeof n.x === 'number' && typeof n.y === 'number'));
console.log(JSON.stringify(d.nodes.find(n => n.id === 'R-Defense-HardcreteWall')));
"
npx tsc -p tsconfig.node.json --noEmit
```
Expected:
```
version: 4.7.0 | nodeCount: 390 | nodes.length: 390
всі мають x/y: true
{"id":"R-Defense-HardcreteWall","name":"Hardcrete","points":600,"branch":"defence","icon":"image_res_defence.png","subIcon":null,"category":null,"prereqs":["R-Sys-Engineering01"],"resultComponents":[],"resultStructures":["A0HardcreteMk1CWall","A0HardcreteMk1Wall"],"x":...,"y":...}
```
(`x`/`y` — числа, точні значення залежать від версії elkjs). `tsc` — без помилок. Розмір файлу ~116 КБ (`du -h src/data/research-4.7.0.json`). Файл НЕ потрапляє під .gitignore — переконатися, що `git status` показує його як untracked.

- [ ] **Step 4: Commit**

Run:
```bash
git add scripts/build-data.ts src/data/research-4.7.0.json
git commit -m "data: generate precomputed research graph for 4.7.0" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: download-icons — 13 PNG з репозиторію гри

**Files:**
- Create: `scripts/download-icons.ts`
- Create: `public/icons/` (13 PNG + LICENSE.txt, генерується скриптом, комітиться)

- [ ] **Step 1: Написати** `scripts/download-icons.ts`:

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const VERSION = '4.7.0';
const BASE = `https://raw.githubusercontent.com/Warzone2100/warzone2100/${VERSION}/data/base/images/intfac`;
const OUT_DIR = 'public/icons';

const ICONS = [
  'image_res_weapontech.png',
  'image_res_defence.png',
  'image_res_droidtech.png',
  'image_res_cyborgtech.png',
  'image_res_systemtech.png',
  'image_res_structuretech.png',
  'image_res_powertech.png',
  'image_res_computertech.png',
  'image_res_grpacc.png',
  'image_res_grpdam.png',
  'image_res_grprep.png',
  'image_res_grprof.png',
  'image_res_grpupg.png',
];

const LICENSE =
  'Icons from Warzone 2100 (GPL-2.0+), https://github.com/Warzone2100/warzone2100\n';

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  for (const name of ICONS) {
    const res = await fetch(`${BASE}/${name}`);
    if (!res.ok) {
      throw new Error(`Не вдалося завантажити ${name}: HTTP ${res.status} ${res.statusText}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(OUT_DIR, name), buf);
    console.log(`OK ${name} (${buf.length} байт)`);
  }
  await writeFile(path.join(OUT_DIR, 'LICENSE.txt'), LICENSE);
  console.log(`Готово: ${ICONS.length} іконок + LICENSE.txt у ${OUT_DIR}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Запустити скачування і перевірити вміст public/icons**

Run:
```bash
npm run icons
ls public/icons
ls public/icons | wc -l
```
Expected: 13 рядків `OK image_res_*.png (NNN байт)` (файли маленькі, 150–280 байт — це нормально, іконки 21x19 px) і фінальний `Готово: 13 іконок + LICENSE.txt у public/icons/`. `ls` показує 13 png + `LICENSE.txt`, `wc -l` дає `14`.

- [ ] **Step 3: Commit**

Run:
```bash
git add scripts/download-icons.ts public/icons
git commit -m "chore: download research branch icons from game repo" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Графова логіка — `buildIndex`, `prereqClosure`, `topoSort` + спільна тестова фікстура

Передумови: проєкт заскаффолджений попередніми завданнями — існують `src/types.ts` (з типами `Branch`, `ResearchNode` тощо) і `vite.config.ts` з `test: { environment: 'happy-dom' }`, залежності встановлені (`vitest` працює).

**Files:**
- Create: `src/lib/testFixture.ts`
- Create: `src/lib/graph.ts`
- Test: `src/lib/graph.test.ts`

- [ ] **Step 1: Написати failing-тест** — спочатку створити спільну фікстуру `src/lib/testFixture.ts` (її реюзають тести planner/nodeState/stores у наступних завданнях, тому `makeNode` і `fixtureNodes` ОБОВʼЯЗКОВО експортовані):

  ```ts
  // src/lib/testFixture.ts
  import type { Branch, ResearchNode } from '../types';

  export function makeNode(
    id: string,
    prereqs: string[] = [],
    points = 100,
    branch: Branch = 'weapon',
  ): ResearchNode {
    return {
      id,
      name: `Name of ${id}`,
      points,
      branch,
      icon: 'image_res_weapontech.png',
      subIcon: null,
      category: null,
      prereqs,
      resultComponents: [],
      resultStructures: [],
      x: 0,
      y: 0,
    };
  }

  // Граф фікстури (стрілка = "потрібен для"):
  //   A ──> C ──> E        A(100) B(50) C(200)
  //   A ──> D ──> E        D(150) E(300) F(80)
  //   B ──> D
  //   B ──> F
  export const fixtureNodes: ResearchNode[] = [
    makeNode('A', [], 100),
    makeNode('B', [], 50),
    makeNode('C', ['A'], 200),
    makeNode('D', ['A', 'B'], 150, 'defence'),
    makeNode('E', ['C', 'D'], 300, 'system'),
    makeNode('F', ['B'], 80, 'power'),
  ];
  ```

  Потім тест:

  ```ts
  // src/lib/graph.test.ts
  import { describe, expect, it } from 'vitest';
  import { buildIndex, prereqClosure, topoSort } from './graph';
  import { fixtureNodes, makeNode } from './testFixture';

  describe('buildIndex', () => {
    it('indexes nodes by id', () => {
      const index = buildIndex(fixtureNodes);
      expect(index.byId.size).toBe(6);
      expect(index.byId.get('C')?.prereqs).toEqual(['A']);
    });

    it('builds reverse edges (unlocks) for every node', () => {
      const index = buildIndex(fixtureNodes);
      expect(index.unlocks.get('A')).toEqual(['C', 'D']);
      expect(index.unlocks.get('B')).toEqual(['D', 'F']);
      expect(index.unlocks.get('C')).toEqual(['E']);
      expect(index.unlocks.get('D')).toEqual(['E']);
      expect(index.unlocks.get('E')).toEqual([]);
      expect(index.unlocks.get('F')).toEqual([]);
    });
  });

  describe('prereqClosure', () => {
    it('includes the target itself plus all transitive prereqs', () => {
      const index = buildIndex(fixtureNodes);
      expect(prereqClosure(index, ['E'])).toEqual(new Set(['A', 'B', 'C', 'D', 'E']));
    });

    it('merges closures of multiple targets without duplicates', () => {
      const index = buildIndex(fixtureNodes);
      expect(prereqClosure(index, ['C', 'F'])).toEqual(new Set(['A', 'B', 'C', 'F']));
    });

    it('node without prereqs closes onto itself only', () => {
      const index = buildIndex(fixtureNodes);
      expect(prereqClosure(index, ['B'])).toEqual(new Set(['B']));
    });
  });

  describe('topoSort', () => {
    it('places every node after all of its prereqs', () => {
      const index = buildIndex(fixtureNodes);
      const order = topoSort(index, new Set(['A', 'B', 'C', 'D', 'E', 'F']));
      const pos = new Map(order.map((id, i) => [id, i]));
      for (const node of fixtureNodes) {
        for (const p of node.prereqs) {
          expect(pos.get(p)!).toBeLessThan(pos.get(node.id)!);
        }
      }
    });

    it('is deterministic: among ready nodes picks the one with fewer points', () => {
      const index = buildIndex(fixtureNodes);
      const order = topoSort(index, new Set(['A', 'B', 'C', 'D', 'E', 'F']));
      expect(order).toEqual(['B', 'F', 'A', 'D', 'C', 'E']);
    });

    it('breaks point ties by lexicographically smaller id', () => {
      const index = buildIndex([makeNode('Z'), makeNode('Y'), makeNode('X')]);
      expect(topoSort(index, new Set(['Z', 'Y', 'X']))).toEqual(['X', 'Y', 'Z']);
    });

    it('sorts only the given subset, ignoring prereqs outside it', () => {
      const index = buildIndex(fixtureNodes);
      expect(topoSort(index, prereqClosure(index, ['E']))).toEqual(['B', 'A', 'D', 'C', 'E']);
    });
  });
  ```

- [ ] **Step 2: Запустити тест, переконатися що падає** — Run: `npx vitest run src/lib/graph.test.ts`. Expected: FAIL — Vitest не може зарезолвити імпорт `./graph` (помилка виду `Failed to resolve import "./graph"` / `Cannot find module`), бо файлу `src/lib/graph.ts` ще не існує.

- [ ] **Step 3: Мінімальна імплементація** — створити `src/lib/graph.ts`:

  ```ts
  // src/lib/graph.ts
  import type { ResearchNode } from '../types';

  export interface GraphIndex {
    byId: Map<string, ResearchNode>;
    unlocks: Map<string, string[]>; // reverse edges: id -> nodes that list it in prereqs
  }

  export function buildIndex(nodes: ResearchNode[]): GraphIndex {
    const byId = new Map<string, ResearchNode>();
    const unlocks = new Map<string, string[]>();
    for (const node of nodes) {
      byId.set(node.id, node);
      if (!unlocks.has(node.id)) unlocks.set(node.id, []);
    }
    for (const node of nodes) {
      for (const p of node.prereqs) {
        const list = unlocks.get(p);
        if (list) list.push(node.id);
        else unlocks.set(p, [node.id]);
      }
    }
    return { byId, unlocks };
  }

  // Closure of prerequisites: targets INCLUDED + all transitive prereqs.
  export function prereqClosure(index: GraphIndex, targetIds: string[]): Set<string> {
    const closure = new Set<string>();
    const stack = [...targetIds];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (closure.has(id)) continue;
      const node = index.byId.get(id);
      if (!node) throw new Error(`Unknown research id: ${id}`);
      closure.add(id);
      for (const p of node.prereqs) stack.push(p);
    }
    return closure;
  }

  // Deterministic Kahn toposort of a subset: among ready nodes picks the one
  // with fewer points; on a tie — the lexicographically smaller id.
  // Prereqs outside the subset are ignored.
  export function topoSort(index: GraphIndex, ids: Set<string>): string[] {
    const inDegree = new Map<string, number>();
    for (const id of ids) {
      const node = index.byId.get(id);
      if (!node) throw new Error(`Unknown research id: ${id}`);
      inDegree.set(id, node.prereqs.filter((p) => ids.has(p)).length);
    }
    const result: string[] = [];
    while (result.length < ids.size) {
      let best: string | null = null;
      for (const [id, deg] of inDegree) {
        if (deg !== 0) continue;
        if (best === null) {
          best = id;
          continue;
        }
        const a = index.byId.get(id)!;
        const b = index.byId.get(best)!;
        if (a.points < b.points || (a.points === b.points && a.id < b.id)) best = id;
      }
      if (best === null) throw new Error('Cycle detected in research graph');
      inDegree.delete(best);
      result.push(best);
      for (const next of index.unlocks.get(best) ?? []) {
        if (inDegree.has(next)) inDegree.set(next, inDegree.get(next)! - 1);
      }
    }
    return result;
  }
  ```

  Лінійний скан претендентів дає O(n²) — для 390 вузлів це миттєво, зате код тривіально детермінований.

- [ ] **Step 4: Запустити тести, переконатися що проходять** — Run: `npx vitest run src/lib/graph.test.ts`, Expected: PASS, 9 passed. Потім `npm test` — усі тести проєкту зелені.

- [ ] **Step 5: Commit** —
  ```sh
  git add src/lib/testFixture.ts src/lib/graph.ts src/lib/graph.test.ts
  git commit -m "feat: add graph lib (buildIndex, prereqClosure, topoSort) with shared test fixture

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

### Task 6: Планувальник — `buildQueue`, `removeGoalFromPlan`, `canMove`, `moveItem`

**Files:**
- Create: `src/lib/planner.ts`
- Test: `src/lib/planner.test.ts`

- [ ] **Step 1: Написати failing-тест** — очікувані черги виведені з фікстури Task 5 (points: A=100, B=50, C=200, D=150, E=300, F=80):

  ```ts
  // src/lib/planner.test.ts
  import { describe, expect, it } from 'vitest';
  import type { Plan } from '../types';
  import { buildIndex } from './graph';
  import { buildQueue, canMove, moveItem, removeGoalFromPlan } from './planner';
  import { fixtureNodes } from './testFixture';

  const index = buildIndex(fixtureNodes);
  const none = new Set<string>();

  describe('buildQueue', () => {
    it('single goal: goal plus all transitive prereqs in topo order', () => {
      expect(buildQueue(index, ['E'], none)).toEqual(['B', 'A', 'D', 'C', 'E']);
    });

    it('two goals: shared prereqs appear exactly once', () => {
      // C and D share prereq A
      const queue = buildQueue(index, ['C', 'D'], none);
      expect(queue).toEqual(['B', 'A', 'D', 'C']);
      expect(queue.filter((id) => id === 'A')).toHaveLength(1);
    });

    it('researched nodes are excluded from the queue', () => {
      expect(buildQueue(index, ['E'], new Set(['A', 'B']))).toEqual(['D', 'C', 'E']);
    });
  });

  describe('removeGoalFromPlan', () => {
    const plan: Plan = {
      id: 'p1',
      name: 'Test plan',
      goals: ['E', 'F'],
      queue: ['B', 'F', 'A', 'D', 'C', 'E'], // = buildQueue(index, ['E','F'], none)
    };

    it('drops the goal and prereqs not needed by remaining goals', () => {
      const next = removeGoalFromPlan(index, plan, 'E', none);
      expect(next.goals).toEqual(['F']);
      expect(next.queue).toEqual(['B', 'F']); // A, C, D, E gone; B kept for F
    });

    it('keeps prereqs still needed by another goal', () => {
      const next = removeGoalFromPlan(index, plan, 'F', none);
      expect(next.goals).toEqual(['E']);
      expect(next.queue).toEqual(['B', 'A', 'D', 'C', 'E']); // B stays: E needs it via D
    });

    it('does not mutate the input plan', () => {
      removeGoalFromPlan(index, plan, 'E', none);
      expect(plan.goals).toEqual(['E', 'F']);
      expect(plan.queue).toEqual(['B', 'F', 'A', 'D', 'C', 'E']);
    });
  });

  describe('canMove', () => {
    const queue = ['B', 'A', 'D', 'C', 'E'];

    it('moving an item before its prereq is rejected with conflictId', () => {
      // C (idx 3) moved to idx 1 lands before its prereq A
      expect(canMove(index, queue, 3, 1)).toEqual({ ok: false, conflictId: 'A' });
    });

    it('a valid move is allowed', () => {
      // B (idx 0) -> idx 1: nothing between depends on B
      expect(canMove(index, queue, 0, 1)).toEqual({ ok: true });
    });
  });

  describe('moveItem', () => {
    it('returns a new array with the item moved to the target index', () => {
      expect(moveItem(['A', 'B', 'C'], 0, 2)).toEqual(['B', 'C', 'A']);
      expect(moveItem(['A', 'B', 'C'], 2, 0)).toEqual(['C', 'A', 'B']);
    });

    it('does not mutate the input array', () => {
      const queue = ['A', 'B', 'C'];
      moveItem(queue, 0, 2);
      expect(queue).toEqual(['A', 'B', 'C']);
    });
  });
  ```

- [ ] **Step 2: Запустити тест, переконатися що падає** — Run: `npx vitest run src/lib/planner.test.ts`. Expected: FAIL — нерозрезолвлений імпорт `./planner` (файл ще не існує).

- [ ] **Step 3: Мінімальна імплементація** — створити `src/lib/planner.ts`:

  ```ts
  // src/lib/planner.ts
  import type { Plan } from '../types';
  import { prereqClosure, topoSort, type GraphIndex } from './graph';

  // Queue = topoSort(prereqClosure(goals)) minus researched.
  export function buildQueue(
    index: GraphIndex,
    goals: string[],
    researched: Set<string>,
  ): string[] {
    if (goals.length === 0) return [];
    const closure = prereqClosure(index, goals);
    return topoSort(index, closure).filter((id) => !researched.has(id));
  }

  // Removes the goal; prereqs not needed by remaining goals disappear
  // automatically because the queue is rebuilt via buildQueue.
  export function removeGoalFromPlan(
    index: GraphIndex,
    plan: Plan,
    goalId: string,
    researched: Set<string>,
  ): Plan {
    const goals = plan.goals.filter((g) => g !== goalId);
    return { ...plan, goals, queue: buildQueue(index, goals, researched) };
  }

  // Pure reorder: removes the item at fromIdx and inserts it at toIdx
  // (index in the resulting array). Does not mutate the input.
  export function moveItem(queue: string[], fromIdx: number, toIdx: number): string[] {
    const copy = [...queue];
    const [item] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, item);
    return copy;
  }

  // Checks the reordered queue: every node must come after all of its prereqs
  // that are also in the queue. conflictId = the prereq that would end up
  // after its dependant.
  export function canMove(
    index: GraphIndex,
    queue: string[],
    fromIdx: number,
    toIdx: number,
  ): { ok: true } | { ok: false; conflictId: string } {
    const moved = moveItem(queue, fromIdx, toIdx);
    const inQueue = new Set(moved);
    const seen = new Set<string>();
    for (const id of moved) {
      const node = index.byId.get(id);
      if (!node) throw new Error(`Unknown research id in queue: ${id}`);
      for (const p of node.prereqs) {
        if (inQueue.has(p) && !seen.has(p)) return { ok: false, conflictId: p };
      }
      seen.add(id);
    }
    return { ok: true };
  }
  ```

- [ ] **Step 4: Запустити тести, переконатися що проходять** — Run: `npx vitest run src/lib/planner.test.ts`, Expected: PASS, 10 passed. Потім `npm test` — усі зелені (graph-тести не зламані).

- [ ] **Step 5: Commit** —
  ```sh
  git add src/lib/planner.ts src/lib/planner.test.ts
  git commit -m "feat: add planner lib (buildQueue, removeGoalFromPlan, canMove, moveItem)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

### Task 7: Статуси вузлів — `computeStatuses`

**Files:**
- Create: `src/lib/nodeState.ts`
- Test: `src/lib/nodeState.test.ts`

- [ ] **Step 1: Написати failing-тест**:

  ```ts
  // src/lib/nodeState.test.ts
  import { describe, expect, it } from 'vitest';
  import { buildIndex } from './graph';
  import { computeStatuses } from './nodeState';
  import { fixtureNodes } from './testFixture';

  const index = buildIndex(fixtureNodes);

  describe('computeStatuses', () => {
    it('empty researched: only nodes without prereqs are available', () => {
      const statuses = computeStatuses(index, new Set());
      expect(statuses.get('A')).toBe('available');
      expect(statuses.get('B')).toBe('available');
      expect(statuses.get('C')).toBe('locked');
      expect(statuses.get('D')).toBe('locked');
      expect(statuses.get('E')).toBe('locked');
      expect(statuses.get('F')).toBe('locked');
    });

    it('partially researched chain', () => {
      const statuses = computeStatuses(index, new Set(['B']));
      expect(statuses.get('B')).toBe('researched');
      expect(statuses.get('F')).toBe('available'); // its only prereq B is done
      expect(statuses.get('D')).toBe('locked'); // still needs A
      expect(statuses.get('A')).toBe('available');
      expect(statuses.get('E')).toBe('locked');
    });

    it('all prereqs researched -> available', () => {
      const statuses = computeStatuses(index, new Set(['A', 'B', 'C', 'D']));
      expect(statuses.get('E')).toBe('available');
      expect(statuses.get('F')).toBe('available');
      expect(statuses.get('C')).toBe('researched');
    });

    it('covers every node in the index', () => {
      const statuses = computeStatuses(index, new Set());
      expect(statuses.size).toBe(fixtureNodes.length);
    });
  });
  ```

- [ ] **Step 2: Запустити тест, переконатися що падає** — Run: `npx vitest run src/lib/nodeState.test.ts`. Expected: FAIL — нерозрезолвлений імпорт `./nodeState` (файл ще не існує).

- [ ] **Step 3: Мінімальна імплементація** — створити `src/lib/nodeState.ts`. Нагадування з контракту: «у плані» — це НЕ статус, а окремий boolean (входження в queue активного плану), його комбінує UI; тому тут лише три статуси:

  ```ts
  // src/lib/nodeState.ts
  import type { NodeStatus } from '../types';
  import type { GraphIndex } from './graph';

  // researched -> 'researched'; otherwise all prereqs researched -> 'available';
  // otherwise 'locked'.
  export function computeStatuses(
    index: GraphIndex,
    researched: Set<string>,
  ): Map<string, NodeStatus> {
    const statuses = new Map<string, NodeStatus>();
    for (const node of index.byId.values()) {
      if (researched.has(node.id)) statuses.set(node.id, 'researched');
      else if (node.prereqs.every((p) => researched.has(p))) statuses.set(node.id, 'available');
      else statuses.set(node.id, 'locked');
    }
    return statuses;
  }
  ```

- [ ] **Step 4: Запустити тести, переконатися що проходять** — Run: `npx vitest run src/lib/nodeState.test.ts`, Expected: PASS, 4 passed. Потім `npm test` — усі зелені.

- [ ] **Step 5: Commit** —
  ```sh
  git add src/lib/nodeState.ts src/lib/nodeState.test.ts
  git commit -m "feat: add nodeState lib (computeStatuses)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

### Task 8: Обгортка localStorage — `src/lib/storage.ts`

**Files:**
- Create: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

- [ ] **Step 1: Написати failing-тест** — `localStorage` доступний завдяки `environment: 'happy-dom'` у `vite.config.ts`:

  ```ts
  // src/lib/storage.test.ts
  import { beforeEach, describe, expect, it } from 'vitest';
  import { clear, load, save } from './storage';

  describe('storage', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('save -> load round-trip preserves the value', () => {
      save('x', { a: 1, list: ['q'], nested: { b: true } });
      expect(load<{ a: number; list: string[]; nested: { b: boolean } }>('x')).toEqual({
        ok: true,
        value: { a: 1, list: ['q'], nested: { b: true } },
      });
    });

    it('stores under the versioned prefix wz2100-tree:v1:', () => {
      save('x', 42);
      expect(localStorage.getItem('wz2100-tree:v1:x')).toBe('42');
    });

    it('missing key -> { ok: false, reason: "missing" }', () => {
      expect(load('nope')).toEqual({ ok: false, reason: 'missing' });
    });

    it('corrupt JSON -> { ok: false, reason: "corrupt" }', () => {
      localStorage.setItem('wz2100-tree:v1:x', '{oops');
      expect(load('x')).toEqual({ ok: false, reason: 'corrupt' });
    });

    it('clear removes the key', () => {
      save('x', 1);
      clear('x');
      expect(load('x')).toEqual({ ok: false, reason: 'missing' });
      expect(localStorage.getItem('wz2100-tree:v1:x')).toBeNull();
    });
  });
  ```

- [ ] **Step 2: Запустити тест, переконатися що падає** — Run: `npx vitest run src/lib/storage.test.ts`. Expected: FAIL — нерозрезолвлений імпорт `./storage` (файл ще не існує).

- [ ] **Step 3: Мінімальна імплементація** — створити `src/lib/storage.ts` (точний код з контракту; зміна версії схеми даних у майбутньому = зміна `PREFIX`, старі ключі просто ігноруються):

  ```ts
  // src/lib/storage.ts
  const PREFIX = 'wz2100-tree:v1:';

  export type LoadResult<T> =
    | { ok: true; value: T }
    | { ok: false; reason: 'missing' | 'corrupt' };

  export function load<T>(key: string): LoadResult<T> {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return { ok: false, reason: 'missing' };
    try {
      return { ok: true, value: JSON.parse(raw) as T };
    } catch {
      return { ok: false, reason: 'corrupt' };
    }
  }

  export function save(key: string, value: unknown): void {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  }

  export function clear(key: string): void {
    localStorage.removeItem(PREFIX + key);
  }
  ```

- [ ] **Step 4: Запустити тести, переконатися що проходять** — Run: `npx vitest run src/lib/storage.test.ts`, Expected: PASS, 5 passed. Потім `npm test` — Expected: усі тест-файли `src/lib/*` зелені (graph 9, planner 10, nodeState 4, storage 5).

- [ ] **Step 5: Commit** —
  ```sh
  git add src/lib/storage.ts src/lib/storage.test.ts
  git commit -m "feat: add versioned localStorage wrapper (load/save/clear)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9: Data store — статичний граф + vue-flow nodes/edges

Передумови: існують `src/data/research-4.7.0.json` (Task 3), `src/types.ts` (Task 1), `src/lib/graph.ts` (Task 5), встановлені залежності `pinia` і `@vue-flow/core` (Task 1).

Стор без персистенсу і без юніт-тестів: це тривіальний маппінг даних у формат vue-flow, його коректність гарантує компілятор (`vue-tsc`) і далі — інтеграція в `TreeCanvas.vue`. `nodes` та `index` зберігаються як звичайні (нереактивні) значення — дані статичні й ніколи не змінюються після завантаження.

**Files:**
- Create: `src/stores/data.ts`

- [ ] **Step 1: Написати src/stores/data.ts** — повний вміст файлу:

```ts
import { computed } from 'vue';
import { defineStore } from 'pinia';
import type { Node, Edge } from '@vue-flow/core';
import type { ResearchData, ResearchNode } from '../types';
import { buildIndex } from '../lib/graph';
import rawData from '../data/research-4.7.0.json';

const data = rawData as unknown as ResearchData;

export const useDataStore = defineStore('data', () => {
  // Статичні дані: нереактивні навмисно — граф не змінюється після завантаження.
  const nodes: ResearchNode[] = data.nodes;
  const index = buildIndex(nodes);

  const flowNodes = computed<Node[]>(() =>
    nodes.map((n) => ({
      id: n.id,
      position: { x: n.x, y: n.y },
      type: 'research',
      data: { node: n },
    })),
  );

  const flowEdges = computed<Edge[]>(() =>
    nodes.flatMap((n) =>
      n.prereqs.map((p) => ({
        id: `${p}->${n.id}`,
        source: p,
        target: n.id,
      })),
    ),
  );

  return { nodes, index, flowNodes, flowEdges };
});
```

- [ ] **Step 2: Перевірити типи** — Run: `npx vue-tsc -b && echo OK`. Expected: вивід `OK`, без помилок компіляції. Якщо зʼявляється помилка `TS2732: Cannot find module '../data/research-4.7.0.json'. Consider using '--resolveJsonModule'` — додати `"resolveJsonModule": true` у `compilerOptions` файлу `tsconfig.json` і повторити команду (у Task 1 воно вже є — це підстраховка).

- [ ] **Step 3: Commit** —
```bash
cd /home/nitka/CODING/wz2100-tree
git add src/stores/data.ts
git commit -m "feat: add data store with precomputed vue-flow nodes and edges

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10 (TDD): Plans store — плани, черга, персистенс

Стор планів за контрактом. `index` береться з `useDataStore` (реальний JSON, згенерований у Task 3), тому тести пишуться проти реальних id: `R-Sys-Engineering01` (без пререквізитів) і `R-Defense-HardcreteWall` (єдиний пререквізит — `R-Sys-Engineering01`). Уся логіка побудови/перестановки черги — чисті функції з `src/lib/planner.ts` (Task 6); стор лише оркеструє стан і персистенс.

Персистенс: відновлення з `load('plans')` у момент створення стора + `watch` із `deep: true` → `save`. Watch має дефолтний flush `'pre'` (спрацьовує на мікротаску), тому в тестах персистенсу перед перечитуванням стора робимо `await nextTick()`.

`researched` у цьому таску — тимчасова заглушка (порожній `Set`): session store зʼявиться лише в Task 11 і тоді буде підключений. Це позначено коментарем у коді й замінюється точним diff-ом у Task 11.

**Files:**
- Test: `src/stores/plans.test.ts`
- Create: `src/stores/plans.ts`

- [ ] **Step 1: Написати failing-тест** — повний вміст `src/stores/plans.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import { usePlansStore } from './plans';

// Реальні id з research-4.7.0.json:
// R-Sys-Engineering01 — без пререквізитів; R-Defense-HardcreteWall — prereq: R-Sys-Engineering01.
const ENG = 'R-Sys-Engineering01';
const WALL = 'R-Defense-HardcreteWall';

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

describe('usePlansStore', () => {
  it('addGoal створює план, якщо його нема, і будує чергу з пререквізитами', () => {
    const store = usePlansStore();
    expect(store.plans).toHaveLength(0);
    store.addGoal(WALL);
    expect(store.plans).toHaveLength(1);
    expect(store.activePlan?.goals).toEqual([WALL]);
    expect(store.activePlan?.queue).toEqual([ENG, WALL]);
    expect(store.plannedSet.has(ENG)).toBe(true);
  });

  it('повторний addGoal тієї самої цілі не дублює її', () => {
    const store = usePlansStore();
    store.addGoal(WALL);
    store.addGoal(WALL);
    expect(store.activePlan?.goals).toEqual([WALL]);
    expect(store.activePlan?.queue).toEqual([ENG, WALL]);
  });

  it('createPlan стає активним, setActive перемикає, deletePlan скидає активний', () => {
    const store = usePlansStore();
    store.createPlan('Перший');
    const firstId = store.activePlanId!;
    store.createPlan('Другий');
    expect(store.activePlan?.name).toBe('Другий');
    store.setActive(firstId);
    expect(store.activePlan?.name).toBe('Перший');
    store.deletePlan(firstId);
    expect(store.plans).toHaveLength(1);
    expect(store.activePlan?.name).toBe('Другий');
  });

  it('removeGoal прибирає ціль і непотрібні пререквізити з черги', () => {
    const store = usePlansStore();
    store.addGoal(WALL);
    store.removeGoal(WALL);
    expect(store.activePlan?.goals).toEqual([]);
    expect(store.activePlan?.queue).toEqual([]);
  });

  it('moveQueueItem відхиляє конфліктне переміщення і не змінює чергу', () => {
    const store = usePlansStore();
    store.addGoal(WALL);
    // Спроба поставити пререквізит (ENG, idx 0) після залежного (WALL, idx 1).
    const res = store.moveQueueItem(0, 1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect([ENG, WALL]).toContain(res.conflictId);
    expect(store.activePlan?.queue).toEqual([ENG, WALL]);
  });

  it('exportActive → importPlan: round-trip створює еквівалентний план', () => {
    const store = usePlansStore();
    store.addGoal(WALL);
    store.renamePlan(store.activePlanId!, 'Мій план');
    const json = store.exportActive();
    const res = store.importPlan(json);
    expect(res).toEqual({ ok: true });
    expect(store.plans).toHaveLength(2);
    expect(store.activePlan?.name).toBe('Мій план');
    expect(store.activePlan?.goals).toEqual([WALL]);
    expect(store.activePlan?.queue).toEqual([ENG, WALL]);
    expect(store.plans[0].id).not.toBe(store.plans[1].id);
  });

  it('importPlan з невідомим id повертає помилку, що містить цей id', () => {
    const store = usePlansStore();
    const res = store.importPlan(
      JSON.stringify({ id: 'x', name: 'Поганий', goals: ['R-Fake-Tech'], queue: [] }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('R-Fake-Tech');
    expect(store.plans).toHaveLength(0);
  });

  it('персистенс: новий pinia відновлює плани з localStorage', async () => {
    const store = usePlansStore();
    store.addGoal(WALL);
    const savedActiveId = store.activePlanId;
    await nextTick(); // watch має flush 'pre' — чекаємо мікротаск
    setActivePinia(createPinia());
    const fresh = usePlansStore();
    expect(fresh.plans).toHaveLength(1);
    expect(fresh.activePlanId).toBe(savedActiveId);
    expect(fresh.activePlan?.queue).toEqual([ENG, WALL]);
  });

  it('corrupt у localStorage → storageCorrupt, resetStorage повертає чистий стан', async () => {
    localStorage.setItem('wz2100-tree:v1:plans', '{broken json');
    const store = usePlansStore();
    expect(store.storageCorrupt).toBe(true);
    expect(store.plans).toEqual([]);
    store.resetStorage();
    expect(store.storageCorrupt).toBe(false);
    await nextTick();
    setActivePinia(createPinia());
    const fresh = usePlansStore();
    expect(fresh.storageCorrupt).toBe(false);
    expect(fresh.plans).toEqual([]);
  });
});
```

- [ ] **Step 2: Запустити тест, переконатися що падає** — Run: `npx vitest run src/stores/plans.test.ts`. Expected: FAIL — помилка резолву імпорту: `Failed to resolve import "./plans" from "src/stores/plans.test.ts"` (файла стора ще не існує).

- [ ] **Step 3: Мінімальна імплементація** — повний вміст `src/stores/plans.ts`:

```ts
import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import type { Plan } from '../types';
import { buildQueue, removeGoalFromPlan, canMove, moveItem } from '../lib/planner';
import { load, save, clear } from '../lib/storage';
import { useDataStore } from './data';

interface PlansPersist {
  plans: Plan[];
  activePlanId: string | null;
}

export const usePlansStore = defineStore('plans', () => {
  const dataStore = useDataStore();

  const plans = ref<Plan[]>([]);
  const activePlanId = ref<string | null>(null);
  const storageCorrupt = ref(false);

  // Відновлення з localStorage у момент створення стора.
  const restored = load<PlansPersist>('plans');
  if (restored.ok) {
    plans.value = restored.value.plans;
    activePlanId.value = restored.value.activePlanId;
  } else if (restored.reason === 'corrupt') {
    storageCorrupt.value = true;
  }

  // Будь-яка зміна (включно з мутаціями всередині планів) → save.
  watch(
    [plans, activePlanId],
    () => {
      save('plans', { plans: plans.value, activePlanId: activePlanId.value });
    },
    { deep: true },
  );

  const activePlan = computed<Plan | null>(
    () => plans.value.find((p) => p.id === activePlanId.value) ?? null,
  );

  const plannedSet = computed<Set<string>>(
    () => new Set(activePlan.value?.queue ?? []),
  );

  // Тимчасово: до появи session store (Task 11) вважаємо, що нічого не досліджено.
  function researchedSet(): Set<string> {
    return new Set();
  }

  function createPlan(name: string): void {
    const plan: Plan = { id: crypto.randomUUID(), name, goals: [], queue: [] };
    plans.value.push(plan);
    activePlanId.value = plan.id;
  }

  function renamePlan(id: string, name: string): void {
    const plan = plans.value.find((p) => p.id === id);
    if (plan) plan.name = name;
  }

  function deletePlan(id: string): void {
    plans.value = plans.value.filter((p) => p.id !== id);
    if (activePlanId.value === id) {
      activePlanId.value = plans.value.length > 0 ? plans.value[0].id : null;
    }
  }

  function setActive(id: string): void {
    if (plans.value.some((p) => p.id === id)) activePlanId.value = id;
  }

  function addGoal(researchId: string): void {
    if (!dataStore.index.byId.has(researchId)) return;
    if (activePlan.value === null) createPlan('Новий план');
    const plan = activePlan.value!;
    if (!plan.goals.includes(researchId)) plan.goals.push(researchId);
    plan.queue = buildQueue(dataStore.index, plan.goals, researchedSet());
  }

  function removeGoal(researchId: string): void {
    const plan = activePlan.value;
    if (plan === null) return;
    const updated = removeGoalFromPlan(dataStore.index, plan, researchId, researchedSet());
    const idx = plans.value.findIndex((p) => p.id === plan.id);
    plans.value[idx] = updated;
  }

  function moveQueueItem(
    fromIdx: number,
    toIdx: number,
  ): { ok: true } | { ok: false; conflictId: string } {
    const plan = activePlan.value;
    if (plan === null) return { ok: true };
    const check = canMove(dataStore.index, plan.queue, fromIdx, toIdx);
    if (!check.ok) return check;
    plan.queue = moveItem(plan.queue, fromIdx, toIdx);
    return { ok: true };
  }

  function exportActive(): string {
    return JSON.stringify(activePlan.value, null, 2);
  }

  function importPlan(json: string): { ok: true } | { ok: false; error: string } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ok: false, error: 'Некоректний JSON' };
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return { ok: false, error: 'Невірний формат плану' };
    }
    const candidate = parsed as { name?: unknown; goals?: unknown };
    if (typeof candidate.name !== 'string' || !Array.isArray(candidate.goals)) {
      return { ok: false, error: 'Невірний формат плану: очікуються поля name і goals' };
    }
    const goals: string[] = [];
    for (const goal of candidate.goals) {
      if (typeof goal !== 'string' || !dataStore.index.byId.has(goal)) {
        return { ok: false, error: `Невідоме дослідження: ${String(goal)}` };
      }
      goals.push(goal);
    }
    const plan: Plan = {
      id: crypto.randomUUID(),
      name: candidate.name,
      goals,
      queue: buildQueue(dataStore.index, goals, researchedSet()),
    };
    plans.value.push(plan);
    activePlanId.value = plan.id;
    return { ok: true };
  }

  function rebuildQueues(): void {
    const researched = researchedSet();
    for (const plan of plans.value) {
      plan.queue = buildQueue(dataStore.index, plan.goals, researched);
    }
  }

  function resetStorage(): void {
    clear('plans');
    plans.value = [];
    activePlanId.value = null;
    storageCorrupt.value = false;
  }

  return {
    plans,
    activePlanId,
    activePlan,
    plannedSet,
    storageCorrupt,
    createPlan,
    renamePlan,
    deletePlan,
    setActive,
    addGoal,
    removeGoal,
    moveQueueItem,
    exportActive,
    importPlan,
    rebuildQueues,
    resetStorage,
  };
});
```

- [ ] **Step 4: Запустити тести, переконатися що проходять** — Run: `npx vitest run src/stores/plans.test.ts && npx vue-tsc -b && echo OK`. Expected: `Test Files 1 passed`, `Tests 9 passed`, потім `OK` (типи чисті).

- [ ] **Step 5: Commit** —
```bash
cd /home/nitka/CODING/wz2100-tree
git add src/stores/plans.ts src/stores/plans.test.ts
git commit -m "feat: add plans store with queue building and localStorage persistence

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11 (TDD): Session store — прогрес гри + інтеграція з планами

Стор лайв-сесії за контрактом: `researched` як `Set<string>`, `statuses` через чисту `computeStatuses` (Task 7), персистенс key `'session'` у форматі `{researched: string[], gameMode: boolean}` (Set серіалізується масивом). Ключова інтеграція: `mark`/`unmark`/`newGame` наприкінці викликають `usePlansStore().rebuildQueues()` — черги планів автоматично скорочуються/відновлюються при зміні прогресу. Для цього `plans.ts` модифікується: заглушка `researchedSet()` починає брати реальний Set із session store.

Циклічний імпорт `plans.ts ↔ session.ts` безпечний: обидва модулі викликають `useSessionStore()` / `usePlansStore()` лише всередині тіл функцій (лінива розвʼязка під час виклику action), а не під час оцінки модуля чи setup-функції стора.

**Files:**
- Test: `src/stores/session.test.ts`
- Create: `src/stores/session.ts`
- Modify: `src/stores/plans.ts`

- [ ] **Step 1: Написати failing-тест** — повний вміст `src/stores/session.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import { useSessionStore } from './session';
import { usePlansStore } from './plans';

// Реальні id з research-4.7.0.json (як у plans.test.ts).
const ENG = 'R-Sys-Engineering01';
const WALL = 'R-Defense-HardcreteWall';

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

describe('useSessionStore', () => {
  it('mark робить вузол researched, а залежний стає available', () => {
    const session = useSessionStore();
    expect(session.statuses.get(ENG)).toBe('available'); // без пререквізитів
    expect(session.statuses.get(WALL)).toBe('locked');
    session.mark(ENG);
    expect(session.researched.has(ENG)).toBe(true);
    expect(session.statuses.get(ENG)).toBe('researched');
    expect(session.statuses.get(WALL)).toBe('available');
  });

  it('mark скорочує чергу активного плану', () => {
    const plans = usePlansStore();
    const session = useSessionStore();
    plans.addGoal(WALL);
    expect(plans.activePlan?.queue).toEqual([ENG, WALL]);
    session.mark(ENG);
    expect(plans.activePlan?.queue).toEqual([WALL]);
    session.unmark(ENG);
    expect(plans.activePlan?.queue).toEqual([ENG, WALL]);
  });

  it('toggle перемикає статус туди й назад', () => {
    const session = useSessionStore();
    session.toggle(ENG);
    expect(session.researched.has(ENG)).toBe(true);
    session.toggle(ENG);
    expect(session.researched.has(ENG)).toBe(false);
    expect(session.statuses.get(ENG)).toBe('available');
  });

  it('toggleGameMode перемикає режим гри', () => {
    const session = useSessionStore();
    expect(session.gameMode).toBe(false);
    session.toggleGameMode();
    expect(session.gameMode).toBe(true);
  });

  it('newGame очищає researched і перебудовує черги планів', () => {
    const plans = usePlansStore();
    const session = useSessionStore();
    plans.addGoal(WALL);
    session.mark(ENG);
    expect(plans.activePlan?.queue).toEqual([WALL]);
    session.newGame();
    expect(session.researched.size).toBe(0);
    expect(plans.activePlan?.queue).toEqual([ENG, WALL]);
  });

  it('персистенс: новий pinia відновлює researched і gameMode', async () => {
    const session = useSessionStore();
    session.mark(ENG);
    session.toggleGameMode();
    await nextTick(); // watch має flush 'pre' — чекаємо мікротаск
    setActivePinia(createPinia());
    const fresh = useSessionStore();
    expect(fresh.researched.has(ENG)).toBe(true);
    expect(fresh.gameMode).toBe(true);
  });

  it('corrupt у localStorage → storageCorrupt, resetStorage повертає дефолт', () => {
    localStorage.setItem('wz2100-tree:v1:session', '???not json');
    const session = useSessionStore();
    expect(session.storageCorrupt).toBe(true);
    expect(session.researched.size).toBe(0);
    session.resetStorage();
    expect(session.storageCorrupt).toBe(false);
    expect(session.gameMode).toBe(false);
  });
});
```

- [ ] **Step 2: Запустити тест, переконатися що падає** — Run: `npx vitest run src/stores/session.test.ts`. Expected: FAIL — `Failed to resolve import "./session" from "src/stores/session.test.ts"` (файла стора ще не існує).

- [ ] **Step 3: Мінімальна імплементація** — дві частини.

Частина А — повний вміст нового файлу `src/stores/session.ts`:

```ts
import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import type { NodeStatus } from '../types';
import { computeStatuses } from '../lib/nodeState';
import { load, save, clear } from '../lib/storage';
import { useDataStore } from './data';
import { usePlansStore } from './plans';

interface SessionPersist {
  researched: string[];
  gameMode: boolean;
}

export const useSessionStore = defineStore('session', () => {
  const dataStore = useDataStore();

  const researched = ref(new Set<string>());
  const gameMode = ref(false);
  const storageCorrupt = ref(false);

  // Відновлення з localStorage у момент створення стора.
  const restored = load<SessionPersist>('session');
  if (restored.ok) {
    researched.value = new Set(restored.value.researched);
    gameMode.value = restored.value.gameMode;
  } else if (restored.reason === 'corrupt') {
    storageCorrupt.value = true;
  }

  watch(
    [researched, gameMode],
    () => {
      save('session', {
        researched: [...researched.value],
        gameMode: gameMode.value,
      });
    },
    { deep: true },
  );

  const statuses = computed<Map<string, NodeStatus>>(() =>
    computeStatuses(dataStore.index, researched.value),
  );

  function mark(id: string): void {
    researched.value.add(id);
    usePlansStore().rebuildQueues();
  }

  function unmark(id: string): void {
    researched.value.delete(id);
    usePlansStore().rebuildQueues();
  }

  function toggle(id: string): void {
    if (researched.value.has(id)) {
      unmark(id);
    } else {
      mark(id);
    }
  }

  function toggleGameMode(): void {
    gameMode.value = !gameMode.value;
  }

  // confirm перед очищенням робить UI, не стор.
  function newGame(): void {
    researched.value = new Set();
    usePlansStore().rebuildQueues();
  }

  function resetStorage(): void {
    clear('session');
    researched.value = new Set();
    gameMode.value = false;
    storageCorrupt.value = false;
  }

  return {
    researched,
    gameMode,
    statuses,
    storageCorrupt,
    mark,
    unmark,
    toggle,
    toggleGameMode,
    newGame,
    resetStorage,
  };
});
```

Частина Б — точний diff у `src/stores/plans.ts` (підключення реального прогресу). Заміна 1 — блок імпортів, було:

```ts
import { useDataStore } from './data';
```

стало:

```ts
import { useDataStore } from './data';
import { useSessionStore } from './session';
```

Заміна 2 — заглушка, було:

```ts
  // Тимчасово: до появи session store (Task 11) вважаємо, що нічого не досліджено.
  function researchedSet(): Set<string> {
    return new Set();
  }
```

стало:

```ts
  // Прогрес береться з session store; виклик лінивий (усередині функції),
  // тому циклічний імпорт plans ↔ session безпечний.
  function researchedSet(): Set<string> {
    return useSessionStore().researched;
  }
```

Тести Task 10 при цьому залишаються зеленими: у них session store піднімається з порожнім `researched` (localStorage очищено в beforeEach), тож черги будуються так само.

- [ ] **Step 4: Запустити тести, переконатися що проходять** — Run: `npx vitest run && npx vue-tsc -b && echo OK`. Expected: усі тест-файли проєкту PASS, зокрема `src/stores/session.test.ts` (7 passed) і `src/stores/plans.test.ts` (9 passed, регресії нема); наприкінці `OK`.

- [ ] **Step 5: Commit** —
```bash
cd /home/nitka/CODING/wz2100-tree
git add src/stores/session.ts src/stores/session.test.ts src/stores/plans.ts
git commit -m "feat: add session store and wire researched progress into plan queues

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: UI-стор, каркас App.vue, TopBar і заглушки панелей

Мета: зібрати повний каркас застосунку — стор UI-стану (вибір/ховер/фільтр гілок/fly-to), сітку розкладки з контракту та заглушки всіх панелей, щоб проєкт компілювався і виглядав як майбутній застосунок.

**Files:**
- Create: `src/stores/ui.ts`
- Create: `src/components/TopBar.vue`
- Create: `src/components/TreeCanvas.vue` (заглушка)
- Create: `src/components/DetailsPanel.vue` (заглушка)
- Create: `src/components/PlanPanel.vue` (заглушка)
- Create: `src/components/GamePanel.vue` (заглушка)
- Create: `src/components/BranchFilter.vue` (заглушка)
- Create: `src/components/SearchBox.vue` (заглушка)
- Modify: `src/App.vue` (повна заміна вмісту)

- [ ] **Step 1: Написати `src/stores/ui.ts`** — повний код стора за контрактом (без персистенсу). `highlightSet` — замикання пререквізитів від `hoveredId ?? selectedId`:

```ts
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { Branch } from '../types';
import { prereqClosure } from '../lib/graph';
import { useDataStore } from './data';

const ALL_BRANCHES: Branch[] = [
  'weapon', 'defence', 'droid', 'cyborg',
  'system', 'structure', 'power', 'computer',
];

export const useUiStore = defineStore('ui', () => {
  const data = useDataStore();

  const enabledBranches = ref<Set<Branch>>(new Set(ALL_BRANCHES));
  function toggleBranch(b: Branch): void {
    const next = new Set(enabledBranches.value);
    if (next.has(b)) next.delete(b);
    else next.add(b);
    enabledBranches.value = next; // заміна цілим Set — надійна реактивність
  }

  const selectedId = ref<string | null>(null);
  function select(id: string | null): void {
    selectedId.value = id;
  }

  const hoveredId = ref<string | null>(null);
  function setHovered(id: string | null): void {
    hoveredId.value = id;
  }

  const flyToRequest = ref<string | null>(null);
  function flyTo(id: string): void {
    flyToRequest.value = id;
  }
  function clearFlyTo(): void {
    flyToRequest.value = null;
  }

  const highlightSet = computed<Set<string>>(() => {
    const focus = hoveredId.value ?? selectedId.value;
    if (!focus) return new Set<string>();
    return prereqClosure(data.index, [focus]);
  });

  return {
    enabledBranches, toggleBranch,
    selectedId, select,
    hoveredId, setHovered,
    flyToRequest, flyTo, clearFlyTo,
    highlightSet,
  };
});
```

- [ ] **Step 2: Написати 6 файлів-заглушок** — кожен компілюється сам по собі, без скриптів. Точний вміст кожного файлу:

`src/components/TreeCanvas.vue`:
```vue
<template>
  <div class="stub">TreeCanvas — заглушка</div>
</template>

<style scoped>
.stub {
  display: flex; align-items: center; justify-content: center;
  height: 100%; box-sizing: border-box;
  color: var(--text-dim); font-size: 13px;
}
</style>
```

`src/components/DetailsPanel.vue`:
```vue
<template>
  <div class="stub">DetailsPanel — заглушка</div>
</template>

<style scoped>
.stub {
  padding: 16px; color: var(--text-dim); font-size: 13px;
  border-bottom: 1px solid var(--border);
}
</style>
```

`src/components/PlanPanel.vue`:
```vue
<template>
  <div class="stub">PlanPanel — заглушка</div>
</template>

<style scoped>
.stub {
  padding: 16px; color: var(--text-dim); font-size: 13px;
  border-bottom: 1px solid var(--border);
}
</style>
```

`src/components/GamePanel.vue`:
```vue
<template>
  <div class="stub">GamePanel — заглушка</div>
</template>

<style scoped>
.stub {
  padding: 16px; color: var(--text-dim); font-size: 13px;
  border-bottom: 1px solid var(--border);
}
</style>
```

`src/components/BranchFilter.vue`:
```vue
<template>
  <div class="stub">BranchFilter — заглушка</div>
</template>

<style scoped>
.stub {
  padding: 16px; color: var(--text-dim); font-size: 13px;
}
</style>
```

`src/components/SearchBox.vue` (поки ніде не монтується, зʼявиться в TopBar у Task 14):
```vue
<template>
  <div class="stub">SearchBox — заглушка</div>
</template>

<style scoped>
.stub {
  color: var(--text-dim); font-size: 13px;
}
</style>
```

- [ ] **Step 3: Написати `src/components/TopBar.vue`** — назва, порожній слот під SearchBox, стилізований checkbox «▶ Гра», який викликає `session.toggleGameMode()`:

```vue
<script setup lang="ts">
import { useSessionStore } from '../stores/session';

const session = useSessionStore();
</script>

<template>
  <header class="topbar">
    <h1 class="title">Warzone 2100 — Дерево досліджень</h1>
    <div class="search-slot">
      <!-- SearchBox зʼявиться тут у Task 14 -->
    </div>
    <label class="game-toggle" :class="{ on: session.gameMode }">
      <input
        type="checkbox"
        :checked="session.gameMode"
        @change="session.toggleGameMode()"
      />
      <span>▶ Гра</span>
    </label>
  </header>
</template>

<style scoped>
.topbar {
  display: flex; align-items: center; gap: 16px;
  height: 100%; padding: 0 16px; box-sizing: border-box;
  background: var(--bg-panel); border-bottom: 1px solid var(--border);
}
.title {
  margin: 0; font-size: 15px; font-weight: 600;
  color: var(--text); white-space: nowrap;
}
.search-slot { flex: 1; display: flex; justify-content: center; }
.game-toggle {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 12px; border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-dim); cursor: pointer; user-select: none; white-space: nowrap;
}
.game-toggle input { display: none; }
.game-toggle.on { border-color: var(--green); color: var(--green); }
</style>
```

- [ ] **Step 4: Замінити `src/App.vue` фінальною розкладкою** — CSS grid: рядок 48px (TopBar на всю ширину), нижче три колонки 200px / 1fr / 320px; права колонка зі скролом, GamePanel між DetailsPanel і PlanPanel тільки у `gameMode`. Повний вміст файлу:

```vue
<script setup lang="ts">
import TopBar from './components/TopBar.vue';
import BranchFilter from './components/BranchFilter.vue';
import TreeCanvas from './components/TreeCanvas.vue';
import DetailsPanel from './components/DetailsPanel.vue';
import GamePanel from './components/GamePanel.vue';
import PlanPanel from './components/PlanPanel.vue';
import { useSessionStore } from './stores/session';

const session = useSessionStore();
</script>

<template>
  <div class="app">
    <header class="area-topbar"><TopBar /></header>
    <aside class="area-sidebar"><BranchFilter /></aside>
    <main class="area-canvas"><TreeCanvas /></main>
    <aside class="area-right">
      <DetailsPanel />
      <GamePanel v-if="session.gameMode" />
      <PlanPanel />
    </aside>
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-rows: 48px 1fr;
  grid-template-columns: 200px 1fr 320px;
  grid-template-areas:
    'topbar topbar topbar'
    'sidebar canvas right';
  height: 100vh;
  background: var(--bg);
  color: var(--text);
}
.area-topbar { grid-area: topbar; min-width: 0; }
.area-sidebar {
  grid-area: sidebar; min-height: 0; overflow-y: auto;
  background: var(--bg-panel); border-right: 1px solid var(--border);
}
.area-canvas { grid-area: canvas; min-width: 0; min-height: 0; }
.area-right {
  grid-area: right; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column;
  background: var(--bg-panel); border-left: 1px solid var(--border);
}
</style>
```

- [ ] **Step 5: Перевірити в браузері** — Run: `npm run dev`, відкрити http://localhost:5173. Expected:
  - зверху панель 48px: назва «Warzone 2100 — Дерево досліджень» зліва, тумблер «▶ Гра» справа;
  - зліва колонка 200px з текстом «BranchFilter — заглушка»;
  - по центру «TreeCanvas — заглушка»;
  - справа колонка 320px: «DetailsPanel — заглушка» зверху, «PlanPanel — заглушка» під нею;
  - клік по «▶ Гра» → тумблер стає зеленим і між Details і Plan зʼявляється «GamePanel — заглушка»; повторний клік — зникає; після F5 стан тумблера зберігається (персистенс session);
  - у консолі браузера немає помилок.

- [ ] **Step 6: Commit** — Run:
```bash
git add src/stores/ui.ts src/components/TopBar.vue src/components/TreeCanvas.vue src/components/DetailsPanel.vue src/components/PlanPanel.vue src/components/GamePanel.vue src/components/BranchFilter.vue src/components/SearchBox.vue src/App.vue
git commit -m "feat: add ui store, app shell layout and panel stubs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 13: TreeCanvas на Vue Flow і картка вузла ResearchNodeCard

Мета: відрендерити дерево 390 вузлів із прекомпʼюченими координатами, кастомною карткою вузла (статус/план/притемнення) і підсвіткою ланцюжка пререквізитів на hover/клік.

**Files:**
- Modify: `src/components/TreeCanvas.vue` (повна заміна заглушки)
- Create: `src/components/ResearchNodeCard.vue`

- [ ] **Step 1: Переконатися, що CSS Vue Flow підключений** — Run: `grep -n "@vue-flow" src/style.css`. Expected: два рядки імпортів. Якщо їх немає — додати НА ПОЧАТОК `src/style.css` (до інших правил):
```css
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
```

- [ ] **Step 2: Написати `src/components/ResearchNodeCard.vue`** — обовʼязкові `Handle` left/right (без них ребра не намалюються), іконка гілки, subIcon-бейдж, назва, очки; класи стану з сторів. Повний код:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import type { ResearchNode } from '../types';
import { useSessionStore } from '../stores/session';
import { usePlansStore } from '../stores/plans';
import { useUiStore } from '../stores/ui';

const props = defineProps<{
  id: string;
  data: { node: ResearchNode };
}>();

const session = useSessionStore();
const plans = usePlansStore();
const ui = useUiStore();

const status = computed(() => session.statuses.get(props.id) ?? 'locked');
const planned = computed(() => plans.plannedSet.has(props.id));
const dimmed = computed(() => {
  const branchOff = !ui.enabledBranches.has(props.data.node.branch);
  const hl = ui.highlightSet;
  const outsideHighlight = hl.size > 0 && !hl.has(props.id);
  return branchOff || outsideHighlight;
});
</script>

<template>
  <div class="card" :class="[status, { planned, dimmed }]" :title="data.node.name">
    <Handle type="target" :position="Position.Left" />
    <img class="icon" :src="`/icons/${data.node.icon}`" :alt="data.node.branch" />
    <div class="body">
      <div class="name">{{ data.node.name }}</div>
      <div class="points">{{ data.node.points }} оч.</div>
    </div>
    <img
      v-if="data.node.subIcon"
      class="sub-icon"
      :src="`/icons/${data.node.subIcon}`"
      alt=""
    />
    <Handle type="source" :position="Position.Right" />
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
.card.dimmed { opacity: 0.25; }
.icon { width: 28px; height: 28px; image-rendering: pixelated; }
.body { flex: 1; min-width: 0; }
.name {
  font-size: 12px; line-height: 1.2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.points { font-size: 10px; color: var(--text-dim); }
.sub-icon {
  position: absolute; top: -8px; right: -8px;
  width: 20px; height: 20px; image-rendering: pixelated;
}
.card :deep(.vue-flow__handle) {
  width: 6px; height: 6px; background: var(--border); border: none;
}
</style>
```

- [ ] **Step 3: Замінити заглушку `src/components/TreeCanvas.vue` повною реалізацією** — VueFlow з пропсами з контракту; клік: у `gameMode` → `session.toggle`, інакше `ui.select`; hover → `ui.setHovered`; computed-ребра з підсвіткою, коли source і target обидва в `highlightSet`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { VueFlow } from '@vue-flow/core';
import type { Edge, NodeMouseEvent } from '@vue-flow/core';
import ResearchNodeCard from './ResearchNodeCard.vue';
import { useDataStore } from '../stores/data';
import { useSessionStore } from '../stores/session';
import { useUiStore } from '../stores/ui';

const data = useDataStore();
const session = useSessionStore();
const ui = useUiStore();

const edges = computed<Edge[]>(() => {
  const hl = ui.highlightSet;
  return data.flowEdges.map((e) => {
    const highlighted = hl.has(e.source) && hl.has(e.target);
    return {
      ...e,
      style: highlighted
        ? { stroke: 'var(--blue)', strokeWidth: 2.5 }
        : { stroke: 'var(--edge)', strokeWidth: 1.5 },
    };
  });
});

function onNodeClick({ node }: NodeMouseEvent): void {
  if (session.gameMode) session.toggle(node.id);
  else ui.select(node.id);
}

function onNodeMouseEnter({ node }: NodeMouseEvent): void {
  ui.setHovered(node.id);
}

function onNodeMouseLeave(): void {
  ui.setHovered(null);
}
</script>

<template>
  <div class="tree-canvas">
    <VueFlow
      :nodes="data.flowNodes"
      :edges="edges"
      :only-render-visible-elements="true"
      :min-zoom="0.05"
      :max-zoom="2"
      fit-view-on-init
      @node-click="onNodeClick"
      @node-mouse-enter="onNodeMouseEnter"
      @node-mouse-leave="onNodeMouseLeave"
    >
      <template #node-research="nodeProps">
        <ResearchNodeCard :id="nodeProps.id" :data="nodeProps.data" />
      </template>
    </VueFlow>
  </div>
</template>

<style scoped>
.tree-canvas {
  width: 100%;
  height: 100%;
  background: var(--bg);
}
</style>
```

- [ ] **Step 4: Перевірити в браузері** — Run: `npm run dev`, відкрити http://localhost:5173. Expected:
  - по центру дерево з картками вузлів (іконка гілки, назва, очки); при свіжому стані (researched порожній) кореневі вузли без пререквізитів мають жовту рамку (available), решта — сіро-синю (locked);
  - пан: затиснути ЛКМ на порожньому місці і тягнути; зум: колесо миші (від 0.05 до 2). Через `only-render-visible-elements` вузли поза екраном домальовуються під час пану — це нормально;
  - hover на будь-який вузол у глибині дерева → весь ланцюжок його пререквізитів аж до коренів лишається яскравим, усі інші вузли притемнюються до opacity 0.25, ребра ланцюжка стають синіми і товщими (2.5px); прибрати мишу → все повертається;
  - клік по вузлу (тумблер «▶ Гра» вимкнений) → підсвітка ланцюжка зберігається і після відведення миші (вибір); клік по іншому вузлу — підсвітка переходить на нього;
  - увімкнути «▶ Гра», клікнути по кореневому вузлу → рамка стає зеленою (researched), у його прямих нащадків — жовтою (available); повторний клік → відкат; вимкнути «▶ Гра»;
  - у консолі браузера немає помилок, іконки `/icons/*.png` вантажаться (немає 404 у вкладці Network).

- [ ] **Step 5: Commit** — Run:
```bash
git add src/components/TreeCanvas.vue src/components/ResearchNodeCard.vue src/style.css
git commit -m "feat: render research tree with vue-flow and custom node cards

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 14: Пошук — lib (TDD), SearchBox і fly-to камери

Мета: чиста функція пошуку (TDD), інкрементальний пошук у TopBar з dropdown і перельотом камери до знайденого вузла через `ui.flyTo` → `fitView` у TreeCanvas.

**Files:**
- Create: `src/lib/search.ts`
- Test: `src/lib/search.test.ts`
- Modify: `src/components/SearchBox.vue` (повна заміна заглушки)
- Modify: `src/components/TopBar.vue`
- Modify: `src/components/TreeCanvas.vue`

- [ ] **Step 1: Написати failing-тест `src/lib/search.test.ts`** — повний код (самодостатня фікстура, без залежності від testFixture):

```ts
import { describe, expect, it } from 'vitest';
import type { ResearchNode } from '../types';
import { searchResearch } from './search';

function makeNode(id: string, name: string): ResearchNode {
  return {
    id,
    name,
    points: 100,
    branch: 'weapon',
    icon: 'image_res_weapontech.png',
    subIcon: null,
    category: null,
    prereqs: [],
    resultComponents: [],
    resultStructures: [],
    x: 0,
    y: 0,
  };
}

const nodes: ResearchNode[] = [
  makeNode('R-Wpn-Rocket01-LtAT', 'Lancer'),
  makeNode('R-Wpn-Cannon1Mk1', 'Light Cannon'),
  makeNode('R-Sys-Engineering01', 'Engineering'),
  makeNode('R-Defense-HardcreteWall', 'Hardcrete'),
];

describe('searchResearch', () => {
  it('знаходить за підрядком назви без урахування регістру', () => {
    const res = searchResearch(nodes, 'lAnCeR');
    expect(res.map((n) => n.id)).toEqual(['R-Wpn-Rocket01-LtAT']);
  });

  it('знаходить за підрядком id без урахування регістру', () => {
    const res = searchResearch(nodes, 'wpn-cannon');
    expect(res.map((n) => n.id)).toEqual(['R-Wpn-Cannon1Mk1']);
  });

  it('повертає кілька збігів у порядку вхідного масиву', () => {
    const res = searchResearch(nodes, 'r-');
    expect(res.map((n) => n.id)).toEqual([
      'R-Wpn-Rocket01-LtAT',
      'R-Wpn-Cannon1Mk1',
      'R-Sys-Engineering01',
      'R-Defense-HardcreteWall',
    ]);
  });

  it('повертає [] для порожнього запиту або самих пробілів', () => {
    expect(searchResearch(nodes, '')).toEqual([]);
    expect(searchResearch(nodes, '   ')).toEqual([]);
  });

  it('повертає [] коли збігів немає', () => {
    expect(searchResearch(nodes, 'zzz-not-there')).toEqual([]);
  });

  it('обмежує результат 20 записами', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      makeNode(`R-Test-${i}`, `Test ${i}`),
    );
    expect(searchResearch(many, 'test')).toHaveLength(20);
  });
});
```

- [ ] **Step 2: Запустити тест, переконатися що падає** — Run: `npm run test -- src/lib/search.test.ts`. Expected: FAIL — Vite не може зарезолвити імпорт `./search` (файлу ще немає): `Failed to resolve import "./search"`.

- [ ] **Step 3: Мінімальна імплементація `src/lib/search.ts`** — повний код:

```ts
import type { ResearchNode } from '../types';

const MAX_RESULTS = 20;

/** Інкрементальний пошук: підрядок без урахування регістру по name та id, максимум 20 результатів. */
export function searchResearch(nodes: ResearchNode[], query: string): ResearchNode[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  const results: ResearchNode[] = [];
  for (const node of nodes) {
    if (node.name.toLowerCase().includes(q) || node.id.toLowerCase().includes(q)) {
      results.push(node);
      if (results.length === MAX_RESULTS) break;
    }
  }
  return results;
}
```

- [ ] **Step 4: Запустити тести, переконатися що проходять** — Run: `npm run test -- src/lib/search.test.ts`. Expected: PASS, 6 passed. Потім повний прогін `npm run test` — усі тести проєкту зелені.

- [ ] **Step 5: Замінити заглушку `src/components/SearchBox.vue`** — input + dropdown до 20 результатів (назва + id дрібним); клік по результату → вибрати вузол, `ui.flyTo(id)`, очистити input (dropdown зникає, бо порожній запит дає 0 результатів). Повний код:

```vue
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
```

- [ ] **Step 6: Вмонтувати SearchBox у TopBar** — у `src/components/TopBar.vue` замінити порожній слот. Точний diff:

```diff
 <script setup lang="ts">
+import SearchBox from './SearchBox.vue';
 import { useSessionStore } from '../stores/session';

 const session = useSessionStore();
 </script>
```

```diff
-    <div class="search-slot">
-      <!-- SearchBox зʼявиться тут у Task 14 -->
-    </div>
+    <div class="search-slot">
+      <SearchBox />
+    </div>
```

- [ ] **Step 7: Додати fly-to у TreeCanvas** — `useVueFlow().fitView` працює, бо `<VueFlow>` рендериться у цьому ж компоненті. Повний оновлений вміст `src/components/TreeCanvas.vue` (зміни: імпорти `watch` і `useVueFlow`, блок watch наприкінці script):

```vue
<script setup lang="ts">
import { computed, watch } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import type { Edge, NodeMouseEvent } from '@vue-flow/core';
import ResearchNodeCard from './ResearchNodeCard.vue';
import { useDataStore } from '../stores/data';
import { useSessionStore } from '../stores/session';
import { useUiStore } from '../stores/ui';

const data = useDataStore();
const session = useSessionStore();
const ui = useUiStore();

const { fitView } = useVueFlow();

const edges = computed<Edge[]>(() => {
  const hl = ui.highlightSet;
  return data.flowEdges.map((e) => {
    const highlighted = hl.has(e.source) && hl.has(e.target);
    return {
      ...e,
      style: highlighted
        ? { stroke: 'var(--blue)', strokeWidth: 2.5 }
        : { stroke: 'var(--edge)', strokeWidth: 1.5 },
    };
  });
});

function onNodeClick({ node }: NodeMouseEvent): void {
  if (session.gameMode) session.toggle(node.id);
  else ui.select(node.id);
}

function onNodeMouseEnter({ node }: NodeMouseEvent): void {
  ui.setHovered(node.id);
}

function onNodeMouseLeave(): void {
  ui.setHovered(null);
}

watch(
  () => ui.flyToRequest,
  (id) => {
    if (!id) return;
    fitView({ nodes: [id], padding: 4, duration: 600 });
    ui.clearFlyTo();
  },
);
</script>

<template>
  <div class="tree-canvas">
    <VueFlow
      :nodes="data.flowNodes"
      :edges="edges"
      :only-render-visible-elements="true"
      :min-zoom="0.05"
      :max-zoom="2"
      fit-view-on-init
      @node-click="onNodeClick"
      @node-mouse-enter="onNodeMouseEnter"
      @node-mouse-leave="onNodeMouseLeave"
    >
      <template #node-research="nodeProps">
        <ResearchNodeCard :id="nodeProps.id" :data="nodeProps.data" />
      </template>
    </VueFlow>
  </div>
</template>

<style scoped>
.tree-canvas {
  width: 100%;
  height: 100%;
  background: var(--bg);
}
</style>
```

- [ ] **Step 8: Перевірити в браузері** — Run: `npm run dev`, відкрити http://localhost:5173. Expected:
  - у центрі TopBar зʼявився input «Пошук дослідження…»;
  - ввести `lancer` → під input випадає список (щонайменше один результат «Lancer», під назвою дрібним сірим його id `R-Wpn-Rocket01-LtAT`); dropdown відмальовується ПОВЕРХ канви;
  - клік по результату → камера плавно (~0.6 с) летить до вузла, вузол з околицею по центру; вузол виділений — його ланцюжок пререквізитів підсвічений, решта дерева притемнена; input очистився, dropdown закрився;
  - ввести фрагмент id `r-wpn-cannon` → у списку результати по id; ввести `zzzzz` → списку немає;
  - у консолі немає помилок.

- [ ] **Step 9: Commit** — Run:
```bash
git add src/lib/search.ts src/lib/search.test.ts src/components/SearchBox.vue src/components/TopBar.vue src/components/TreeCanvas.vue
git commit -m "feat: add research search with fly-to navigation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 15: BranchFilter — фільтр гілок дерева

Мета: лівий сайдбар із 8 чекбоксами (іконка гілки + український підпис), які вмикають/вимикають гілки через `ui.toggleBranch`; вимкнена гілка притемнює свої вузли на канві.

**Files:**
- Modify: `src/components/BranchFilter.vue` (повна заміна заглушки)

- [ ] **Step 1: Замінити заглушку `src/components/BranchFilter.vue` повною реалізацією** — порядок гілок і мапа іконок/підписів фіксовані:

```vue
<script setup lang="ts">
import type { Branch } from '../types';
import { useUiStore } from '../stores/ui';

const ui = useUiStore();

const BRANCHES: { branch: Branch; icon: string; label: string }[] = [
  { branch: 'weapon', icon: 'image_res_weapontech.png', label: 'Зброя' },
  { branch: 'defence', icon: 'image_res_defence.png', label: 'Захист' },
  { branch: 'droid', icon: 'image_res_droidtech.png', label: 'Корпуси й рушії' },
  { branch: 'cyborg', icon: 'image_res_cyborgtech.png', label: 'Кіборги' },
  { branch: 'system', icon: 'image_res_systemtech.png', label: 'Системи' },
  { branch: 'structure', icon: 'image_res_structuretech.png', label: 'Будівлі' },
  { branch: 'power', icon: 'image_res_powertech.png', label: 'Енергія' },
  { branch: 'computer', icon: 'image_res_computertech.png', label: 'Компʼютери' },
];
</script>

<template>
  <nav class="branch-filter">
    <h2 class="heading">Гілки</h2>
    <label v-for="b in BRANCHES" :key="b.branch" class="row">
      <input
        type="checkbox"
        :checked="ui.enabledBranches.has(b.branch)"
        @change="ui.toggleBranch(b.branch)"
      />
      <img class="icon" :src="`/icons/${b.icon}`" :alt="b.label" />
      <span>{{ b.label }}</span>
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
```

- [ ] **Step 2: Перевірити в браузері** — Run: `npm run dev`, відкрити http://localhost:5173. Expected:
  - зліва список «Гілки»: 8 рядків, кожен — чекбокс (усі увімкнені за замовчуванням), піксельна іконка гілки і підпис: Зброя, Захист, Корпуси й рушії, Кіборги, Системи, Будівлі, Енергія, Компʼютери;
  - зняти чекбокс «Зброя» → усі вузли гілки weapon на канві (кулемети, гармати, ракети — з іконкою image_res_weapontech) притемнюються до opacity 0.25, решта без змін; повернути чекбокс → вузли знову яскраві;
  - зняти всі 8 → усе дерево притемнене; повернути всі;
  - комбінація з hover: при вимкненій «Зброя» навести мишу на вузол іншої гілки — weapon-вузли з ланцюжка пререквізитів ЛИШАЮТЬСЯ притемненими (умова «вимкнена гілка АБО поза підсвіткою»);
  - у консолі немає помилок, іконки в сайдбарі вантажаться без 404.

- [ ] **Step 3: Commit** — Run:
```bash
git add src/components/BranchFilter.vue
git commit -m "feat: add branch filter sidebar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 16: DetailsPanel — панель деталей вибраної технології

**Files:**
- Create: `src/components/DetailsPanel.vue` (якщо Task 12 лишив stub-файл із такою назвою — повністю замінити його вміст кодом нижче)

- [ ] **Step 1: Написати компонент із повним кодом**

  Панель читає `ui.selectedId`, показує деталі вузла, дає перейти до пререквізитів/розблокувань (`ui.flyTo`), додати ціль у план і — у режимі гри — відмітити технологію вивченою. Після зміни `researched` викликаємо `plans.rebuildQueues()`, щоб черга активного плану одразу виключила вивчене (виклик ідемпотентний, тож не конфліктує з можливим watcher-ом в App.vue).

  Повний вміст `src/components/DetailsPanel.vue`:

  ```vue
  <script setup lang="ts">
  import { computed } from 'vue';
  import { useDataStore } from '../stores/data';
  import { usePlansStore } from '../stores/plans';
  import { useSessionStore } from '../stores/session';
  import { useUiStore } from '../stores/ui';
  import type { Branch, NodeStatus, ResearchNode } from '../types';

  const data = useDataStore();
  const plans = usePlansStore();
  const session = useSessionStore();
  const ui = useUiStore();

  const BRANCH_LABELS: Record<Branch, string> = {
    weapon: 'Зброя',
    defence: 'Оборона',
    droid: 'Дроїди',
    cyborg: 'Кіборги',
    system: 'Системи',
    structure: 'Будівлі',
    power: 'Енергія',
    computer: 'Компʼютери',
  };

  const STATUS_LABELS: Record<NodeStatus, string> = {
    researched: 'Вивчено',
    available: 'Доступно',
    locked: 'Недоступно',
  };

  const node = computed<ResearchNode | null>(() =>
    ui.selectedId ? data.index.byId.get(ui.selectedId) ?? null : null,
  );

  const status = computed<NodeStatus>(() =>
    node.value ? session.statuses.get(node.value.id) ?? 'locked' : 'locked',
  );

  const prereqNodes = computed<ResearchNode[]>(() => {
    if (!node.value) return [];
    return node.value.prereqs
      .map((id) => data.index.byId.get(id))
      .filter((n): n is ResearchNode => n !== undefined);
  });

  const unlockNodes = computed<ResearchNode[]>(() => {
    if (!node.value) return [];
    return (data.index.unlocks.get(node.value.id) ?? [])
      .map((id) => data.index.byId.get(id))
      .filter((n): n is ResearchNode => n !== undefined);
  });

  const alreadyGoal = computed(() =>
    node.value !== null &&
    plans.activePlan !== null &&
    plans.activePlan.goals.includes(node.value.id),
  );

  function onToggleResearched(): void {
    if (!node.value) return;
    session.toggle(node.value.id);
    plans.rebuildQueues();
  }
  </script>

  <template>
    <section class="details">
      <p v-if="!node" class="empty">Клікни технологію на дереві</p>
      <template v-else>
        <h2>{{ node.name }}</h2>
        <p class="meta">
          {{ BRANCH_LABELS[node.branch] }}<span v-if="node.category"> · {{ node.category }}</span>
        </p>
        <p class="meta">Очки дослідження: {{ node.points }}</p>
        <p class="status" :class="status">{{ STATUS_LABELS[status] }}</p>

        <label v-if="session.gameMode" class="researched-toggle">
          <input
            type="checkbox"
            :checked="status === 'researched'"
            @change="onToggleResearched"
          />
          Вивчено
        </label>

        <button class="add-goal" :disabled="alreadyGoal" @click="plans.addGoal(node.id)">
          У план
        </button>

        <div v-if="prereqNodes.length" class="block">
          <h3>Потребує:</h3>
          <div class="link-list">
            <button
              v-for="p in prereqNodes"
              :key="p.id"
              class="link"
              @click="ui.flyTo(p.id)"
            >
              {{ p.name }}
            </button>
          </div>
        </div>

        <div v-if="unlockNodes.length" class="block">
          <h3>Відкриває:</h3>
          <div class="link-list">
            <button
              v-for="u in unlockNodes"
              :key="u.id"
              class="link"
              @click="ui.flyTo(u.id)"
            >
              {{ u.name }}
            </button>
          </div>
        </div>

        <div v-if="node.resultComponents.length" class="block">
          <h3>Компоненти:</h3>
          <p class="results">{{ node.resultComponents.join(', ') }}</p>
        </div>

        <div v-if="node.resultStructures.length" class="block">
          <h3>Споруди:</h3>
          <p class="results">{{ node.resultStructures.join(', ') }}</p>
        </div>
      </template>
    </section>
  </template>

  <style scoped>
  .details {
    padding: 12px;
    border-bottom: 1px solid var(--border);
  }
  .empty {
    color: var(--text-dim);
    margin: 0;
  }
  h2 {
    margin: 0 0 4px;
    font-size: 16px;
    color: var(--text);
  }
  h3 {
    margin: 0 0 4px;
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .meta {
    margin: 2px 0;
    font-size: 13px;
    color: var(--text-dim);
  }
  .status {
    margin: 8px 0;
    font-weight: 600;
  }
  .status.researched { color: var(--green); }
  .status.available { color: var(--yellow); }
  .status.locked { color: var(--text-dim); }
  .researched-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 8px 0;
    color: var(--text);
    cursor: pointer;
  }
  .add-goal {
    margin: 4px 0 10px;
    padding: 6px 14px;
    border: none;
    border-radius: 4px;
    background: var(--blue);
    color: var(--bg);
    font-weight: 600;
    cursor: pointer;
  }
  .add-goal:disabled {
    background: var(--border);
    color: var(--text-dim);
    cursor: default;
  }
  .block {
    margin: 10px 0 0;
  }
  .link-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .link {
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-node);
    color: var(--blue);
    font-size: 12px;
    cursor: pointer;
  }
  .link:hover {
    border-color: var(--blue);
  }
  .results {
    margin: 0;
    font-size: 12px;
    color: var(--text);
    word-break: break-word;
  }
  </style>
  ```

- [ ] **Step 2: Перевірка очима**

  Run: `npm run dev` → відкрити http://localhost:5173 у браузері. Сценарій:
  1. Нічого не клікати — у правій панелі зверху текст «Клікни технологію на дереві».
  2. Клікнути будь-який вузол дерева (наприклад, стартовий без пререквізитів) — зʼявляються: назва, гілка українською (та категорія через «·», якщо є), «Очки дослідження: N», статус словом («Доступно» жовтим для стартових вузлів).
  3. Клікнути вузол глибше в дереві — статус «Недоступно», у блоці «Потребує:» кнопки з назвами пререквізитів. Клік по кнопці — камера плавно летить до того вузла (сам вибір не змінюється — це очікувано).
  4. У блоці «Відкриває:» кнопки технологій, що залежать від вибраної; клік — теж переліт. Якщо у вузла є resultComponents/resultStructures — вони видно текстом у блоках «Компоненти:»/«Споруди:».
  5. Натиснути «У план» — кнопка стає disabled (сірою). Повторний клік неможливий.
  6. Увімкнути тумблер гри в TopBar — зʼявляється чекбокс «Вивчено». Поставити галочку — статус змінюється на «Вивчено» зеленим, рамка вузла на дереві стає зеленою. Зняти галочку — статус повертається.

  Expected: усі 6 пунктів поводяться як описано, у консолі браузера немає помилок.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/DetailsPanel.vue
  git commit -m "feat: research details panel with prereqs, unlocks and plan/game actions" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

### Task 17: PlanPanel — керування планами, drag-and-drop черги, експорт/імпорт

**Files:**
- Create: `src/components/PlanPanel.vue` (якщо Task 12 лишив stub — повністю замінити вміст)

- [ ] **Step 1: Написати компонент із повним кодом**

  Панель: селект планів + кнопки CRUD (через `window.prompt`/`window.confirm`), чипи цілей з ✕, черга з нативним HTML5 drag-and-drop (`dragstart` запамʼятовує `fromIdx`, `dragover.prevent` дозволяє drop, `drop` викликає `plans.moveQueueItem`; при `{ok:false}` елемент-конфлікт отримує клас `.conflict` з червоною рамкою на 1.2 с — через `ref<Set<string>>`, який пересоздаємо для тригеру реактивності). Експорт — `Blob` + `a.download='plan.json'`; імпорт — прихований `input type=file` + `FileReader`, помилка → `alert`. Якщо `plans.storageCorrupt || session.storageCorrupt` — банер «Збереження пошкоджено» з кнопкою «Скинути», що викликає `resetStorage()` обох сторів.

  Повний вміст `src/components/PlanPanel.vue`:

  ```vue
  <script setup lang="ts">
  import { computed, ref } from 'vue';
  import { useDataStore } from '../stores/data';
  import { usePlansStore } from '../stores/plans';
  import { useSessionStore } from '../stores/session';
  import { useUiStore } from '../stores/ui';
  import type { ResearchNode } from '../types';

  const data = useDataStore();
  const plans = usePlansStore();
  const session = useSessionStore();
  const ui = useUiStore();

  const fileInput = ref<HTMLInputElement | null>(null);
  const dragFromIdx = ref<number | null>(null);
  const conflictIds = ref<Set<string>>(new Set());

  const goalNodes = computed<ResearchNode[]>(() => {
    const plan = plans.activePlan;
    if (!plan) return [];
    return plan.goals
      .map((id) => data.index.byId.get(id))
      .filter((n): n is ResearchNode => n !== undefined);
  });

  const queueNodes = computed<ResearchNode[]>(() => {
    const plan = plans.activePlan;
    if (!plan) return [];
    return plan.queue
      .map((id) => data.index.byId.get(id))
      .filter((n): n is ResearchNode => n !== undefined);
  });

  function onSelectPlan(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    if (id) plans.setActive(id);
  }

  function onCreate(): void {
    const name = window.prompt('Назва плану', 'Новий план');
    if (name === null) return;
    plans.createPlan(name.trim() || 'Новий план');
  }

  function onRename(): void {
    const plan = plans.activePlan;
    if (!plan) return;
    const name = window.prompt('Нова назва плану', plan.name);
    if (name === null) return;
    plans.renamePlan(plan.id, name.trim() || plan.name);
  }

  function onDelete(): void {
    const plan = plans.activePlan;
    if (!plan) return;
    if (window.confirm(`Видалити план «${plan.name}»?`)) {
      plans.deletePlan(plan.id);
    }
  }

  function onDragStart(idx: number): void {
    dragFromIdx.value = idx;
  }

  function onDrop(toIdx: number): void {
    const from = dragFromIdx.value;
    dragFromIdx.value = null;
    if (from === null || from === toIdx) return;
    const res = plans.moveQueueItem(from, toIdx);
    if (!res.ok) {
      conflictIds.value = new Set([res.conflictId]);
      window.setTimeout(() => {
        conflictIds.value = new Set();
      }, 1200);
    }
  }

  function onExport(): void {
    const json = plans.exportActive();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plan.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportClick(): void {
    fileInput.value?.click();
  }

  function onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = plans.importPlan(String(reader.result));
      if (!res.ok) window.alert(res.error);
    };
    reader.readAsText(file);
    input.value = '';
  }

  function onResetStorage(): void {
    plans.resetStorage();
    session.resetStorage();
  }

  function statusColor(id: string): string {
    const s = session.statuses.get(id) ?? 'locked';
    if (s === 'researched') return 'var(--green)';
    if (s === 'available') return 'var(--yellow)';
    return 'var(--border)';
  }
  </script>

  <template>
    <section class="plan-panel">
      <div v-if="plans.storageCorrupt || session.storageCorrupt" class="corrupt-banner">
        <span>Збереження пошкоджено</span>
        <button class="reset-btn" @click="onResetStorage">Скинути</button>
      </div>

      <h2>План</h2>

      <div class="plan-bar">
        <select :value="plans.activePlanId ?? ''" @change="onSelectPlan">
          <option v-for="p in plans.plans" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <button title="Новий план" @click="onCreate">+</button>
        <button title="Перейменувати" :disabled="!plans.activePlan" @click="onRename">✎</button>
        <button title="Видалити" :disabled="!plans.activePlan" @click="onDelete">🗑</button>
      </div>

      <template v-if="plans.activePlan">
        <div class="goals">
          <span v-for="g in goalNodes" :key="g.id" class="chip">
            {{ g.name }}
            <button class="chip-x" title="Прибрати ціль" @click="plans.removeGoal(g.id)">✕</button>
          </span>
          <p v-if="goalNodes.length === 0" class="hint">
            Додай цілі кнопкою «У план» у деталях технології
          </p>
        </div>

        <ol class="queue">
          <li
            v-for="(n, idx) in queueNodes"
            :key="n.id"
            draggable="true"
            :class="{ conflict: conflictIds.has(n.id) }"
            @dragstart="onDragStart(idx)"
            @dragover.prevent
            @drop="onDrop(idx)"
          >
            <span class="num">{{ idx + 1 }}.</span>
            <span class="dot" :style="{ background: statusColor(n.id) }"></span>
            <button class="name" @click="ui.flyTo(n.id)">{{ n.name }}</button>
            <span class="pts">{{ n.points }}</span>
          </li>
        </ol>
      </template>
      <p v-else class="hint">Немає планів — створи перший кнопкою «+»</p>

      <div class="io">
        <button :disabled="!plans.activePlan" @click="onExport">Експорт</button>
        <button @click="onImportClick">Імпорт</button>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          class="hidden-input"
          @change="onImportFile"
        />
      </div>
    </section>
  </template>

  <style scoped>
  .plan-panel {
    padding: 12px;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 16px;
    color: var(--text);
  }
  .corrupt-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
    padding: 8px;
    border: 1px solid var(--red);
    border-radius: 4px;
    color: var(--red);
    font-size: 13px;
  }
  .reset-btn {
    padding: 4px 10px;
    border: 1px solid var(--red);
    border-radius: 4px;
    background: transparent;
    color: var(--red);
    cursor: pointer;
  }
  .plan-bar {
    display: flex;
    gap: 4px;
    margin-bottom: 10px;
  }
  .plan-bar select {
    flex: 1;
    min-width: 0;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-node);
    color: var(--text);
  }
  .plan-bar button {
    width: 28px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-node);
    color: var(--text);
    cursor: pointer;
  }
  .plan-bar button:disabled {
    color: var(--text-dim);
    cursor: default;
  }
  .goals {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 10px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px 2px 8px;
    border: 1px solid var(--blue);
    border-radius: 10px;
    color: var(--blue);
    font-size: 12px;
  }
  .chip-x {
    border: none;
    background: transparent;
    color: var(--blue);
    cursor: pointer;
    font-size: 11px;
    padding: 0;
  }
  .hint {
    margin: 4px 0;
    color: var(--text-dim);
    font-size: 12px;
  }
  .queue {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
  }
  .queue li {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: grab;
  }
  .queue li:hover {
    background: var(--bg-node);
  }
  .queue li.conflict {
    border-color: var(--red);
  }
  .num {
    color: var(--text-dim);
    font-size: 12px;
    min-width: 22px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .name {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--text);
    text-align: left;
    font-size: 13px;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name:hover {
    color: var(--blue);
  }
  .pts {
    color: var(--text-dim);
    font-size: 11px;
  }
  .io {
    display: flex;
    gap: 6px;
  }
  .io button {
    padding: 4px 12px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-node);
    color: var(--text);
    cursor: pointer;
  }
  .io button:disabled {
    color: var(--text-dim);
    cursor: default;
  }
  .hidden-input {
    display: none;
  }
  </style>
  ```

- [ ] **Step 2: Перевірка очима**

  Run: `npm run dev` → http://localhost:5173. Сценарій:
  1. Натиснути «+» → prompt з дефолтом «Новий план», ввести «Тест» → план зʼявляється в селекті і стає активним. «✎» → перейменувати → назва оновилась у селекті. Створити другий план через «+» і перемкнутися між ними селектом.
  2. Вибрати на дереві технологію з 3+ пререквізитами, натиснути «У план» (DetailsPanel) → у PlanPanel зʼявляється чип цілі, черга заповнюється всіма пререквізитами у валідному порядку (кожен пункт: номер, крапка кольору статусу, назва, points).
  3. Клік по назві пункту черги → камера летить до вузла.
  4. **Невалідний drag:** перетягнути ПЕРШИЙ пункт черги (базовий пререквізит) на ОСТАННЮ позицію → порядок не змінюється, на елементі-конфлікті (тому, що залежить від перетягуваного) на ~1.2 с зʼявляється червона рамка і зникає.
  5. **Валідний drag:** якщо в черзі є два незалежні сусідні пункти — поміняти їх місцями → порядок змінюється і лишається.
  6. ✕ на чипі цілі → ціль і непотрібні пререквізити зникають з черги.
  7. Повернути ціль, натиснути «Експорт» → браузер завантажує `plan.json`. Видалити план «🗑» (confirm) → «Імпорт» → вибрати завантажений `plan.json` → план повертається з цілями і чергою. Імпорт свідомо зіпсованого файлу (текстовий файл з «abc») → `alert` з помилкою.
  8. У DevTools Console: `localStorage.setItem('wz2100-tree:v1:plans', '{oops')` → перезавантажити сторінку → банер «Збереження пошкоджено» → «Скинути» → банер зникає, стан дефолтний.

  Expected: усі пункти проходять, помилок у консолі немає.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/PlanPanel.vue
  git commit -m "feat: plan panel with goals, drag-and-drop queue and import/export" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

### Task 18: GamePanel — прогрес плану і швидке відмічання в режимі гри

**Files:**
- Create: `src/components/GamePanel.vue` (якщо Task 12 лишив stub — повністю замінити вміст)

- [ ] **Step 1: Написати компонент із повним кодом**

  Видимість панелі (тільки в `session.gameMode`, над PlanPanel) уже керується з App.vue (Task 12) — сам компонент умову не перевіряє. Прогрес: `done` = кількість id з `prereqClosure(index, goals)`, що вже в `researched`; `total = queue.length + done` (інваріант: при відмічанні пункту черги done росте, черга скорочується, total сталий). Після `mark`/`newGame` викликаємо `plans.rebuildQueues()`.

  Повний вміст `src/components/GamePanel.vue`:

  ```vue
  <script setup lang="ts">
  import { computed } from 'vue';
  import { useDataStore } from '../stores/data';
  import { usePlansStore } from '../stores/plans';
  import { useSessionStore } from '../stores/session';
  import { prereqClosure } from '../lib/graph';
  import type { ResearchNode } from '../types';

  const data = useDataStore();
  const plans = usePlansStore();
  const session = useSessionStore();

  const done = computed<number>(() => {
    const plan = plans.activePlan;
    if (!plan || plan.goals.length === 0) return 0;
    const closure = prereqClosure(data.index, plan.goals);
    let count = 0;
    for (const id of closure) {
      if (session.researched.has(id)) count += 1;
    }
    return count;
  });

  const total = computed<number>(() => {
    const plan = plans.activePlan;
    if (!plan) return 0;
    return plan.queue.length + done.value;
  });

  const percent = computed<number>(() =>
    total.value === 0 ? 0 : Math.round((done.value / total.value) * 100),
  );

  const nextNodes = computed<ResearchNode[]>(() => {
    const plan = plans.activePlan;
    if (!plan) return [];
    return plan.queue
      .slice(0, 5)
      .map((id) => data.index.byId.get(id))
      .filter((n): n is ResearchNode => n !== undefined);
  });

  function isAvailable(id: string): boolean {
    return session.statuses.get(id) === 'available';
  }

  function onMark(id: string): void {
    session.mark(id);
    plans.rebuildQueues();
  }

  function onNewGame(): void {
    if (!window.confirm('Почати нову гру? Весь прогрес досліджень буде скинуто.')) return;
    session.newGame();
    plans.rebuildQueues();
  }
  </script>

  <template>
    <section class="game-panel">
      <h2>Режим гри</h2>

      <template v-if="plans.activePlan">
        <p class="progress-label">Прогрес плану: {{ done }} / {{ total }} ({{ percent }}%)</p>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: percent + '%' }"></div>
        </div>

        <h3>Наступні</h3>
        <ul class="next">
          <li
            v-for="n in nextNodes"
            :key="n.id"
            :class="{ available: isAvailable(n.id) }"
            title="Клік — відмітити вивченим"
            @click="onMark(n.id)"
          >
            {{ n.name }}
          </li>
        </ul>
        <p v-if="nextNodes.length === 0" class="hint">Черга порожня — план виконано</p>
      </template>
      <p v-else class="hint">Немає активного плану</p>

      <button class="new-game" @click="onNewGame">Нова гра</button>
    </section>
  </template>

  <style scoped>
  .game-panel {
    padding: 12px;
    border-bottom: 1px solid var(--border);
  }
  h2 {
    margin: 0 0 8px;
    font-size: 16px;
    color: var(--text);
  }
  h3 {
    margin: 12px 0 6px;
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .progress-label {
    margin: 0 0 6px;
    font-size: 13px;
    color: var(--text);
  }
  .progress-track {
    height: 10px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg-node);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--green);
    transition: width 0.3s ease;
  }
  .next {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .next li {
    padding: 5px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-dim);
    font-size: 13px;
    cursor: pointer;
  }
  .next li.available {
    border-color: var(--yellow);
    color: var(--yellow);
  }
  .next li:hover {
    background: var(--bg-node);
  }
  .hint {
    margin: 6px 0;
    color: var(--text-dim);
    font-size: 12px;
  }
  .new-game {
    margin-top: 12px;
    padding: 5px 12px;
    border: 1px solid var(--red);
    border-radius: 4px;
    background: transparent;
    color: var(--red);
    cursor: pointer;
  }
  </style>
  ```

- [ ] **Step 2: Перевірка очима — повний ігровий сценарій**

  Run: `npm run dev` → http://localhost:5173. Сценарій:
  1. Створити план, додати ціль із ~5+ пререквізитами (DetailsPanel → «У план»). GamePanel ще НЕ видно.
  2. Увімкнути тумблер гри в TopBar → над PlanPanel зʼявляється GamePanel: «Прогрес плану: 0 / N (0%)», порожній прогрес-бар, список «Наступні» — перші 5 пунктів черги, доступні зараз — із жовтою рамкою.
  3. Клікнути перший (жовтий) пункт → він зникає зі списку, черга в PlanPanel скорочується, прогрес стає «1 / N», бар росте, N не змінюється; наступний пункт стає жовтим.
  4. Відмітити так усі пункти до кінця → «N / N (100%)», бар повний, «Черга порожня — план виконано».
  5. Перезавантажити сторінку (F5) → режим гри, прогрес 100% і вивчені вузли (зелені рамки на дереві) збереглися.
  6. Натиснути «Нова гра» → confirm → researched очищено: прогрес 0%, черга в PlanPanel знову повна, вузли на дереві без зелених рамок.

  Expected: усі 6 пунктів проходять, помилок у консолі немає.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/GamePanel.vue
  git commit -m "feat: game panel with plan progress and quick research marking" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

### Task 19: Фінал — README, чекліст ручної перевірки, фінальні перевірки

**Files:**
- Create: `README.md`
- Create: `docs/superpowers/checklists/manual-verification.md`

- [ ] **Step 1: Написати README.md**

  Повний вміст `README.md`:

  ````markdown
  # WZ2100 Research Tree

  Інтерактивне дерево досліджень гри **Warzone 2100** — 390 технологій з мультиплеєрних
  даних гри (тег `4.7.0`). Статична SPA без бекенду: Vite + Vue 3 + TypeScript + Pinia +
  Vue Flow; розкладку графа прекомпʼютить elkjs на етапі генерації даних.

  ## Можливості

  - Повне дерево досліджень: зум/панорамування, підсвітка ланцюжка пререквізитів при
    наведенні чи виборі, фільтри за гілками, пошук із перельотом до вузла.
  - Деталі технології: пререквізити, що вона відкриває, компоненти/споруди.
  - Планувальник: обираєш цілі — отримуєш впорядковану чергу досліджень з усіма
    пререквізитами; ручне перевпорядкування drag-and-drop із перевіркою конфліктів;
    кілька планів; експорт/імпорт у JSON.
  - Режим гри: відмічай вивчене під час партії і слідкуй за прогресом плану.
    Усе зберігається в localStorage.

  ## Запуск

  ```bash
  npm install
  npm run build:data   # генерує src/data/research-4.7.0.json (потрібен інтернет)
  npm run icons        # завантажує іконки гри в public/icons/ (потрібен інтернет)
  npm run dev          # http://localhost:5173
  ```

  Згенерований файл даних закомічений у репозиторій, тож `build:data` та `icons`
  потрібні лише при першому налаштуванні без іконок або після зміни версії гри.

  Інші команди: `npm test` (Vitest), `npm run build` (vue-tsc + vite build),
  `npm run preview`.

  ## Оновлення під нову версію гри

  1. У `scripts/build-data.ts` і `scripts/download-icons.ts` змініть тег `4.7.0`
     на потрібну версію.
  2. `npm run build:data && npm run icons` — перегенерує дані та іконки.
  3. Якщо змінилось імʼя файлу даних (`src/data/research-<версія>.json`) — оновіть
     імпорт у `src/stores/data.ts`.
  4. `npm test && npm run build` — переконайтеся, що все зелене.

  ## Ліцензія даних

  Дані досліджень та іконки походять з гри
  [Warzone 2100](https://github.com/Warzone2100/warzone2100) (GPL-2.0+).
  ````

- [ ] **Step 2: Написати чекліст ручної перевірки**

  Run: `mkdir -p docs/superpowers/checklists`, потім створити файл.

  Повний вміст `docs/superpowers/checklists/manual-verification.md`:

  ```markdown
  # Чекліст ручної перевірки

  Передумови: `npm install`, дані та іконки на місці (`npm run build:data`,
  `npm run icons` за потреби). Старт: `npm run dev` → http://localhost:5173.
  Перед сценарієм очистити сховище: DevTools Console → `localStorage.clear()` → F5.

  1. **Дерево.** Видно граф вузлів з іконками та ребрами зліва направо; стартові
     вузли (без пререквізитів) мають жовту рамку (available), решта — сіру (locked).
  2. **Зум/панорамування.** Колесо миші зумить (до дрібного огляду всього дерева
     і назад), перетягування полотна панорамує. Вузли поза екраном не гальмують UI.
  3. **Hover-підсвітка.** Навести курсор на вузол глибоко в дереві → він і весь
     ланцюжок його пререквізитів лишаються яскравими, решта дерева тьмяніє
     (opacity ~0.25). Прибрати курсор → підсвітка зникає.
  4. **Пошук + fly-to.** У полі пошуку в TopBar набрати частину назви (наприклад,
     «cannon») → випадає до 20 результатів; клік по результату → камера плавно
     летить до вузла.
  5. **Фільтри гілок.** У лівій панелі вимкнути гілку (наприклад, «Зброя») → її
     вузли тьмяніють; увімкнути назад → повертаються.
  6. **Деталі.** Клік по вузлу → права панель: назва, гілка/категорія, очки, статус
     словом; кнопки пререквізитів і «Відкриває:» летять до відповідних вузлів;
     компоненти/споруди видно текстом.
  7. **План і цілі.** «+» → створити план; у деталях технології «У план» → чип цілі
     та черга з пререквізитами у валідному порядку; кнопка стає disabled; ✕ на чипі
     прибирає ціль і зайві пререквізити.
  8. **DnD-конфлікт.** Перетягнути базовий пререквізит у кінець черги → порядок
     НЕ змінюється, елемент-конфлікт блимає червоною рамкою ~1.2 с. Валідне
     перетягування незалежних пунктів — порядок змінюється.
  9. **Експорт-імпорт.** «Експорт» → завантажується plan.json; видалити план «🗑» →
     «Імпорт» цього файлу → план повертається. Імпорт сміттєвого файлу → alert
     з помилкою.
  10. **Режим гри.** Тумблер у TopBar → зʼявляється GamePanel із прогресом 0/N і
      списком «Наступні» (доступні — жовті); клік по доступному пункту відмічає
      його вивченим: прогрес-бар росте, черга коротшає, вузол на дереві зеленіє.
      Чекбокс «Вивчено» в деталях працює так само.
  11. **Перезавантаження.** F5 → плани, цілі, порядок черги, вивчені технології
      та режим гри збереглися.
  12. **Нова гра.** «Нова гра» → confirm → вивчене очищено, черга знову повна,
      прогрес 0%.
  13. **Скидання зіпсованого сховища.** Console:
      `localStorage.setItem('wz2100-tree:v1:plans', '{oops')` → F5 → банер
      «Збереження пошкоджено» → «Скинути» → банер зникає, апка в дефолтному стані
      і працює.
  ```

- [ ] **Step 3: Пройти чекліст і фінальні перевірки**

  1. Run: `npm run dev` → пройти очима всі 13 пунктів `docs/superpowers/checklists/manual-verification.md`. Expected: усі пункти проходять.
  2. Run: `npm test`. Expected: усі test-файли PASS, `0 failed`.
  3. Run: `npm run build`. Expected: `vue-tsc -b` без помилок типів, vite збирає `dist/` без errors.
  4. Run: `npm run preview` → відкрити вказаний URL. Expected: зібрана апка працює (дерево рендериться, дані/іконки на місці).

- [ ] **Step 4: Commit**

  ```bash
  git add README.md docs/superpowers/checklists/manual-verification.md
  git commit -m "docs: readme and manual verification checklist" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```
