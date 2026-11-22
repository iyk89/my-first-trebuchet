import { Scene } from './scene/Scene';
import { currentVersion, useStore } from './state/store';
import { describeChanges } from './data/variables';
import { BuildPanel, StepTabs, ThrowBar } from './ui/BuildPanel';
import { ComparePanel } from './ui/ComparePanel';
import { ResultsPanel } from './ui/ResultsPanel';
import { StageOverlay } from './ui/StageOverlay';
import { VersionsPanel } from './ui/VersionsPanel';
import { LearnPanel } from './learn/LearnPanel';
import { PlansViewer } from './plans/PlansViewer';

function TopBar() {
  const panel = useStore((s) => s.panel);
  const setPanel = useStore((s) => s.setPanel);
  const versions = useStore((s) => s.versions);
  const sim = useStore((s) => s.sim);
  const simVersionId = useStore((s) => s.simVersionId);
  const draft = useStore((s) => s.draft);
  const base = useStore((s) => currentVersion(s));
  const resetDraft = useStore((s) => s.resetDraft);
  const changed = base ? describeChanges(base.design, draft).length : 0;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">🏰</span>
        <span>Trebuchet Lab</span>
      </div>
      {base && (
        <div className="current-ver" style={{ borderColor: base.color }}>
          <span className="dot" style={{ background: base.color }} />
          {changed > 0 ? (
            <>
              <span>
                Changing <b>{base.name}</b> · {changed} change{changed === 1 ? '' : 's'}
              </span>
              <button className="link" onClick={resetDraft}>
                undo
              </button>
            </>
          ) : (
            <span>
              <b>{base.name}</b>
            </span>
          )}
        </div>
      )}
      <nav className="tabs">
        <button className={panel === 'build' ? 'on' : ''} onClick={() => setPanel('build')}>
          🔧 Build
        </button>
        <button className={panel === 'learn' ? 'on' : ''} onClick={() => setPanel('learn')}>
          📖 Learn
        </button>
        <button className={panel === 'results' ? 'on' : ''} disabled={!sim || !simVersionId} onClick={() => setPanel('results')}>
          🏁 Results
        </button>
        <button className={panel === 'versions' ? 'on' : ''} onClick={() => setPanel('versions')}>
          📚 Versions{versions.length ? ` (${versions.length})` : ''}
        </button>
        <button className={panel === 'compare' ? 'on' : ''} onClick={() => setPanel('compare')}>
          ⚖️ Compare
        </button>
      </nav>
    </header>
  );
}

export default function App() {
  const panel = useStore((s) => s.panel);
  return (
    <div className="app">
      <TopBar />
      <main className="main">
        <section className="stage">
          <Scene />
          <StageOverlay />
        </section>
        <aside className="panel">
          {panel === 'build' && <StepTabs />}
          <div className="panel-scroll">
            {panel === 'build' && <BuildPanel />}
            {panel === 'results' && <ResultsPanel />}
            {panel === 'versions' && <VersionsPanel />}
            {panel === 'compare' && <ComparePanel />}
            {panel === 'learn' && <LearnPanel />}
          </div>
          {panel !== 'learn' && <ThrowBar />}
        </aside>
      </main>
      <PlansViewer />
    </div>
  );
}
