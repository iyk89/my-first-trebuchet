/**
 * Build plans for a design: side view, top view, key numbers with templates, and a cut list.
 * All drawn from the same model the simulator uses, so the numbers match the throw you tested.
 */
import { projectileById } from '../data/projectiles';
import { cwBoxHeight, geometry, maxPullBackDeg, pose, startAngles } from '../physics/geometry';
import type { Design, Results } from '../physics/types';
import { machineDims } from '../scene/Trebuchet';
import { ACCENT, INK, METAL, Pen, SCALES, SOFT, WOOD, WOOD_DARK, textWidth, type Pt, type Sheet } from './drawing';

const PW = 279.4; // US Letter, landscape (mm). Content stays inside A4 too.
const PH = 215.9;
const M = 10;

export function cm(m: number) {
  const v = m * 100;
  const a = Math.abs(v);
  return `${a >= 100 ? Math.round(v) : a >= 10 ? v.toFixed(1) : v.toFixed(1)} cm`;
}
function kg(v: number) {
  return v < 1 ? `${Math.round(v * 1000)} g` : `${Number(v.toPrecision(3))} kg`;
}
function deg(v: number) {
  return `${Math.round(v)}°`;
}

export interface PlanInput {
  design: Design;
  name: string;
  results?: Results | null;
}

interface Model {
  d: Design;
  L: number;
  La: number;
  Lb: number;
  H: number;
  t: number;
  post: number;
  w: number;
  footX: number;
  baseHalf: number;
  box: [number, number, number];
  boxH: number;
  Lh: number;
  hinged: boolean;
  Ls: number;
  r: number;
  alpha: number; // degrees
  hookLen: number;
  pull: number; // degrees, after the ground limit
  start: ReturnType<typeof pose>;
  troughStart: number;
  troughEnd: number;
  clearance: number;
  axleLen: number;
  legLen: number;
  legAngle: number;
}

function model(d: Design): Model {
  const g = geometry(d);
  const dims = machineDims(g);
  const a = startAngles(g);
  const sp = pose(g, a.theta, a.phi, a.psi);
  const t = dims.t;
  const post = dims.post;
  const boxH = cwBoxHeight(g);
  const rise = g.H - 0.4 * t - post;
  const run = dims.footX - 0.4 * post;
  return {
    d,
    L: g.La + g.Lb,
    La: g.La,
    Lb: g.Lb,
    H: g.H,
    t,
    post,
    w: dims.w,
    footX: dims.footX,
    baseHalf: dims.baseHalf,
    box: dims.box,
    boxH,
    Lh: g.Lh,
    hinged: g.hinged,
    Ls: g.Ls,
    r: g.r,
    alpha: d.releaseAngle,
    hookLen: t * 3.2,
    pull: Math.min(d.pullBack, maxPullBackDeg(d)),
    start: sp,
    troughStart: Math.min(sp.tip[0], sp.ball[0]) - g.r * 2,
    troughEnd: Math.max(sp.ball[0], post) + g.r * 3,
    clearance: g.H - g.Lb - (g.hinged ? g.Lh : 0) - boxH / 2,
    axleLen: (dims.w + post * 1.3) * 2,
    legLen: Math.hypot(run, rise),
    legAngle: (Math.atan2(rise, run) * 180) / Math.PI,
  };
}

/** Pick the biggest standard scale (1:n) that fits both views on the page, with room for measurements. */
function pickScale(m: Model) {
  const left = Math.max(m.La + m.hookLen * 1.5, m.baseHalf, -m.troughStart);
  const right = Math.max(m.baseHalf, m.Lb + m.box[0] / 2, m.troughEnd);
  const cockUp = m.Lb * Math.sin((m.pull * Math.PI) / 180) + (m.hinged ? 0 : m.boxH / 2);
  const outer = m.w + m.post * 1.3;
  for (const n of SCALES) {
    const k = 1000 / n;
    const widthOk = (left + right) * k <= 200;
    const profileOk = m.H * k + Math.max(24, cockUp * k + 4) <= 110;
    const planOk = outer * 2 * k <= 72;
    if (widthOk && profileOk && planOk) return n;
  }
  return SCALES[SCALES.length - 1];
}

