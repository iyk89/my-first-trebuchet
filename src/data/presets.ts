import type { Design } from '../physics/types';
import { projectileById } from './projectiles';

function withBall(d: Omit<Design, 'projectileMass' | 'projectileDiameter'>): Design {
  const p = projectileById(d.projectileId);
  return { ...d, projectileMass: p.mass, projectileDiameter: p.diameter };
}

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  design: Design;
}

const world = { planet: 'earth' as const, air: true, wind: 0 };

export const PRESETS: Preset[] = [
  {
    id: 'lego',
    name: 'Lego mini',
    blurb: 'About the size of a LEGO build. Throws a marble.',
    design: withBall({
      armLength: 0.32,
      pivotRatio: 3,
      armMass: 0.03,
      towerHeight: 0.2,
      pullBack: 60,
      cwMass: 0.4,
      cwStyle: 'hinged',
      hangerLength: 0.05,
      slingLength: 0.18,
      releaseAngle: 50,
      projectileId: 'marble',
      ...world,
    }),
  },
  {
    id: 'tabletop',
    name: 'Tabletop',
    blurb: 'Fits on a table. Throws a golf ball across the yard.',
    design: withBall({
      armLength: 1.0,
      pivotRatio: 3.5,
      armMass: 0.3,
      towerHeight: 0.6,
      pullBack: 60,
      cwMass: 5,
      cwStyle: 'hinged',
      hangerLength: 0.15,
      slingLength: 0.55,
      releaseAngle: 50,
      projectileId: 'golf',
      ...world,
    }),
  },
  {
    id: 'backyard',
    name: 'Backyard',
    blurb: 'Taller than a grown-up. Throws a water balloon.',
    design: withBall({
      armLength: 2.8,
      pivotRatio: 4,
      armMass: 5,
      towerHeight: 1.6,
      pullBack: 60,
      cwMass: 60,
      cwStyle: 'hinged',
      hangerLength: 0.4,
      slingLength: 1.8,
      releaseAngle: 50,
      projectileId: 'waterballoon',
      ...world,
    }),
  },
  {
    id: 'castle',
    name: 'Castle giant',
    blurb: 'A real siege engine. Throws a boulder.',
    design: withBall({
      armLength: 14,
      pivotRatio: 4.5,
      armMass: 900,
      towerHeight: 7.5,
      pullBack: 60,
      cwMass: 8000,
      cwStyle: 'hinged',
      hangerLength: 2,
      slingLength: 10,
      releaseAngle: 50,
      projectileId: 'boulder',
      ...world,
    }),
  },
];

export const DEFAULT_DESIGN: Design = PRESETS[1].design;
