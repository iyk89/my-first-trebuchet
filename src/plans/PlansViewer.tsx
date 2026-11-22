import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { saveFile } from '../ui/saveFile';
import type { Prim, Sheet } from './drawing';
import { sheetsToPdf } from './pdf';
import { buildPlanSheets } from './sheets';

function PrimSvg({ p }: { p: Prim }) {
  const dash = 'dash' in p && p.dash ? p.dash.join(' ') : undefined;
  if (p.t === 'line')
    return <line x1={p.a[0]} y1={p.a[1]} x2={p.b[0]} y2={p.b[1]} stroke={p.c} strokeWidth={p.w} strokeDasharray={dash} strokeLinecap="round" />;
  if (p.t === 'poly') {
    const pts = p.pts.map((q) => q.join(',')).join(' ');
    const props = { points: pts, fill: p.fill ?? 'none', stroke: p.w === 0 ? 'none' : p.c, strokeWidth: p.w, strokeDasharray: dash, strokeLinejoin: 'round' as const };
    return p.close === false ? <polyline {...props} /> : <polygon {...props} />;
  }
  if (p.t === 'circle') return <circle cx={p.at[0]} cy={p.at[1]} r={p.r} fill={p.fill ?? 'none'} stroke={p.c} strokeWidth={p.w} strokeDasharray={dash} />;
  return (
    <text
      x={p.at[0]}
      y={p.at[1]}
      fontSize={p.size}
      fontFamily="Helvetica, Arial, sans-serif"
      fontWeight={p.bold ? 700 : 400}
      textAnchor={p.anchor}
      fill={p.c}
      transform={p.rot ? `rotate(${-p.rot} ${p.at[0]} ${p.at[1]})` : undefined}
    >
      {p.s}
    </text>
  );
}

export function SheetSvg({ sheet }: { sheet: Sheet }) {
  return (
    <svg viewBox={`0 0 ${sheet.w} ${sheet.h}`} className="plan-sheet" role="img" aria-label={sheet.title}>
      <rect width={sheet.w} height={sheet.h} fill="#ffffff" />
      {sheet.prims.map((p, i) => (
        <PrimSvg key={i} p={p} />
      ))}
    </svg>
  );
}

/** Full-screen view of the build plans, with a PDF download. */
export function PlansViewer() {
  const plans = useStore((s) => s.plans);
  const close = useStore((s) => s.openPlans);
  const [zoom, setZoom] = useState(1);
  const [msg, setMsg] = useState('');
  const sheets = useMemo(() => (plans ? buildPlanSheets(plans) : []), [plans]);
  if (!plans) return null;
  const file = `trebuchet-plans-${plans.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'design'}.pdf`;
  return (
    <div className="plans-overlay" role="dialog" aria-label="Build plans">
      <header className="plans-bar">
        <div className="plans-title">
          <b>📐 Build plans</b>
          <span>{plans.name}</span>
        </div>
        <div className="plans-actions">
          <div className="zoom">
            {[1, 1.5, 2].map((z) => (
              <button key={z} className={zoom === z ? 'on' : ''} onClick={() => setZoom(z)}>
                {z === 1 ? 'Fit' : `${z * 100}%`}
              </button>
            ))}
          </div>
          <button className="primary" onClick={async () => setMsg(await saveFile(file, sheetsToPdf(sheets, `Trebuchet plans: ${plans.name}`), 'application/pdf'))}>
            ⬇️ Download PDF
          </button>
          <button onClick={() => close(null)}>Close</button>
        </div>
      </header>
      {msg && <div className="plans-msg">{msg}</div>}
      <div className="plans-scroll">
        <div className="plans-pages" style={{ width: `${zoom * 100}%` }}>
          {sheets.map((s) => (
            <SheetSvg key={s.title} sheet={s} />
          ))}
          <p className="plans-tip">Print the PDF at 100% (actual size). Each page has a scale bar so you can check the print before measuring off it.</p>
        </div>
      </div>
    </div>
  );
}
