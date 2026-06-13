import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ResearchData } from '../src/types';

const VERSION = '4.7.0';
const TREE_URL = `https://api.github.com/repos/Warzone2100/warzone2100/git/trees/${VERSION}?recursive=1`;
const TEXPAGES_INFO_URL = `https://api.github.com/repos/Warzone2100/warzone2100/contents/data/base/texpages?ref=${VERSION}`;
const RAW_BASE = `https://raw.githubusercontent.com/Warzone2100/warzone2100/${VERSION}`;
const DATA_FILE = `src/data/research-${VERSION}.json`;
const MODEL_OUT_DIR = 'public/models';
const TEXPAGE_OUT_DIR = 'public/texpages';

type TreeResponse = {
  tree: { path: string; type: string }[];
};

type TexpageInfo = {
  git_url: string;
  sha: string;
};

function extractTextureNames(text: string): string[] {
  return [...text.matchAll(/^TEXTURE\s+\S+\s+(\S+)/gim)].map((match) => match[1]!.toLowerCase());
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Не вдалося завантажити ${url}: HTTP ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function main(): Promise<void> {
  const data = JSON.parse(await readFile(DATA_FILE, 'utf8')) as ResearchData;
  const needed = new Set(data.nodes.flatMap((node) => node.models.map((model) => model.toLowerCase())));
  const neededTextures = new Set<string>();

  const tree = await fetchJson<TreeResponse>(TREE_URL);
  const piePaths = new Map(
    tree.tree
      .filter((entry) => entry.type === 'blob' && entry.path.toLowerCase().endsWith('.pie'))
      .map((entry) => [path.basename(entry.path).toLowerCase(), entry.path]),
  );

  await mkdir(MODEL_OUT_DIR, { recursive: true });
  let downloaded = 0;
  const missing: string[] = [];

  for (const model of [...needed].sort()) {
    const sourcePath = piePaths.get(model);
    if (!sourcePath) {
      missing.push(model);
      continue;
    }

    const res = await fetch(`${RAW_BASE}/${sourcePath}`);
    if (!res.ok) {
      throw new Error(`Не вдалося завантажити ${sourcePath}: HTTP ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    for (const texture of extractTextureNames(text)) neededTextures.add(texture);
    await writeFile(path.join(MODEL_OUT_DIR, model), text);
    downloaded++;
  }

  await writeFile(
    path.join(MODEL_OUT_DIR, 'LICENSE.txt'),
    'PIE models from Warzone 2100 (GPL-2.0+), https://github.com/Warzone2100/warzone2100\n',
  );

  const texpageInfo = await fetchJson<TexpageInfo>(TEXPAGES_INFO_URL);
  const texpageTree = await fetchJson<TreeResponse>(texpageInfo.git_url);
  const texpagePaths = new Map(
    texpageTree.tree
      .filter((entry) => entry.type === 'blob' && entry.path.toLowerCase().endsWith('.png'))
      .map((entry) => [path.basename(entry.path).toLowerCase(), entry.path]),
  );
  const texpageBase = `https://raw.githubusercontent.com/Warzone2100/data-texpages/${texpageInfo.sha}`;
  let downloadedTextures = 0;
  const missingTextures: string[] = [];

  await mkdir(TEXPAGE_OUT_DIR, { recursive: true });
  for (const texture of [...neededTextures].sort()) {
    const sourcePath = texpagePaths.get(texture);
    if (!sourcePath) {
      missingTextures.push(texture);
      continue;
    }

    const res = await fetch(`${texpageBase}/${sourcePath}`);
    if (!res.ok) {
      throw new Error(`Не вдалося завантажити ${sourcePath}: HTTP ${res.status} ${res.statusText}`);
    }

    await writeFile(path.join(TEXPAGE_OUT_DIR, texture), Buffer.from(await res.arrayBuffer()));
    downloadedTextures++;
  }

  await writeFile(
    path.join(TEXPAGE_OUT_DIR, 'LICENSE.txt'),
    'Texture pages from Warzone 2100 data-texpages (GPL-2.0+), https://github.com/Warzone2100/data-texpages\n',
  );

  console.log(`Готово: ${downloaded} моделей у ${MODEL_OUT_DIR}/`);
  console.log(`Готово: ${downloadedTextures} texture pages у ${TEXPAGE_OUT_DIR}/`);
  if (missing.length) {
    console.warn(`Не знайдено ${missing.length}: ${missing.join(', ')}`);
  }
  if (missingTextures.length) {
    console.warn(`Не знайдено texture pages ${missingTextures.length}: ${missingTextures.join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
