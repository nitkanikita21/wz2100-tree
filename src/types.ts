export type Branch =
  | 'weapon' | 'defence' | 'droid' | 'cyborg'
  | 'system' | 'structure' | 'power' | 'computer';

/** Один stat-апгрейд із поля `results` у research.json. */
export interface ResearchResult {
  class: string;             // "Weapon" | "Body" | "Brain" | ...
  parameter: string;         // "Damage" | "Thermal" | "HitPoints" | ...
  value: number;             // зазвичай % модифікатор (може бути від'ємним)
  filterParameter?: string;  // "BodyClass" | "ImpactClass" | "Type" | "Id"
  filterValue?: string;      // "Cyborgs" | "CANNON" | ...
}

export interface ResearchNode {
  id: string;                // "R-Wpn-Cannon1Mk1"
  name: string;              // "Light Cannon" (EN, з даних гри)
  points: number;            // researchPoints
  cost: number;              // researchPower
  branch: Branch;            // з iconID
  icon: string;              // "image_res_weapontech.png"
  subIcon: string | null;    // "image_res_grpdam.png" | null
  category: string | null;   // "Cannon Damage" | null
  prereqs: string[];         // requiredResearch
  resultComponents: string[];
  resultStructures: string[];
  results: ResearchResult[];       // stat-апгрейди (поле results)
  requiredStructures: string[];    // де можна дослідити
  redComponents: string[];         // компоненти, що стають застарілими
  redStructures: string[];         // споруди, що стають застарілими
  models: string[];          // .pie-моделі для research-preview
  modelGroups: ModelGroup[]; // окремі preview-обʼєкти; складені частини всередині group.models
  x: number;                 // прекомпʼючені ELK-координати
  y: number;
}

export interface ModelGroup {
  id: string;
  models: string[];
  parts: ModelPart[];
  scaleMode?: 'component' | 'research' | 'structure';
  structureBasePlate?: number;
  componentScaleMultiplier?: number;
}

export interface ModelPart {
  model: string;
  attachToPrevious: boolean;
}

export interface ResearchData {
  version: string;           // "4.7.0"
  nodeCount: number;
  /** Макс. очок дослідження/сек повністю прокачаної лабораторії (лаб+модуль+апгрейди). */
  maxLabResearchPoints: number;
  /** id компонента/споруди -> дружня назва (тільки для згаданих у вузлах id). */
  componentNames: Record<string, string>;
  nodes: ResearchNode[];
}

export interface Plan {
  id: string;                // crypto.randomUUID()
  name: string;
  goals: string[];           // research ids — цілі
  queue: string[];           // повна впорядкована черга (цілі + пререквізити)
}

export type NodeStatus = 'researched' | 'available' | 'locked';