function frame(p: Pen, title: string, sub: string, input: PlanInput, sheetNo: number, sheets: number, scale: string) {
  p.rect(M, M, PW - 2 * M, PH - 2 * M, { w: 0.5 });
  p.text([M + 4, M + 9], title, { size: 6, bold: true });
  p.text([M + 4, M + 15], sub, { size: 3, c: SOFT });
  // Title block
  const bx = PW - M - 96;
  const by = PH - M - 30;
  p.rect(bx, by, 96, 30, { w: 0.4, fill: '#ffffff' });
  p.line([bx, by + 10], [bx + 96, by + 10], 0.2);
  p.line([bx, by + 20], [bx + 96, by + 20], 0.2);
  p.line([bx + 60, by + 10], [bx + 60, by + 30], 0.2);
  p.text([bx + 3, by + 7], 'TREBUCHET LAB  ·  BUILD PLANS', { size: 3.6, bold: true });
  const name = input.name.length > 38 ? input.name.slice(0, 37) + '…' : input.name;
  p.text([bx + 3, by + 16.5], name, { size: 3.4, bold: true });
  p.text([bx + 63, by + 14], 'SHEET', { size: 2, c: SOFT });
  p.text([bx + 63, by + 18.2], `${sheetNo} of ${sheets}`, { size: 3.2, bold: true });
  p.text([bx + 3, by + 24], 'Units: centimeters (cm)', { size: 2.6 });
  p.text([bx + 3, by + 28], new Date().toLocaleDateString(), { size: 2.4, c: SOFT });
  p.text([bx + 63, by + 24], 'SCALE', { size: 2, c: SOFT });
  p.text([bx + 63, by + 28.2], scale, { size: 3.2, bold: true });
}

function scaleBar(p: Pen, at: Pt, n: number) {
  // A bar showing real length at this scale, so you can check the print.
  const k = 1000 / n; // mm on paper per meter
  const options = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
  const step = options.find((s) => s * k >= 8) ?? 10;
  for (let i = 0; i < 5; i++) {
    p.rect(at[0] + i * step * k, at[1], step * k, 1.6, { w: 0.15, fill: i % 2 ? '#ffffff' : INK });
  }
  for (let i = 0; i <= 5; i += 1) {
    p.text([at[0] + i * step * k, at[1] + 4.6], String(Math.round(i * step * 1000) / 10), { size: 2.2, anchor: 'middle', c: SOFT });
  }
  p.text([at[0] + 5 * step * k + 2, at[1] + 1.6], 'cm', { size: 2.2, c: SOFT });
}

function beam(p: Pen, a: Pt, b: Pt, width: number, fill: string) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = (-dy / L) * (width / 2);
  const ny = (dx / L) * (width / 2);
  p.poly(
    [
      [a[0] + nx, a[1] + ny],
      [b[0] + nx, b[1] + ny],
      [b[0] - nx, b[1] - ny],
      [a[0] - nx, a[1] - ny],
    ],
    { fill, w: 0.25 },
  );
}

/** Notes in the bottom-left corner, wrapped so they never run into the title block. */
function notes(p: Pen, lines: string[], at: Pt = [M + 4, PH - M - 27]) {
  const maxW = PW - 2 * M - 96 - 10;
  const out: { s: string; bold: boolean }[] = [];
  lines.forEach((l, i) => {
    let cur = '';
    for (const word of l.split(' ')) {
      const next = cur ? `${cur} ${word}` : word;
      if (textWidth(next, 2.7, i === 0) > maxW && cur) {
        out.push({ s: cur, bold: i === 0 });
        cur = word;
      } else cur = next;
    }
    out.push({ s: cur, bold: i === 0 });
  });
  out.slice(0, 7).forEach((l, i) => p.text([at[0], at[1] + i * 4.1], l.s, { size: 2.7, bold: l.bold }));
}

