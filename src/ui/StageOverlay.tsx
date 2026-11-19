import { fmtLength } from '../data/format';
import { frameAt, simEndTime } from '../scene/playback';
import { useStore } from '../state/store';

const SPEEDS = [
  { v: 1, label: '1×' },
  { v: 0.5, label: '½×' },
  { v: 0.25, label: '¼×' },
  { v: 0.1, label: '⅒×' },
];

type S = ReturnType<typeof useStore.getState>;

/** Live ball readout: -1 = not throwing, -2 = still swinging, otherwise the value rounded to 1 cm. */
function hudValue(s: S, axis: 'x' | 'y') {
  if (s.mode !== 'throw' || !s.sim || !s.sim.frames.length) return -1;
  const ci = s.sim.crashIndex ?? -1;
  if (ci >= 0 && s.sim.failure === 'weightCrash' && s.playTime >= s.sim.frames[ci].t) return -3;
  const f = frameAt(s.sim, s.playTime);
  if (!f.released) return -2;
  const v = axis === 'x' ? f.bx : f.by - s.draft.projectileDiameter / 2;
  return Math.max(0, Math.round(v * 100) / 100);
}

function LiveHud() {
  const x = useStore((s) => hudValue(s, 'x'));
  const y = useStore((s) => hudValue(s, 'y'));
  if (x === -1) return null;
  if (x === -2) return <div className="hud">Swinging…</div>;
  if (x === -3) return <div className="hud crash">💥 CRASH!</div>;
  if (y === 0 && x > 0) return <div className="hud">🎯 Landed! {fmtLength(x)}</div>;
  return (
    <div className="hud">
      <span>📏 {fmtLength(x)}</span>
      <span>⛰️ {fmtLength(y)}</span>
    </div>
  );
}

export function StageOverlay() {
  const mode = useStore((s) => s.mode);
  const sim = useStore((s) => s.sim);
  const playing = useStore((s) => s.playing);
  const playTime = useStore((s) => s.playTime);
  const speed = useStore((s) => s.speed);
  const slowSwing = useStore((s) => s.slowSwing);
  const autoCam = useStore((s) => s.autoCam);
  const focus = useStore((s) => s.focus);
  const set = useStore.getState();
  const showPlayback = mode === 'throw' && sim && sim.frames.length > 0;
  const end = sim ? simEndTime(sim) : 0;

  return (
    <>
      <LiveHud />
      {mode === 'build' && focus === 'hook' && (
        <div className="focus-chip">
          <span>🔍 The moment the ball lets go</span>
          <button onClick={() => set.setFocus(null)}>Show whole machine</button>
        </div>
      )}
      <div className="stage-tools">
        {!autoCam && (
          <button onClick={() => set.setAutoCam(true)} title="Point the camera back at the action">
            🎥 Auto camera
          </button>
        )}
      </div>
      {showPlayback && (
        <div className="playback">
          <button
            className="pb-main"
            onClick={() => {
              if (playTime >= end) {
                set.setPlayTime(0);
                set.setAutoCam(true);
              }
              set.setPlaying(!playing || playTime >= end);
            }}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? '⏸' : playTime >= end ? '↺' : '▶'}
          </button>
          <input
            type="range"
            min={0}
            max={end}
            step={end / 1000}
            value={playTime}
            onChange={(e) => {
              set.setPlaying(false);
              set.setPlayTime(Number(e.target.value));
            }}
            aria-label="Scrub through the throw"
          />
          <div className="pb-speeds">
            {SPEEDS.map((s) => (
              <button key={s.v} className={speed === s.v ? 'on' : ''} onClick={() => set.setSpeed(s.v)}>
                {s.label}
              </button>
            ))}
            <button className={slowSwing ? 'on' : ''} onClick={() => set.setSlowSwing(!slowSwing)} title="Slow motion while the arm swings">
              🐢 Slow-mo swing
            </button>
          </div>
        </div>
      )}
    </>
  );
}
