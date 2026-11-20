/** Diagrams for the lessons. Most are drawn from real "what if" throws of your own build. */
import { useMemo } from 'react';
import { fmtDeg, fmtLength, kmh } from '../data/format';
import { geometry, pose } from '../physics/geometry';
import type { Design } from '../physics/types';
import { releasePreview } from '../scene/preview';
import { useStore } from '../state/store';
import { EnergyBar } from '../ui/EnergyBar';
import { BarChart, SweepChart, type SweepPoint } from './Charts';
import { designKey, useTrials, type Trial } from './compute';
import { Sketch, sketchBounds, unionBounds, type Mark } from './Sketch';

export interface Variant {
  label: string;
  patch: Partial<Design>;
  mine?: boolean;
  color?: string;
}

const ARC_COLORS = ['#2f80ed', '#ff7a1a', '#27ae60', '#d6336c', '#9b51e0'];

function Loading() {
  return <div className="fig-loading">Running test throws on your machine…</div>;
}

/** Turn finished trials into colored arcs in the 3D view. */
function show3d(trials: Trial[], labels: string[], colors?: string[]) {
  const arcs = trials
    .map((t, i) => ({ t, label: labels[i], color: colors?.[i] ?? ARC_COLORS[i % ARC_COLORS.length] }))
    .filter((a) => a.t.results && a.t.results.path.length > 1)
    .map((a) => ({
      label: `${a.label} → ${fmtLength(a.t.results!.distance)}`,
      color: a.color,
      path: a.t.results!.path,
      distance: a.t.results!.distance,
      maxHeight: a.t.results!.maxHeight,
    }));
  useStore.getState().showDemoArcs(arcs);
}

/** Where the energy goes, for a few versions of your build. */
export function EnergyCompare({ d, variants }: { d: Design; variants: Variant[] }) {
  const designs = useMemo(() => variants.map((v) => ({ ...d, ...v.patch })), [d, variants]);
  const trials = useTrials('energy' + designKey(d) + JSON.stringify(variants), () => designs);
  if (!trials) return <Loading />;
  return (
    <div className="fig-stack">
      {trials.map((t, i) => (
        <div key={variants[i].label} className={`energy-row ${variants[i].mine ? 'mine' : ''}`}>
          <div className="energy-row-head">
            <b>{variants[i].label}</b>
            <span>{t.results ? `throws ${fmtLength(t.results.distance)}` : 'fails'}</span>
          </div>
          {t.results && <EnergyBar e={t.results.energy} />}
        </div>
      ))}
    </div>
  );
}

/** The path the counterweight takes during the throw, traced from real throws. */
export function WeightPaths({ d, variants }: { d: Design; variants: Variant[] }) {
  const designs = useMemo(() => variants.map((v) => ({ ...d, ...v.patch })), [d, variants]);
  const trials = useTrials('paths' + designKey(d) + JSON.stringify(variants), () => designs, true);
  const paths = useMemo(() => {
    if (!trials) return null;
    return trials.map((t) => {
      const g = geometry(t.design);
      const frames = t.frames ?? [];
      const end = t.releaseIndex >= 0 ? t.releaseIndex : frames.length;
      return frames.slice(0, Math.max(2, end)).map((f) => pose(g, f.theta, f.phi, f.psi).cw);
    });
  }, [trials]);
  if (!trials || !paths) return <Loading />;
  const extent = unionBounds(...designs.map((x, i) => sketchBounds(x, 'start', paths[i])));
  return (
    <div className="fig-stack">
      {designs.map((x, i) => (
        <Sketch
          key={variants[i].label}
          design={x}
          pose="start"
          highlight={['weight', 'hanger']}
          extent={extent}
          maxH={190}
          title={`${variants[i].label}${trials[i].results ? ` · throws ${fmtLength(trials[i].results!.distance)}` : ''}`}
          marks={[{ kind: 'path', pts: paths[i], color: 'var(--accent)', label: 'path of the weight' }]}
        />
      ))}
    </div>
  );
}

