import { geometry, startAngles } from '../physics/geometry';
import { simulate } from '../physics/simulate';
import type { Design, FailureCode } from '../physics/types';

export interface ReleasePreview {
  ok: boolean;
  failure?: FailureCode;
  theta: number;
  phi: number;
  psi: number;
  bx: number;
  by: number;
  vx: number;
  vy: number;
  angle: number; // launch angle in degrees
}

let lastDesign: Design | null = null;
let last: ReleasePreview | null = null;

/**
 * Where everything is at the exact moment the ball lets go, for the current build.
 * Runs the physics only up to the release (a few milliseconds) and remembers the answer
 * until the build changes.
 */
export function releasePreview(d: Design): ReleasePreview {
  if (d === lastDesign && last) return last;
  const out = simulate(d, { stopAtRelease: true });
  const f = out.frames[out.frames.length - 1];
  if (out.launch && f) {
    last = {
      ok: true,
      theta: f.theta,
      phi: f.phi,
      psi: f.psi,
      bx: f.bx,
      by: f.by,
      vx: out.launch.vx,
      vy: out.launch.vy,
      angle: (Math.atan2(out.launch.vy, out.launch.vx) * 180) / Math.PI,
    };
  } else {
    const a = startAngles(geometry(d));
    last = { ok: false, failure: out.failure, theta: a.theta, phi: a.phi, psi: a.psi, bx: 0, by: 0, vx: 0, vy: 0, angle: 0 };
  }
  lastDesign = d;
  return last;
}
