export type Branch =
  | 'weapon' | 'defence' | 'droid' | 'cyborg'
  | 'system' | 'structure' | 'power' | 'computer';

export interface ResearchNode {
  id: string;                // "R-Wpn-Cannon1Mk1"
  name: string;              // "Light Cannon" (EN, з даних гри)
  points: number;            // researchPoints
  branch: Branch;            // з iconID
  icon: string;              // "image_res_weapontech.png"
  subIcon: string | null;    // "image_res_grpdam.png" | null
  category: string | null;   // "Cannon Damage" | null
  prereqs: string[];         // requiredResearch
  resultComponents: string[];
  resultStructures: string[];
  x: number;                 // прекомпʼючені ELK-координати
  y: number;
}

export interface ResearchData {
  version: string;           // "4.7.0"
  nodeCount: number;
  nodes: ResearchNode[];
}

export interface Plan {
  id: string;                // crypto.randomUUID()
  name: string;
  goals: string[];           // research ids — цілі
  queue: string[];           // повна впорядкована черга (цілі + пререквізити)
}

export type NodeStatus = 'researched' | 'available' | 'locked';
