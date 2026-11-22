import { FAILURE_TEXT, nextTip } from '../data/advice';
import {
  distanceCompare,
  fmtDeg,
  fmtLength,
  fmtPct,
  fmtSpeed,
  fmtTime,
  heightCompare,
  kmh,
  speedCompare,
} from '../data/format';
import { useStore } from '../state/store';
import { EnergyBar } from './EnergyBar';
import { openPlansForVersion } from '../plans/open';

export function ResultsPanel() {
  const sim = useStore((s) => s.sim);
  const versions = useStore((s) => s.versions);
  const simVersionId = useStore((s) => s.simVersionId);
  const lastThrowNew = useStore((s) => s.lastThrowNew);
  const setPanel = useStore((s) => s.setPanel);
  const updateVersion = useStore((s) => s.updateVersion);
  const draft = useStore((s) => s.draft);
  const revealed = useStore((s) => s.revealed);
  const reveal = useStore((s) => s.reveal);
  const v = versions.find((x) => x.id === simVersionId);
  if (!sim || !v) return <div className="panel-body"><p>Press THROW to see what happens!</p></div>;
  const r = sim.results;
  const fail = sim.failure ? FAILURE_TEXT[sim.failure] : null;
  const parent = versions.find((x) => x.id === v.parentId);

  return (
    <div className="panel-body results">
      <div className="ver-title" style={{ borderColor: v.color }}>
        <span className="dot" style={{ background: v.color }} />
        <input className="ver-name" value={v.name} onChange={(e) => updateVersion(v.id, { name: e.target.value })} aria-label="Version name" />
        {lastThrowNew && <span className="saved">Saved ✓</span>}
      </div>
      {v.changes.length > 0 && parent && (
        <div className="changes">
          <span className="muted">Changed from {parent.name}:</span>
          {v.changes.map((c) => (
            <span key={c} className="chip">
              {c}
            </span>
          ))}
        </div>
      )}

      {!revealed && (
        <div className="waiting">
          <div className="waiting-big">👀 Watch the throw!</div>
          {v.guess !== undefined && <p>Your guess: <b>{fmtLength(v.guess)}</b></p>}
          <button onClick={reveal}>Skip to the results</button>
        </div>
      )}

      {revealed && fail && (
        <div className="issue">
          <b>{fail.title}</b>
          <span>{fail.why}</span>
        </div>
      )}

      {revealed && r?.weightCrashed && (
        <div className="issue">
          <b>💥 The weight smashed into the ground after the throw.</b>
          <span>The ball still flew, but on a real machine that crash would break something. Give the weight more room to swing.</span>
        </div>
      )}

      {revealed && r && (
        <>
          <div className="stats">
            <div className="stat hero">
              <span className="stat-label">📏 How far</span>
              <span className="stat-value">{fmtLength(r.distance)}</span>
              <span className="stat-sub">{r.distance > 0 ? distanceCompare(r.distance) : 'behind the machine!'}</span>
              {parent?.results && <Delta now={r.distance} before={parent.results.distance} label={parent.name} />}
            </div>
            <div className="stat">
              <span className="stat-label">⛰️ How high</span>
              <span className="stat-value">{fmtLength(r.maxHeight)}</span>
              <span className="stat-sub">{heightCompare(r.maxHeight)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">⚡ How fast</span>
              <span className="stat-value">{kmh(r.launchSpeed)}</span>
              <span className="stat-sub">
                {fmtSpeed(r.launchSpeed)} · {speedCompare(r.launchSpeed)}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">↗️ Launch angle</span>
              <span className="stat-value">{fmtDeg(r.launchAngle)}</span>
              <span className="stat-sub">45° is best with no air</span>
            </div>
            <div className="stat">
              <span className="stat-label">⏱️ Time in the air</span>
              <span className="stat-value">{fmtTime(r.flightTime)}</span>
              <span className="stat-sub">Landed at {kmh(r.landingSpeed)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">🔋 Energy score</span>
              <span className="stat-value">{fmtPct(r.efficiency)}</span>
              <span className="stat-sub">of the weight's energy went into the ball</span>
            </div>
          </div>

          {v.guess !== undefined && lastThrowNew && (
            <div className="guess-result">
              You guessed <b>{fmtLength(v.guess)}</b>. It went <b>{fmtLength(r.distance)}</b>.{' '}
              {Math.abs(v.guess - r.distance) < Math.max(0.1 * r.distance, 0.05) ? 'Great guess! 🎯' : v.guess < r.distance ? 'Farther than you thought!' : 'Not as far as you thought.'}
            </div>
          )}

          <h4>Where did the energy go?</h4>
          <EnergyBar e={r.energy} />
        </>
      )}

      {revealed && <div className="tip">
        <b>Try this next:</b> {nextTip(draft, r, sim.failure)}
      </div>}

      <div className="btn-row">
        <button className="primary" onClick={() => setPanel('build')}>
          🔧 Change something
        </button>
        <button onClick={() => openPlansForVersion(v)}>📐 Build plans</button>
        <button onClick={() => setPanel('versions')}>📚 All versions</button>
      </div>
    </div>
  );
}

function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  const diff = now - before;
  if (Math.abs(diff) < 0.005 * Math.max(Math.abs(before), 0.01)) return <span className="delta same">Same as {label}</span>;
  const pct = before !== 0 ? Math.round((diff / Math.abs(before)) * 100) : 0;
  return (
    <span className={`delta ${diff > 0 ? 'up' : 'down'}`}>
      {diff > 0 ? '▲' : '▼'} {fmtLength(Math.abs(diff))} {diff > 0 ? 'farther' : 'shorter'} than {label} ({pct > 0 ? '+' : ''}
      {pct}%)
    </span>
  );
}
