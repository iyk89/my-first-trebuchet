import { useState } from 'react';
import { FAILURE_TEXT } from '../data/advice';
import { fmtDeg, fmtLength, fmtMass, fmtPct, fmtRatio, fmtTime, kmh } from '../data/format';
import { projectileById } from '../data/projectiles';
import type { Design, Results } from '../physics/types';
import { useStore, type Version } from '../state/store';

interface Row {
  label: string;
  get: (v: Version) => string;
  num?: (v: Version) => number | undefined;
}

const RESULT_ROWS: (Row & { num: (v: Version) => number | undefined })[] = [
  { label: '📏 How far', get: (v) => (v.results ? fmtLength(v.results.distance) : '—'), num: (v) => v.results?.distance },
  { label: '⛰️ How high', get: (v) => (v.results ? fmtLength(v.results.maxHeight) : '—'), num: (v) => v.results?.maxHeight },
  { label: '⚡ How fast', get: (v) => (v.results ? kmh(v.results.launchSpeed) : '—'), num: (v) => v.results?.launchSpeed },
  { label: '↗️ Launch angle', get: (v) => (v.results ? fmtDeg(v.results.launchAngle) : '—'), num: () => undefined },
  { label: '⏱️ Time in air', get: (v) => (v.results ? fmtTime(v.results.flightTime) : '—'), num: (v) => v.results?.flightTime },
  { label: '🔋 Energy score', get: (v) => (v.results ? fmtPct(v.results.efficiency) : '—'), num: (v) => v.results?.efficiency },
  { label: '🏗️ Real throw', get: (v) => (v.realDistance !== undefined ? fmtLength(v.realDistance) : '—'), num: (v) => v.realDistance },
];

const d = (f: (d: Design) => string) => (v: Version) => f(v.design);
const DESIGN_ROWS: Row[] = [
  { label: 'Arm length', get: d((x) => fmtLength(x.armLength)) },
  { label: 'Turning point', get: d((x) => fmtRatio(x.pivotRatio)) },
  { label: 'Arm weight', get: d((x) => fmtMass(x.armMass)) },
  { label: 'Tower', get: d((x) => fmtLength(x.towerHeight)) },
  { label: 'Pull-back', get: d((x) => fmtDeg(x.pullBack)) },
  { label: 'Weight', get: d((x) => fmtMass(x.cwMass)) },
  { label: 'Weight style', get: d((x) => (x.cwStyle === 'hinged' ? 'Swinging' : 'Bolted on')) },
  { label: 'Hanger', get: d((x) => (x.cwStyle === 'hinged' ? fmtLength(x.hangerLength) : '—')) },
  { label: 'Sling', get: d((x) => fmtLength(x.slingLength)) },
  { label: 'Release hook', get: d((x) => fmtDeg(x.releaseAngle)) },
  { label: 'Ball', get: d((x) => projectileById(x.projectileId).name) },
  { label: 'Ball weight', get: d((x) => fmtMass(x.projectileMass)) },
  { label: 'Ball size', get: d((x) => fmtLength(x.projectileDiameter)) },
  { label: 'Planet', get: d((x) => x.planet[0].toUpperCase() + x.planet.slice(1)) },
  { label: 'Air', get: d((x) => (x.air ? 'On' : 'Off')) },
  { label: 'Wind', get: d((x) => `${x.wind} m/s`) },
];

export function ComparePanel() {
  const versions = useStore((s) => s.versions);
  const compareIds = useStore((s) => s.compareIds);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const setPanel = useStore((s) => s.setPanel);
  const [showSame, setShowSame] = useState(false);
  const chosen = versions.filter((v) => compareIds.includes(v.id)).sort((a, b) => a.number - b.number);

  if (chosen.length < 2) {
    return (
      <div className="panel-body">
        <h2>⚖️ Compare</h2>
        <p className="intro">Pick at least two versions to compare.</p>
        <button className="primary" onClick={() => setPanel('versions')}>
          📚 Pick versions
        </button>
      </div>
    );
  }

  const maxDist = Math.max(...chosen.map((v) => v.results?.distance ?? 0), 0.001);
  const differing = DESIGN_ROWS.filter((row) => new Set(chosen.map(row.get)).size > 1);
  const same = DESIGN_ROWS.filter((row) => !differing.includes(row));

  return (
    <div className="panel-body compare">
      <h2>⚖️ Compare</h2>
      <p className="intro">The colored arcs in the 3D view show each throw.</p>

      <div className="race">
        {chosen.map((v) => {
          const r: Results | null = v.results;
          return (
            <div key={v.id} className="race-row">
              <span className="race-name" style={{ color: v.color }}>
                {v.name}
              </span>
              <div className="race-track">
                <span className="race-bar" style={{ width: `${Math.max(0, (r?.distance ?? 0) / maxDist) * 100}%`, background: v.color }} />
              </div>
              <span className="race-val">{r ? fmtLength(r.distance) : v.failure ? FAILURE_TEXT[v.failure].title : '—'}</span>
            </div>
          );
        })}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th />
              {chosen.map((v) => (
                <th key={v.id} style={{ color: v.color }}>
                  {v.name}
                  <button className="x" onClick={() => toggleCompare(v.id)} aria-label={`Remove ${v.name}`}>
                    ×
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="section">
              <td colSpan={chosen.length + 1}>Results</td>
            </tr>
            {RESULT_ROWS.map((row) => {
              const nums = chosen.map(row.num);
              const valid = nums.filter((n): n is number => n !== undefined);
              const best = valid.length > 1 ? Math.max(...valid) : undefined;
              return (
                <tr key={row.label}>
                  <th>{row.label}</th>
                  {chosen.map((v, i) => (
                    <td key={v.id} className={best !== undefined && nums[i] === best ? 'best' : ''}>
                      {row.get(v)}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr className="section">
              <td colSpan={chosen.length + 1}>What's different</td>
            </tr>
            {differing.length === 0 && (
              <tr>
                <td colSpan={chosen.length + 1} className="muted">
                  Exactly the same build.
                </td>
              </tr>
            )}
            {differing.map((row) => (
              <tr key={row.label} className="diff">
                <th>{row.label}</th>
                {chosen.map((v) => (
                  <td key={v.id}>{row.get(v)}</td>
                ))}
              </tr>
            ))}
            {showSame &&
              same.map((row) => (
                <tr key={row.label} className="same">
                  <th>{row.label}</th>
                  {chosen.map((v) => (
                    <td key={v.id}>{row.get(v)}</td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <button className="link" onClick={() => setShowSame(!showSame)}>
        {showSame ? 'Hide settings that are the same' : `Show ${same.length} settings that are the same`}
      </button>
    </div>
  );
}
