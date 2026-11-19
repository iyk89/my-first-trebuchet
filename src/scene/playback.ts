import { geometry, pose, startAngles } from '../physics/geometry';
import type { Design, Frame, SimOutput } from '../physics/types';
import { useStore } from '../state/store';

/** Smoothly blended snapshot of the throw at time t. */
export function frameAt(sim: SimOutput, t: number): Frame {
  const f = sim.frames;
  if (t <= f[0].t) return f[0];
  const last = f[f.length - 1];
  if (t >= last.t) return last;
  let lo = 0;
  let hi = f.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (f[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = f[lo];
  const b = f[hi];
  const u = (t - a.t) / (b.t - a.t);
  if (a.released !== b.released) return u < 0.5 ? a : b;
  const l = (x: number, y: number) => x + (y - x) * u;
  return {
    t,
    theta: l(a.theta, b.theta),
    phi: l(a.phi, b.phi),
    psi: l(a.psi, b.psi),
    bx: l(a.bx, b.bx),
    by: l(a.by, b.by),
    released: a.released,
  };
}

export function frameIndexAt(sim: SimOutput, t: number): number {
  const f = sim.frames;
  let lo = 0;
  let hi = f.length - 1;
  if (t >= f[hi].t) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (f[mid].t <= t) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The pose to draw right now: the cocked build pose, or the current moment of the throw. */
export function currentFrame(design: Design): Frame {
  const s = useStore.getState();
  if (s.mode === 'throw' && s.sim && s.sim.frames.length > 0) return frameAt(s.sim, s.playTime);
  const g = geometry(design);
  const a = startAngles(g);
  const p = pose(g, a.theta, a.phi, a.psi);
  return { t: 0, theta: a.theta, phi: a.phi, psi: a.psi, bx: p.ball[0], by: p.ball[1], released: false };
}

export function simEndTime(sim: SimOutput) {
  return sim.frames.length ? sim.frames[sim.frames.length - 1].t : 0;
}
