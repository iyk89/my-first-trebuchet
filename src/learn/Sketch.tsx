/**
 * A flat side-view drawing of a trebuchet, made from a real build, for the lessons.
 * Parts can be highlighted, and "marks" add measuring lines, arrows, arcs and labels.
 * Everything is placed in meters and scaled to fit, so two drawings can share one scale.
 */
import type { ReactNode } from 'react';
import { geometry, pose as poseOf, startAngles } from '../physics/geometry';
import type { Design } from '../physics/types';
import { projectileById } from '../data/projectiles';
import { machineDims } from '../scene/Trebuchet';
import { releasePreview } from '../scene/preview';

export type Part = 'arm' | 'pivot' | 'tower' | 'weight' | 'hanger' | 'sling' | 'ball' | 'hook';
export type Pt = 'pivot' | 'tip' | 'shortEnd' | 'cw' | 'ball' | 'ground' | 'cwBottom' | [number, number];
export type PoseName = 'start' | 'release' | 'flat' | 'down' | { theta: number; phi: number; psi: number };

export type Mark =
  | { kind: 'dim'; a: Pt; b: Pt; label: string; side?: 1 | -1; offset?: number }
  | { kind: 'arrow'; a: Pt; b: Pt; label?: string; color?: string }
  | { kind: 'arc'; c: Pt; r: number; from: number; to: number; label?: string; color?: string }
  | { kind: 'circle'; c: Pt; r: number; label?: string; color?: string }
  | { kind: 'path'; pts: [number, number][]; color?: string; label?: string; dashed?: boolean }
  | { kind: 'text'; at: Pt; text: string; dx?: number; dy?: number; color?: string };

export interface SketchProps {
  design: Design;
  pose?: PoseName;
  highlight?: Part[];
  marks?: Mark[];
  extent?: [number, number, number, number];
  hideBall?: boolean;
  hideSling?: boolean;
  caption?: ReactNode;
  title?: string;
  maxH?: number;
}

const W = 360;
const MAX_H = 250;
const FONT = 12;

export function resolvePose(d: Design, p: PoseName) {
  const g = geometry(d);
  if (typeof p === 'object') return p;
  if (p === 'release') {
    const pv = releasePreview(d);
    if (pv.ok) return { theta: pv.theta, phi: pv.phi, psi: pv.psi };
  }
  if (p === 'flat') return { theta: 0, phi: -Math.PI / 2, psi: -Math.PI / 2 };
  if (p === 'down') return { theta: Math.PI / 2, phi: -Math.PI / 2, psi: -Math.PI / 2 };
  return startAngles(g);
}

/** Bounds (meters) a sketch needs, so side-by-side sketches can share one scale. */
export function sketchBounds(d: Design, p: PoseName = 'start', extra: [number, number][] = []): [number, number, number, number] {
  const g = geometry(d);
  const dims = machineDims(g);
  const a = resolvePose(d, p);
  const q = poseOf(g, a.theta, a.phi, a.psi);
  const half = Math.max(...dims.box) * 0.75;
  const pts: [number, number][] = [
    [-dims.baseHalf, 0],
    [dims.baseHalf, 0],
    [0, g.H],
    q.tip,
    q.shortEnd,
    [q.cw[0] - half, q.cw[1] - half],
    [q.cw[0] + half, q.cw[1] + half],
    q.ball,
    ...extra,
  ];
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const pad = Math.max(x1 - x0, y1 - y0) * 0.1;
  return [x0 - pad, Math.min(y0, 0) - pad * 0.6, x1 + pad, y1 + pad];
}

export function unionBounds(...bs: [number, number, number, number][]): [number, number, number, number] {
  return [Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))];
}

