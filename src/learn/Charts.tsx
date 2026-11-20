import { fmtLength } from '../data/format';

export interface SweepPoint {
  x: number;
  y: number | null; // distance, or null when the throw failed
  failure?: string;
}

const W = 360;
const H = 210;
const M = { l: 46, r: 16, t: 26, b: 44 };

function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0];
  const raw = max / count;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const step = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  const out: number[] = [];
  for (let v = 0; v <= max * 1.0001; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** Line chart: how far the ball goes as one setting changes, with your build and the best marked. */
export function SweepChart({ points, current, xLabel, formatX, log }: { points: SweepPoint[]; current: number; xLabel: string; formatX: (v: number) => string; log?: boolean }) {
  const xs = points.map((p) => p.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const valid = points.filter((p) => p.y !== null) as { x: number; y: number }[];
  const yMaxRaw = Math.max(1e-3, ...valid.map((p) => p.y));
  const ticks = niceTicks(yMaxRaw);
  const yMax = Math.max(ticks[ticks.length - 1], yMaxRaw);
  const X = (v: number) => {
    const u = log ? Math.log(v / xMin) / Math.log(xMax / xMin) : (v - xMin) / (xMax - xMin || 1);
    return M.l + u * (W - M.l - M.r);
  };
  const Y = (v: number) => H - M.b - (Math.max(0, v) / yMax) * (H - M.t - M.b);

  const segments: string[][] = [];
  let seg: string[] = [];
  for (const p of points) {
    if (p.y === null) {
      if (seg.length) segments.push(seg);
      seg = [];
    } else seg.push(`${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`);
  }
  if (seg.length) segments.push(seg);

  const cur = points.find((p) => Math.abs(p.x - current) < 1e-9 * Math.max(1, Math.abs(current)));
  const best = valid.reduce<{ x: number; y: number } | null>((b, p) => (!b || p.y > b.y ? p : b), null);
  const curIsBest = !!(cur && best && cur.y !== null && Math.abs(cur.y - best.y) < 1e-6);

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`How far the ball goes as ${xLabel.toLowerCase()} changes`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={Y(t)} y2={Y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={M.l - 6} y={Y(t) + 4} textAnchor="end" className="ch-tick">
              {fmtLength(t)}
            </text>
          </g>
        ))}
        <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="var(--ink-2)" strokeWidth={1.2} />
        {points.map((p) => (
          <line key={`t${p.x}`} x1={X(p.x)} x2={X(p.x)} y1={H - M.b} y2={H - M.b + 4} stroke="var(--ink-2)" />
        ))}
        <text x={X(xMin)} y={H - M.b + 17} textAnchor="start" className="ch-tick">
          {formatX(xMin)}
        </text>
        <text x={X(xMax)} y={H - M.b + 17} textAnchor="end" className="ch-tick">
          {formatX(xMax)}
        </text>
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" className="ch-axis">
          {xLabel} →
        </text>
        <text x={12} y={(M.t + H - M.b) / 2} textAnchor="middle" className="ch-axis" transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`}>
          How far ↑
        </text>

        {segments.map((sg, i) =>
          sg.length > 1 ? <polyline key={i} points={sg.join(' ')} fill="none" stroke="var(--brand)" strokeWidth={2.5} strokeLinejoin="round" /> : null,
        )}
        {points.map((p) =>
          p.y === null ? (
            <text key={`f${p.x}`} x={X(p.x)} y={H - M.b - 4} textAnchor="middle" className="ch-fail">
              ✕
            </text>
          ) : (
            <circle key={`p${p.x}`} cx={X(p.x)} cy={Y(p.y)} r={3} fill="var(--brand)" />
          ),
        )}

        {best && !curIsBest && (
          <g>
            <circle cx={X(best.x)} cy={Y(best.y)} r={6} fill="var(--good)" stroke="white" strokeWidth={2} />
            <text x={X(best.x)} y={Y(best.y) - 10} textAnchor="middle" className="ch-best">
              Best: {fmtLength(best.y)}
            </text>
          </g>
        )}
        {cur && (
          <g>
            <circle cx={X(cur.x)} cy={cur.y === null ? H - M.b : Y(cur.y)} r={7} fill="var(--accent)" stroke="white" strokeWidth={2} />
            <text
              x={Math.min(Math.max(X(cur.x), M.l + 40), W - M.r - 40)}
              y={(cur.y === null ? H - M.b : Y(cur.y)) + (best && !curIsBest && Math.abs(Y(best.y) - Y(cur.y ?? 0)) < 26 ? 22 : -12)}
              textAnchor="middle"
              className="ch-cur"
            >
              {curIsBest ? 'Yours is the best!' : `Yours: ${cur.y === null ? 'fails' : fmtLength(cur.y)}`}
            </text>
          </g>
        )}
      </svg>
      {points.some((p) => p.y === null) && <p className="ch-note">✕ = that throw failed (crashed, never let go, or flew backward).</p>}
    </div>
  );
}

export interface Bar {
  label: string;
  value: number | null;
  note?: string;
  color?: string;
  mine?: boolean;
}

/** Horizontal bars, longest throw wins. */
export function BarChart({ bars }: { bars: Bar[] }) {
  const max = Math.max(1e-3, ...bars.map((b) => b.value ?? 0));
  return (
    <div className="bars">
      {bars.map((b) => (
        <div key={b.label} className={`bar-row ${b.mine ? 'mine' : ''}`}>
          <span className="bar-label">
            {b.label}
            {b.mine && <em> (yours)</em>}
          </span>
          <div className="bar-track">
            <span className="bar-fill" style={{ width: `${(Math.max(0, b.value ?? 0) / max) * 100}%`, background: b.color ?? (b.mine ? 'var(--accent)' : 'var(--brand)') }} />
          </div>
          <span className="bar-val">
            {b.value === null ? 'fails' : b.value < 0 ? 'backward' : fmtLength(b.value)}
            {b.note && <small>{b.note}</small>}
          </span>
        </div>
      ))}
    </div>
  );
}
