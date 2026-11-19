import { fmtPct } from '../data/format';
import type { EnergyShare } from '../physics/types';

const PARTS: { key: keyof EnergyShare; label: string; color: string }[] = [
  { key: 'ball', label: 'Ball', color: '#ff7a1a' },
  { key: 'arm', label: 'Arm still spinning', color: '#c4925c' },
  { key: 'weight', label: 'Weight still moving', color: '#6b4c30' },
  { key: 'unused', label: "Weight hadn't fallen yet", color: '#a9b4c2' },
  { key: 'air', label: 'Air', color: '#7fc8f8' },
];

export function EnergyBar({ e }: { e: EnergyShare }) {
  const parts = PARTS.filter((p) => e[p.key] > 0.005);
  return (
    <div className="energy">
      <div className="energy-bar">
        {parts.map((p) => (
          <span key={p.key} style={{ width: `${Math.max(0, e[p.key]) * 100}%`, background: p.color }} title={`${p.label}: ${fmtPct(e[p.key])}`} />
        ))}
      </div>
      <ul className="energy-legend">
        {parts.map((p) => (
          <li key={p.key}>
            <i style={{ background: p.color }} /> {p.label} <b>{fmtPct(e[p.key])}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
