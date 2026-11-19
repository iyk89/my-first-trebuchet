import { expect, test } from 'vitest';
import { PRESETS } from '../src/data/presets';
import { VARS } from '../src/data/variables';
import { simulate } from '../src/physics/simulate';
import type { Design } from '../src/physics/types';

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

test('random builds never crash, hang, or produce nonsense', () => {
  const r = rng(42);
  let worstMs = 0;
  const counts: Record<string, number> = {};
  for (let i = 0; i < 400; i++) {
    let d: Design = { ...PRESETS[Math.floor(r() * PRESETS.length)].design };
    for (const spec of Object.values(VARS)) {
      if (r() < 0.5) continue;
      const lo = spec.min(d), hi = spec.max(d);
      const v = spec.log ? lo * Math.pow(hi / lo, r()) : lo + (hi - lo) * r();
      d = { ...d, [spec.key]: v };
    }
    if (r() < 0.3) d.cwStyle = d.cwStyle === 'hinged' ? 'fixed' : 'hinged';
    const t0 = performance.now();
    const out = simulate(d);
    const ms = performance.now() - t0;
    worstMs = Math.max(worstMs, ms);
    const key = out.ok ? (out.failure ?? 'ok') : out.failure!;
    counts[key] = (counts[key] ?? 0) + 1;
    for (const f of out.frames) {
      expect(Number.isFinite(f.theta) && Number.isFinite(f.bx) && Number.isFinite(f.by)).toBe(true);
    }
    if (out.results) {
      expect(Number.isFinite(out.results.distance)).toBe(true);
      expect(out.results.efficiency).toBeLessThanOrEqual(1.0001);
    }
    expect(out.frames.length).toBeLessThan(200000);
  }
  console.log('outcomes', counts, 'slowest', worstMs.toFixed(0), 'ms');
  expect(worstMs).toBeLessThan(3000);
}, 60_000);
