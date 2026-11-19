export interface Projectile {
  id: string;
  name: string;
  mass: number; // kg
  diameter: number; // m
  color: string;
  note: string;
}

export const PROJECTILES: Projectile[] = [
  { id: 'marble', name: 'Marble', mass: 0.005, diameter: 0.016, color: '#4fa3e0', note: 'Tiny and heavy for its size' },
  { id: 'pingpong', name: 'Ping-pong ball', mass: 0.0027, diameter: 0.04, color: '#f5f5f0', note: 'Super light, air slows it down fast' },
  { id: 'golf', name: 'Golf ball', mass: 0.046, diameter: 0.043, color: '#ffffff', note: 'Same size as ping-pong, 17x heavier' },
  { id: 'tennis', name: 'Tennis ball', mass: 0.058, diameter: 0.067, color: '#d4e157', note: 'Big and light' },
  { id: 'baseball', name: 'Baseball', mass: 0.145, diameter: 0.074, color: '#f3efe6', note: 'Heavy for its size' },
  { id: 'waterballoon', name: 'Water balloon', mass: 0.15, diameter: 0.066, color: '#e5397b', note: 'Splash!' },
  { id: 'softball', name: 'Softball', mass: 0.19, diameter: 0.097, color: '#f2e94e', note: 'Bigger than a baseball' },
  { id: 'pumpkin', name: 'Small pumpkin', mass: 2, diameter: 0.18, color: '#f08a24', note: 'Pumpkin chunkin!' },
  { id: 'watermelon', name: 'Watermelon', mass: 5, diameter: 0.25, color: '#3c8d40', note: 'Big, heavy, messy' },
  { id: 'bowling', name: 'Bowling ball', mass: 6, diameter: 0.216, color: '#2b3a67', note: 'Very heavy' },
  { id: 'boulder', name: 'Castle boulder', mass: 100, diameter: 0.41, color: '#8a8580', note: 'What real castles were hit with' },
  { id: 'custom', name: 'Custom', mass: 0.1, diameter: 0.06, color: '#9c6ade', note: 'Pick your own weight and size' },
];

export function projectileById(id: string): Projectile {
  return PROJECTILES.find((p) => p.id === id) ?? PROJECTILES[PROJECTILES.length - 1];
}
