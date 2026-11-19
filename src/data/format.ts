export function fmtLength(m: number): string {
  const a = Math.abs(m);
  if (a < 0.1) return `${trim(m * 100, 1)} cm`;
  if (a < 1) return `${Math.round(m * 100)} cm`;
  if (a < 10) return `${trim(m, 2)} m`;
  if (a < 100) return `${trim(m, 1)} m`;
  return `${Math.round(m).toLocaleString()} m`;
}

export function fmtMass(kg: number): string {
  if (kg < 0.01) return `${trim(kg * 1000, 1)} g`;
  if (kg < 1) return `${Math.round(kg * 1000)} g`;
  if (kg < 10) return `${trim(kg, 2)} kg`;
  if (kg < 100) return `${trim(kg, 1)} kg`;
  return `${Math.round(kg).toLocaleString()} kg`;
}

export function fmtSpeed(ms: number): string {
  return `${trim(ms, ms < 10 ? 1 : 0)} m/s`;
}

export function kmh(ms: number): string {
  return `${Math.round(ms * 3.6)} km/h`;
}

export function fmtTime(s: number): string {
  return `${trim(s, s < 10 ? 2 : 1)} s`;
}

export function fmtDeg(d: number): string {
  return `${Math.round(d)}°`;
}

export function fmtRatio(r: number): string {
  return `${trim(r, 1)} : 1`;
}

export function fmtPct(f: number): string {
  return `${Math.round(f * 100)}%`;
}

function trim(v: number, digits: number): string {
  return String(Number(v.toFixed(digits)));
}

/** Fun real-world comparisons for kids. */
function count(v: number, one: string, many: string) {
  const n = round1(v);
  return `${n} ${n === 1 ? one : many}`;
}

export function distanceCompare(m: number): string {
  if (m >= 100) return `about ${count(m / 100, 'soccer field', 'soccer fields')} long`;
  if (m >= 12) return `about ${count(m / 12, 'school bus', 'school buses')} in a row`;
  if (m >= 4.5) return `about ${count(m / 4.5, 'car', 'cars')} in a row`;
  if (m >= 1.2) return `about ${count(m / 1.2, 'kid', 'kids')} lying head to toe`;
  return `about ${count(m / 0.3, 'ruler', 'rulers')} long`;
}

export function heightCompare(m: number): string {
  if (m >= 90) return `taller than the Statue of Liberty (93 m)`;
  if (m >= 10) return `as high as about ${count(m / 3, 'floor', 'floors')} of a building`;
  if (m >= 5) return `as tall as ${count(m / 5, 'giraffe', 'giraffes')}`;
  if (m >= 1.2) return `as tall as ${count(m / 1.2, 'kid', 'kids')} standing on each other`;
  return `about as high as a table`;
}

export function speedCompare(ms: number): string {
  const k = ms * 3.6;
  if (k >= 250) return 'faster than a race car';
  if (k >= 100) return 'as fast as a car on the highway';
  if (k >= 40) return 'as fast as a car in town';
  if (k >= 20) return 'as fast as a bike going downhill';
  if (k >= 10) return 'as fast as a kid running';
  return 'about walking speed';
}

function round1(v: number) {
  return v >= 10 ? Math.round(v) : Math.round(v * 2) / 2;
}
