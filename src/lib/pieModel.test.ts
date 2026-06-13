import { describe, expect, it } from 'vitest';
import { parsePieModel } from './pieModel';

describe('parsePieModel', () => {
  it('парсить PIE2 точки, pixel UV і триангулює quad-полігон', () => {
    const model = parsePieModel(`
PIE 2
TEXTURE 0 page-17-droid-weapons.png 256 256
LEVELS 1
LEVEL 1
POINTS 4
  0 1 0
  10 1 0
  10 1 10
  0 1 10
POLYGONS 1
  200 4 0 1 2 3 0 0 128 0 128 128 0 128
CONNECTORS 1
  4 5 6
`);

    expect(model.texture).toBe('page-17-droid-weapons.png');
    expect(model.radius).toBeCloseTo(Math.hypot(10, 1, 10));
    expect(model.vertices).toEqual([
      0, 1, 0,
      10, 1, 0,
      10, 1, 10,
      0, 1, 0,
      10, 1, 10,
      0, 1, 10,
    ]);
    expect(model.uvs).toEqual([
      0, 1,
      0.5, 1,
      0.5, 0.5,
      0, 1,
      0.5, 0.5,
      0, 0.5,
    ]);
    expect(model.indices).toEqual([0, 1, 2, 3, 4, 5]);
    expect(model.connectors).toEqual([[4, 6, 5]]);
  });

  it('не ділить PIE4 normalized UV на розмір текстури', () => {
    const model = parsePieModel(`
PIE 4
TEXTURE 0 page-34-buildings.png
LEVELS 1
LEVEL 1
POINTS 3
  0 0 0
  10 0 0
  0 10 0
POLYGONS 1
  200 3 0 1 2 0.25 0.5 0.75 0.5 0.25 0.75
`);

    expect(model.texture).toBe('page-34-buildings.png');
    expect(model.uvs).toEqual([
      0.25, 0.5,
      0.75, 0.5,
      0.25, 0.25,
    ]);
  });

  it('не ділить PIE3 normalized UV на розмір текстури', () => {
    const model = parsePieModel(`
PIE 3
TEXTURE 0 page-17-droid-weapons.png 0 0
LEVELS 1
LEVEL 1
POINTS 3
  0 0 0
  10 0 0
  0 10 0
POLYGONS 1
  200 3 0 1 2 0.5 0.25 0.75 0.25 0.5 0.75
`);

    expect(model.uvs).toEqual([
      0.5, 0.75,
      0.75, 0.75,
      0.5, 0.25,
    ]);
  });
});
