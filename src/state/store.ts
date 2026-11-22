import { create } from 'zustand';
import { DEFAULT_DESIGN } from '../data/presets';
import { describeChanges, sameDesign, type StepId } from '../data/variables';
import { simulate } from '../physics/simulate';
import type { Design, FailureCode, Results, SimOutput } from '../physics/types';

export interface Version {
  id: string;
  number: number;
  name: string;
  design: Design;
  results: Results | null;
  failure?: FailureCode;
  parentId?: string;
  changes: string[];
  guess?: number;
  realDistance?: number;
  notes?: string;
  createdAt: number;
  color: string;
}

export interface DemoArc {
  label: string;
  color: string;
  path: [number, number][];
  distance: number;
  maxHeight: number;
}

const LEARNED_KEY = 'trebuchet-lab:learned';
function loadLearned(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(LEARNED_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function saveLearned(v: string[]) {
  try {
    localStorage.setItem(LEARNED_KEY, JSON.stringify(v));
  } catch {
    /* fine: it just won't remember which lessons you finished */
  }
}

/** Leaving a lesson demo: drop the what-if build and go back to the build view. */
function noDemo(s: { mode: Mode; simVersionId: string | null }) {
  const wasDemo = s.mode === 'throw' && s.simVersionId === null;
  return { demoDesign: null, demoLabel: null, demoArcs: null, ...(wasDemo ? { mode: 'build' as Mode, playing: false } : {}) };
}

export const VERSION_COLORS = ['#ff7a1a', '#2f80ed', '#27ae60', '#d6336c', '#9b51e0', '#f2c94c', '#00a3a3', '#8d6e63'];

const STORAGE_KEY = 'trebuchet-lab:v1';

interface Saved {
  versions: Version[];
  draft: Design;
  baseVersionId: string | null;
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    if (!Array.isArray(s.versions) || !s.draft) return null;
    return s;
  } catch {
    return null;
  }
}

function save(s: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage blocked or full: the app still works, it just won't remember */
  }
}

export type Mode = 'build' | 'throw';

interface State {
  draft: Design;
  baseVersionId: string | null;
  versions: Version[];
  step: StepId;
  mode: Mode;
  sim: SimOutput | null;
  simVersionId: string | null;
  playTime: number;
  playing: boolean;
  speed: number; // user playback speed
  slowSwing: boolean; // auto slow motion during the swing
  autoCam: boolean;
  guess: string;
  compareIds: string[];
  showAllArcs: boolean;
  panel: 'build' | 'results' | 'versions' | 'compare' | 'learn';
  /** Lessons: which one is open (null = the list), which page, and which ones you've finished. */
  learnId: string | null;
  /** Build plans being shown (null = closed). */
  plans: { design: Design; name: string; results?: Results | null } | null;
  openPlans: (p: { design: Design; name: string; results?: Results | null } | null) => void;
  learnPage: number;
  learned: string[];
  /** A "what if" build shown in 3D during a lesson. It is never saved as a version. */
  demoDesign: Design | null;
  demoLabel: string | null;
  demoArcs: DemoArc[] | null;
  openLesson: (id: string | null, opts?: { step?: StepId; focus?: 'hook' | null }) => void;
  setLearnPage: (n: number) => void;
  playDemo: (patch: Partial<Design>, label: string) => void;
  showDemoArcs: (arcs: DemoArc[]) => void;
  clearDemo: () => void;
  lastThrowNew: boolean;
  /** Part of the machine the camera is zoomed in on while you adjust it. */
  focus: 'hook' | null;
  setFocus: (f: 'hook' | null) => void;
  revealed: boolean; // results stay hidden until the ball lands, so guesses stay honest
  reveal: () => void;

  setDesign: (patch: Partial<Design>) => void;
  replaceDesign: (d: Design) => void;
  setStep: (s: StepId) => void;
  throwIt: () => void;
  replay: (versionId: string) => void;
  loadVersion: (versionId: string) => void;
  resetDraft: () => void;
  renameVersion: (id: string, name: string) => void;
  updateVersion: (id: string, patch: Partial<Pick<Version, 'realDistance' | 'notes' | 'name'>>) => void;
  deleteVersion: (id: string) => void;
  toggleCompare: (id: string) => void;
  setCompare: (ids: string[]) => void;
  setPanel: (p: State['panel']) => void;
  setPlayTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  setSlowSwing: (b: boolean) => void;
  setAutoCam: (b: boolean) => void;
  setGuess: (g: string) => void;
  setShowAllArcs: (b: boolean) => void;
  importVersions: (vs: Version[]) => number;
}