// ---------------------------------------------------------------- Sheet 1: side view
function profileSheet(m: Model, input: PlanInput, n: number, count: number): Sheet {
  const p = new Pen();
  frame(p, 'SIDE VIEW (PROFILE)', 'Arm shown level so you can measure it. Dashed lines show the ready-to-throw position.', input, 1, count, `1 : ${n}`);
  const k = 1000 / n;
  const xmin = Math.min(-m.La - m.hookLen * 1.5, -m.baseHalf, m.troughStart);
  const xmax = Math.max(m.baseHalf, m.Lb + m.box[0] / 2, m.troughEnd);
  const cx = M + 20 + (225 - (xmax - xmin) * k) / 2 - xmin * k;
  const gy = PH - M - 52; // ground line on paper
  const X = (x: number) => cx + x * k;
  const Y = (y: number) => gy - y * k;
  const P = (x: number, y: number): Pt => [X(x), Y(y)];
  const { La, Lb, H, t, post, footX, baseHalf, box } = m;

  p.ground(X(xmin) - 8, X(xmax) + 8, gy);
  // trough
  p.rect(X(m.troughStart), Y(Math.max(m.r * 0.5, 0.004)), (m.troughEnd - m.troughStart) * k, Math.max(m.r * 0.5 * k, 0.6), { fill: WOOD_DARK, w: 0.15 });
  // base, legs, brace, bearing block
  p.rect(X(-baseHalf), Y(post), baseHalf * 2 * k, post * k, { fill: '#e8d2b0', w: 0.25 });
  beam(p, P(-footX, post), P(-post * 0.4, H - t * 0.4), post * k, '#e8d2b0');
  beam(p, P(footX, post), P(post * 0.4, H - t * 0.4), post * k, '#e8d2b0');
  beam(p, P(-footX * 0.55, H * 0.45), P(footX * 0.55, H * 0.45), post * 0.8 * k, '#e8d2b0');
  p.rect(X(-t * 0.9), Y(H + t * 0.7), t * 1.8 * k, t * 1.4 * k, { fill: '#e8d2b0', w: 0.25 });

  // ready-to-throw ghost (dashed)
  const s = m.start;
  const dash = [1.6, 1.2];
  const G = '#b9b3cf';
  p.line(P(s.shortEnd[0], s.shortEnd[1]), P(s.tip[0], s.tip[1]), 0.3, G, dash);
  p.line(P(s.tip[0], s.tip[1]), P(s.ball[0], s.ball[1]), 0.22, G, dash);
  p.circle(P(s.ball[0], s.ball[1]), Math.max(m.r * k, 0.9), { c: SOFT, dash, w: 0.25 });
  if (m.hinged) p.line(P(s.shortEnd[0], s.shortEnd[1]), P(s.cw[0], s.cw[1] + box[1] / 2), 0.2, G, dash);
  p.rect(X(s.cw[0] - box[0] / 2), Y(s.cw[1] + box[1] / 2), box[0] * k, box[1] * k, { c: G, dash, w: 0.22 });

  // the arm, level
  p.rect(X(-La), Y(H + t / 2), (La + Lb) * k, t * k, { fill: WOOD, w: 0.3 });
  p.circle(P(0, H), Math.max(t * 0.22 * k, 0.8), { fill: METAL, c: INK, w: 0.2 });
  // release hook
  const a = (m.alpha * Math.PI) / 180;
  const hookEnd = P(-La - m.hookLen * Math.cos(a), H - m.hookLen * Math.sin(a));
  p.line(P(-La, H), [X(-La - m.hookLen * 1.6), Y(H)], 0.15, SOFT, [1.2, 1]);
  p.line(P(-La, H), hookEnd, Math.max(t * 0.26 * k, 0.5), METAL);
  p.angle(P(-La, H), Math.max(m.hookLen * k * 0.75, 6), 180, 180 + m.alpha, deg(m.alpha));
  // counterweight
  if (m.hinged) {
    p.line(P(Lb, H), P(Lb, H - m.Lh + box[1] / 2), Math.max(t * 0.16 * k, 0.4), METAL);
    p.rect(X(Lb - box[0] / 2), Y(H - m.Lh + box[1] / 2), box[0] * k, box[1] * k, { fill: WOOD_DARK, w: 0.3 });
  } else {
    p.rect(X(Lb - box[0] / 2), Y(H + box[1] / 2), box[0] * k, box[1] * k, { fill: WOOD_DARK, w: 0.3 });
  }

  // pull-back angle on the ghost
  p.angle(P(0, H), Math.min(La * k * 0.45, 26), 180, 180 + m.pull, deg(m.pull), { col: SOFT, size: 2.8 });

  // ---- measurements
  const top = t * k / 2;
  p.dim(P(-La, H), P(Lb, H), top + 16, `arm ${cm(m.L)}`);
  p.dim(P(-La, H), P(0, H), top + 7, `throwing side ${cm(La)}`, { c: ACCENT });
  p.dim(P(0, H), P(Lb, H), top + 7, `weight side ${cm(Lb)}`, { c: ACCENT });
  const xr = Math.max(baseHalf, Lb + box[0] / 2);
  p.dim(P(0, 0), P(0, H), -(xr * k + 12), `axle height ${cm(H)}`);
  if (m.hinged) p.dim(P(Lb, H - m.Lh), P(Lb, H), -(box[0] * k / 2 + 4), `hanger ${cm(m.Lh)}`);
  p.dim(P(-footX, 0), P(footX, 0), -7, `feet ${cm(footX * 2)} apart`);
  p.dim(P(-baseHalf, 0), P(baseHalf, 0), -14, `base ${cm(baseHalf * 2)}`);

  // notes on the drawing
  const boxBottom: Pt = m.hinged ? P(Lb, H - m.Lh - box[1] / 2) : P(Lb, H - box[1] / 2);
  p.text([boxBottom[0], boxBottom[1] + 4], `weight ${kg(m.d.cwMass)}`, { size: 2.6, anchor: 'middle', bold: true });
  p.note([hookEnd[0] - 4, hookEnd[1] + 10], hookEnd, `release hook, bent ${deg(m.alpha)}`, 2.6, 'end');
  const ballAt = P(s.ball[0], s.ball[1]);
  p.note([ballAt[0] + 4, ballAt[1] - 12], ballAt, `ball starts ${cm(Math.abs(s.ball[0]))} ${s.ball[0] >= 0 ? 'in front of' : 'behind'} the axle`);

  scaleBar(p, [M + 4, M + 22], n);
  notes(p, [
    'KEY MEASUREMENTS',
    `Axle hole: ${cm(Lb)} from the weight end, ${cm(La)} from the throwing end (${(La / Lb).toFixed(1)} : 1).`,
    `Axle center sits ${cm(H)} above the ground. Pull the arm down ${deg(m.pull)} below level to load it.`,
    m.clearance >= 0 ? `The weight clears the ground by ${cm(m.clearance)} at the bottom of its swing.` : `WARNING: the weight hits the ground by ${cm(-m.clearance)} at the bottom of its swing.`,
    'Print at 100% (actual size) and check the scale bar before measuring off the paper.',
  ]);
  return { w: PW, h: PH, title: 'Side view', prims: p.prims };
}

