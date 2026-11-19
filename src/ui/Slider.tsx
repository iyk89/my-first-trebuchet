import { useState } from 'react';
import type { NumberVar } from '../data/variables';
import type { Design } from '../physics/types';
import { useStore } from '../state/store';

const RES = 1000;

function toSlider(spec: NumberVar, d: Design, v: number) {
  const lo = spec.min(d);
  const hi = spec.max(d);
  const c = Math.min(hi, Math.max(lo, v));
  if (spec.log) return (Math.log(c / lo) / Math.log(hi / lo)) * RES;
  return hi === lo ? 0 : ((c - lo) / (hi - lo)) * RES;
}

function fromSlider(spec: NumberVar, d: Design, x: number) {
  const lo = spec.min(d);
  const hi = spec.max(d);
  const u = x / RES;
  if (spec.log) return niceRound(lo * Math.pow(hi / lo, u));
  const v = lo + (hi - lo) * u;
  return spec.step ? Math.round(v / spec.step) * spec.step : niceRound(v);
}

/** Round to 3 significant figures so numbers stay friendly. */
function niceRound(v: number) {
  if (v === 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 2);
  return Math.round(v / p) * p;
}

export function Slider({ spec }: { spec: NumberVar }) {
  const d = useStore((s) => s.draft);
  const setDesign = useStore((s) => s.setDesign);
  // Pull-back is limited by the ground, and the physics uses the limited value, so show that.
  const raw = d[spec.key] as number;
  const value = spec.key === 'pullBack' ? Math.min(raw, spec.max(d)) : raw;
  const [typing, setTyping] = useState<string | null>(null);
  const lo = spec.min(d);
  const hi = spec.max(d);

  const set = (v: number) => {
    const c = Math.min(hi, Math.max(lo, v));
    setDesign({ [spec.key]: spec.step ? Math.round(c / spec.step) * spec.step : niceRound(c) } as Partial<Design>);
  };
  const nudge = (dir: 1 | -1) => {
    if (spec.log || !spec.step) {
      const k = spec.nudge ?? 0.05;
      set(value * (dir > 0 ? 1 + k : 1 / (1 + k)));
    } else set(value + dir * spec.step);
  };

  return (
    <div className="var">
      <div className="var-head">
        <span className="var-label">{spec.label}</span>
        {typing === null ? (
          <button className="var-value" onClick={() => setTyping(String(Number(value.toPrecision(4))))} title="Tap to type a number">
            {spec.format(value)}
          </button>
        ) : (
          <input
            className="var-input"
            autoFocus
            inputMode="decimal"
            value={typing}
            onChange={(e) => setTyping(e.target.value)}
            onBlur={() => {
              const n = parseFloat(typing);
              if (Number.isFinite(n)) set(n);
              setTyping(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setTyping(null);
            }}
          />
        )}
      </div>
      <div className="var-row">
        <button className="nudge" onClick={() => nudge(-1)} aria-label={`Less ${spec.label}`}>
          −
        </button>
        <input
          type="range"
          min={0}
          max={RES}
          step={1}
          value={toSlider(spec, d, value)}
          onChange={(e) => setDesign({ [spec.key]: fromSlider(spec, d, Number(e.target.value)) } as Partial<Design>)}
        />
        <button className="nudge" onClick={() => nudge(1)} aria-label={`More ${spec.label}`}>
          +
        </button>
      </div>
      <p className="var-kid">{spec.kid}</p>
      {spec.tryThis && <p className="var-try">💡 {spec.tryThis}</p>}
    </div>
  );
}