/** The moment the ball lets go, for a few hook bends, with the launch direction. */
export function ReleaseFan({ d, angles }: { d: Design; angles: number[] }) {
  const designs = useMemo(() => angles.map((a) => ({ ...d, releaseAngle: a })), [d, angles]);
  const L = d.armLength;
  const items = designs.map((x) => {
    const pv = releasePreview(x);
    const sp = Math.hypot(pv.vx, pv.vy) || 1;
    const end: [number, number] = [pv.bx + (pv.vx / sp) * L * 0.45, pv.by + (pv.vy / sp) * L * 0.45];
    return { x, pv, end };
  });
  const extent = unionBounds(...items.map((it) => sketchBounds(it.x, 'release', it.pv.ok ? [it.end] : [])));
  return (
    <div className="fig-stack">
      {items.map(({ x, pv, end }) => {
        const marks: Mark[] = pv.ok ? [{ kind: 'arrow', a: 'ball', b: end, label: pv.vx < 0 ? 'backward!' : `${Math.round(pv.angle)}° up` }] : [];
        return (
          <Sketch
            key={x.releaseAngle}
            design={x}
            pose="release"
            highlight={['hook', 'sling']}
            extent={extent}
            maxH={170}
            marks={marks}
            title={`Hook bent ${fmtDeg(x.releaseAngle)}${x.releaseAngle === d.releaseAngle ? ' (yours)' : ''}: ${pv.ok ? (pv.vx < 0 ? 'lets go too early' : `lets go here`) : 'never lets go'}`}
          />
        );
      })}
    </div>
  );
}

/** How fast the arm tip and the ball are moving when the ball lets go. */
export function ReleaseSpeeds({ d }: { d: Design }) {
  const pv = releasePreview(d);
  if (!pv.ok) return <p className="muted">Your build doesn't let go of the ball yet, so there's nothing to measure. Try the release hook lesson.</p>;
  const g = geometry(d);
  const p = pose(g, pv.theta, pv.phi, pv.psi);
  const ballSp = Math.hypot(pv.vx, pv.vy);
  const k = (d.armLength * 0.55) / Math.max(ballSp, pv.tipSpeed, 1e-6);
  const tipDir: [number, number] = [Math.sin(pv.theta), -Math.cos(pv.theta)]; // the arm turns clockwise
  const tipEnd: [number, number] = [p.tip[0] + tipDir[0] * pv.tipSpeed * k, p.tip[1] + tipDir[1] * pv.tipSpeed * k];
  const ballEnd: [number, number] = [pv.bx + (pv.vx / ballSp) * ballSp * k, pv.by + (pv.vy / ballSp) * ballSp * k];
  return (
    <Sketch
      design={d}
      pose="release"
      highlight={['sling']}
      marks={[
        { kind: 'arrow', a: 'tip', b: tipEnd, label: `tip ${kmh(pv.tipSpeed)}`, color: 'var(--brand)' },
        { kind: 'arrow', a: 'ball', b: ballEnd, label: `ball ${kmh(ballSp)}` },
      ]}
      title="The moment the ball lets go"
    />
  );
}

