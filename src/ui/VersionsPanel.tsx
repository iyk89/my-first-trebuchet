import { useRef, useState } from 'react';
import { fmtLength, kmh } from '../data/format';
import { FAILURE_TEXT } from '../data/advice';
import { useStore, type Version } from '../state/store';
import { openPlansForVersion } from '../plans/open';
import { saveFile } from './saveFile';

function timeAgo(ms: number) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString();
}

function VersionCard({ v }: { v: Version }) {
  const compareIds = useStore((s) => s.compareIds);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const replay = useStore((s) => s.replay);
  const loadVersion = useStore((s) => s.loadVersion);
  const deleteVersion = useStore((s) => s.deleteVersion);
  const updateVersion = useStore((s) => s.updateVersion);
  const baseVersionId = useStore((s) => s.baseVersionId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const r = v.results;
  const real = v.realDistance;
  const changes = showAll ? v.changes : v.changes.slice(0, 3);
  return (
    <div className={`vcard ${baseVersionId === v.id ? 'current' : ''}`} style={{ borderLeftColor: v.color }}>
      <div className="vcard-head">
        <label className="vcheck" title="Pick for comparing">
          <input type="checkbox" checked={compareIds.includes(v.id)} onChange={() => toggleCompare(v.id)} />
        </label>
        <input className="ver-name" value={v.name} onChange={(e) => updateVersion(v.id, { name: e.target.value })} aria-label="Version name" />
        <span className="muted small">{timeAgo(v.createdAt)}</span>
      </div>
      {r ? (
        <div className="vstats">
          <span>
            📏 <b>{fmtLength(r.distance)}</b>
          </span>
          <span>⛰️ {fmtLength(r.maxHeight)}</span>
          <span>⚡ {kmh(r.launchSpeed)}</span>
        </div>
      ) : (
        <div className="vstats fail">{v.failure ? FAILURE_TEXT[v.failure].title : 'No throw'}</div>
      )}
      {v.changes.length > 0 && (
        <div className="changes">
          {changes.map((c) => (
            <span key={c} className="chip">
              {c}
            </span>
          ))}
          {v.changes.length > 3 && (
            <button className="link" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'less' : `+${v.changes.length - 3} more`}
            </button>
          )}
        </div>
      )}
      {v.changes.length === 0 && !v.parentId && <div className="muted small">First build</div>}
      <label className="real">
        We built it! Real throw:
        <input
          inputMode="decimal"
          placeholder="—"
          value={real ?? ''}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            updateVersion(v.id, { realDistance: Number.isFinite(n) ? n : undefined });
          }}
        />
        m
        {real !== undefined && r && r.distance > 0 && (
          <span className="muted small"> · {Math.round((real / r.distance) * 100)}% of the simulation</span>
        )}
      </label>
      <div className="btn-row small">
        <button onClick={() => replay(v.id)}>▶ Replay</button>
        <button onClick={() => loadVersion(v.id)}>🔧 Build from this</button>
        <button onClick={() => openPlansForVersion(v)}>📐 Plans</button>
        {confirmDelete ? (
          <>
            <button className="danger" onClick={() => deleteVersion(v.id)}>
              Yes, delete
            </button>
            <button onClick={() => setConfirmDelete(false)}>Keep it</button>
          </>
        ) : (
          <button className="ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete">
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

export function VersionsPanel() {
  const versions = useStore((s) => s.versions);
  const compareIds = useStore((s) => s.compareIds);
  const setPanel = useStore((s) => s.setPanel);
  const setCompare = useStore((s) => s.setCompare);
  const showAllArcs = useStore((s) => s.showAllArcs);
  const setShowAllArcs = useStore((s) => s.setShowAllArcs);
  const importVersions = useStore((s) => s.importVersions);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const sorted = [...versions].sort((a, b) => b.number - a.number);

  const exportAll = async () => {
    const json = JSON.stringify({ app: 'trebuchet-lab', versions }, null, 2);
    const filename = `trebuchet-versions-${new Date().toISOString().slice(0, 10)}.json`;
    const m = await saveFile(filename, json, 'application/json');
    setMsg(m === 'Saved.' || m === 'Downloaded.' ? 'Backup saved.' : m);
  };

  return (
    <div className="panel-body">
      <h2>📚 My versions</h2>
      {versions.length === 0 ? (
        <p className="intro">Nothing saved yet. Every time you change something and press THROW, it gets saved here with its results.</p>
      ) : (
        <>
          <p className="intro">Every build you throw is saved here. Tick two or more to compare them.</p>
          <div className="btn-row">
            <button className="primary" disabled={compareIds.length < 2} onClick={() => setPanel('compare')}>
              ⚖️ Compare {compareIds.length >= 2 ? `(${compareIds.length})` : ''}
            </button>
            {versions.length >= 2 && compareIds.length < 2 && (
              <button onClick={() => { setCompare(sorted.slice(0, 2).map((v) => v.id)); setPanel('compare'); }}>Compare last 2</button>
            )}
            <label className="toggle">
              <input type="checkbox" checked={showAllArcs} onChange={(e) => setShowAllArcs(e.target.checked)} /> Show all arcs in 3D
            </label>
          </div>
        </>
      )}
      <div className="vlist">
        {sorted.map((v) => (
          <VersionCard key={v.id} v={v} />
        ))}
      </div>
      <div className="backup">
        <h4>Backup</h4>
        <p className="muted small">Versions are saved in this browser on this device. Download a backup file to keep them safe or move them to another device.</p>
        <div className="btn-row small">
          <button disabled={versions.length === 0} onClick={exportAll}>⬇️ Download backup</button>
          <button onClick={() => fileRef.current?.click()}>⬆️ Load backup</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const data = JSON.parse(await f.text());
                const n = importVersions(Array.isArray(data?.versions) ? data.versions : []);
                setMsg(n > 0 ? `Added ${n} version${n === 1 ? '' : 's'}.` : 'Nothing new in that file.');
              } catch {
                setMsg("That file didn't look like a trebuchet backup.");
              }
              e.target.value = '';
            }}
          />
        </div>
        {msg && <p className="muted small">{msg}</p>}
      </div>
    </div>
  );
}
