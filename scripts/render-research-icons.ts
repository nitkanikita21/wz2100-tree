import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import rawData from '../src/data/research-4.7.0.json' with { type: 'json' };
import type { ResearchData } from '../src/types';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'public/generated');
const data = rawData as ResearchData;
const requestedId = process.argv.find((arg) => arg.startsWith('--id='))?.slice('--id='.length);
const waitTimeout = Number(process.argv.find((arg) => arg.startsWith('--wait='))?.slice('--wait='.length) ?? 750);
const iconWidth = 240;
const iconHeight = 184;
const columns = Number(process.argv.find((arg) => arg.startsWith('--columns='))?.slice('--columns='.length) ?? 20);

type SpriteEntry = {
  key: string;
  representativeId: string;
  researchIds: string[];
};

function modelKey(node: ResearchData['nodes'][number]): string {
  return JSON.stringify(
    node.modelGroups.map((group) =>
      group.parts.map((part) => part.model.toLowerCase()),
    ),
  );
}

function buildEntries(): SpriteEntry[] {
  const entries = new Map<string, SpriteEntry>();
  for (const node of data.nodes) {
    if (requestedId && node.id !== requestedId) continue;
    const key = modelKey(node);
    const entry = entries.get(key);
    if (entry) entry.researchIds.push(node.id);
    else {
      entries.set(key, {
        key,
        representativeId: node.id,
        researchIds: [node.id],
      });
    }
  }
  return [...entries.values()];
}

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const server = await createServer({
    root,
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'error',
  });
  await server.listen();

  const address = server.httpServer?.address();
  if (address === null || typeof address === 'string' || address === undefined) {
    throw new Error('Vite server did not expose a local port.');
  }

  const entries = buildEntries();

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: iconWidth, height: iconHeight },
    deviceScaleFactor: 1,
  });
  const rows = Math.ceil(entries.length / columns);
  const sheetWidth = columns * iconWidth;
  const sheetHeight = rows * iconHeight;
  const sheetPage = await browser.newPage();
  await sheetPage.setContent(`<canvas id="sheet" width="${sheetWidth}" height="${sheetHeight}"></canvas>`);

  try {
    for (const [index, entry] of entries.entries()) {
      const url = `http://127.0.0.1:${address.port}/?renderResearchIcon=${encodeURIComponent(entry.representativeId)}`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForSelector('.research-icon.export', { state: 'visible' });
      await page.waitForFunction(() => {
        const images = Array.from(document.images);
        const overlay = document.querySelector('.overlay');
        const modelDone = overlay === null || !overlay.textContent?.includes('Загрузка');
        return modelDone && images.every((image) => image.complete);
      }, null, { timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(waitTimeout);

      const png = await page.locator('.research-icon.export').screenshot({
        animations: 'disabled',
        omitBackground: true,
      });
      await sheetPage.evaluate(
        async ({ dataUrl, x, y }) => {
          const image = new Image();
          image.src = dataUrl;
          await image.decode();
          const canvas = document.getElementById('sheet') as HTMLCanvasElement | null;
          const context = canvas?.getContext('2d');
          if (!context) throw new Error('Cannot create sheet canvas context.');
          context.drawImage(image, x, y);
        },
        {
          dataUrl: `data:image/png;base64,${png.toString('base64')}`,
          x: (index % columns) * iconWidth,
          y: Math.floor(index / columns) * iconHeight,
        },
      );
      console.log(`rendered ${entry.representativeId} (${entry.researchIds.length})`);
    }

    const sheetDataUrl = await sheetPage.evaluate(() => {
      const canvas = document.getElementById('sheet') as HTMLCanvasElement | null;
      if (!canvas) throw new Error('Missing sheet canvas.');
      return canvas.toDataURL('image/png');
    });
    const sheetPng = Buffer.from(sheetDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
    await writeFile(path.join(outputDir, 'research-models-sheet.png'), sheetPng);
    await writeFile(
      path.join(outputDir, 'research-models-sheet.json'),
      `${JSON.stringify({
        image: 'research-models-sheet.png',
        iconWidth,
        iconHeight,
        displayWidth: 60,
        displayHeight: 46,
        columns,
        rows,
        items: Object.fromEntries(entries.map((entry, index) => [
          entry.key,
          {
            index,
            representativeId: entry.representativeId,
            researchIds: entry.researchIds,
            x: (index % columns) * iconWidth,
            y: Math.floor(index / columns) * iconHeight,
            width: iconWidth,
            height: iconHeight,
          },
        ])),
      }, null, 2)}\n`,
    );
    console.log(`wrote ${path.relative(root, path.join(outputDir, 'research-models-sheet.png'))}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
