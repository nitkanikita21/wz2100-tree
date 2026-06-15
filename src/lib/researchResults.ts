import type { ResearchNode, ResearchResult } from '../types';

/** id компонента/споруди -> дружня назва (з ResearchData.componentNames). */
export type NameLookup = Pick<Map<string, string>, 'get'>;

/** Перекладач: ключ i18n (+ іменовані параметри) -> рядок. */
export type Translate = (key: string, named?: Record<string, unknown>) => string;

/** Назва id з фолбеком на сам id (для невідомих/відсутніх у даних). */
export function resolveName(id: string, names: NameLookup): string {
  return names.get(id) ?? id;
}

/** До якого підмножини застосовується апгрейд: "Кіборги", "Гармати", назва компонента тощо. */
function scopeLabel(result: ResearchResult, names: NameLookup, t: Translate): string {
  if (result.filterValue == null) return t(`research.class.${result.class}`);
  if (result.filterParameter === 'Id') return resolveName(result.filterValue, names);
  return t(`research.filter.${result.filterValue}`);
}

function signedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}%`;
}

/** Один апгрейд у читабельний рядок, напр. "Кіборги: Тепловий захист +45%". */
export function formatResult(result: ResearchResult, names: NameLookup, t: Translate): string {
  return `${scopeLabel(result, names, t)}: ${t(`research.param.${result.parameter}`)} ${signedPercent(result.value)}`;
}

/** Мінімальний час дослідження (секунди) при заданій потужності лабораторії. */
export function minResearchSeconds(points: number, ratePerSecond: number): number {
  if (ratePerSecond <= 0) return 0;
  return Math.ceil(points / ratePerSecond);
}

/** Секунди -> "хв:сс" або "г:хх:сс". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Короткий авто-опис: що розблоковує і які характеристики покращує. ("" якщо нічого.) */
export function describeNode(node: ResearchNode, names: NameLookup, t: Translate): string {
  const parts: string[] = [];

  const unlocks = [...node.resultStructures, ...node.resultComponents]
    .map((id) => resolveName(id, names));
  if (unlocks.length) parts.push(t('research.phrase.unlocks', { items: unlocks.join(', ') }));

  if (node.results.length) {
    const distinct: string[] = [];
    for (const r of node.results) {
      const label = t(`research.param.${r.parameter}`);
      if (!distinct.includes(label)) distinct.push(label);
    }
    const improves = t('research.phrase.improves', { items: distinct.slice(0, 4).join(', ') });
    const more = distinct.length > 4
      ? ` ${t('research.phrase.andMore', { count: distinct.length - 4 })}`
      : '';
    parts.push(improves + more);
  }

  return parts.join('. ');
}
