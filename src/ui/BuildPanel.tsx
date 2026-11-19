import { fmtLength, fmtMass } from '../data/format';
import { PRESETS } from '../data/presets';
import { PROJECTILES, projectileById } from '../data/projectiles';
import { STEPS, VARS, describeChanges, type StepId } from '../data/variables';
import { buildIssues, PLANETS } from '../physics/geometry';
import type { Planet } from '../physics/types';
import { currentVersion, useStore } from '../state/store';
import { Slider } from './Slider';

const STEP_ICONS: Record<StepId, string> = {
  size: '📐',
  arm: '🪵',
  tower: '🗼',
  weight: '🪨',
  sling: '🪢',
  ball: '⚾',
  world: '🌍',
};

function SizeStep() {
  const d = useStore((s) => s.draft);
  const replaceDesign = useStore((s) => s.replaceDesign);
  const setDesign = useStore((s) => s.setDesign);
  const resize = (k: number) =>
    setDesign({
      armLength: d.armLength * k,
      towerHeight: d.towerHeight * k,
      hangerLength: d.hangerLength * k,
      slingLength: d.slingLength * k,
      armMass: d.armMass * k * k * k,
      cwMass: d.cwMass * k * k * k,
    });
  return (
    <>
      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p.id} className="preset" onClick={() => replaceDesign(p.design)}>
            <strong>{p.name}</strong>
            <span>{p.blurb}</span>
            <small>
              Arm {fmtLength(p.design.armLength)} · Weight {fmtMass(p.design.cwMass)}
            </small>
          </button>
        ))}
      </div>
      <div className="resize">
        <h4>Make the whole machine bigger or smaller</h4>
        <p className="muted">
          Right now: arm {fmtLength(d.armLength)}, tower {fmtLength(d.towerHeight)}, weight {fmtMass(d.cwMass)}.
        </p>
        <div className="btn-row">
          <button onClick={() => resize(0.5)}>½ size</button>
          <button onClick={() => resize(1 / 1.1)}>Smaller</button>
          <button onClick={() => resize(1.1)}>Bigger</button>
          <button onClick={() => resize(2)}>2× size</button>
        </div>
        <p className="var-try">
          💡 Everything keeps its shape. Built from the same stuff, a machine twice as big weighs 8 times as much (2 × 2 × 2), so the
          arm and weight scale up that way too. The ball stays the same.
        </p>
      </div>
    </>
  );
}

function WeightStep() {
  const d = useStore((s) => s.draft);
  const setDesign = useStore((s) => s.setDesign);
  return (
    <>
      <Slider spec={VARS.cwMass} />
      <div className="var">
        <div className="var-head">
          <span className="var-label">How is it attached?</span>
        </div>
        <div className="choice">
          <button className={d.cwStyle === 'fixed' ? 'on' : ''} onClick={() => setDesign({ cwStyle: 'fixed' })}>
            <b>Bolted on</b>
            <span>Stuck to the arm</span>
          </button>
          <button className={d.cwStyle === 'hinged' ? 'on' : ''} onClick={() => setDesign({ cwStyle: 'hinged' })}>
            <b>Swinging</b>
            <span>Hangs from a hinge</span>
          </button>
        </div>
        <p className="var-kid">A swinging weight falls straighter down, so more of its energy goes into the ball.</p>
        <p className="var-try">💡 Throw it both ways and compare!</p>
      </div>
      {d.cwStyle === 'hinged' && <Slider spec={VARS.hangerLength} />}
    </>
  );
}

function BallStep() {
  const d = useStore((s) => s.draft);
  const setDesign = useStore((s) => s.setDesign);
  const choose = (id: string) => {
    if (id === 'custom') setDesign({ projectileId: 'custom' });
    else {
      const p = projectileById(id);
      setDesign({ projectileId: id, projectileMass: p.mass, projectileDiameter: p.diameter });
    }
  };
  return (
    <>
      <div className="balls">
        {PROJECTILES.map((p) => {
          const px = Math.max(10, Math.min(40, 12 + Math.log10(p.diameter / 0.016) * 22));
          return (
            <button key={p.id} className={`ball-card ${d.projectileId === p.id ? 'on' : ''}`} onClick={() => choose(p.id)}>
              <span className="ball-dot" style={{ background: p.color, width: px, height: px }} />
              <b>{p.name}</b>
              <small>{p.id === 'custom' ? 'You pick' : `${fmtMass(p.mass)} · ${fmtLength(p.diameter)}`}</small>
            </button>
          );
        })}
      </div>
      <p className="var-kid">{projectileById(d.projectileId).note}.</p>
      {d.projectileId === 'custom' && (
        <>
          <Slider spec={VARS.projectileMass} />
          <Slider spec={VARS.projectileDiameter} />
        </>
      )}
      <p className="var-try">💡 Try a ping-pong ball and a golf ball. Same size, very different weight. Which goes farther?</p>
    </>
  );
}

