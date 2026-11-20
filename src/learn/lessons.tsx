/**
 * The lessons: one per thing you can change. Each has four short pages
 * (what it is, why it matters, how it works, what it changes), drawn from your own build.
 */
import type { ReactNode } from 'react';
import { fmtDeg, fmtLength, fmtMass, fmtPct, fmtRatio, kmh } from '../data/format';
import { PROJECTILES, projectileById } from '../data/projectiles';
import type { StepId } from '../data/variables';
import { geometry, longArm, maxPullBackDeg, shortArm } from '../physics/geometry';
import type { Design } from '../physics/types';
import { releasePreview } from '../scene/preview';
import { machineDims } from '../scene/Trebuchet';
import {
  AirPush,
  EnergyCompare,
  ExperimentBars,
  FlightPaths,
  HookCloseup,
  PingVsGolf,
  Planets,
  ReleaseFan,
  ReleaseSpeeds,
  SweepExperiment,
  WeightPaths,
  type SweepSpec,
  type Variant,
} from './figures';
import { Sketch, sketchBounds, unionBounds } from './Sketch';

export type LessonId =
  | 'arm-length'
  | 'pivot'
  | 'arm-weight'
  | 'tower'
  | 'pull-back'
  | 'counterweight'
  | 'weight-style'
  | 'hanger'
  | 'sling'
  | 'hook'
  | 'ball'
  | 'air'
  | 'gravity';

export interface Watch {
  label: string;
  patch: (d: Design) => Partial<Design>;
}

export interface Lesson {
  id: LessonId;
  title: string;
  icon: string;
  group: string;
  summary: string;
  step: StepId;
  focus?: 'hook';
  keys: (keyof Design)[];
  What: (p: { d: Design }) => ReactNode;
  Why: (p: { d: Design }) => ReactNode;
  How: (p: { d: Design }) => ReactNode;
  Impact: (p: { d: Design }) => ReactNode;
  takeaway: string;
  watch: Watch[];
}

const times = (d: Design, key: keyof Design, ks: number[]) => ks.map((k) => (d[key] as number) * k);
const sweep = (spec: SweepSpec) => ({ d }: { d: Design }) => <SweepExperiment d={d} spec={spec} />;
const hinged = (d: Design): Design => (d.cwStyle === 'hinged' ? d : { ...d, cwStyle: 'hinged' });
const lowestNeeded = (d: Design) => {
  const g = geometry(d);
  return g.Lb + (g.hinged ? g.Lh : 0) + machineDims(g).box[1] / 2;
};