const initial = load();

function persist(get: () => State) {
  const s = get();
  save({ versions: s.versions, draft: s.draft, baseVersionId: s.baseVersionId });
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const useStore = create<State>((set, get) => ({
  draft: initial?.draft ?? DEFAULT_DESIGN,
  baseVersionId: initial?.baseVersionId ?? null,
  versions: initial?.versions ?? [],
  step: 'size',
  mode: 'build',
  sim: null,
  simVersionId: null,
  playTime: 0,
  playing: false,
  speed: 1,
  slowSwing: true,
  autoCam: true,
  guess: '',
  compareIds: [],
  showAllArcs: false,
  panel: 'build',
  lastThrowNew: false,
  focus: null,
  setFocus: (focus) => {
    if (get().focus !== focus) set({ focus, autoCam: true });
  },
  revealed: false,
  learnId: null,
  plans: null,
  openPlans: (plans) => set({ plans, playing: false }),
  learnPage: 0,
  learned: loadLearned(),
  demoDesign: null,
  demoLabel: null,
  demoArcs: null,

  openLesson: (id, opts) => {
    set((s) => ({
      ...noDemo(s),
      panel: 'learn',
      learnId: id,
      learnPage: 0,
      step: opts?.step ?? s.step,
      focus: opts?.focus ?? null,
      autoCam: true,
    }));
  },
  setLearnPage: (n) => {
    set((s) => ({ ...noDemo(s), learnPage: n, autoCam: true }));
    const s = get();
    if (n >= 3 && s.learnId && !s.learned.includes(s.learnId)) {
      const learned = [...s.learned, s.learnId];
      set({ learned });
      saveLearned(learned);
    }
  },
  playDemo: (patch, label) => {
    const s = get();
    const d = { ...s.draft, ...patch };
    set({
      demoDesign: Object.keys(patch).length ? d : null,
      demoLabel: label,
      demoArcs: null,
      sim: simulate(d),
      simVersionId: null,
      mode: 'throw',
      playTime: 0,
      playing: true,
      autoCam: true,
      revealed: true,
      lastThrowNew: false,
    });
  },
  showDemoArcs: (arcs) => set((s) => ({ ...noDemo(s), demoArcs: arcs, mode: 'build', playing: false, autoCam: true })),
  clearDemo: () => set((s) => noDemo(s)),

  setDesign: (patch) => {
    set((s) => ({ ...noDemo(s), draft: { ...s.draft, ...patch }, mode: 'build', playing: false, autoCam: true }));
    persist(get);
  },
  replaceDesign: (d) => {
    set((s) => ({ ...noDemo(s), draft: { ...d }, mode: 'build', playing: false, autoCam: true }));
    persist(get);
  },
  setStep: (step) => set((s) => ({ ...noDemo(s), step, mode: 'build', playing: false, autoCam: true, panel: 'build', focus: null })),

  throwIt: () => {
    const s = get();
    const sim = simulate(s.draft);
    const base = s.versions.find((v) => v.id === s.baseVersionId);
    let versionId: string;
    let isNew = false;
    if (base && sameDesign(base.design, s.draft)) {
      versionId = base.id; // nothing changed: just throw it again
    } else {
      isNew = true;
      const number = s.versions.reduce((m, v) => Math.max(m, v.number), 0) + 1;
      const guessNum = parseFloat(s.guess);
      const v: Version = {
        id: uid(),
        number,
        name: `Version ${number}`,
        design: { ...s.draft },
        results: sim.results ?? null,
        failure: sim.failure,
        parentId: base?.id,
        changes: base ? describeChanges(base.design, s.draft) : [],
        guess: Number.isFinite(guessNum) ? guessNum : undefined,
        createdAt: Date.now(),
        color: VERSION_COLORS[(number - 1) % VERSION_COLORS.length],
      };
      versionId = v.id;
      set({ versions: [...s.versions, v], baseVersionId: v.id });
    }
    set({
      demoDesign: null,
      demoLabel: null,
      demoArcs: null,
      sim,
      simVersionId: versionId,
      mode: 'throw',
      playTime: 0,
      playing: true,
      autoCam: true,
      guess: '',
      panel: 'results',
      focus: null,
      lastThrowNew: isNew,
      revealed: !isNew,
    });
    persist(get);
  },

  replay: (versionId) => {
    const v = get().versions.find((x) => x.id === versionId);
    if (!v) return;
    const sim = simulate(v.design);
    set({
      demoDesign: null,
      demoLabel: null,
      demoArcs: null,
      draft: { ...v.design },
      baseVersionId: v.id,
      sim,
      simVersionId: v.id,
      mode: 'throw',
      playTime: 0,
      playing: true,
      autoCam: true,
      panel: 'results',
      lastThrowNew: false,
      revealed: true,
    });
    persist(get);
  },

  loadVersion: (versionId) => {
    const v = get().versions.find((x) => x.id === versionId);
    if (!v) return;
    set({ ...noDemo(get()), draft: { ...v.design }, baseVersionId: v.id, mode: 'build', playing: false, panel: 'build', autoCam: true });
    persist(get);
  },

  resetDraft: () => {
    const s = get();
    const base = s.versions.find((v) => v.id === s.baseVersionId);
    if (base) set({ draft: { ...base.design }, mode: 'build', playing: false });
    persist(get);
  },

  renameVersion: (id, name) => get().updateVersion(id, { name }),
  updateVersion: (id, patch) => {
    set((s) => ({ versions: s.versions.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));
    persist(get);
  },
  deleteVersion: (id) => {
    set((s) => ({
      versions: s.versions.filter((v) => v.id !== id),
      compareIds: s.compareIds.filter((c) => c !== id),
      baseVersionId: s.baseVersionId === id ? null : s.baseVersionId,
      simVersionId: s.simVersionId === id ? null : s.simVersionId,
    }));
    persist(get);
  },
  toggleCompare: (id) =>
    set((s) => ({
      compareIds: s.compareIds.includes(id) ? s.compareIds.filter((c) => c !== id) : [...s.compareIds, id],
    })),
  setCompare: (ids) => set({ compareIds: ids }),
  setPanel: (panel) => set((s) => (panel === 'learn' ? { panel } : { ...noDemo(s), panel, focus: s.panel === 'learn' ? null : s.focus })),
  setPlayTime: (playTime) => {
    const s = get();
    if (!s.revealed && s.sim && s.sim.frames.length) {
      const f = s.sim.frames;
      const at = s.sim.landIndex >= 0 ? f[s.sim.landIndex].t : f[f.length - 1].t;
      if (playTime >= at) {
        set({ playTime, revealed: true });
        return;
      }
    }
    set({ playTime });
  },
  reveal: () => {
    const s = get();
    if (s.sim && s.sim.frames.length) set({ playTime: s.sim.frames[s.sim.frames.length - 1].t, playing: false });
    set({ revealed: true });
  },
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setSlowSwing: (slowSwing) => set({ slowSwing }),
  setAutoCam: (autoCam) => set({ autoCam }),
  setGuess: (guess) => set({ guess }),
  setShowAllArcs: (showAllArcs) => set({ showAllArcs }),
  importVersions: (incoming) => {
    const s = get();
    const have = new Set(s.versions.map((v) => v.id));
    let next = s.versions.reduce((m, v) => Math.max(m, v.number), 0);
    const added = incoming
      .filter((v) => v && v.id && v.design && !have.has(v.id))
      .map((v) => {
        next += 1;
        return { ...v, number: next, color: VERSION_COLORS[(next - 1) % VERSION_COLORS.length] };
      });
    set({ versions: [...s.versions, ...added] });
    persist(get);
    return added.length;
  },
}));

export function currentVersion(s: Pick<State, 'versions' | 'baseVersionId'>) {
  return s.versions.find((v) => v.id === s.baseVersionId) ?? null;
}
