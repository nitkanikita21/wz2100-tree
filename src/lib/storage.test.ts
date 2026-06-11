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