export function Sketch({ design, pose = 'start', highlight = [], marks = [], extent, hideBall, hideSling, caption, title, maxH = MAX_H }: SketchProps) {
  const g = geometry(design);
  const dims = machineDims(g);
  const a = resolvePose(design, pose);
  const q = poseOf(g, a.theta, a.phi, a.psi);
  const ball = projectileById(design.projectileId);

  const resolve = (p: Pt): [number, number] => {
    if (Array.isArray(p)) return p;
    if (p === 'pivot') return [0, g.H];
    if (p === 'ground') return [0, 0];
    if (p === 'cwBottom') return [q.cw[0], q.cw[1] - dims.box[1] / 2];
    return q[p];
  };
  const markPts: [number, number][] = [];
  for (const m of marks) {
    if (m.kind === 'dim' || m.kind === 'arrow') markPts.push(resolve(m.a), resolve(m.b));
    else if (m.kind === 'circle') {
      const c = resolve(m.c);
      markPts.push([c[0] - m.r, c[1] - m.r], [c[0] + m.r, c[1] + m.r]);
    } else if (m.kind === 'arc') {
      const c = resolve(m.c);
      for (let i = 0; i <= 8; i++) {
        const a = m.from + ((m.to - m.from) * i) / 8;
        markPts.push([c[0] + m.r * Math.cos(a), c[1] + m.r * Math.sin(a)]);
      }
    } else if (m.kind === 'path') markPts.push(...m.pts);
    else markPts.push(resolve(m.at));
  }
  const [x0, y0, x1, y1] = extent ?? sketchBounds(design, pose, markPts);
  const TOP = marks.length ? 28 : 6; // room for labels that sit above the drawing
  const s = Math.min(W / (x1 - x0), maxH / (y1 - y0));
  const Hpx = (y1 - y0) * s + TOP + 4;
  const ox = (W - (x1 - x0) * s) / 2;
  const P = (p: [number, number]): [number, number] => [ox + (p[0] - x0) * s, TOP + (y1 - p[1]) * s];
  const hl = (part: Part) => highlight.includes(part);
  const col = (part: Part, normal: string) => (hl(part) ? 'var(--accent)' : normal);

  const t = Math.max(dims.t * s, 3);
  const post = Math.max(dims.post * s, 2.5);
  const gy = P([0, 0])[1];
  const piv = P([0, g.H]);
  const tip = P(q.tip);
  const se = P(q.shortEnd);
  const cw = P(q.cw);
  const bl = P(q.ball);
  const hookLen = dims.t * 3.2;
  const hookEnd = P([q.tip[0] + hookLen * Math.cos(a.theta + (design.releaseAngle * Math.PI) / 180), q.tip[1] + hookLen * Math.sin(a.theta + (design.releaseAngle * Math.PI) / 180)]);
  const boxW = dims.box[0] * s;
  const boxH = dims.box[1] * s;
  const crashed = q.cw[1] - dims.box[1] / 2 < -1e-6;
  const cwDeg = (-q.cwAngle * 180) / Math.PI;

  return (
    <figure className="sketch">
      {title && <div className="sketch-title">{title}</div>}
      <svg viewBox={`0 0 ${W} ${Hpx.toFixed(1)}`} role="img" aria-label={title ?? 'Trebuchet diagram'}>
        <rect x={0} y={0} width={W} height={gy} fill="var(--sky-soft)" />
        <rect x={0} y={gy} width={W} height={Math.max(0, Hpx - gy)} fill="var(--grass)" />
        <line x1={0} y1={gy} x2={W} y2={gy} stroke="var(--grass-dark)" strokeWidth={1.5} />

        {/* frame */}
        <g className={hl('tower') ? 'sk-hl' : ''} stroke={col('tower', 'var(--wood)')} strokeWidth={post} strokeLinecap="round">
          <line x1={P([-dims.baseHalf, 0])[0]} y1={gy - post / 2} x2={P([dims.baseHalf, 0])[0]} y2={gy - post / 2} />
          <line x1={P([-dims.footX, 0])[0]} y1={gy} x2={piv[0]} y2={piv[1]} />
          <line x1={P([dims.footX, 0])[0]} y1={gy} x2={piv[0]} y2={piv[1]} />
          <line x1={P([-dims.footX * 0.55, g.H * 0.45])[0]} y1={P([0, g.H * 0.45])[1]} x2={P([dims.footX * 0.55, g.H * 0.45])[0]} y2={P([0, g.H * 0.45])[1]} strokeWidth={post * 0.7} />
        </g>

        {/* hinged weight hangs from the short end */}
        {g.hinged && (
          <line className={hl('hanger') ? 'sk-hl' : ''} x1={se[0]} y1={se[1]} x2={cw[0]} y2={cw[1]} stroke={col('hanger', 'var(--metal)')} strokeWidth={Math.max(1.5, t * 0.25)} />
        )}

        {/* arm */}
        <line className={hl('arm') ? 'sk-hl' : ''} x1={se[0]} y1={se[1]} x2={tip[0]} y2={tip[1]} stroke={col('arm', 'var(--wood)')} strokeWidth={t} strokeLinecap="round" />
        <line className={hl('hook') ? 'sk-hl' : ''} x1={tip[0]} y1={tip[1]} x2={hookEnd[0]} y2={hookEnd[1]} stroke={col('hook', 'var(--metal)')} strokeWidth={Math.max(2, t * 0.3)} strokeLinecap="round" />

        {/* weight box */}
        <g transform={`translate(${cw[0]} ${cw[1]}) rotate(${cwDeg})`} className={hl('weight') ? 'sk-hl' : ''}>
          <rect x={-boxW / 2} y={-boxH / 2} width={boxW} height={boxH} rx={2} fill={crashed ? 'var(--bad)' : col('weight', 'var(--wood-dark)')} />
        </g>
        {crashed && (
          <text x={cw[0]} y={gy + 14} textAnchor="middle" fontSize={FONT} className="sk-crash">
            💥 hits the ground
          </text>
        )}

        {/* pivot */}
        <circle className={hl('pivot') ? 'sk-hl' : ''} cx={piv[0]} cy={piv[1]} r={Math.max(3.5, t * 0.35)} fill={col('pivot', 'var(--metal)')} stroke="white" strokeWidth={1} />

        {/* sling and ball */}
        {!hideSling && !hideBall && (
          <line className={hl('sling') ? 'sk-hl' : ''} x1={tip[0]} y1={tip[1]} x2={bl[0]} y2={bl[1]} stroke={col('sling', 'var(--rope)')} strokeWidth={hl('sling') ? 2.5 : 1.5} />
        )}
        {!hideBall && (
          <circle className={hl('ball') ? 'sk-hl' : ''} cx={bl[0]} cy={bl[1]} r={Math.max(3, g.r * s)} fill={ball.color} stroke={hl('ball') ? 'var(--accent)' : 'var(--ink-2)'} strokeWidth={1.2} />
        )}

        {marks.map((m, i) => (
          <MarkView key={i} m={m} P={P} resolve={resolve} />
        ))}
      </svg>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function Pill({ x, y, text, color = 'var(--ink)', bg = 'var(--card)' }: { x: number; y: number; text: string; color?: string; bg?: string }) {
  const w = text.length * FONT * 0.56 + 10;
  return (
    <g>
      <rect x={x - w / 2} y={y - 9} width={w} height={18} rx={9} fill={bg} stroke={color} strokeWidth={1.2} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={FONT} fill={color} className="sk-label">
        {text}
      </text>
    </g>
  );
}

function arrowHead(b: [number, number], ux: number, uy: number, size: number) {
  const nx = -uy;
  const ny = ux;
  const p1 = [b[0] - ux * size + nx * size * 0.5, b[1] - uy * size + ny * size * 0.5];
  const p2 = [b[0] - ux * size - nx * size * 0.5, b[1] - uy * size - ny * size * 0.5];
  return `${b[0]},${b[1]} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`;
}

function MarkView({ m, P, resolve }: { m: Mark; P: (p: [number, number]) => [number, number]; resolve: (p: Pt) => [number, number] }) {
  if (m.kind === 'dim') {
    const a = P(resolve(m.a));
    const b = P(resolve(m.b));
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const off = (m.offset ?? 16) * (m.side ?? 1);
    const nx = -uy * off;
    const ny = ux * off;
    const a2: [number, number] = [a[0] + nx, a[1] + ny];
    const b2: [number, number] = [b[0] + nx, b[1] + ny];
    return (
      <g className="sk-dim">
        <line x1={a[0]} y1={a[1]} x2={a2[0] + nx * 0.2} y2={a2[1] + ny * 0.2} stroke="var(--ink-2)" strokeWidth={0.8} />
        <line x1={b[0]} y1={b[1]} x2={b2[0] + nx * 0.2} y2={b2[1] + ny * 0.2} stroke="var(--ink-2)" strokeWidth={0.8} />
        <line x1={a2[0]} y1={a2[1]} x2={b2[0]} y2={b2[1]} stroke="var(--ink)" strokeWidth={1.4} />
        <polygon points={arrowHead(b2, ux, uy, 7)} fill="var(--ink)" />
        <polygon points={arrowHead(a2, -ux, -uy, 7)} fill="var(--ink)" />
        <Pill x={(a2[0] + b2[0]) / 2} y={(a2[1] + b2[1]) / 2} text={m.label} />
      </g>
    );
  }
  if (m.kind === 'arrow') {
    const a = P(resolve(m.a));
    const b = P(resolve(m.b));
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    const c = m.color ?? 'var(--accent)';
    const end: [number, number] = [b[0] - ux * 6, b[1] - uy * 6];
    return (
      <g>
        <line x1={a[0]} y1={a[1]} x2={end[0]} y2={end[1]} stroke={c} strokeWidth={3} strokeLinecap="round" />
        <polygon points={arrowHead(b, ux, uy, 11)} fill={c} />
        {m.label && <Pill x={b[0] + ux * 4} y={b[1] + uy * 4 - 14} text={m.label} color={c} />}
      </g>
    );
  }
  if (m.kind === 'arc' || m.kind === 'circle') {
    const c = resolve(m.c);
    const from = m.kind === 'arc' ? m.from : 0;
    const to = m.kind === 'arc' ? m.to : Math.PI * 2;
    const n = Math.max(8, Math.ceil(Math.abs(to - from) / 0.08));
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const ang = from + ((to - from) * i) / n;
      const p = P([c[0] + m.r * Math.cos(ang), c[1] + m.r * Math.sin(ang)]);
      pts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
    }
    const color = m.color ?? (m.kind === 'arc' ? 'var(--accent-2)' : 'var(--ink-2)');
    const mid = (from + to) / 2;
    const lp = P([c[0] + m.r * 1.15 * Math.cos(mid), c[1] + m.r * 1.15 * Math.sin(mid)]);
    return (
      <g>
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={m.kind === 'arc' ? 2.5 : 1.3} strokeDasharray={m.kind === 'circle' ? '5 4' : undefined} />
        {m.label && <Pill x={m.kind === 'circle' ? P(c)[0] : lp[0]} y={m.kind === 'circle' ? P([c[0], c[1] + m.r])[1] - 12 : lp[1]} text={m.label} color={m.kind === 'arc' ? 'var(--ink)' : 'var(--ink-2)'} />}
      </g>
    );
  }
  if (m.kind === 'path') {
    const pts = m.pts.map((p) => P(p).map((v) => v.toFixed(1)).join(',')).join(' ');
    const last = P(m.pts[m.pts.length - 1]);
    return (
      <g>
        <polyline points={pts} fill="none" stroke={m.color ?? 'var(--accent)'} strokeWidth={2.5} strokeDasharray={m.dashed ? '6 4' : undefined} strokeLinecap="round" />
        {m.label && <Pill x={last[0]} y={last[1] + 16} text={m.label} color={m.color ?? 'var(--accent)'} />}
      </g>
    );
  }
  const at = P(resolve(m.at));
  return <Pill x={at[0] + (m.dx ?? 0)} y={at[1] + (m.dy ?? 0)} text={m.text} color={m.color} />;
}
