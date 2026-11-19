import { PROJECTILES } from '../data/projectiles';
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

/** Height of the weight box. A hinged box too tall for its hanger is drawn flatter and wider (same sand). */
export function cwBoxHeight(g: Geometry) {
  return g.hinged && g.cwSize / 2 > g.Lh * 0.85 ? g.Lh * 1.7 : g.cwSize;
}

/** How high the bottom of the weight box gets at the lowest point of its swing (negative = below ground). */
export function cwLowestBottom(g: Geometry) {
  return g.H - g.Lb - (g.hinged ? g.Lh : 0) - cwBoxHeight(g) / 2;
}

export interface BuildFix {
  label: string;
  patch: Partial<Design>;
}

/** True when the ball is so big its middle sits above the axle, or the sling can't reach it. */
export function ballTooBig(g: Geometry) {
  const tipY = g.H + g.La * Math.sin(-Math.PI + g.pullBack);
  return g.r >= g.H || tipY - g.r < -g.Ls;
}

export interface BuildIssue {
  part: 'weight' | 'arm' | 'sling' | 'ball';
  message: string;
  fixes: BuildFix[];
}

/** Round up (or down) to 2 significant figures so suggested numbers stay friendly. */
function nice(v: number, up: boolean) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 1);
  return (up ? Math.ceil(v / p) : Math.floor(v / p)) * p;
}

/** Problems you'll see when you throw, each with one-tap fixes that would solve it. */
export function buildIssues(d: Design): BuildIssue[] {
  const g = geometry(d);
  const issues: BuildIssue[] = [];
  const bottom = cwLowestBottom(g);
  if (bottom < 0) {
    const L = g.La + g.Lb;
    const gap = Math.max(0.03 * L, 0.01); // leave a little room under the weight
    const hang = g.hinged ? g.Lh : 0;
    const boxH = cwBoxHeight(g);
    const fixes: BuildFix[] = [];

    const tower = nice(g.Lb + hang + boxH / 2 + gap, true);
    fixes.push({ label: `Taller tower: ${fmtLen(tower)}`, patch: { towerHeight: tower } });

    const lbMax = g.H - hang - boxH / 2 - gap;
    if (lbMax > 0) {
      const ratio = Math.ceil((L / lbMax - 1) * 10) / 10;
      if (ratio <= 8) fixes.push({ label: `Turning point: ${ratio} : 1`, patch: { pivotRatio: ratio } });
    }
    if (g.hinged) {
      const lhMax = nice(g.H - g.Lb - boxH / 2 - gap, false);
      if (lhMax >= 0.02 * L && lhMax > boxH / 2) fixes.push({ label: `Shorter hanger: ${fmtLen(lhMax)}`, patch: { hangerLength: lhMax } });
    }
    const room = g.H - g.Lb - hang - gap;
    if (room > 0) {
      const mass = nice(CW_DENSITY * Math.pow(2 * room, 3), false);
      if (mass >= 0.02 && mass < g.mc) fixes.push({ label: `Lighter weight: ${fmtKg(mass)}`, patch: { cwMass: mass } });
    }

    issues.push({
      part: 'weight',
      message: `The weight will smash into the ground when it swings down (it needs ${fmtLen(-bottom + gap)} more room).`,
      fixes,
    });
  }
  if (ballTooBig(g)) {
    const fixes: BuildFix[] = [{ label: `Taller tower: ${fmtLen(nice(Math.max(g.r * 2.5, g.H * 1.2), true))}`, patch: { towerHeight: nice(Math.max(g.r * 2.5, g.H * 1.2), true) } }];
    const smaller = [...PROJECTILES].reverse().find((p) => p.id !== 'custom' && p.diameter / 2 < g.H * 0.3);
    if (smaller) fixes.push({ label: `Smaller ball: ${smaller.name}`, patch: { projectileId: smaller.id, projectileMass: smaller.mass, projectileDiameter: smaller.diameter } });
    issues.push({ part: 'ball', message: 'The ball is bigger than this machine! It sits higher than the arm can reach.', fixes });
  }
  return issues;
}

function fmtLen(m: number) {
  return m < 1 ? `${Math.round(m * 100)} cm` : `${Number(m.toFixed(2))} m`;
}
function fmtKg(kg: number) {
  return kg < 1 ? `${Math.round(kg * 1000)} g` : `${Number(kg.toPrecision(2)).toLocaleString()} kg`;
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
    // (if the ball is too big for the sling to reach, point the sling straight up; the build is flagged)
    psi = drop < -g.Ls ? Math.PI / 2 : Math.atan2(-drop, Math.sqrt(g.Ls * g.Ls - drop * drop));
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
