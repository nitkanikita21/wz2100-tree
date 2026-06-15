import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import type { ResearchResult } from '../types';
import uk from '../i18n/uk';
import { makeNode } from './testFixture';
import {
  describeNode,
  formatDuration,
  formatResult,
  minResearchSeconds,
  resolveName,
  type Translate,
} from './researchResults';

// Реальний український каталог: тести лишаються змістовними (перевіряють і переклади).
const i18n = createI18n({
  legacy: false,
  locale: 'uk',
  messages: { uk },
  missing: (_locale, key) => key.split('.').pop() ?? key,
  missingWarn: false,
  fallbackWarn: false,
});
const t: Translate = (key, named) => (named ? i18n.global.t(key, named) : i18n.global.t(key));

const names = new Map<string, string>([
  ['AutoRepair', 'Auto-Repair'],
  ['CommandBrain01', 'Command Turret'],
  ['Cyb-Hvywpn-TK', 'Cyborg Thermite'],
]);

describe('minResearchSeconds', () => {
  it('divides points by lab rate and rounds up', () => {
    expect(minResearchSeconds(14400, 96.2)).toBe(150); // 149.7 -> 150
    expect(minResearchSeconds(96, 96)).toBe(1);
  });
  it('guards against zero rate', () => {
    expect(minResearchSeconds(1000, 0)).toBe(0);
  });
});

describe('formatDuration', () => {
  it('formats minutes:seconds', () => {
    expect(formatDuration(150)).toBe('2:30');
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(0)).toBe('0:00');
  });
  it('adds an hours field past an hour', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });
});

describe('formatResult', () => {
  it('labels a BodyClass-filtered upgrade', () => {
    const r: ResearchResult = {
      class: 'Body', parameter: 'Thermal', value: 45,
      filterParameter: 'BodyClass', filterValue: 'Cyborgs',
    };
    expect(formatResult(r, names, t)).toBe('Кіборги: Тепловий захист +45%');
  });
  it('labels an ImpactClass-filtered weapon upgrade', () => {
    const r: ResearchResult = {
      class: 'Weapon', parameter: 'Damage', value: 25,
      filterParameter: 'ImpactClass', filterValue: 'CANNON',
    };
    expect(formatResult(r, names, t)).toBe('Гармати: Пошкодження +25%');
  });
  it('resolves an Id filter through the name lookup', () => {
    const r: ResearchResult = {
      class: 'Brain', parameter: 'HitPoints', value: 20,
      filterParameter: 'Id', filterValue: 'CommandBrain01',
    };
    expect(formatResult(r, names, t)).toBe('Command Turret: Міцність +20%');
  });
  it('falls back to the class label when there is no filter', () => {
    const r: ResearchResult = { class: 'Brain', parameter: 'BaseCommandLimit', value: 20 };
    expect(formatResult(r, names, t)).toBe('Командний модуль: Базовий ліміт команд +20%');
  });
  it('shows negative values and renders unknown tokens verbatim', () => {
    const r: ResearchResult = { class: 'Xeno', parameter: 'Mystery', value: -10 };
    expect(formatResult(r, names, t)).toBe('Xeno: Mystery -10%');
  });
});

describe('resolveName', () => {
  it('returns the friendly name or the raw id', () => {
    expect(resolveName('AutoRepair', names)).toBe('Auto-Repair');
    expect(resolveName('Unknown-X', names)).toBe('Unknown-X');
  });
});

describe('describeNode', () => {
  it('summarises unlocks and improved parameters', () => {
    const node = makeNode('R-Test');
    node.resultComponents = ['AutoRepair'];
    node.results = [
      { class: 'Body', parameter: 'Thermal', value: 45 },
      { class: 'Body', parameter: 'Armour', value: 30 },
      { class: 'Body', parameter: 'Thermal', value: 10 }, // duplicate param collapses
    ];
    expect(describeNode(node, names, t)).toBe(
      'Розблоковує: Auto-Repair. Покращує: Тепловий захист, Броня',
    );
  });
  it('returns an empty string when there is nothing to say', () => {
    expect(describeNode(makeNode('R-Empty'), names, t)).toBe('');
  });
});