// ---------------------------------------------------------------- Sheet 2: top view
function planSheet(m: Model, input: PlanInput, n: number, count: number): Sheet {
  const p = new Pen();
  frame(p, 'TOP VIEW (PLAN)', 'Seen from above, arm level. The throw goes to the right.', input, 2, count, `1 : ${n}`);
  const k = 1000 / n;
  const xmin = Math.min(-m.La - m.hookLen * 1.5, -m.baseHalf, m.troughStart);
  const xmax = Math.max(m.baseHalf, m.Lb + m.box[0] / 2, m.troughEnd);
  const cx = M + 20 + (225 - (xmax - xmin) * k) / 2 - xmin * k;
  const cz = M + 80;
  const X = (x: number) => cx + x * k;
  const Z = (z: number) => cz + z * k;
  const { La, Lb, t, post, w, baseHalf, box } = m;
  const outer = w + post;

  // base rails and cross pieces
  for (const s of [-1, 1]) p.rect(X(-baseHalf), Z(s > 0 ? w : -outer), baseHalf * 2 * k, post * k, { fill: '#e8d2b0', w: 0.25 });
  for (const x of [-baseHalf, baseHalf - post]) p.rect(X(x), Z(-outer), post * k, outer * 2 * k, { fill: '#e8d2b0', w: 0.25 });
  // leg feet and bearing blocks
  for (const s of [-1, 1]) {
    for (const x of [-m.footX, m.footX]) p.rect(X(x - post / 2), Z(s * (w + post / 2) - post / 2), post * k, post * k, { fill: WOOD, w: 0.3 });
    p.rect(X(-t * 0.9), Z(s * (w + post / 2) - post * 0.55), t * 1.8 * k, post * 1.1 * k, { fill: '#d9b98f', w: 0.3 });
  }
  // trough
  for (const s of [-1, 1]) p.rect(X(m.troughStart), Z(s * m.r * 1.2 - Math.max(m.r * 0.15, 0.002)), (m.troughEnd - m.troughStart) * k, Math.max(m.r * 0.3 * k, 0.5), { fill: WOOD_DARK, w: 0.1 });
  p.circle([X(m.start.ball[0]), Z(0)], Math.max(m.r * k, 0.9), { c: SOFT, dash: [1.2, 1], w: 0.25 });
  // arm, axle, hook, weight
  p.rect(X(-La), Z(-t * 0.4), (La + Lb) * k, t * 0.8 * k, { fill: WOOD, w: 0.3 });
  p.rect(X(-t * 0.22), Z(-m.axleLen / 2), t * 0.44 * k, m.axleLen * k, { fill: METAL, w: 0.2 });
  p.line([X(-La), Z(0)], [X(-La - m.hookLen * Math.cos((m.alpha * Math.PI) / 180)), Z(0)], Math.max(t * 0.26 * k, 0.5), METAL);
  p.rect(X(Lb - box[0] / 2), Z(-box[2] / 2), box[0] * k, box[2] * k, { fill: WOOD_DARK, w: 0.3 });

  // measurements
  p.dim([X(-baseHalf), Z(outer)], [X(baseHalf), Z(outer)], -8, `base ${cm(baseHalf * 2)}`);
  p.dim([X(m.troughStart), Z(outer)], [X(m.troughEnd), Z(outer)], -16, `trough ${cm(m.troughEnd - m.troughStart)}`, { c: SOFT });
  p.dim([X(baseHalf), Z(outer)], [X(baseHalf), Z(-outer)], -8, `outside ${cm(outer * 2)}`);
  // Measure the gap where nothing else is in the way: in front of the weight box if there's room.
  const frontRoom = baseHalf - post - (Lb + box[0] / 2);
  const gx = frontRoom > 0.02 ? Lb + box[0] / 2 + frontRoom / 2 : -baseHalf + post * 1.5;
  p.dim([X(gx), Z(w)], [X(gx), Z(-w)], 0, `gap ${cm(w * 2)}`, { c: ACCENT });
  p.dim([X(-La), Z(-outer)], [X(Lb), Z(-outer)], 8, `arm ${cm(m.L)}`);

  const fx = Math.min(Math.max(X(xmax), X(baseHalf) + 18) + 6, PW - M - 24);
  p.text([fx, cz + 1], 'FRONT', { size: 3, bold: true, c: ACCENT });
  p.text([fx, cz + 5], '(throw this way)', { size: 2.4, c: SOFT });
  p.text([X(xmin) - 6, cz + 1], 'BACK', { size: 3, bold: true, c: SOFT, anchor: 'end' });

  scaleBar(p, [M + 4, M + 22], n);
  const side = (w * 2 - box[2]) / 2;
  notes(p, [
    'KEY MEASUREMENTS',
    `Inside gap between the two side frames: ${cm(w * 2)}. The weight box is ${cm(box[2])} wide, so it clears by ${cm(side)} on each side.`,
    `The arm sits in the middle, on an axle ${cm(m.axleLen)} long (about ${cm(t * 0.44)} thick).`,
    `The trough runs ${cm(m.troughEnd - m.troughStart)} along the middle of the base, under the arm.`,
    'Print at 100% (actual size) and check the scale bar before measuring off the paper.',
  ]);
  return { w: PW, h: PH, title: 'Top view', prims: p.prims };
}

