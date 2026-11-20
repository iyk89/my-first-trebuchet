import { useEffect, useState } from 'react';
import { simulate } from '../physics/simulate';
import type { Design, FailureCode, Frame, Results } from '../physics/types';

export interface Trial {
  design: Design;
  results?: Results;
  failure?: FailureCode;
  frames?: Frame[]; // only when asked for (to trace a part's path)
  releaseIndex: number;
}

const cache = new Map<string, Promise<unknown>>();
const tick = () => new Promise((r) => setTimeout(r, 0));

/** Run one "what if" throw with the fast physics setting. */
export function trial(d: Design, keepFrames = false): Trial {
  const out = simulate(d, { coarse: true });
  return {
    design: d,
    results: out.results,
    failure: out.failure && !out.results ? out.failure : undefined,
    frames: keepFrames ? out.frames : undefined,
    releaseIndex: out.releaseIndex,
  };
}

/** Run several throws, yielding to the page between each so it never freezes. Remembered by key. */
export function runTrials(key: string, designs: Design[], keepFrames = false): Promise<Trial[]> {
  const hit = cache.get(key);
  if (hit) return hit as Promise<Trial[]>;
  if (cache.size > 300) cache.clear();
  const p = (async () => {
    const out: Trial[] = [];
    for (const d of designs) {
      await tick();
      out.push(trial(d, keepFrames));
    }
    return out;
  })();
  cache.set(key, p);
  return p;
}

/** React hook: the trials for these designs, or undefined while they're still running. */
export function useTrials(key: string, designs: () => Design[], keepFrames = false): Trial[] | undefined {
  const [state, setState] = useState<{ key: string; trials: Trial[] } | null>(null);
  useEffect(() => {
    let alive = true;
    runTrials(key, designs(), keepFrames).then((trials) => alive && setState({ key, trials }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state && state.key === key ? state.trials : undefined;
}

export function designKey(d: Design) {
  return JSON.stringify(d);
}