export const LESSONS: Lesson[] = [
  // ---------------------------------------------------------------- ARM
  {
    id: 'arm-length',
    title: 'Arm length',
    icon: '📏',
    group: 'The arm',
    summary: 'How long the swinging beam is.',
    step: 'arm',
    keys: ['armLength'],
    What: ({ d }) => (
      <>
        <p>
          The arm is the long wooden beam that swings around the axle. Its length is measured from one end to the other. Yours is{' '}
          <b>{fmtLength(d.armLength)}</b>.
        </p>
        <Sketch design={d} pose="flat" highlight={['arm']} hideSling hideBall marks={[{ kind: 'dim', a: 'shortEnd', b: 'tip', label: `arm: ${fmtLength(d.armLength)}`, side: -1, offset: 24 }]} />
      </>
    ),
    Why: ({ d }) => {
      const La = longArm(d);
      return (
        <>
          <p>The tip of the arm swings the sling, and the sling flings the ball. How fast the tip moves decides how fast the ball can go.</p>
          <p>When the arm turns, every part of it turns together. But the tip has the longest trip around.</p>
          <Sketch
            design={d}
            pose="flat"
            highlight={['arm']}
            hideSling
            hideBall
            marks={[
              { kind: 'circle', c: 'pivot', r: La, label: 'the tip travels this circle' },
              { kind: 'circle', c: 'pivot', r: La * 0.4, color: 'var(--muted)' },
            ]}
          />
        </>
      );
    },
    How: ({ d }) => {
      const short = { ...d, armLength: d.armLength * 0.7 };
      const long = { ...d, armLength: d.armLength * 1.4 };
      const ext = unionBounds(
        sketchBounds(short, 'flat', [[0, short.towerHeight + longArm(short)], [0, short.towerHeight - longArm(short)]]),
        sketchBounds(long, 'flat', [[0, long.towerHeight + longArm(long)], [0, long.towerHeight - longArm(long)], [-longArm(long), 0]]),
      );
      return (
        <>
          <p>
            In the same moment, a longer arm's tip goes around a <b>bigger circle</b>, so it moves faster. It's like the end of a jump rope: the far end
            whips around fastest.
          </p>
          <p>But a longer arm is also heavier to swing, needs a taller tower, and wants a longer sling. If you change only the arm, the rest of the machine may not keep up.</p>
          <Sketch design={short} pose="flat" hideSling hideBall extent={ext} maxH={170} title="Shorter arm" highlight={['arm']} marks={[{ kind: 'circle', c: 'pivot', r: longArm(short) }]} />
          <Sketch design={long} pose="flat" hideSling hideBall extent={ext} maxH={170} title="Longer arm: bigger circle, faster tip" highlight={['arm']} marks={[{ kind: 'circle', c: 'pivot', r: longArm(long) }]} />
        </>
      );
    },
    Impact: sweep({ key: 'armLength', xLabel: 'Arm length', format: fmtLength, log: true, values: (d) => times(d, 'armLength', [0.5, 0.6, 0.7, 0.85, 1.2, 1.4, 1.7, 2]) }),
    takeaway: 'A longer arm only helps when the tower, sling and weight grow with it. To grow everything together, use the Size step.',
    watch: [
      { label: 'Shorter arm', patch: (d) => ({ armLength: d.armLength * 0.7 }) },
      { label: 'Longer arm', patch: (d) => ({ armLength: d.armLength * 1.4 }) },
    ],
  },
  {
    id: 'pivot',
    title: 'Where the arm turns',
    icon: '⚖️',
    group: 'The arm',
    summary: 'The axle splits the arm into a long side and a short side.',
    step: 'arm',
    keys: ['pivotRatio'],
    What: ({ d }) => (
      <>
        <p>
          The axle is where the arm turns. It splits the arm into a long <b>throwing side</b> and a short <b>weight side</b>. Yours is{' '}
          <b>{fmtRatio(d.pivotRatio)}</b>: the throwing side is {Number(d.pivotRatio.toFixed(1))} times longer.
        </p>
        <Sketch
          design={d}
          pose="flat"
          highlight={['pivot']}
          hideSling
          hideBall
          marks={[
            { kind: 'dim', a: 'pivot', b: 'tip', label: `throwing side ${fmtLength(longArm(d))}`, side: -1, offset: 24 },
            { kind: 'dim', a: 'shortEnd', b: 'pivot', label: `weight side ${fmtLength(shortArm(d))}`, side: -1, offset: 24 },
          ]}
        />
      </>
    ),
    Why: ({ d }) => {
      const La = longArm(d);
      const Lb = shortArm(d);
      const H = d.towerHeight;
      return (
        <>
          <p>The arm is a lever, just like a seesaw. Where you put the turning point decides whether you get more speed or more push.</p>
          <Sketch
            design={d}
            pose="flat"
            highlight={['pivot']}
            hideSling
            hideBall
            marks={[
              { kind: 'arrow', a: 'shortEnd', b: [-Lb, H - Lb * 0.9], label: 'weight pulls down', color: 'var(--wood-dark)' },
              { kind: 'arrow', a: 'tip', b: [La, H + La * 0.6], label: 'tip flies up' },
            ]}
          />
        </>
      );
    },
    How: ({ d }) => {
      const turn = 0.6;
      return (
        <>
          <p>
            When the weight side moves down a little, the throwing side swings up a lot, and fast. At {fmtRatio(d.pivotRatio)}, the tip moves{' '}
            {Number(d.pivotRatio.toFixed(1))} times as far as the weight end, in the same moment.
          </p>
          <p>
            The catch: a longer throwing side is harder for the weight to lift, and a shorter weight side gives the weight less room to fall. Go too far either
            way and the throw gets weaker.
          </p>
          <Sketch
            design={d}
            pose="flat"
            highlight={['pivot']}
            hideSling
            hideBall
            marks={[
              { kind: 'arc', c: 'pivot', r: shortArm(d), from: Math.PI, to: Math.PI + turn, label: 'small move', color: 'var(--wood-dark)' },
              { kind: 'arc', c: 'pivot', r: longArm(d), from: 0, to: turn, label: 'big, fast move' },
            ]}
          />
        </>
      );
    },
    Impact: sweep({ key: 'pivotRatio', xLabel: 'Throwing side : weight side', format: fmtRatio, values: () => [1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8] }),
    takeaway: 'There is a sweet spot. Look for the top of the hill in the chart.',
    watch: [
      { label: '2 : 1', patch: () => ({ pivotRatio: 2 }) },
      { label: '6 : 1', patch: () => ({ pivotRatio: 6 }) },
    ],
  },
  {
    id: 'arm-weight',
    title: 'Arm weight',
    icon: '🪵',
    group: 'The arm',
    summary: 'How heavy the beam itself is.',
    step: 'arm',
    keys: ['armMass'],
    What: ({ d }) => (
      <>
        <p>
          How heavy the arm itself is, not counting the box. Yours weighs <b>{fmtMass(d.armMass)}</b>.
        </p>
        <Sketch design={d} highlight={['arm']} marks={[{ kind: 'text', at: 'tip', text: `arm: ${fmtMass(d.armMass)}`, dy: -18 }]} />
      </>
    ),
    Why: () => (
      <>
        <p>The falling weight has to swing the arm too. Any energy spent spinning the arm is energy the ball never gets.</p>
        <p>Most of the arm is on the long side, and that side moves fast. It's like trying to throw with a heavy bat instead of a light stick.</p>
      </>
    ),
    How: ({ d }) => (
      <>
        <p>Here's where the weight's energy ends up on your machine, with a light, your, and a heavy arm. The orange part is what the ball gets.</p>
        <EnergyCompare
          d={d}
          variants={[
            { label: `Light arm (${fmtMass(d.armMass * 0.25)})`, patch: { armMass: d.armMass * 0.25 } },
            { label: `Your arm (${fmtMass(d.armMass)})`, patch: {}, mine: true },
            { label: `Heavy arm (${fmtMass(d.armMass * 4)})`, patch: { armMass: d.armMass * 4 } },
          ]}
        />
        <p>That's why builders make arms light and stiff, and often thinner toward the tip.</p>
      </>
    ),
    Impact: sweep({ key: 'armMass', xLabel: 'Arm weight', format: fmtMass, log: true, values: (d) => times(d, 'armMass', [0.1, 0.2, 0.35, 0.5, 0.75, 1.5, 2, 3, 5]) }),
    takeaway: "Lighter is better, as long as the arm is strong enough not to bend or snap. (The simulator doesn't check for breaking.)",
    watch: [
      { label: 'Light arm', patch: (d) => ({ armMass: d.armMass * 0.25 }) },
      { label: 'Heavy arm', patch: (d) => ({ armMass: d.armMass * 4 }) },
    ],
  },

  // ---------------------------------------------------------------- TOWER
  {
    id: 'tower',
    title: 'Tower height',
    icon: '🗼',
    group: 'The tower',
    summary: 'How high the axle sits.',
    step: 'tower',
    keys: ['towerHeight'],
    What: ({ d }) => {
      const x = machineDims(geometry(d)).baseHalf * 1.25;
      return (
        <>
          <p>
            The tower is the frame that holds the axle up. Its height is measured from the ground to the axle. Yours is <b>{fmtLength(d.towerHeight)}</b>.
          </p>
          <Sketch
            design={d}
            highlight={['tower']}
            marks={[
              { kind: 'path', pts: [[0, d.towerHeight], [x, d.towerHeight]], color: 'var(--ink-2)', dashed: true },
              { kind: 'dim', a: [x, 0], b: [x, d.towerHeight], label: `tower ${fmtLength(d.towerHeight)}`, offset: 0 },
            ]}
          />
        </>
      );
    },
    Why: () => (
      <>
        <p>The weight needs room to fall, and the arm needs room to swing. The tower gives them that room.</p>
        <p>A taller tower also lets you pull the arm back farther, so the weight starts higher up.</p>
      </>
    ),
    How: ({ d }) => {
      const need = lowestNeeded(d);
      const short = { ...d, towerHeight: Math.max(need * 0.8, d.armLength * 0.15) };
      const ext = unionBounds(sketchBounds(d, 'down', [[0, -d.armLength * 0.1]]), sketchBounds(short, 'down', [[0, -d.armLength * 0.1]]));
      const gapOk = d.towerHeight - need;
      return (
        <>
          <p>
            When the weight swings down to its lowest point, it hangs below the axle by the length of the short side
            {d.cwStyle === 'hinged' ? ' plus the hanger' : ''}. If the tower is shorter than that, the weight smashes into the ground.
          </p>
          <Sketch
            design={d}
            pose="down"
            hideBall
            hideSling
            highlight={['tower']}
            extent={ext}
            maxH={180}
            title={gapOk >= 0 ? `Your tower: ${fmtLength(gapOk)} to spare` : 'Your tower: too short!'}
            marks={gapOk > 0 ? [{ kind: 'dim', a: 'cwBottom', b: 'ground', label: fmtLength(gapOk), offset: 26 }] : []}
          />
          <Sketch design={short} pose="down" hideBall hideSling highlight={['tower']} extent={ext} maxH={180} title={`A ${fmtLength(short.towerHeight)} tower: crash!`} />
        </>
      );
    },
    Impact: sweep({
      key: 'towerHeight',
      xLabel: 'Tower height',
      format: fmtLength,
      values: (d) => [0.3, 0.4, 0.5, 0.6, 0.75, 0.9, 1.1, 1.3].map((k) => k * d.armLength),
    }),
    takeaway: 'Make the tower tall enough for the weight to clear the ground, with a little room to spare.',
    watch: [
      { label: 'Too-short tower', patch: (d) => ({ towerHeight: Math.max(lowestNeeded(d) * 0.8, d.armLength * 0.15) }) },
      { label: 'Taller tower', patch: (d) => ({ towerHeight: d.towerHeight * 1.3 }) },
    ],
  },
  {
    id: 'pull-back',
    title: 'Pull-back angle',
    icon: '↩️',
    group: 'The tower',
    summary: 'How far the arm is pulled down before the throw.',
    step: 'tower',
    keys: ['pullBack'],
    What: ({ d }) => {
      const pb = Math.min(d.pullBack, maxPullBackDeg(d));
      return (
        <>
          <p>
            How far the long arm is pulled down before you let it go. The ground stops it, so there's a limit. Yours is <b>{fmtDeg(pb)}</b>.
          </p>
          <Sketch design={d} highlight={['arm']} marks={[{ kind: 'arc', c: 'pivot', r: longArm(d) * 0.45, from: Math.PI, to: Math.PI + (pb * Math.PI) / 180, label: fmtDeg(pb) }]} />
        </>
      );
    },
    Why: () => (
      <>
        <p>Pulling the arm down lifts the weight up. The higher the weight starts, the more energy it stores, like stretching a rubber band farther.</p>
      </>
    ),
    How: ({ d }) => {
      const pb = Math.min(d.pullBack, maxPullBackDeg(d));
      const little = { ...d, pullBack: Math.min(20, pb) };
      const drop = (x: Design) => {
        const g = geometry(x);
        const p = Math.min(x.pullBack, maxPullBackDeg(x)) * (Math.PI / 180);
        const top = g.H + g.Lb * Math.sin(p) - (g.hinged ? g.Lh : 0);
        const bottom = g.H - g.Lb - (g.hinged ? g.Lh : 0);
        return { top, bottom, size: top - bottom };
      };
      const ext = unionBounds(sketchBounds(d), sketchBounds(little));
      const Sk = ({ x, title }: { x: Design; title: string }) => {
        const dr = drop(x);
        const cx = machineDims(geometry(x)).baseHalf * 1.2;
        return (
          <Sketch
            design={x}
            highlight={['weight']}
            extent={ext}
            maxH={170}
            title={title}
            marks={[{ kind: 'dim', a: [cx, dr.top], b: [cx, dr.bottom], label: `falls ${fmtLength(dr.size)}`, offset: 0 }]}
          />
        );
      };
      return (
        <>
          <p>
            The weight's energy comes from how far it falls. Pull back more and the weight starts higher, falls farther, and gives more energy. The arm also gets
            a longer run to speed up.
          </p>
          <Sk x={little} title={`Pulled back ${fmtDeg(little.pullBack)}`} />
          <Sk x={d} title={`Pulled back ${fmtDeg(pb)} (yours)`} />
        </>
      );
    },
    Impact: sweep({
      key: 'pullBack',
      xLabel: 'Pull-back angle',
      format: fmtDeg,
      values: (d) => {
        const m = maxPullBackDeg(d);
        return [0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1].map((k) => Math.max(5, Math.round(m * k)));
      },
    }),
    takeaway: 'Pull it back as far as the ground allows.',
    watch: [{ label: 'Pulled back only 20°', patch: () => ({ pullBack: 20 }) }],
  },

  // ---------------------------------------------------------------- WEIGHT
  {
    id: 'counterweight',
    title: 'The counterweight',
    icon: '🪨',
    group: 'The weight',
    summary: 'The heavy box that powers everything.',
    step: 'weight',
    keys: ['cwMass'],
    What: ({ d }) => (
      <>
        <p>
          The heavy box that falls. It's the <b>engine</b> of the trebuchet: every bit of the throw's energy comes from this box falling. Yours is{' '}
          <b>{fmtMass(d.cwMass)}</b>.
        </p>
        <Sketch design={d} highlight={['weight']} marks={[{ kind: 'text', at: 'cw', text: fmtMass(d.cwMass), dy: -machineDims(geometry(d)).box[1] * 0 - 26 }]} />
      </>
    ),
    Why: () => (
      <>
        <p>Energy is what makes things move. A heavier weight falling the same distance gives more energy to throw with.</p>
        <p>
          The energy is <b>how heavy × how far it falls</b>. Twice the weight gives twice the energy.
        </p>
      </>
    ),
    How: ({ d }) => (
      <>
        <p>But the ball doesn't go twice as far. A heavier weight also has to speed itself up, and more energy stays stuck in the moving weight. Here's your machine:</p>
        <ExperimentBars
          d={d}
          variants={[
            { label: `Half (${fmtMass(d.cwMass / 2)})`, patch: { cwMass: d.cwMass / 2 } },
            { label: `Yours (${fmtMass(d.cwMass)})`, patch: {}, mine: true },
            { label: `Double (${fmtMass(d.cwMass * 2)})`, patch: { cwMass: d.cwMass * 2 } },
            { label: `4× (${fmtMass(d.cwMass * 4)})`, patch: { cwMass: d.cwMass * 4 } },
          ]}
          note={(t) => `energy score ${fmtPct(t.results!.efficiency)}`}
        />
      </>
    ),
    Impact: sweep({ key: 'cwMass', xLabel: 'Weight', format: fmtMass, log: true, values: (d) => times(d, 'cwMass', [0.25, 0.35, 0.5, 0.7, 1.4, 2, 3, 4, 6, 8]) }),
    takeaway: 'More weight helps, but each extra kilo helps less than the one before. Past a point it stops helping unless you also retune the release hook.',
    watch: [
      { label: 'Half the weight', patch: (d) => ({ cwMass: d.cwMass / 2 }) },
      { label: 'Double the weight', patch: (d) => ({ cwMass: d.cwMass * 2 }) },
    ],
  },
  {
    id: 'weight-style',
    title: 'Bolted or swinging',
    icon: '🔩',
    group: 'The weight',
    summary: 'Is the box stuck to the arm, or hanging from a hinge?',
    step: 'weight',
    keys: ['cwStyle'],
    What: ({ d }) => {
      const fixed = { ...d, cwStyle: 'fixed' as const };
      const swing = hinged(d);
      const ext = unionBounds(sketchBounds(fixed), sketchBounds(swing));
      return (
        <>
          <p>
            <b>Bolted on:</b> the box is fixed to the end of the arm. <b>Swinging:</b> the box hangs from a hinge and can swing. Yours is{' '}
            <b>{d.cwStyle === 'hinged' ? 'swinging' : 'bolted on'}</b>.
          </p>
          <Sketch design={fixed} extent={ext} maxH={170} highlight={['weight']} title="Bolted on" />
          <Sketch design={swing} extent={ext} maxH={170} highlight={['weight', 'hanger']} title="Swinging" />
        </>
      );
    },
    Why: () => (
      <>
        <p>It changes how the weight falls, and so how much of its energy reaches the ball.</p>
      </>
    ),
    How: ({ d }) => (
      <>
        <p>A bolted weight has to follow the arm around a circle, so it gets dragged sideways instead of falling down.</p>
        <p>A swinging weight hangs below the arm and drops more straight down. It pushes on the arm at the right time and wastes less energy. Here are the real paths on your machine, up to the moment the ball lets go:</p>
        <WeightPaths
          d={d}
          variants={[
            { label: 'Bolted on', patch: { cwStyle: 'fixed' } },
            { label: 'Swinging', patch: { cwStyle: 'hinged' } },
          ]}
        />
      </>
    ),
    Impact: ({ d }) => (
      <ExperimentBars
        d={d}
        variants={[
          { label: 'Bolted on', patch: { cwStyle: 'fixed' }, mine: d.cwStyle === 'fixed' },
          { label: 'Swinging', patch: { cwStyle: 'hinged' }, mine: d.cwStyle === 'hinged' },
        ]}
        note={(t) => `energy score ${fmtPct(t.results!.efficiency)}`}
      />
    ),
    takeaway: "Swinging weights usually throw farther. That's why most big trebuchets use them.",
    watch: [
      { label: 'Bolted on', patch: () => ({ cwStyle: 'fixed' }) },
      { label: 'Swinging', patch: () => ({ cwStyle: 'hinged' }) },
    ],
  },
  {
    id: 'hanger',
    title: 'Hanger length',
    icon: '🔗',
    group: 'The weight',
    summary: 'How far below the arm a swinging weight hangs.',
    step: 'weight',
    keys: ['hangerLength'],
    What: ({ d }) => (
      <>
        <p>
          For a swinging weight: how far below the arm the box hangs, from the hinge to the middle of the box. Yours is <b>{fmtLength(d.hangerLength)}</b>.
        </p>
        {d.cwStyle === 'fixed' && <p className="muted">Your weight is bolted on right now, so this does nothing until you switch to swinging. The pictures use a swinging weight.</p>}
        <Sketch design={hinged(d)} highlight={['hanger']} marks={[{ kind: 'dim', a: 'shortEnd', b: 'cw', label: `hanger ${fmtLength(d.hangerLength)}`, side: 1, offset: 30 }]} />
      </>
    ),
    Why: () => <p>It changes how the box swings as it falls, and how low it gets.</p>,
    How: ({ d }) => (
      <>
        <p>A very short hanger acts almost like a bolted weight. A longer one lets the box swing more freely and drop more straight down.</p>
        <p>But a longer hanger also hangs lower, so it needs a taller tower or it hits the ground.</p>
        <WeightPaths
          d={hinged(d)}
          variants={[
            { label: `Short hanger (${fmtLength(d.armLength * 0.05)})`, patch: { hangerLength: d.armLength * 0.05 } },
            { label: `Long hanger (${fmtLength(d.armLength * 0.3)})`, patch: { hangerLength: d.armLength * 0.3 } },
          ]}
        />
      </>
    ),
    Impact: sweep({
      key: 'hangerLength',
      xLabel: 'Hanger length',
      format: fmtLength,
      prep: () => ({ cwStyle: 'hinged' }),
      values: (d) => [0.03, 0.06, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5].map((k) => k * d.armLength),
    }),
    takeaway: 'Find a length where the box swings freely but still clears the ground.',
    watch: [
      { label: 'Short hanger', patch: (d) => ({ cwStyle: 'hinged', hangerLength: d.armLength * 0.05 }) },
      { label: 'Long hanger', patch: (d) => ({ cwStyle: 'hinged', hangerLength: d.armLength * 0.3 }) },
    ],
  },

  // ---------------------------------------------------------------- SLING
  {
    id: 'sling',
    title: 'Sling length',
    icon: '🪢',
    group: 'The sling',
    summary: 'The rope that whips the ball around.',
    step: 'sling',
    keys: ['slingLength'],
    What: ({ d }) => (
      <>
        <p>
          The rope from the arm tip to the pouch that holds the ball. Yours is <b>{fmtLength(d.slingLength)}</b>.
        </p>
        <Sketch design={d} highlight={['sling']} marks={[{ kind: 'dim', a: 'tip', b: 'ball', label: `sling ${fmtLength(d.slingLength)}`, side: -1, offset: 18 }]} />
      </>
    ),
    Why: () => (
      <>
        <p>The sling works like an extra, bendy piece of arm. As the arm swings, the sling whips around even faster, the way a whip's tip snaps.</p>
        <p>That makes the ball go faster than the arm tip itself.</p>
      </>
    ),
    How: ({ d }) => {
      const pv = releasePreview(d);
      const ball = Math.hypot(pv.vx, pv.vy);
      return (
        <>
          {pv.ok && (
            <p>
              At the moment your ball lets go, the arm tip is moving <b>{kmh(pv.tipSpeed)}</b>, but the ball is moving <b>{kmh(ball)}</b>. The sling made it{' '}
              <b>{(ball / Math.max(pv.tipSpeed, 1e-6)).toFixed(1)}× faster</b>.
            </p>
          )}
          <ReleaseSpeeds d={d} />
          <p>Too short and there's little whip. Too long and the ball drags along the ground and lets go at the wrong moment.</p>
        </>
      );
    },
    Impact: sweep({
      key: 'slingLength',
      xLabel: 'Sling length',
      format: fmtLength,
      values: (d) => [0.2, 0.3, 0.4, 0.5, 0.6, 0.75, 0.9, 1.1, 1.3, 1.5].map((k) => k * d.armLength),
    }),
    takeaway: 'A sling about as long as the throwing side of the arm is a good place to start.',
    watch: [
      { label: 'Short sling', patch: (d) => ({ slingLength: d.slingLength * 0.5 }) },
      { label: 'Long sling', patch: (d) => ({ slingLength: d.slingLength * 1.5 }) },
    ],
  },
  {
    id: 'hook',
    title: 'Release hook',
    icon: '🪝',
    group: 'The sling',
    summary: 'Decides when the ball lets go.',
    step: 'sling',
    focus: 'hook',
    keys: ['releaseAngle'],
    What: ({ d }) => (
      <>
        <p>
          A short bent metal pin at the tip of the arm. One end of the sling has a loop that hooks over it. How much it's bent is measured from straight out.
          Yours is bent <b>{fmtDeg(d.releaseAngle)}</b>.
        </p>
        <HookCloseup d={d} />
      </>
    ),
    Why: () => (
      <>
        <p>
          The hook decides <b>when</b> the ball lets go. When it lets go decides <b>which way</b> it flies: up into the sky, far down the field, or into the
          ground.
        </p>
        <p>The 3D view is zoomed in on the moment your ball lets go.</p>
      </>
    ),
    How: ({ d }) => {
      const a = d.releaseAngle;
      const lo = Math.max(0, Math.round(a - 20));
      const hi = Math.min(110, Math.round(a + 20));
      return (
        <>
          <p>
            The loop slides off the moment the sling lines up with the hook. Bend the hook <b>more</b> and that happens sooner, while the ball is still swinging
            upward, so it flies <b>higher</b>. Bend it <b>less</b> and it happens later, so it flies <b>flatter</b>.
          </p>
          <ReleaseFan d={d} angles={[lo, a, hi].filter((x, i, arr) => arr.indexOf(x) === i)} />
          <p>Too much bend and the ball flies backward. Too little and it never lets go.</p>
        </>
      );
    },
    Impact: sweep({ key: 'releaseAngle', xLabel: 'Hook bend', format: fmtDeg, values: () => [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] }),
    takeaway: 'This is the main tuning knob. Change it 5° at a time and watch the launch angle.',
    watch: [
      { label: 'Bent less', patch: (d) => ({ releaseAngle: Math.max(0, d.releaseAngle - 20) }) },
      { label: 'Bent more', patch: (d) => ({ releaseAngle: Math.min(110, d.releaseAngle + 20) }) },
    ],
  },

  // ---------------------------------------------------------------- BALL
  {
    id: 'ball',
    title: 'The ball',
    icon: '⚾',
    group: 'The ball',
    summary: 'How heavy and how big the thing you throw is.',
    step: 'ball',
    keys: ['projectileId', 'projectileMass', 'projectileDiameter'],
    What: ({ d }) => (
      <>
        <p>
          What you throw. Two things matter: how heavy it is and how big it is. Yours is a <b>{projectileById(d.projectileId).name.toLowerCase()}</b>:{' '}
          {fmtMass(d.projectileMass)}, {fmtLength(d.projectileDiameter)} across.
        </p>
        <Sketch design={d} highlight={['ball']} marks={[{ kind: 'text', at: 'ball', text: `${fmtMass(d.projectileMass)} · ${fmtLength(d.projectileDiameter)}`, dy: -22 }]} />
      </>
    ),
    Why: () => (
      <>
        <p>Heavy balls need more energy to speed up. Light balls get slowed down by the air.</p>
        <PingVsGolf />
      </>
    ),
    How: () => (
      <>
        <p>The same machine flings a light ball faster. But the air pushes back on every ball, and a light, big ball loses its speed quickly.</p>
        <p>A heavy, small ball keeps its speed best. But if it's too heavy for the machine, it never gets going fast in the first place.</p>
      </>
    ),
    Impact: ({ d }) => {
      const variants: Variant[] = PROJECTILES.filter((p) => p.id !== 'custom').map((p) => ({
        label: p.name,
        patch: { projectileId: p.id, projectileMass: p.mass, projectileDiameter: p.diameter },
        mine: p.id === d.projectileId,
        color: p.id === d.projectileId ? undefined : '#6d5fb3',
      }));
      if (d.projectileId === 'custom') variants.push({ label: 'Your custom ball', patch: {}, mine: true });
      return (
        <>
          <p>A race: every ball, thrown by your machine.</p>
          <ExperimentBars d={d} variants={variants} />
        </>
      );
    },
    takeaway: 'Every machine has a best ball. The race shows which one suits yours.',
    watch: [
      { label: 'Ping-pong ball', patch: () => ({ projectileId: 'pingpong', projectileMass: 0.0027, projectileDiameter: 0.04 }) },
      { label: 'Baseball', patch: () => ({ projectileId: 'baseball', projectileMass: 0.145, projectileDiameter: 0.074 }) },
    ],
  },

  // ---------------------------------------------------------------- WORLD
  {
    id: 'air',
    title: 'Air and wind',
    icon: '💨',
    group: 'The world',
    summary: 'Air pushes back on the ball; wind pushes it along.',
    step: 'world',
    keys: ['air', 'wind'],
    What: () => (
      <>
        <p>
          Air pushes back on anything moving through it. That push is called <b>drag</b>. Wind is air that's already moving, so it can push the ball forward or
          backward.
        </p>
        <AirPush />
      </>
    ),
    Why: ({ d }) => (
      <>
        <p>Without air, your ball would fly farther. Here's your throw with and without air:</p>
        <FlightPaths
          d={d}
          variants={[
            { label: 'No air', patch: { air: false }, color: '#2f80ed' },
            { label: 'With air', patch: { air: true, wind: 0 }, color: '#ff7a1a' },
          ]}
        />
      </>
    ),
    How: () => (
      <>
        <p>
          The faster the ball goes, the harder the air pushes back. Twice as fast means <b>four times</b> the push. That's why fast throws lose the most.
        </p>
        <p>Wind behind you adds to the ball's speed through the air. Wind in your face takes away from it.</p>
      </>
    ),
    Impact: ({ d }) => (
      <ExperimentBars
        d={d}
        variants={[
          { label: 'No air', patch: { air: false }, mine: !d.air },
          { label: 'Air, no wind', patch: { air: true, wind: 0 }, mine: d.air && d.wind === 0 },
          { label: 'Wind in your face (8 m/s)', patch: { air: true, wind: -8 } },
          { label: 'Wind behind you (8 m/s)', patch: { air: true, wind: 8 } },
        ]}
      />
    ),
    takeaway: 'On a real day, check which way the wind blows before you throw.',
    watch: [
      { label: 'No air', patch: () => ({ air: false }) },
      { label: 'Strong headwind', patch: () => ({ air: true, wind: -10 }) },
    ],
  },
  {
    id: 'gravity',
    title: 'Gravity',
    icon: '🌍',
    group: 'The world',
    summary: 'How hard the planet pulls things down.',
    step: 'world',
    keys: ['planet'],
    What: () => (
      <>
        <p>Gravity is the pull that makes things fall. The Moon pulls about one sixth as hard as Earth, and Mars about one third.</p>
        <Planets />
      </>
    ),
    Why: () => (
      <>
        <p>Gravity does two jobs in a trebuchet:</p>
        <ul>
          <li>It pulls the weight down. That's the engine.</li>
          <li>It pulls the ball back down. That's what ends the flight.</li>
        </ul>
      </>
    ),
    How: () => (
      <>
        <p>On the Moon the weight falls gently, so the ball launches slower. But the ball also falls gently, so it stays up longer.</p>
        <p>
          Those two cancel out! With no air, your machine throws about the <b>same distance</b> on any planet. It just takes much longer to land.
        </p>
      </>
    ),
    Impact: ({ d }) => (
      <ExperimentBars
        d={d}
        variants={[
          { label: 'Earth, with air', patch: { planet: 'earth', air: true }, mine: d.planet === 'earth' && d.air },
          { label: 'Earth, no air', patch: { planet: 'earth', air: false }, mine: d.planet === 'earth' && !d.air },
          { label: 'Mars', patch: { planet: 'mars', air: true }, mine: d.planet === 'mars' },
          { label: 'Moon (no air)', patch: { planet: 'moon' }, mine: d.planet === 'moon' },
        ]}
        note={(t) => `in the air ${t.results!.flightTime.toFixed(1)} s`}
      />
    ),
    takeaway: 'Weaker gravity: about the same distance, much longer flight. (The Moon has no air at all.)',
    watch: [
      { label: 'On the Moon', patch: () => ({ planet: 'moon' }) },
      { label: 'On Mars', patch: () => ({ planet: 'mars' }) },
    ],
  },
];

export function lessonById(id: string | null) {
  return LESSONS.find((l) => l.id === id) ?? null;
}

export function lessonForKey(key: keyof Design): LessonId | null {
  return LESSONS.find((l) => l.keys.includes(key))?.id ?? null;
}

export const PAGES = [
  { id: 'what', label: 'What is it?' },
  { id: 'why', label: 'Why it matters' },
  { id: 'how', label: 'How it works' },
  { id: 'impact', label: 'What it changes' },
] as const;
