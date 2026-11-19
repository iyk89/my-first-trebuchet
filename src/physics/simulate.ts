/**
 * Trebuchet physics.
 *
 * The machine is modeled as connected parts swinging in a vertical plane:
 *   - the arm turns on a fixed axle (angle theta)
 *   - the sling hangs from the arm tip (angle psi) with the ball at its end
 *   - a hinged counterweight hangs from the short end (angle phi); a fixed one is bolted on
 *
 * Equations of motion come from Lagrangian mechanics (M * accel = forces), solved with a
 * 4th-order Runge-Kutta integrator at a small fixed time step, so the same build always
 * gives exactly the same result. While the ball is dragged along the trough, the ground
 * holds it up (a constraint force); once the sling lifts it, it swings free. The ball lets
 * go when the sling swings past the release-hook angle, then flies with gravity and air drag.
 */
import { ballTooBig, cwBoxHeight, geometry, startAngles, type Geometry } from './geometry';
import type { Design, Frame, Results, SimOutput } from './types';

type Phase = 'ground' | 'swing' | 'released';
type Vec6 = [number, number, number, number, number, number]; // theta, psi, phi, and their rates

function solve3(M: number[][], b: number[]): number[] {
  // Gaussian elimination with partial pivoting on a 3x3 system.
  const A = M.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = c + 1; r < 3; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 4; k++) A[r][k] -= f * A[c][k];
    }
  }
  const x = [0, 0, 0];
  for (let r = 2; r >= 0; r--) {
    let s = A[r][3];
    for (let k = r + 1; k < 3; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}

interface Accel {
  acc: [number, number, number];
  normal: number; // ground push on the ball (ground phase only)
}

function accelerations(g: Geometry, s: Vec6, phase: Phase, damp: number): Accel {
  const [th, ps, ph, thd, psd, phd] = s;
  const cth = Math.cos(th), sth = Math.sin(th);
  const cps = Math.cos(ps), sps = Math.sin(ps);
  const cph = Math.cos(ph), sph = Math.sin(ph);

  const M = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const rhs = [0, 0, 0];

  // Arm turning on its axle
  M[0][0] += g.Ia;
  rhs[0] += -g.ma * g.g * g.da * cth;

  // Counterweight
  if (g.hinged) {
    const j0 = [g.Lb * sth, -g.Lb * cth]; // d(position)/d(theta)
    const j2 = [-g.Lh * sph, g.Lh * cph]; // d(position)/d(phi)
    const ax = g.Lb * cth * thd * thd - g.Lh * cph * phd * phd;
    const ay = g.Lb * sth * thd * thd - g.Lh * sph * phd * phd;
    const fx = -g.mc * ax;
    const fy = -g.mc * g.g - g.mc * ay;
    M[0][0] += g.mc * (j0[0] * j0[0] + j0[1] * j0[1]);
    const m02 = g.mc * (j0[0] * j2[0] + j0[1] * j2[1]);
    M[0][2] += m02;
    M[2][0] += m02;
    M[2][2] += g.mc * g.Lh * g.Lh + g.Icbox;
    rhs[0] += j0[0] * fx + j0[1] * fy;
    rhs[2] += j2[0] * fx + j2[1] * fy;
  } else {
    M[0][0] += g.mc * g.Lb * g.Lb + g.Icbox;
    rhs[0] += g.mc * g.g * g.Lb * cth;
    M[2][2] = 1; // phi unused
  }

  if (phase === 'released') {
    // Machine keeps swinging on its own; friction slowly settles it.
    rhs[0] += -damp * M[0][0] * thd;
    if (g.hinged) rhs[2] += -damp * M[2][2] * phd;
    M[1][1] = 1;
    const a = solve3(M, rhs);
    // Empty sling dangles from the moving tip like a pendulum.
    const atx = g.La * (-sth * a[0] - cth * thd * thd);
    const aty = g.La * (cth * a[0] - sth * thd * thd);
    const psdd = (-sps * (0 - atx) + cps * (-g.g - aty)) / g.Ls - 3 * damp * psd;
    return { acc: [a[0], psdd, g.hinged ? a[2] : 0], normal: 0 };
  }

  // Ball in the sling
  const j0 = [-g.La * sth, g.La * cth];
  const j1 = [-g.Ls * sps, g.Ls * cps];
  const vx = j0[0] * thd + j1[0] * psd;
  const vy = j0[1] * thd + j1[1] * psd;
  const ax = -g.La * cth * thd * thd - g.Ls * cps * psd * psd;
  const ay = -g.La * sth * thd * thd - g.Ls * sps * psd * psd;
  const rvx = vx - g.wind;
  const rvy = vy;
  const sp = Math.hypot(rvx, rvy);
  const fx = -g.mp * g.dragK * sp * rvx - g.mp * ax;
  const fy = -g.mp * g.g - g.mp * g.dragK * sp * rvy - g.mp * ay;
  M[0][0] += g.mp * g.La * g.La;
  const m01 = g.mp * (j0[0] * j1[0] + j0[1] * j1[1]);
  M[0][1] += m01;
  M[1][0] += m01;
  M[1][1] += g.mp * g.Ls * g.Ls;
  rhs[0] += j0[0] * fx + j0[1] * fy;
  rhs[1] += j1[0] * fx + j1[1] * fy;

  const a0 = solve3(M, rhs);
  if (phase === 'swing') return { acc: [a0[0], a0[1], g.hinged ? a0[2] : 0], normal: 0 };

  // Ground phase: the trough keeps the ball at height r. Solve for the push N that does that.
  const G = [g.La * cth, g.Ls * cps, 0];
  const c = g.La * sth * thd * thd + g.Ls * sps * psd * psd;
  const u = solve3(M, G);
  const Gu = G[0] * u[0] + G[1] * u[1];
  const Ga = G[0] * a0[0] + G[1] * a0[1];
  const N = Gu > 1e-12 ? (c - Ga) / Gu : 0;
  return {
    acc: [a0[0] + N * u[0], a0[1] + N * u[1], g.hinged ? a0[2] + N * u[2] : 0],
    normal: N,
  };
}

function rk4(g: Geometry, s: Vec6, phase: Phase, dt: number, damp: number): Vec6 {
  const f = (y: Vec6): Vec6 => {
    const { acc } = accelerations(g, y, phase, damp);
    return [y[3], y[4], y[5], acc[0], acc[1], acc[2]];
  };
  const add = (a: Vec6, b: Vec6, k: number): Vec6 =>
    a.map((v, i) => v + b[i] * k) as Vec6;
  const k1 = f(s);
  const k2 = f(add(s, k1, dt / 2));
  const k3 = f(add(s, k2, dt / 2));
  const k4 = f(add(s, k3, dt));
  return s.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as Vec6;
}

/** Keep the ball exactly on the trough while it's being dragged (removes tiny numeric drift). */
function projectToGround(g: Geometry, s: Vec6): Vec6 {
  const [th, ps, ph, thd, , phd] = s;
  const tipY = g.H + g.La * Math.sin(th);
  const sn = (g.r - tipY) / g.Ls;
  if (Math.abs(sn) > 1) return s;
  const base = Math.asin(sn);
  let best = ps;
  let bestD = Infinity;
  for (const cand of [base, Math.PI - base]) {
    const k = Math.round((ps - cand) / (2 * Math.PI));
    const v = cand + 2 * Math.PI * k;
    if (Math.abs(v - ps) < bestD) {
      bestD = Math.abs(v - ps);
      best = v;
    }
  }
  const cps = Math.cos(best);
  const psd = Math.abs(cps) > 1e-6 ? (-g.La * Math.cos(th) * thd) / (g.Ls * cps) : s[4];
  return [th, best, ph, thd, psd, phd];
}

function ballState(g: Geometry, s: readonly number[]) {
  const [th, ps, , thd, psd] = s;
  return {
    x: g.La * Math.cos(th) + g.Ls * Math.cos(ps),
    y: g.H + g.La * Math.sin(th) + g.Ls * Math.sin(ps),
    vx: -g.La * Math.sin(th) * thd - g.Ls * Math.sin(ps) * psd,
    vy: g.La * Math.cos(th) * thd + g.Ls * Math.cos(ps) * psd,
  };
}

function cwState(g: Geometry, s: readonly number[]) {
  const [th, , ph, thd, , phd] = s;
  if (!g.hinged) {
    return { y: g.H - g.Lb * Math.sin(th), ke: 0.5 * (g.mc * g.Lb * g.Lb + g.Icbox) * thd * thd };
  }
  const vx = g.Lb * Math.sin(th) * thd - g.Lh * Math.sin(ph) * phd;
  const vy = -g.Lb * Math.cos(th) * thd + g.Lh * Math.cos(ph) * phd;
  return {
    y: g.H - g.Lb * Math.sin(th) + g.Lh * Math.sin(ph),
    ke: 0.5 * g.mc * (vx * vx + vy * vy) + 0.5 * g.Icbox * phd * phd,
  };
}

/** Total mechanical energy (for testing that the physics conserves energy). */
export function totalEnergy(d: Design, s: readonly number[]): number {
  const g = geometry(d);
  const b = ballState(g, s);
  const cw = cwState(g, s);
  const armKE = 0.5 * g.Ia * s[3] * s[3];
  const armPE = g.ma * g.g * (g.H + g.da * Math.sin(s[0]));
  return armKE + armPE + cw.ke + g.mc * g.g * cw.y + 0.5 * g.mp * (b.vx * b.vx + b.vy * b.vy) + g.mp * g.g * b.y;
}

export interface SimOptions {
  /** Called after every machine step before release (used by tests to check energy). */
  onStep?: (state: readonly number[], phase: string, t: number) => void;
  /** Stop at the moment the ball lets go (used to preview the release while you adjust the hook). */
  stopAtRelease?: boolean;
}

export function simulate(d: Design, opts: SimOptions = {}): SimOutput {
  const g = geometry(d);
  const start = startAngles(g);
  let s: Vec6 = [start.theta, start.psi, start.phi, 0, 0, 0];
  let phase: Phase = start.onGround ? 'ground' : 'swing';

  const dt = g.tScale / 3000;
  const sampleEvery = 12;
  const damp = 0.6 / g.tScale;
  const frames: Frame[] = [];

  // Reference values for the energy breakdown
  const b0 = ballState(g, s);
  const cw0 = cwState(g, s);
  const cwLowest = g.H - g.Lb - (g.hinged ? g.Lh : 0);
  const available = g.mc * g.g * (cw0.y - cwLowest);

  let released = false;
  let landed = false;
  let crashed = false; // the weight hit the ground and the machine stopped dead
  let crashedAfterRelease = false;
  let crashIndex = -1;
  const boxHalf = cwBoxHeight(g) / 2;
  let failure: SimOutput['failure'];
  let releaseIndex = -1;
  let landIndex = -1;
  let tRelease = 0;
  let tLand = 0;
  let tEnd = Infinity;
  let ball = { x: b0.x, y: b0.y, vx: 0, vy: 0 };
  let releaseInfo: Omit<Results, 'distance' | 'maxHeight' | 'flightTime' | 'landingSpeed' | 'apex' | 'path'> | null = null;
  const path: [number, number][] = [];
  let apex = { x: 0, y: 0 };
  let landingSpeed = 0;

  // Can the machine even hold this ball, and can the weight lift the arm and ball?
  const cantStart = ballTooBig(g) ? 'ballTooBig' : accelerations(g, s, phase, damp).acc[0] >= 0 ? 'tooWeak' : null;
  if (cantStart) {
    return {
      ok: false,
      failure: cantStart,
      frames: [{ t: 0, theta: s[0], phi: s[2], psi: s[1], bx: b0.x, by: b0.y, released: false }],
      releaseIndex: -1,
      landIndex: -1,
    };
  }

  const pushFrame = (t: number) => {
    frames.push({ t, theta: s[0], phi: s[2], psi: s[1], bx: ball.x, by: ball.y, released });
  };
  pushFrame(0);

  const maxSteps = 4_000_000;
  for (let step = 1; step < maxSteps; step++) {
    const t = step * dt;

    // --- the machine
    if (crashed) {
      // Stopped dead on the ground. Only an empty sling still dangles from the tip.
      if (released) {
        s[4] += ((-g.g * Math.cos(s[1])) / g.Ls - 3 * damp * s[4]) * dt;
        s[1] += s[4] * dt;
      }
    } else {
      s = rk4(g, s, phase, dt, damp);
      if (phase === 'ground') s = projectToGround(g, s);
      if (cwState(g, s).y - boxHalf < 0) {
        crashed = true;
        crashIndex = frames.length;
        s[3] = 0;
        s[5] = 0;
        if (released) crashedAfterRelease = true;
        else {
          failure = 'weightCrash';
          s[4] = 0;
          tEnd = t + 1.2 * g.tScale;
        }
      }
    }

    // After release: stop the empty arm going through the ground.
    if (released && !crashed) {
      const tipY = g.H + g.La * Math.sin(s[0]);
      const tipVy = g.La * Math.cos(s[0]) * s[3];
      if (tipY < 0.02 * g.La && tipVy < 0) s[3] = -0.3 * s[3];
    }

    if (!released) {
      opts.onStep?.(s, phase, t);
      if (failure !== 'neverReleased' && g.H + g.La * Math.sin(s[0]) < 0 && t > 0.2 * g.tScale) {
        failure = 'neverReleased'; // arm smashed into the ground with the ball still in the sling
        pushFrame(t);
        break;
      }
      const b = ballState(g, s);
      ball = { x: b.x, y: b.y, vx: b.vx, vy: b.vy };
      if (phase === 'ground') {
        if (accelerations(g, s, 'ground', damp).normal < 0) phase = 'swing';
      } else if (b.y < g.r && b.vy < 0) {
        phase = 'ground';
        s = projectToGround(g, s);
      }

      const beta = s[1] - s[0]; // sling angle relative to the arm
      if (failure === 'neverReleased' || failure === 'weightCrash') {
        // already over: hold the scene for a moment so you can see what happened
      } else if (beta <= g.releaseAngle) {
        if (phase === 'ground') {
          failure = 'groundRelease';
          released = true;
          phase = 'released';
          ball = { ...ball, vx: 0, vy: 0 };
          tEnd = t + 3 * g.tScale;
        } else {
          released = true;
          phase = 'released';
          tRelease = t;
          releaseIndex = frames.length;
          // Where did the energy go at the moment of release?
          const cw = cwState(g, s);
          const ballE = 0.5 * g.mp * (b.vx * b.vx + b.vy * b.vy) + g.mp * g.g * (b.y - b0.y);
          const armE = 0.5 * g.Ia * s[3] * s[3] + g.ma * g.g * g.da * (Math.sin(s[0]) - Math.sin(start.theta));
          const unused = g.mc * g.g * (cw.y - cwLowest);
          const parts = { ball: ballE, arm: armE, weight: cw.ke, unused };
          const air = Math.max(0, available - (ballE + armE + cw.ke + unused));
          const norm = (v: number) => (available > 0 ? v / available : 0);
          const speed = Math.hypot(b.vx, b.vy);
          releaseInfo = {
            launchSpeed: speed,
            launchAngle: (Math.atan2(b.vy, b.vx) * 180) / Math.PI,
            releaseHeight: b.y,
            releaseTime: t,
            efficiency: norm(parts.ball),
            energy: {
              ball: norm(parts.ball),
              arm: norm(parts.arm),
              weight: norm(parts.weight),
              unused: norm(parts.unused),
              air: norm(air),
            },
          };
          apex = { x: b.x, y: b.y };
          path.push([b.x, b.y]);
          if (opts.stopAtRelease) {
            pushFrame(t);
            return { ok: true, frames, releaseIndex, landIndex: -1, launch: { vx: b.vx, vy: b.vy } };
          }
        }
      } else if (t > 12 * g.tScale || (t > 0.5 * g.tScale && s[3] > 0)) {
        // Arm stopped and is swinging back, and the ball is still in the sling.
        failure = 'neverReleased';
        tEnd = t + 1.5 * g.tScale;
      }
      if (failure === 'neverReleased' && t >= tEnd) {
        pushFrame(t);
        break;
      }
    } else if (!landed && !failure) {
      // --- the ball in flight (same RK4 method, gravity + air drag)
      const deriv = (x: number[]) => {
        const rvx = x[2] - g.wind;
        const sp = Math.hypot(rvx, x[3]);
        return [x[2], x[3], -g.dragK * sp * rvx, -g.g - g.dragK * sp * x[3]];
      };
      const y0 = [ball.x, ball.y, ball.vx, ball.vy];
      const k1 = deriv(y0);
      const k2 = deriv(y0.map((v, i) => v + (k1[i] * dt) / 2));
      const k3 = deriv(y0.map((v, i) => v + (k2[i] * dt) / 2));
      const k4 = deriv(y0.map((v, i) => v + k3[i] * dt));
      const y1 = y0.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      if (y1[1] <= g.r && y1[3] < 0) {
        const f = (y0[1] - g.r) / (y0[1] - y1[1]);
        ball = {
          x: y0[0] + f * (y1[0] - y0[0]),
          y: g.r,
          vx: y0[2] + f * (y1[2] - y0[2]),
          vy: y0[3] + f * (y1[3] - y0[3]),
        };
        landed = true;
        tLand = t - dt + f * dt;
        landingSpeed = Math.hypot(ball.vx, ball.vy);
        landIndex = frames.length;
        path.push([ball.x, ball.y]);
        ball = { ...ball, vx: 0, vy: 0 };
        tEnd = t + 1.0 * g.tScale;
      } else {
        ball = { x: y1[0], y: y1[1], vx: y1[2], vy: y1[3] };
        if (ball.y > apex.y) apex = { x: ball.x, y: ball.y };
        if (step % 4 === 0) path.push([ball.x, ball.y]);
      }
      if (t - tRelease > 400) break; // safety
    }

    if (step % sampleEvery === 0 || t >= tEnd) pushFrame(t);
    if (t >= tEnd) break;
  }

  if (!releaseInfo || !landed) {
    return { ok: false, failure: failure ?? 'neverReleased', frames, releaseIndex, landIndex, crashIndex };
  }

  // Thin the path out to ~120 points for drawing and saving.
  const stride = Math.max(1, Math.ceil(path.length / 120));
  const thin = path.filter((_, i) => i % stride === 0);
  if (thin[thin.length - 1] !== path[path.length - 1]) thin.push(path[path.length - 1]);

  const distance = ball.x;
  const results: Results = {
    ...releaseInfo,
    distance,
    maxHeight: Math.max(apex.y, releaseInfo.releaseHeight),
    flightTime: tLand - tRelease,
    landingSpeed,
    weightCrashed: crashedAfterRelease || undefined,
    apex,
    path: thin.map(([x, y]) => [round(x), round(y)]),
  };
  return {
    ok: true,
    failure: distance < 0 ? 'backward' : undefined,
    frames,
    releaseIndex,
    landIndex,
    crashIndex,
    results,
  };
}

function round(v: number) {
  return Math.round(v * 1000) / 1000;
}
