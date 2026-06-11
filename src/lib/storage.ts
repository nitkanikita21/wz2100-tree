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
