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
