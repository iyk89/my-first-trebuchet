import { sameDesign } from '../data/variables';
import { simulate } from '../physics/simulate';
import { currentVersion, useStore, type Version } from '../state/store';

/** Plans for whatever is on the build screen right now. */
export function openPlansForDraft() {
  const s = useStore.getState();
  const base = currentVersion(s);
  const same = !!base && sameDesign(base.design, s.draft);
  const results = same ? base!.results : (simulate(s.draft).results ?? null);
  const name = same ? base!.name : base ? `${base.name} + changes (not thrown yet)` : 'New design (not thrown yet)';
  s.openPlans({ design: s.draft, name, results });
}

export function openPlansForVersion(v: Version) {
  useStore.getState().openPlans({ design: v.design, name: v.name, results: v.results });
}