function WorldStep() {
  const d = useStore((s) => s.draft);
  const setDesign = useStore((s) => s.setDesign);
  return (
    <>
      <div className="var">
        <div className="var-head">
          <span className="var-label">Planet</span>
        </div>
        <div className="choice three">
          {(Object.keys(PLANETS) as Planet[]).map((p) => (
            <button key={p} className={d.planet === p ? 'on' : ''} onClick={() => setDesign({ planet: p })}>
              <b>{p === 'earth' ? '🌍' : p === 'moon' ? '🌕' : '🔴'} {PLANETS[p].label}</b>
              <span>Gravity {Math.round((PLANETS[p].g / 9.81) * 100)}%</span>
            </button>
          ))}
        </div>
        <p className="var-kid">Gravity pulls the weight down AND pulls the ball down. On the Moon it's much weaker.</p>
      </div>
      <div className="var">
        <div className="var-head">
          <span className="var-label">Air</span>
        </div>
        <div className="choice">
          <button className={d.air ? 'on' : ''} onClick={() => setDesign({ air: true })}>
            <b>Air on</b>
            <span>Like real life</span>
          </button>
          <button className={!d.air ? 'on' : ''} onClick={() => setDesign({ air: false })}>
            <b>No air</b>
            <span>Like in space</span>
          </button>
        </div>
        <p className="var-kid">Air pushes back on the ball and slows it down. Light, big balls feel it the most.</p>
      </div>
      {d.air && d.planet !== 'moon' && <Slider spec={VARS.wind} />}
    </>
  );
}

function StepBody({ step }: { step: StepId }) {
  switch (step) {
    case 'size':
      return <SizeStep />;
    case 'arm':
      return (
        <>
          <Slider spec={VARS.armLength} />
          <Slider spec={VARS.pivotRatio} />
          <Slider spec={VARS.armMass} />
        </>
      );
    case 'tower':
      return (
        <>
          <Slider spec={VARS.towerHeight} />
          <Slider spec={VARS.pullBack} />
        </>
      );
    case 'weight':
      return <WeightStep />;
    case 'sling':
      return (
        <>
          <Slider spec={VARS.slingLength} />
          <Slider spec={VARS.releaseAngle} />
        </>
      );
    case 'ball':
      return <BallStep />;
    case 'world':
      return <WorldStep />;
  }
}

export function StepTabs() {
  const step = useStore((s) => s.step);
  const setStep = useStore((s) => s.setStep);
  const panel = useStore((s) => s.panel);
  return (
    <nav className="steps" aria-label="Build steps">
      {STEPS.map((s, i) => (
        <button key={s.id} className={panel === 'build' && step === s.id ? 'on' : ''} onClick={() => setStep(s.id)}>
          <span className="step-num">{i + 1}</span>
          <span className="step-icon">{STEP_ICONS[s.id]}</span>
          <span className="step-label">{s.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function BuildPanel() {
  const step = useStore((s) => s.step);
  const setStep = useStore((s) => s.setStep);
  const d = useStore((s) => s.draft);
  const idx = STEPS.findIndex((s) => s.id === step);
  const info = STEPS[idx];
  const next = STEPS[idx + 1];
  const issues = buildIssues(d);
  return (
    <div className="panel-body">
      <h2>
        <span className="h-icon">{STEP_ICONS[step]}</span> {info.title}
      </h2>
      <p className="intro">{info.intro}</p>
      {issues.map((i) => (
        <div key={i.message} className="issue">
          <b>⚠️ {i.message}</b>
          <span>{i.fix}</span>
        </div>
      ))}
      <StepBody step={step} />
      {next ? (
        <button className="next" onClick={() => setStep(next.id)}>
          Next: {next.label} →
        </button>
      ) : (
        <p className="ready">All set! Make a guess and press THROW.</p>
      )}
    </div>
  );
}

export function ThrowBar() {
  const d = useStore((s) => s.draft);
  const guess = useStore((s) => s.guess);
  const setGuess = useStore((s) => s.setGuess);
  const throwIt = useStore((s) => s.throwIt);
  const versions = useStore((s) => s.versions);
  const base = useStore((s) => currentVersion(s));
  const blocked = buildIssues(d).length > 0;
  const changes = base ? describeChanges(base.design, d) : null;
  const nextNum = versions.reduce((m, v) => Math.max(m, v.number), 0) + 1;
  const isReplay = base && changes && changes.length === 0;
  return (
    <div className="throwbar">
      <div className="throwbar-info">
        {isReplay ? (
          <span>
            Throwing <b>{base!.name}</b> again
          </span>
        ) : (
          <span>
            Will save as <b>Version {nextNum}</b>
            {base ? ` (${changes!.length} change${changes!.length === 1 ? '' : 's'} from ${base.name})` : ''}
          </span>
        )}
        <label className="guess">
          Guess how far:
          <input inputMode="decimal" placeholder="?" value={guess} onChange={(e) => setGuess(e.target.value)} />m
        </label>
      </div>
      <button className="throw" disabled={blocked} onClick={throwIt}>
        {blocked ? 'Fix the build first' : 'THROW!'}
      </button>
    </div>
  );
}