// ---------------------------------------------------------------- Sheet 3: key numbers + templates
function detailsSheet(m: Model, input: PlanInput, count: number): Sheet {
  const p = new Pen();
  frame(p, 'KEY NUMBERS AND TEMPLATES', 'Everything you need to set up this version. Numbers come from the same model the simulator used.', input, 3, count, 'not to scale');
  const d = m.d;
  const ball = projectileById(d.projectileId);
  const rows: [string, string][] = [
    ['Arm length', cm(m.L)],
    ['Axle hole from the weight end', cm(m.Lb)],
    ['Axle hole from the throwing end', `${cm(m.La)}   (${(m.La / m.Lb).toFixed(1)} : 1)`],
    ['Axle height above the ground', cm(m.H)],
    ['Counterweight', `${kg(d.cwMass)}, ${m.hinged ? 'swinging on a hinge' : 'bolted to the arm'}`],
    ['Weight box (outside, if filled with sand)', `${cm(m.box[0])} × ${cm(m.box[1])} × ${cm(m.box[2])}`],
    ...(m.hinged ? ([['Hanger (hinge to middle of box)', cm(m.Lh)]] as [string, string][]) : []),
    ['Weight clearance at its lowest', m.clearance >= 0 ? cm(m.clearance) : `hits the ground by ${cm(-m.clearance)}!`],
    ['Sling length (arm tip to middle of ball)', cm(m.Ls)],
    ['Release hook', `${cm(m.hookLen)} long, bent ${deg(m.alpha)} from straight out`],
    ['Ready position', `arm ${deg(m.pull)} below level, tip ${cm(m.start.tip[1])} off the ground`],
    ['Ball', `${ball.id === 'custom' ? 'custom' : ball.name.toLowerCase()}: ${kg(d.projectileMass)}, ${cm(d.projectileDiameter)} across`],
    ['Ball start (in the trough)', `${cm(Math.abs(m.start.ball[0]))} ${m.start.ball[0] >= 0 ? 'in front of' : 'behind'} the axle`],
  ];
  let y = M + 26;
  p.text([M + 4, y], 'KEY NUMBERS', { size: 3.6, bold: true });
  y += 3;
  for (const [i, [a, b]] of rows.entries()) {
    y += 6.4;
    if (i % 2 === 0) p.rect(M + 3, y - 4.5, 136, 6.4, { fill: '#f6f1e8', w: 0, c: '#f6f1e8' });
    p.text([M + 5, y], a, { size: 2.8, c: SOFT });
    p.text([M + 136, y], b, { size: 3, bold: true, anchor: 'end' });
  }

  const r = input.results;
  y += 11;
  p.text([M + 4, y], 'EXPECTED THROW (SIMULATOR)', { size: 3.6, bold: true });
  if (r) {
    const items = [
      ['Distance', `${(r.distance).toFixed(r.distance < 10 ? 2 : 1)} m`],
      ['Highest point', `${r.maxHeight.toFixed(r.maxHeight < 10 ? 2 : 1)} m`],
      ['Launch speed', `${Math.round(r.launchSpeed * 3.6)} km/h`],
      ['Launch angle', deg(r.launchAngle)],
    ];
    items.forEach(([a, b], i) => {
      const x = M + 5 + i * 34;
      p.text([x, y + 7], a, { size: 2.4, c: SOFT });
      p.text([x, y + 13], b, { size: 4.2, bold: true });
    });
    p.text([M + 5, y + 19], 'Real machines usually throw shorter: friction, bending wood and a stretchy sling all cost distance.', { size: 2.5, c: SOFT });
  } else {
    p.text([M + 5, y + 7], 'This build does not complete a throw in the simulator yet. Fix it in the app first.', { size: 2.8, c: ACCENT });
  }

  // ---- Hook angle template (works at any size: angles don't change with scale)
  const hx = 160;
  const hy = M + 22;
  p.text([hx, hy + 4], 'RELEASE HOOK ANGLE TEMPLATE', { size: 3.6, bold: true });
  p.text([hx, hy + 9], 'Angles are the same at any size. Lay the end of the arm on the brown bar,', { size: 2.5, c: SOFT });
  p.text([hx, hy + 12.5], 'then bend the hook to follow the orange line.', { size: 2.5, c: SOFT });
  const tip: Pt = [hx + 40, hy + 32];
  p.rect(hx, tip[1] - 5, 40, 10, { fill: WOOD, w: 0.3 });
  p.text([hx + 20, tip[1] + 1], 'END OF ARM', { size: 2.4, bold: true, anchor: 'middle', c: '#ffffff' });
  p.text([hx + 20, tip[1] + 9], 'underside (faces the ground when pulled back)', { size: 2.1, anchor: 'middle', c: SOFT });
  const R = 50;
  p.line(tip, [tip[0] + R + 4, tip[1]], 0.25, SOFT, [1.5, 1.2]);
  p.text([tip[0] + R + 5, tip[1] - 1.5], 'straight out (0°)', { size: 2.3, c: SOFT });
  for (let a = 0; a <= 110; a += 10) {
    const rad = (-a * Math.PI) / 180; // bend toward the underside = downward on this drawing
    const r0 = a % 30 === 0 ? R - 6 : R - 3.5;
    p.line([tip[0] + r0 * Math.cos(rad), tip[1] - r0 * Math.sin(rad)], [tip[0] + R * Math.cos(rad), tip[1] - R * Math.sin(rad)], 0.2, SOFT);
    if (a % 30 === 0 && a > 0) p.text([tip[0] + (R + 4) * Math.cos(rad), tip[1] - (R + 4) * Math.sin(rad) + 1], `${a}°`, { size: 2.3, anchor: 'middle', c: SOFT });
  }
  const ar = (-m.alpha * Math.PI) / 180;
  p.line(tip, [tip[0] + R * 0.92 * Math.cos(ar), tip[1] - R * 0.92 * Math.sin(ar)], 1.6, ACCENT);
  p.angle(tip, 18, -m.alpha, 0, deg(m.alpha), { size: 4.4 });
  p.circle([tip[0] + R * 0.5 * Math.cos(ar), tip[1] - R * 0.5 * Math.sin(ar)], 2.6, { c: '#a5793f', w: 0.8 });
  p.text([tip[0] + R * 0.5 * Math.cos(ar) + 4, tip[1] - R * 0.5 * Math.sin(ar) + 1], "sling's loop", { size: 2.3, c: SOFT });

  // ---- Sling layout
  const sy = hy + 112;
  p.text([hx, sy], 'SLING', { size: 3.6, bold: true });
  const s0: Pt = [hx + 4, sy + 14];
  const s1: Pt = [hx + 92, sy + 14];
  p.line(s0, [s1[0] - 6, s1[1] - 3], 0.6, '#a5793f');
  p.line([s0[0], s0[1] + 6], [s1[0] - 6, s1[1] + 3], 0.6, '#a5793f');
  p.circle(s0, 1.8, { c: '#a5793f', w: 0.7 });
  p.circle([s0[0], s0[1] + 6], 1.2, { fill: '#a5793f', c: '#a5793f' });
  p.poly([[s1[0] - 7, s1[1] - 5], [s1[0] + 3, s1[1] - 5], [s1[0] + 3, s1[1] + 5], [s1[0] - 7, s1[1] + 5]], { fill: '#6b4226', c: '#6b4226', w: 0.2 });
  p.circle([s1[0] - 2, s1[1]], 3.6, { fill: '#ffffff', w: 0.3 });
  p.text([s0[0] + 3, s0[1] - 3], 'loop goes over the hook', { size: 2.3, c: SOFT });
  p.text([s0[0] + 3, s0[1] + 10.5], 'tied to the arm tip', { size: 2.3, c: SOFT });
  p.text([s1[0] - 2, s1[1] + 9.5], 'pouch + ball', { size: 2.3, anchor: 'middle', c: SOFT });
  p.dim([s0[0], s0[1] + 3], [s1[0] - 2, s1[1] + 3], -12, `${cm(m.Ls)} to the middle of the ball`, { c: ACCENT });
  return { w: PW, h: PH, title: 'Key numbers', prims: p.prims };
}

