import { writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { PRESETS } from '../src/data/presets';
import { simulate } from '../src/physics/simulate';
import { sheetsToPdf } from '../src/plans/pdf';
import { buildPlanSheets } from '../src/plans/sheets';

const OUT = process.env.PLANS_OUT;

test('every preset makes a 4-page PDF with sane structure', () => {
  for (const p of PRESETS) {
    const sheets = buildPlanSheets({ design: p.design, name: p.name, results: simulate(p.design).results });
    expect(sheets).toHaveLength(4);
    for (const s of sheets) for (const prim of s.prims) {
      const nums = JSON.stringify(prim).match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? [];
      expect(nums.every((n) => Number.isFinite(Number(n)))).toBe(true);
      expect(JSON.stringify(prim)).not.toContain('NaN');
    }
    const pdf = sheetsToPdf(sheets, p.name);
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    // every xref offset must point at the start of its object
    const xref = Number(text.match(/startxref\n(\d+)/)![1]);
    const table = text.slice(xref).split('\n').slice(3).filter((l) => / n $/.test(l));
    table.forEach((line, i) => {
      const off = Number(line.slice(0, 10));
      expect(text.slice(off, off + 12)).toContain(`${i + 1} 0 obj`);
    });
    if (OUT) writeFileSync(`${OUT}/${p.id}.pdf`, pdf);
  }
});
