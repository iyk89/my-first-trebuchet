import { maxPullBackDeg } from '../physics/geometry';
import type { Design } from '../physics/types';
import { fmtDeg, fmtLength, fmtMass, fmtRatio } from './format';
import { projectileById } from './projectiles';

export type StepId = 'size' | 'arm' | 'tower' | 'weight' | 'sling' | 'ball' | 'world';

export const STEPS: { id: StepId; label: string; title: string; intro: string }[] = [
  { id: 'size', label: 'Size', title: 'How big is it?', intro: 'Start from a ready-made machine, then make the whole thing bigger or smaller.' },
  { id: 'arm', label: 'Arm', title: 'The throwing arm', intro: 'The long beam that swings up and flings the ball.' },
  { id: 'tower', label: 'Tower', title: 'The tower', intro: 'The frame that holds the arm up in the air.' },
  { id: 'weight', label: 'Weight', title: 'The counterweight', intro: 'The heavy box that falls down and makes everything go.' },
  { id: 'sling', label: 'Sling', title: 'The sling', intro: 'The rope and pouch that hold the ball and whip it around.' },
  { id: 'ball', label: 'Ball', title: 'What are we throwing?', intro: 'Heavy or light, big or small. It all changes the flight.' },
  { id: 'world', label: 'World', title: 'The world', intro: 'Where are we throwing? Try other planets!' },
];

export interface NumberVar {
  key: keyof Design;
  label: string;
  kid: string; // one sentence a 6-year-old can follow
  tryThis?: string;
  format: (v: number) => string;
  min: (d: Design) => number;
  max: (d: Design) => number;
  log?: boolean;
  step?: number; // linear sliders
  /** Relative nudge for the - / + buttons (log sliders) */
  nudge?: number;
}

export const VARS: Record<string, NumberVar> = {
  armLength: {
    key: 'armLength',
    label: 'Arm length',
    kid: 'How long the whole beam is, end to end.',
    tryThis: 'Make it longer. Does the ball go farther, or does the arm just get slower?',
    format: fmtLength,
    min: () => 0.1,
    max: () => 25,
    log: true,
    nudge: 0.05,
  },
  pivotRatio: {
    key: 'pivotRatio',
    label: 'Where the arm turns',
    kid: 'How much longer the throwing side is than the weight side. 4 : 1 means 4 times longer.',
    tryThis: 'Slide the turning point toward the weight. The tip whips faster, but it gets harder to lift.',
    format: fmtRatio,
    min: () => 1.5,
    max: () => 8,
    step: 0.1,
  },
  armMass: {
    key: 'armMass',
    label: 'Arm weight',
    kid: 'How heavy the arm itself is. A heavy arm uses up energy.',
    tryThis: 'Make the arm lighter and see how much farther it throws.',
    format: fmtMass,
    min: () => 0.005,
    max: () => 5000,
    log: true,
    nudge: 0.1,
  },
  towerHeight: {
    key: 'towerHeight',
    label: 'Tower height',
    kid: 'How high the axle is. The weight needs room to fall.',
    tryThis: 'Make it shorter until the weight hits the ground!',
    format: fmtLength,
    min: (d) => d.armLength * 0.15,
    max: (d) => d.armLength * 1.5,
    log: false,
  },
  pullBack: {
    key: 'pullBack',
    label: 'Pull-back angle',
    kid: 'How far down the long arm is pulled before the throw.',
    tryThis: 'Pull it back less. The weight starts lower and has less to give.',
    format: fmtDeg,
    min: () => 5,
    max: (d) => maxPullBackDeg(d),
    step: 1,
  },
  cwMass: {
    key: 'cwMass',
    label: 'Weight',
    kid: 'How heavy the falling box is. This is where ALL the energy comes from.',
    tryThis: 'Double it. Does the ball go twice as far?',
    format: fmtMass,
    min: () => 0.02,
    max: () => 30000,
    log: true,
    nudge: 0.1,
  },
  hangerLength: {
    key: 'hangerLength',
    label: 'Hanger length',
    kid: 'How far below the arm the box hangs.',
    format: fmtLength,
    min: (d) => d.armLength * 0.02,
    max: (d) => d.armLength * 0.6,
  },
  slingLength: {
    key: 'slingLength',
    label: 'Sling length',
    kid: 'How long the rope is. Long slings whip harder, but too long is trouble.',
    tryThis: 'Make it about as long as the long side of the arm.',
    format: fmtLength,
    min: (d) => d.armLength * 0.15,
    max: (d) => d.armLength * 1.5,
  },
  releaseAngle: {
    key: 'releaseAngle',
    label: 'Release hook bend',
    kid: 'The hook at the tip that lets the sling go. Bend it more and the ball lets go sooner and flies higher.',
    tryThis: 'This is the secret tuning knob! Try small changes, like 5° at a time.',
    format: fmtDeg,
    min: () => 0,
    max: () => 110,
    step: 1,
  },
  projectileMass: {
    key: 'projectileMass',
    label: 'Ball weight',
    kid: 'How heavy the ball is.',
    format: fmtMass,
    min: () => 0.001,
    max: () => 300,
    log: true,
    nudge: 0.1,
  },
  projectileDiameter: {
    key: 'projectileDiameter',
    label: 'Ball size',
    kid: 'How wide the ball is. Bigger balls get pushed back more by the air.',
    format: fmtLength,
    min: () => 0.005,
    max: () => 0.8,
    log: true,
    nudge: 0.05,
  },
  wind: {
    key: 'wind',
    label: 'Wind',
    kid: 'Wind blowing toward the target helps. Wind in your face slows the ball.',
    format: (v) => (v === 0 ? 'No wind' : `${Math.abs(v)} m/s ${v > 0 ? 'behind you' : 'in your face'}`),
    min: () => -15,
    max: () => 15,
    step: 1,
  },
};

/** Human-readable list of what changed between two builds. */
export function describeChanges(from: Design, to: Design): string[] {
  const out: string[] = [];
  const num = (k: keyof Design, label: string, f: (v: number) => string) => {
    const a = from[k] as number;
    const b = to[k] as number;
    if (Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a))) out.push(`${label}: ${f(a)} → ${f(b)}`);
  };
  num('armLength', 'Arm length', fmtLength);
  num('pivotRatio', 'Turning point', fmtRatio);
  num('armMass', 'Arm weight', fmtMass);
  num('towerHeight', 'Tower', fmtLength);
  num('pullBack', 'Pull-back', fmtDeg);
  num('cwMass', 'Weight', fmtMass);
  if (from.cwStyle !== to.cwStyle) out.push(`Weight style: ${from.cwStyle} → ${to.cwStyle}`);
  num('hangerLength', 'Hanger', fmtLength);
  num('slingLength', 'Sling', fmtLength);
  num('releaseAngle', 'Release hook', fmtDeg);
  if (from.projectileId !== to.projectileId)
    out.push(`Ball: ${projectileById(from.projectileId).name} → ${projectileById(to.projectileId).name}`);
  else {
    num('projectileMass', 'Ball weight', fmtMass);
    num('projectileDiameter', 'Ball size', fmtLength);
  }
  if (from.planet !== to.planet) out.push(`Planet: ${from.planet} → ${to.planet}`);
  if (from.air !== to.air) out.push(`Air: ${from.air ? 'on' : 'off'} → ${to.air ? 'on' : 'off'}`);
  num('wind', 'Wind', (v) => `${v} m/s`);
  return out;
}

export function sameDesign(a: Design, b: Design) {
  return describeChanges(a, b).length === 0;
}
