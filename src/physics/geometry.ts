import type { Design, Planet } from './types';

export const PLANETS: Record<Planet, { g: number; airDensity: number; label: string }> = {
  earth: { g: 9.81, airDensity: 1.225, label: 'Earth' },
  moon: { g: 1.62, airDensity: 0, label: 'Moon' },
  mars: { g: 3.71, airDensity: 0.02, label: 'Mars' },
};

/** Counterweight box is filled with sand/rocks, about 1600 kg per cubic meter. */
export const CW_DENSITY = 1600;
export const DRAG_COEFF = 0.47; // a smooth ball

export interface Geometry {
  La: number; // long side of the arm (pivot to sling tip)
  Lb: number; // short side (pivot to weight end)
  H: number; // axle height
  da: number; // arm center of mass, measured from pivot toward the long tip
  Ia: number; // arm inertia about the pivot
  ma: number;
  mc: number;
  hinged: boolean;
  Lh: number;
  cwSize: number; // edge length of the weight box
  Icbox: number; // weight box inertia about its own center
  mp: number;
  r: number; // ball radius
  Ls: number;
  g: number;
  dragK: number; // drag acceleration factor: a = dragK * v^2
  wind: number;
  pullBack: number; // radians, after limiting to what fits
  maxPullBack: number; // radians
  releaseAngle: number; // radians
  tScale: number; // natural time scale of the machine (s)
}

export function maxPullBackDeg(d: Design): number {
  const La = longArm(d);
  const clearance = Math.max(d.projectileDiameter / 2, 0.02 * La);
  const s = (d.towerHeight - clearance) / La;
  const deg = s >= 1 ? 90 : (Math.asin(Math.max(0, s)) * 180) / Math.PI;
  return Math.min(80, deg);
}

export function longArm(d: Design) {
  return (d.armLength * d.pivotRatio) / (d.pivotRatio + 1);
}
export function shortArm(d: Design) {
  return d.armLength / (d.pivotRatio + 1);
}
export function cwSize(mass: number) {
  return Math.cbrt(mass / CW_DENSITY);
}

export function geometry(d: Design): Geometry {
  const La = longArm(d);
  const Lb = shortArm(d);
  const L = d.armLength;
  const da = (La - Lb) / 2;
  const ma = d.armMass;
  const Ia = ma * (L * L / 12 + da * da);
  const size = cwSize(d.cwMass);
  const planet = PLANETS[d.planet];
  const r = d.projectileDiameter / 2;
  const area = Math.PI * r * r;
  const rho = d.air ? planet.airDensity : 0;
  const maxPb = (maxPullBackDeg(d) * Math.PI) / 180;
  return {
    La,
    Lb,
    H: d.towerHeight,
    da,
    Ia,
    ma,
    mc: d.cwMass,
    hinged: d.cwStyle === 'hinged',
    Lh: d.hangerLength,
    cwSize: size,
    Icbox: (d.cwMass * size * size) / 6,
    mp: d.projectileMass,
    r,
    Ls: d.slingLength,
    g: planet.g,
    dragK: (0.5 * rho * DRAG_COEFF * area) / d.projectileMass,
    wind: d.air ? d.wind : 0,
    pullBack: Math.min((d.pullBack * Math.PI) / 180, maxPb),
    maxPullBack: maxPb,
    releaseAngle: (d.releaseAngle * Math.PI) / 180,
    tScale: Math.sqrt(L / planet.g),
  };
}

export interface BuildIssue {
  part: 'weight' | 'arm' | 'sling' | 'ball';
  message: string;
  fix: string;
}

/** Things that would make the build physically impossible. */
export function buildIssues(d: Design): BuildIssue[] {
  const g = geometry(d);
  const issues: BuildIssue[] = [];
  const lowest = g.H - g.Lb - (g.hinged ? g.Lh : 0) - g.cwSize / 2;
  if (lowest < 0) {
    issues.push({
      part: 'weight',
      message: 'The weight would smash into the ground when it falls.',
      fix: g.hinged
        ? 'Make the tower taller, the hanger shorter, or move the pivot toward the weight.'
        : 'Make the tower taller or move the pivot toward the weight.',
    });
  }
  return issues;
}

/** Initial arm/sling angles for the cocked "ready to throw" pose. */
export function startAngles(g: Geometry) {
  // Long arm points back and down; it swings clockwise (angle decreasing) up and over the top.
  const theta = -Math.PI + g.pullBack;
  const phi = -Math.PI / 2; // hinged weight hangs straight down
  const tipY = g.H + g.La * Math.sin(theta);
  const drop = tipY - g.r; // how far above the trough the sling tip is
  let psi: number;
  let onGround: boolean;
  if (drop >= g.Ls) {
    psi = -Math.PI / 2; // sling can't reach the ground: ball hangs straight down
    onGround = false;
  } else {
    // ball lies in the trough in front of the tip, sling stretched along the ground
    psi = Math.atan2(-drop, Math.sqrt(g.Ls * g.Ls - drop * drop));
    onGround = true;
  }
  return { theta, phi, psi, onGround };
}

export interface Pose {
  pivot: [number, number];
  tip: [number, number];
  shortEnd: [number, number];
  cw: [number, number]; // center of the weight
  cwAngle: number; // rotation of the weight box
  ball: [number, number];
}

/** Positions of every part for given angles (pivot sits at x = 0). */
export function pose(g: Geometry, theta: number, phi: number, psi: number): Pose {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const pivot: [number, number] = [0, g.H];
  const tip: [number, number] = [g.La * c, g.H + g.La * s];
  const shortEnd: [number, number] = [-g.Lb * c, g.H - g.Lb * s];
  let cw: [number, number];
  let cwAngle: number;
  if (g.hinged) {
    cw = [shortEnd[0] + g.Lh * Math.cos(phi), shortEnd[1] + g.Lh * Math.sin(phi)];
    cwAngle = phi + Math.PI / 2;
  } else {
    cw = shortEnd;
    cwAngle = theta;
  }
  const ball: [number, number] = [tip[0] + g.Ls * Math.cos(psi), tip[1] + g.Ls * Math.sin(psi)];
  return { pivot, tip, shortEnd, cw, cwAngle, ball };
}