/** Close-up of the release hook with its bend drawn as an angle. */
export function HookCloseup({ d }: { d: Design }) {
  const a = (Math.min(110, Math.max(0, d.releaseAngle)) * Math.PI) / 180;
  const tip = [150, 178];
  const hook = 80;
  const he = [tip[0] + hook * Math.cos(a), tip[1] - hook * Math.sin(a)];
  const loop = [tip[0] + hook * 0.55 * Math.cos(a), tip[1] - hook * 0.55 * Math.sin(a)];
  const sa = a + 1.0; // the sling trails behind the hook, at a bigger angle
  const sl = 92;
  const ball = [loop[0] + sl * Math.cos(sa), loop[1] - sl * Math.sin(sa)];
  const arc = (r: number, a0: number, a1: number, c: number[]) => {
    const pts: string[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = a0 + ((a1 - a0) * i) / 24;
      pts.push(`${(c[0] + r * Math.cos(t)).toFixed(1)},${(c[1] - r * Math.sin(t)).toFixed(1)}`);
    }
    return pts.join(' ');
  };
  const swingEnd = [loop[0] + sl * Math.cos(sa - 0.6), loop[1] - sl * Math.sin(sa - 0.6)];
  return (
    <figure className="sketch">
      <div className="sketch-title">Close-up of the arm tip</div>
      <svg viewBox="0 0 360 230" role="img" aria-label="Release hook close-up">
        <rect width={360} height={230} fill="var(--sky-soft)" />
        <line x1={0} y1={tip[1]} x2={tip[0]} y2={tip[1]} stroke="var(--wood)" strokeWidth={22} />
        <text x={60} y={tip[1] + 36} className="sk-label" fontSize={12} textAnchor="middle" fill="var(--ink-2)">
          end of the arm
        </text>
        <line x1={tip[0]} y1={tip[1]} x2={352} y2={tip[1]} stroke="var(--ink-2)" strokeDasharray="6 5" strokeWidth={1.5} />
        <text x={350} y={tip[1] + 18} className="sk-label" fontSize={11} textAnchor="end" fill="var(--ink-2)">
          straight out
        </text>
        <polyline points={arc(46, 0, a, tip)} fill="none" stroke="var(--accent-2)" strokeWidth={3} />
        <text x={tip[0] + 62 * Math.cos(Math.max(a / 2, 0.18))} y={tip[1] - 62 * Math.sin(Math.max(a / 2, 0.18)) + 5} fontSize={15} className="sk-label" textAnchor="middle" fill="var(--ink)">
          {fmtDeg(d.releaseAngle)}
        </text>
        <line x1={tip[0]} y1={tip[1]} x2={he[0]} y2={he[1]} stroke="var(--metal)" strokeWidth={7} strokeLinecap="round" />
        <text x={he[0] + 8} y={he[1] + 4} fontSize={12} className="sk-label" fill="var(--ink)">
          hook
        </text>
        <polyline points={arc(sl, sa, sa - 0.6, loop)} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 4" />
        <circle cx={swingEnd[0]} cy={swingEnd[1]} r={4} fill="var(--accent)" />
        <line x1={loop[0]} y1={loop[1]} x2={ball[0]} y2={ball[1]} stroke="var(--rope)" strokeWidth={3} />
        <ellipse cx={loop[0]} cy={loop[1]} rx={9} ry={5} transform={`rotate(${(-a * 180) / Math.PI + 90} ${loop[0]} ${loop[1]})`} fill="none" stroke="var(--rope)" strokeWidth={3} />
        <circle cx={ball[0]} cy={ball[1]} r={11} fill="var(--card)" stroke="var(--ink-2)" strokeWidth={1.5} />
        <text x={ball[0] - 16} y={ball[1] + 4} fontSize={12} className="sk-label" textAnchor="end" fill="var(--ink)">
          ball
        </text>
        <text x={loop[0] - 14} y={loop[1] + 4} fontSize={11} className="sk-label" textAnchor="end" fill="var(--ink-2)">
          loop
        </text>
      </svg>
      <figcaption>The sling swings toward the hook (orange dashes). The moment it lines up with the hook, the loop slides off and the ball flies.</figcaption>
    </figure>
  );
}

/** A ping-pong ball and a golf ball: same size, very different weight. */
export function PingVsGolf() {
  // Same size, so air pushes on both equally; the light one slows 17x more.
  return (
    <figure className="sketch">
      <svg viewBox="0 0 360 150" role="img" aria-label="Ping-pong ball and golf ball compared">
        <rect width={360} height={150} fill="var(--sky-soft)" />
        {[
          { x: 120, name: 'Ping-pong ball', w: '2.7 g', fill: '#f5f5f0', arrow: 68 },
          { x: 280, name: 'Golf ball', w: '46 g', fill: '#ffffff', arrow: 4 },
        ].map((b) => (
          <g key={b.name}>
            <circle cx={b.x} cy={70} r={26} fill={b.fill} stroke="var(--ink-2)" strokeWidth={1.5} />
            <text x={b.x} y={118} textAnchor="middle" fontSize={13} className="sk-label" fill="var(--ink)">
              {b.name}
            </text>
            <text x={b.x} y={136} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
              {b.w} · 4 cm
            </text>
            <line x1={b.x - 30} y1={70} x2={b.x - 30 - b.arrow} y2={70} stroke="var(--bad)" strokeWidth={4} />
            <polygon points={`${b.x - 34 - b.arrow},70 ${b.x - 26 - b.arrow},64 ${b.x - 26 - b.arrow},76`} fill="var(--bad)" />
          </g>
        ))}
        <text x={180} y={22} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
          red arrows: how much the air slows each one down
        </text>
      </svg>
      <figcaption>The air pushes on both the same, because they're the same size. But the ping-pong ball is 17 times lighter, so the same push slows it 17 times more.</figcaption>
    </figure>
  );
}

