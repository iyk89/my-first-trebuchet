import { describe, expect, test } from 'vitest';
import { PRESETS } from '../src/data/presets';
import { simulate, totalEnergy } from '../src/physics/simulate';
import { buildIssues, geometry } from '../src/physics/geometry';
import type { Design } from '../src/physics/types';

const noAir = (d: Design): Design => ({ ...d, air: false });

describe('trebuchet physics', () => {
  for (const p of PRESETS) {
    for (const style of ['hinged', 'fixed'] as const) {
      test(`${p.id} (${style}) conserves energy until release`, () => {
        const d = noAir({ ...p.design, cwStyle: style, towerHeight: p.design.towerHeight * 1.3 });
        let e0: number | null = null;
        let maxDrift = 0;
        const phases = new Set<string>();
        simulate(d, {
          onStep: (s, phase) => {
            phases.add(phase);
            const e = totalEnergy(d, s);
            if (e0 === null) e0 = e;
            maxDrift = Math.max(maxDrift, Math.abs(e - e0));
          },
        });
        const g = geometry(d);
        const scale = g.mc * g.g * (g.Lb + g.Lh); // energy the weight can give
        expect(maxDrift / scale).toBeLessThan(1e-3);
        expect(phases.has('swing')).toBe(true);
      });
    }

    test(`${p.id} never beats the perfect-machine limit`, () => {
      const d = noAir(p.design);
      const out = simulate(d);
      expect(out.ok).toBe(true);
      const r = out.results!;
      const g = geometry(d);
      // If 100% of the weight's drop went into the ball, launched at the best angle:
      const drop = g.Lb * 2; // generous upper bound on how far the weight can fall
      const vMax = Math.sqrt((2 * g.mc * g.g * (drop + g.Lh)) / g.mp);
      expect(r.launchSpeed).toBeLessThan(vMax);
      const e = r.energy;
      expect(e.ball + e.arm + e.weight + e.unused + e.air).toBeCloseTo(1, 2);
    });
  }

  test('without air, flight matches the textbook formula', () => {
    const d = noAir(PRESETS[1].design);
    const r = simulate(d).results!;
    const g = 9.81;
    const a = (r.launchAngle * Math.PI) / 180;
    const vx = r.launchSpeed * Math.cos(a);
    const vy = r.launchSpeed * Math.sin(a);
    const h0 = r.releaseHeight - d.projectileDiameter / 2;
    const tFlight = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g;
    const x0 = r.path[0][0];
    expect(r.distance).toBeCloseTo(x0 + vx * tFlight, 1);
    expect(r.maxHeight).toBeCloseTo(r.releaseHeight + (vy * vy) / (2 * g), 1);
  });

  test('air drag shortens the throw, most for light balls', () => {
    const base = PRESETS[1].design;
    const golf = { ...base, projectileMass: 0.046, projectileDiameter: 0.043 };
    const ping = { ...base, projectileMass: 0.0027, projectileDiameter: 0.04 };
    const loss = (d: Design) => simulate(d).results!.distance / simulate(noAir(d)).results!.distance;
    expect(loss(golf)).toBeLessThan(1);
    expect(loss(ping)).toBeLessThan(loss(golf));
  });

  test('same build always gives the same result', () => {
    const a = simulate(PRESETS[2].design).results!;
    const b = simulate(PRESETS[2].design).results!;
    expect(a.distance).toBe(b.distance);
  });

  test('a weight that hits the ground crashes, and the fixes really fix it', () => {
    const d = { ...PRESETS[1].design, cwStyle: 'fixed' as const, towerHeight: 0.2 };
    expect(simulate(d).failure).toBe('weightCrash');
    const issue = buildIssues(d)[0];
    expect(issue.fixes.length).toBeGreaterThanOrEqual(1);
    for (const fix of issue.fixes) {
      const fixed = { ...d, ...fix.patch };
      expect(buildIssues(fixed)).toHaveLength(0);
      expect(simulate(fixed).failure).not.toBe('weightCrash');
    }
  });
});
