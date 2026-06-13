export interface PieMesh {
  texture: string | null;
  radius: number;
  vertices: number[];
  uvs: number[];
  indices: number[];
  connectors: [number, number, number][];
}

function nextUsefulLine(lines: string[], start: number): { line: string; index: number } | null {
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line && !line.startsWith('#')) return { line, index: i };
  }
  return null;
}

export function parsePieModel(text: string): PieMesh {
  const lines = text.split(/\r?\n/);
  const points: [number, number, number][] = [];
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const connectors: [number, number, number][] = [];
  let texture: string | null = null;
  let pieVersion = 2;
  let textureWidth = 256;
  let textureHeight = 256;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();

    if (line.startsWith('PIE ')) {
      pieVersion = Number(line.split(/\s+/)[1]) || 2;
    }

    if (line.startsWith('TEXTURE ') && texture === null) {
      const parts = line.split(/\s+/);
      texture = parts[2]?.toLowerCase() ?? null;
      textureWidth = Number(parts[3]) || 256;
      textureHeight = Number(parts[4]) || textureWidth;
    }

    if (line.startsWith('POINTS ')) {
      const count = Number(line.split(/\s+/)[1]);
      for (let p = 0; p < count; p++) {
        const pointLine = nextUsefulLine(lines, i + 1);
        if (!pointLine) break;
        i = pointLine.index;
        const [x, y, z] = pointLine.line.split(/\s+/).map(Number);
        if ([x, y, z].every(Number.isFinite)) {
          points.push([x!, y!, z!]);
        }
      }
    }

    if (line.startsWith('POLYGONS ')) {
      const count = Number(line.split(/\s+/)[1]);
      for (let p = 0; p < count; p++) {
        const polyLine = nextUsefulLine(lines, i + 1);
        if (!polyLine) break;
        i = polyLine.index;
        const parts = polyLine.line.split(/\s+/).map(Number);
        const vertexCount = parts[1] ?? 0;
        const polyIndices = parts.slice(2, 2 + vertexCount);
        const uvOffset = 2 + vertexCount;
        const polyUvs = Array.from({ length: vertexCount }, (_, index) => {
          const u = parts[uvOffset + index * 2] ?? 0;
          const v = parts[uvOffset + index * 2 + 1] ?? 0;
          const normalizedU = pieVersion >= 3 ? u : u / textureWidth;
          const normalizedV = pieVersion >= 3 ? v : v / textureHeight;
          return [normalizedU, 1 - normalizedV] as const;
        });

        for (let n = 1; n < polyIndices.length - 1; n++) {
          for (const pointIndex of [0, n, n + 1]) {
            const sourceIndex = polyIndices[pointIndex]!;
            const point = points[sourceIndex];
            const uv = polyUvs[pointIndex]!;
            if (!point) continue;

            vertices.push(...point);
            uvs.push(...uv);
            indices.push(indices.length);
          }
        }
      }
    }

    if (line.startsWith('CONNECTORS ')) {
      const count = Number(line.split(/\s+/)[1]);
      for (let c = 0; c < count; c++) {
        const connectorLine = nextUsefulLine(lines, i + 1);
        if (!connectorLine) break;
        i = connectorLine.index;
        const [x, y, z] = connectorLine.line.split(/\s+/).map(Number);
        if ([x, y, z].every(Number.isFinite)) {
          // PIE connectors use the third coordinate as height for attached parts.
          connectors.push([x!, z!, y!]);
        }
      }
    }
  }

  return {
    texture,
    radius: Math.max(...points.map(([x, y, z]) => Math.hypot(x, y, z)), 1),
    vertices,
    uvs,
    indices,
    connectors,
  };
}
