import { expect, test } from 'vitest';
import { PRESETS } from '../src/data/presets';
import { simulate } from '../src/physics/simulate';

test('coarse lesson runs agree with full runs', () => {
  let worst = 0;
  for (const p of PRESETS) for (const k of [0.5, 1, 2]) for (const a of [30, 50, 70]) {
    const d = { ...p.design, cwMass: p.design.cwMass * k, releaseAngle: a };
    const full = simulate(d).results;
    const fast = simulate(d, { coarse: true }).results;
    if (!full || !fast) { expect(!!full).toBe(!!fast); continue; }
    worst = Math.max(worst, Math.abs(full.distance - fast.distance) / Math.max(1, Math.abs(full.distance)));
  }
  let t0 = performance.now(); for (let i = 0; i < 5; i++) simulate(PRESETS[1].design, { coarse: true });
  console.log('worst difference', (worst * 100).toFixed(2) + '%', 'coarse ms', ((performance.now() - t0) / 5).toFixed(1));
  expect(worst).toBeLessThan(0.02);
});