// ---------------------------------------------------------------- Sheet 4: cut list + safety
function cutListSheet(m: Model, input: PlanInput, count: number): Sheet {
  const p = new Pen();
  frame(p, 'CUT LIST AND SAFETY', 'Sizes come from the model. Use real lumber close to these; sturdier is fine, but keep the lengths.', input, 4, count, 'not to scale');
  const { t, post } = m;
  const sec = (a: number, b: number) => `${cm(a)} × ${cm(b)}`;
  const rows: string[][] = [
    ['Throwing arm', '1', cm(m.L), sec(t, t * 0.8), `Drill the axle hole ${cm(m.Lb)} from the weight end.`],
    ['Base rails', '2', cm(m.baseHalf * 2), sec(post, post), 'Run front to back, one on each side.'],
    ['Cross pieces', '2', cm((m.w + post) * 2), sec(post, post * 0.9), 'Join the two rails at the front and back.'],
    ['Legs', '4', cm(m.legLen), sec(post, post), `Lean in at ${deg(m.legAngle)} from the ground; pairs meet at the axle.`],
    ['Leg braces', '2', cm(m.footX * 1.1), sec(post * 0.8, post * 0.8), `Across each leg pair, ${cm(m.H * 0.45)} up.`],
    ['Bearing blocks', '2', cm(t * 1.8), sec(t * 1.4, post * 1.1), 'On top of each leg pair; hold the axle.'],
    ['Axle', '1', cm(m.axleLen), `${cm(t * 0.44)} thick`, 'Steel rod or hardwood dowel; must spin freely.'],
    ['Release hook', '1', cm(m.hookLen), `${cm(t * 0.26)} thick`, `Metal rod at the arm tip, bent ${deg(m.alpha)} (see template).`],
    ...(m.hinged ? [['Hanger', '2', cm(Math.max(m.Lh - m.boxH / 2, 0.01)), 'chain or rods', 'From the hinge pin down to the top of the box.']] : []),
    ['Weight box', '1', sec(m.box[0], m.box[1]), `${cm(m.box[2])} wide`, `Holds ${kg(m.d.cwMass)} (sand is about 1.6 kg per liter).`],
    ['Trough rails', '2', cm(m.troughEnd - m.troughStart), sec(Math.max(m.r * 0.3, 0.005), Math.max(m.r * 0.5, 0.005)), 'Guide the ball in a straight line under the arm.'],
    ['Sling cords', '2', cm(m.Ls * 1.15), 'strong cord', `About ${cm(m.Ls)} each once tied, plus a pouch.`],
  ];
  const cols = [M + 4, M + 52, M + 70, M + 100, M + 140];
  const heads = ['PART', 'HOW MANY', 'LENGTH', 'THICKNESS', 'NOTES'];
  let y = M + 28;
  heads.forEach((h, i) => p.text([cols[i], y], h, { size: 2.6, bold: true, c: SOFT }));
  p.line([M + 3, y + 2], [PW - M - 3, y + 2], 0.3);
  for (const [i, row] of rows.entries()) {
    y += 7.2;
    if (i % 2 === 0) p.rect(M + 3, y - 4.9, PW - 2 * M - 6, 7.2, { fill: '#f6f1e8', w: 0, c: '#f6f1e8' });
    row.forEach((cell, j) => {
      const maxW = j === 4 ? PW - M - cols[4] - 4 : 60;
      let s = cell;
      while (textWidth(s, 2.8, j === 0) > maxW && s.length > 4) s = s.slice(0, -2) + '…';
      p.text([cols[j], y], s, { size: 2.8, bold: j === 0 || j === 2 });
    });
  }

  y += 14;
  p.text([M + 4, y], 'SAFETY', { size: 3.6, bold: true, c: ACCENT });
  const safety = [
    'Stand to the SIDE. Never stand in front of or behind the machine: a bad release can fire backward or straight up.',
    'Keep hands, heads and pets clear of the arm and of the weight’s swing. It moves fast and hard.',
    'Hold the arm down with a trigger pin and pull it with a long cord, from the side.',
    'Grown-ups load the counterweight. Check the frame is steady before adding weight.',
    'Start with a light weight and add more a little at a time.',
  ];
  safety.forEach((s, i) => p.text([M + 6, y + 6 + i * 5.2], `•  ${s}`, { size: 2.8 }));
  return { w: PW, h: PH, title: 'Cut list', prims: p.prims };
}

export function buildPlanSheets(input: PlanInput): Sheet[] {
  const m = model(input.design);
  const n = pickScale(m);
  const count = 4;
  return [profileSheet(m, input, n, count), planSheet(m, input, n, count), detailsSheet(m, input, count), cutListSheet(m, input, count)];
}

export { WOOD, METAL };
