/**
 * A tiny drawing kit for build plans. Everything is in millimeters on paper (y points down).
 * The same list of shapes is drawn on screen (SVG) and written to the PDF, so they always match.
 */

export type Pt = [number, number];

export type Prim =
  | { t: 'line'; a: Pt; b: Pt; w?: number; c?: string; dash?: number[] }
  | { t: 'poly'; pts: Pt[]; close?: boolean; w?: number; c?: string; fill?: string; dash?: number[] }
  | { t: 'circle'; at: Pt; r: number; w?: number; c?: string; fill?: string; dash?: number[] }
  | { t: 'text'; at: Pt; s: string; size?: number; anchor?: 'start' | 'middle' | 'end'; bold?: boolean; c?: string; rot?: number };

export interface Sheet {
  w: number; // mm
  h: number;
  title: string;
  prims: Prim[];
}

export const INK = '#1f1b3a';
export const SOFT = '#7a7596';
export const ACCENT = '#d9600b';
export const WOOD = '#c4925c';
export const WOOD_DARK = '#6b4c30';
export const METAL = '#55585e';

// Approximate Helvetica character widths (fraction of the font size), good enough to center labels.
const NARROW = new Set("iIjl.,:;'|!".split(''));
const SEMI = new Set('frt()[]- /'.split(''));
const WIDE = new Set('mwMW%@'.split(''));
export function textWidth(s: string, size: number, bold = false) {
  let w = 0;
  for (const ch of s) {
    if (NARROW.has(ch)) w += 0.26;
    else if (SEMI.has(ch)) w += 0.33;
    else if (WIDE.has(ch)) w += 0.86;
    else if (ch >= 'A' && ch <= 'Z') w += 0.68;
    else if (ch >= '0' && ch <= '9') w += 0.556;
    else w += 0.54;
  }
  return w * size * (bold ? 1.06 : 1);
}

export class Pen {
  prims: Prim[] = [];
  line(a: Pt, b: Pt, w = 0.25, c = INK, dash?: number[]) {
    this.prims.push({ t: 'line', a, b, w, c, dash });
  }
  poly(pts: Pt[], o: { close?: boolean; w?: number; c?: string; fill?: string; dash?: number[] } = {}) {
    this.prims.push({ t: 'poly', pts, close: o.close ?? true, w: o.w ?? 0.3, c: o.c ?? INK, fill: o.fill, dash: o.dash });
  }
  rect(x: number, y: number, w: number, h: number, o: { w?: number; c?: string; fill?: string; dash?: number[] } = {}) {
    this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { ...o, close: true });
  }
  circle(at: Pt, r: number, o: { w?: number; c?: string; fill?: string; dash?: number[] } = {}) {
    this.prims.push({ t: 'circle', at, r, w: o.w ?? 0.3, c: o.c ?? INK, fill: o.fill, dash: o.dash });
  }
  text(at: Pt, s: string, o: { size?: number; anchor?: 'start' | 'middle' | 'end'; bold?: boolean; c?: string; rot?: number } = {}) {
    this.prims.push({ t: 'text', at, s, size: o.size ?? 3, anchor: o.anchor ?? 'start', bold: o.bold, c: o.c ?? INK, rot: o.rot ?? 0 });
  }
  arrowHead(tip: Pt, from: Pt, c = INK, len = 2.4, wid = 0.9) {
    const dx = tip[0] - from[0];
    const dy = tip[1] - from[1];
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L;
    const uy = dy / L;
    this.poly(
      [
        tip,
        [tip[0] - ux * len - uy * wid, tip[1] - uy * len + ux * wid],
        [tip[0] - ux * len + uy * wid, tip[1] - uy * len - ux * wid],
      ],
      { fill: c, c, w: 0.1 },
    );
  }

  /** A measuring line between a and b, pushed out sideways by `off` mm, with the label on it. */
  dim(a: Pt, b: Pt, off: number, label: string, o: { c?: string; size?: number } = {}) {
    const c = o.c ?? INK;
    const size = o.size ?? 2.8;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L;
    const uy = dy / L;
    const nx = uy; // normal (to the right of a->b on paper)
    const ny = -ux;
    const a2: Pt = [a[0] + nx * off, a[1] + ny * off];
    const b2: Pt = [b[0] + nx * off, b[1] + ny * off];
    const ext = Math.sign(off) * 1.5;
    this.line(a, [a2[0] + nx * ext, a2[1] + ny * ext], 0.15, SOFT);
    this.line(b, [b2[0] + nx * ext, b2[1] + ny * ext], 0.15, SOFT);
    this.line(a2, b2, 0.22, c);
    this.arrowHead(a2, b2, c);
    this.arrowHead(b2, a2, c);
    // Text sits on the line, reading left-to-right or bottom-to-top.
    let ang = (Math.atan2(-dy, dx) * 180) / Math.PI; // math angle on paper
    if (ang > 90.5) ang -= 180;
    if (ang < -89.5) ang += 180;
    const mid: Pt = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2];
    const rad = (ang * Math.PI) / 180;
    // lift text 1 mm off the line, toward the "up" side of the text
    const lift: Pt = [-Math.sin(rad) * 1.0, -Math.cos(rad) * 1.0];
    const tw = textWidth(label, size);
    if (tw + 6 < L) {
      this.text([mid[0] + lift[0], mid[1] + lift[1]], label, { size, anchor: 'middle', c, rot: ang });
      return;
    }
    // Too short for the label: write it level, just outside the measuring line.
    const s = Math.sign(off) || 1;
    const ox = nx * s;
    const oy = ny * s;
    if (Math.abs(ox) > Math.abs(oy)) {
      this.text([mid[0] + ox * 2.5, mid[1] + size * 0.35], label, { size, anchor: ox > 0 ? 'start' : 'end', c });
    } else {
      this.text([mid[0], mid[1] + (oy > 0 ? size + 1.5 : -1.5)], label, { size, anchor: 'middle', c });
    }
  }

  /** An angle arc around center c from angle a0 to a1 (degrees, counterclockwise on paper). */
  angle(c: Pt, r: number, a0: number, a1: number, label: string, o: { col?: string; size?: number } = {}) {
    const col = o.col ?? ACCENT;
    const pts: Pt[] = [];
    const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) / 4));
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
      pts.push([c[0] + r * Math.cos(a), c[1] - r * Math.sin(a)]);
    }
    this.poly(pts, { close: false, w: 0.35, c: col });
    const am = (((a0 + a1) / 2) * Math.PI) / 180;
    this.text([c[0] + (r + 4) * Math.cos(am), c[1] - (r + 4) * Math.sin(am) + 1.2], label, { size: o.size ?? 3.2, anchor: 'middle', bold: true, c: col });
  }

  /** A note with a thin line pointing at something. */
  note(at: Pt, to: Pt, s: string, size = 2.6, anchor: 'start' | 'middle' | 'end' = 'start') {
    this.line([at[0], at[1] - size * 0.35], to, 0.15, SOFT);
    this.circle(to, 0.5, { fill: SOFT, c: SOFT, w: 0.1 });
    this.text([at[0] + (anchor === 'start' ? 1 : anchor === 'end' ? -1 : 0), at[1]], s, { size, anchor, c: INK });
  }

  /** Hatched ground strip under y. */
  ground(x0: number, x1: number, y: number) {
    this.line([x0, y], [x1, y], 0.4, INK);
    for (let x = x0; x < x1; x += 3) this.line([x, y], [x - 2, y + 2], 0.12, SOFT);
  }
}

/** Standard drawing scales (1:n) to choose from. */
export const SCALES = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250];
