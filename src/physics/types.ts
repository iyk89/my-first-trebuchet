export type CounterweightStyle = 'fixed' | 'hinged';
export type Planet = 'earth' | 'moon' | 'mars';

/** Everything you can change about a trebuchet build. All lengths in meters, masses in kg. */
export interface Design {
  // The arm
  armLength: number; // total beam length, tip to tip
  pivotRatio: number; // long side : short side (4 means the long side is 4x the short side)
  armMass: number;
  towerHeight: number; // axle height above the ground
  pullBack: number; // degrees the long arm starts below horizontal (limited by the ground)

  // The counterweight
  cwMass: number;
  cwStyle: CounterweightStyle;
  hangerLength: number; // hinged only: hinge to the center of the weight

  // The sling
  slingLength: number;
  releaseAngle: number; // degrees the release hook is bent; bigger = lets go sooner

  // The projectile
  projectileId: string;
  projectileMass: number;
  projectileDiameter: number;

  // The world
  planet: Planet;
  air: boolean;
  wind: number; // m/s, positive = blowing toward the target
}

export type FailureCode =
  | 'blocked' // no longer produced; kept so old saved data still reads
  | 'weightCrash' // the weight hit the ground before the ball let go
  | 'tooWeak' // the weight can't even lift the arm
  | 'ballTooBig' // the ball is bigger than the machine can hold
  | 'neverReleased' // the ball never let go of the sling
  | 'groundRelease' // let go while still dragging on the ground
  | 'backward'; // landed behind the machine

/** One snapshot of the machine and ball, used to animate the throw. */
export interface Frame {
  t: number;
  theta: number; // arm angle (radians)
  phi: number; // hanger angle (radians), hinged weight only
  psi: number; // sling angle (radians)
  bx: number; // ball position
  by: number;
  released: boolean;
}

export interface EnergyShare {
  ball: number; // fraction of available energy that went into the ball
  arm: number; // still in the arm (spinning + lifted)
  weight: number; // weight still moving
  unused: number; // weight hadn't finished falling yet
  air: number; // lost to air drag during the swing
}

export interface Results {
  distance: number;
  maxHeight: number;
  launchSpeed: number;
  launchAngle: number; // degrees above horizontal
  flightTime: number;
  landingSpeed: number;
  releaseHeight: number;
  releaseTime: number; // seconds from start to release
  efficiency: number; // 0..1, same as energy.ball
  weightCrashed?: boolean; // the weight hit the ground after the ball let go
  energy: EnergyShare;
  apex: { x: number; y: number };
  /** Ball flight path from release to landing, downsampled to ~120 points: [x, y] pairs. */
  path: [number, number][];
}

export interface SimOutput {
  ok: boolean;
  failure?: FailureCode;
  frames: Frame[];
  releaseIndex: number; // first frame after release, or -1
  landIndex: number; // frame where the ball lands, or -1
  crashIndex?: number; // frame where the weight hit the ground, if it did
  launch?: { vx: number; vy: number; tipSpeed: number }; // at release (release-preview runs only)
  results?: Results;
}