/** A little ball flying right with air pushing back on it. */
export function AirPush() {
  return (
    <figure className="sketch">
      <svg viewBox="0 0 360 120" role="img" aria-label="Air pushing back on a flying ball">
        <rect width={360} height={120} fill="var(--sky-soft)" />
        {[30, 60, 90].map((y) => (
          <g key={y}>
            <line x1={330} y1={y} x2={250} y2={y} stroke="#7fc8f8" strokeWidth={3} strokeDasharray="10 6" />
          </g>
        ))}
        <circle cx={200} cy={60} r={20} fill="var(--card)" stroke="var(--ink-2)" strokeWidth={1.5} />
        <line x1={110} y1={60} x2={170} y2={60} stroke="var(--accent)" strokeWidth={4} />
        <polygon points="176,60 166,54 166,66" fill="var(--accent)" />
        <text x={130} y={50} textAnchor="middle" fontSize={12} fill="var(--ink)" className="sk-label">
          ball flying →
        </text>
        <text x={290} y={112} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
          ← air pushes back
        </text>
      </svg>
    </figure>
  );
}

/** Three planets and how hard each one pulls. */
export function Planets() {
  const ps = [
    { name: 'Earth', pct: 100, r: 44, fill: '#3f86d8' },
    { name: 'Mars', pct: 38, r: 30, fill: '#c1440e' },
    { name: 'Moon', pct: 17, r: 22, fill: '#c9c9c9' },
  ];
  return (
    <figure className="sketch">
      <svg viewBox="0 0 360 150" role="img" aria-label="Gravity on Earth, Mars and the Moon">
        <rect width={360} height={150} fill="#1f1b3a" />
        {ps.map((p, i) => (
          <g key={p.name}>
            <circle cx={65 + i * 115} cy={62} r={p.r} fill={p.fill} />
            <text x={65 + i * 115} y={128} textAnchor="middle" fontSize={14} fill="#ffffff" className="sk-label">
              {p.name}
            </text>
            <text x={65 + i * 115} y={145} textAnchor="middle" fontSize={12} fill="#c9c4e8">
              pull: {p.pct}%
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

/** Flight paths of a few versions of your throw, drawn to scale. */
export function FlightPaths({ d, variants }: { d: Design; variants: Variant[] }) {
  const designs = useMemo(() => variants.map((v) => ({ ...d, ...v.patch })), [d, variants]);
  const trials = useTrials('flight' + designKey(d) + JSON.stringify(variants), () => designs);
  if (!trials) return <Loading />;
  const all = trials.flatMap((t) => t.results?.path ?? []);
  if (all.length === 0) return <p className="muted">These throws don't fly, so there's no path to draw.</p>;
  const xMax = Math.max(...all.map((p) => p[0]), 1e-3);
  const xMin = Math.min(0, ...all.map((p) => p[0]));
  const yMax = Math.max(...all.map((p) => p[1]), 1e-3);
  const W = 360;
  const H = 170;
  const s = Math.min((W - 30) / (xMax - xMin), (H - 40) / yMax);
  const X = (x: number) => 15 + (x - xMin) * s;
  const Y = (y: number) => H - 22 - y * s;
  return (
    <figure className="sketch">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Flight paths compared">
        <rect width={W} height={H} fill="var(--sky-soft)" />
        <rect y={Y(0)} width={W} height={H - Y(0)} fill="var(--grass)" />
        {trials.map((t, i) =>
          t.results ? (
            <g key={variants[i].label}>
              <polyline points={t.results.path.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' ')} fill="none" stroke={variants[i].color ?? ARC_COLORS[i]} strokeWidth={3} />
              <circle cx={X(t.results.distance)} cy={Y(0)} r={4} fill={variants[i].color ?? ARC_COLORS[i]} />
            </g>
          ) : null,
        )}
      </svg>
      <figcaption className="legend">
        {trials.map((t, i) => (
          <span key={variants[i].label}>
            <i style={{ background: variants[i].color ?? ARC_COLORS[i] }} />
            {variants[i].label}: <b>{t.results ? fmtLength(t.results.distance) : 'fails'}</b>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Bars: how far each version of your build throws. */
export function ExperimentBars({ d, variants, note }: { d: Design; variants: Variant[]; note?: (t: Trial) => string }) {
  const designs = useMemo(() => variants.map((v) => ({ ...d, ...v.patch })), [d, variants]);
  const trials = useTrials('bars' + designKey(d) + JSON.stringify(variants), () => designs);
  if (!trials) return <Loading />;
  const bars = trials.map((t, i) => ({
    label: variants[i].label,
    value: t.results ? t.results.distance : null,
    mine: variants[i].mine,
    color: variants[i].color,
    note: note && t.results ? note(t) : undefined,
  }));
  // For the 3D view: your build plus the best and worst others (at most 4 arcs).
  const order = trials.map((t, i) => ({ t, i })).filter((x) => x.t.results);
  order.sort((a, b) => b.t.results!.distance - a.t.results!.distance);
  const pick = order.length <= 4 ? order : [order[0], ...order.filter((x) => variants[x.i].mine), order[order.length - 1]];
  const uniq = pick.filter((x, k) => pick.findIndex((y) => y.i === x.i) === k);
  return (
    <div>
      <BarChart bars={bars} />
      <button className="show3d" onClick={() => show3d(uniq.map((x) => x.t), uniq.map((x) => variants[x.i].label), uniq.map((x, k) => variants[x.i].color ?? ARC_COLORS[k]))}>
        🎯 Show these throws in 3D
      </button>
    </div>
  );
}

export interface SweepSpec {
  key: keyof Design;
  xLabel: string;
  format: (v: number) => string;
  log?: boolean;
  values: (d: Design) => number[];
  prep?: (d: Design) => Partial<Design>;
}

/** Try many values of one setting on your build and chart how far each one throws. */
export function SweepExperiment({ d, spec }: { d: Design; spec: SweepSpec }) {
  const base = useMemo(() => ({ ...d, ...(spec.prep?.(d) ?? {}) }), [d, spec]);
  const current = base[spec.key] as number;
  const xs = useMemo(() => {
    const v = [...spec.values(base), current].filter((x) => Number.isFinite(x));
    const uniq = [...new Set(v.map((x) => Number(x.toPrecision(6))))];
    return uniq.sort((a, b) => a - b);
  }, [base, spec, current]);
  const designs = useMemo(() => xs.map((x) => ({ ...base, [spec.key]: x }) as Design), [xs, base, spec.key]);
  const trials = useTrials('sweep' + String(spec.key) + designKey(base) + xs.join(','), () => designs);
  if (!trials) return <Loading />;
  const points: SweepPoint[] = trials.map((t, i) => ({ x: xs[i], y: t.results && t.results.distance > 0 ? t.results.distance : null }));
  const cur = points.find((p) => Math.abs(p.x - Number(current.toPrecision(6))) < 1e-9 * Math.max(1, Math.abs(current)));
  const best = points.filter((p) => p.y !== null).reduce<SweepPoint | null>((b, p) => (!b || (p.y ?? 0) > (b.y ?? 0) ? p : b), null);
  const iLo = 0;
  const iHi = trials.length - 1;
  const iCur = points.indexOf(cur!);
  return (
    <div>
      <SweepChart points={points} current={Number(current.toPrecision(6))} xLabel={spec.xLabel} formatX={spec.format} log={spec.log} />
      {best && cur && (
        <p className="insight">
          {cur === best || (cur.y !== null && best.y !== null && cur.y >= best.y - 1e-9) ? (
            <>
              Your setting, <b>{spec.format(cur.x)}</b>, is the best of these. 🎉
            </>
          ) : (
            <>
              Best here: <b>{spec.format(best.x)}</b> throws <b>{fmtLength(best.y!)}</b>. Yours, <b>{spec.format(cur.x)}</b>, throws{' '}
              <b>{cur.y === null ? 'nothing (it fails)' : fmtLength(cur.y)}</b>.
            </>
          )}
        </p>
      )}
      <button
        className="show3d"
        onClick={() =>
          show3d(
            [trials[iLo], trials[iCur], trials[iHi]].filter(Boolean),
            [`${spec.format(xs[iLo])}`, `Yours (${spec.format(xs[iCur])})`, `${spec.format(xs[iHi])}`],
            ['#2f80ed', '#ff7a1a', '#27ae60'],
          )
        }
      >
        🎯 Show smallest, yours and biggest in 3D
      </button>
    </div>
  );
}
