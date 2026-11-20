import { Line } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { fmtMass } from '../data/format';
import { projectileById } from '../data/projectiles';
import type { StepId } from '../data/variables';
import { buildIssues, cwBoxHeight, geometry, pose, startAngles, type Geometry } from '../physics/geometry';
import type { Design } from '../physics/types';
import { useStore } from '../state/store';
import { Label } from './Label';
import { frameAt } from './playback';
import { releasePreview } from './preview';
import { darkWoodTexture, woodTexture } from './textures';

const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpD = new THREE.Vector3();

export function setRod(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  tmpD.subVectors(b, a);
  const len = tmpD.length();
  mesh.position.copy(a).addScaledVector(tmpD, 0.5);
  if (len > 1e-9) mesh.quaternion.setFromUnitVectors(UP, tmpD.divideScalar(len));
  mesh.scale.set(1, Math.max(len, 1e-6), 1);
}

export interface MachineDims {
  L: number;
  t: number; // arm thickness
  post: number; // frame post thickness
  w: number; // half the gap between the two side frames
  footX: number;
  baseHalf: number;
  box: [number, number, number]; // weight box size
}

export function machineDims(g: Geometry): MachineDims {
  const L = g.La + g.Lb;
  const t = Math.max(L * 0.045, 0.006);
  const post = t * 0.85;
  let box: [number, number, number] = [g.cwSize, g.cwSize, g.cwSize];
  const h = cwBoxHeight(g);
  if (h !== g.cwSize) {
    // a short hanger needs a flatter, wider box (same amount of sand)
    const side = Math.sqrt((g.cwSize * g.cwSize * g.cwSize) / h);
    box = [side, h, side];
  }
  const w = Math.max(box[2] / 2 + t * 1.2, t * 1.6);
  const footX = Math.max(g.H * 0.6, t * 3);
  return { L, t, post, w, footX, baseHalf: footX + post * 1.5, box };
}

function useMat(color: string, map?: THREE.Texture, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return useMemo(
    () => new THREE.MeshStandardMaterial({ color, ...(map ? { map } : {}), roughness: 0.8, metalness: 0, ...extra }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [color, map],
  );
}

function useHighlight(mats: THREE.MeshStandardMaterial[], on: boolean) {
  useEffect(() => {
    for (const m of mats) {
      m.emissive.set(on ? '#ff9a3c' : '#000000');
      m.emissiveIntensity = on ? 0.35 : 0;
    }
  }, [mats, on]);
}

/** Tap a part of the machine to jump to its settings. */
function pick(step: StepId) {
  return (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return; // it was a drag, not a tap
    e.stopPropagation();
    useStore.getState().setStep(step);
  };
}

export function Trebuchet({ design }: { design: Design }) {
  const g = useMemo(() => geometry(design), [design]);
  const dims = useMemo(() => machineDims(g), [g]);
  const step = useStore((s) => s.step);
  const mode = useStore((s) => s.mode);
  const building = mode === 'build';
  const projectile = projectileById(design.projectileId);
  const issueGhost = useMemo(() => buildIssues(design).some((i) => i.part === 'weight'), [design]);

  const wood = useMat('#ffffff', woodTexture());
  const frameWood = useMat('#e8d2b0', woodTexture());
  const darkWood = useMat('#ffffff', darkWoodTexture());
  const metal = useMat('#55585e', undefined, { metalness: 0.7, roughness: 0.35 });
  const rope = useMat('#c9a66b', undefined, { roughness: 1 });
  const leather = useMat('#6b4226', undefined, { roughness: 0.9 });
  const ballMat = useMat(projectile.color, undefined, { roughness: 0.5 });
  const hookMat = useMat('#c0c4cc', undefined, { metalness: 0.8, roughness: 0.25 });

  const lit = useStore((s) => s.mode === 'build' || s.panel === 'learn');
  useHighlight([wood], lit && step === 'arm');
  useHighlight([frameWood], lit && step === 'tower');
  useHighlight([darkWood], lit && step === 'weight');
  useHighlight([rope, leather, hookMat], lit && step === 'sling');
  useHighlight([ballMat], lit && step === 'ball');

  const arm = useRef<THREE.Group>(null);
  const hanger = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Mesh>(null);
  const pouch = useRef<THREE.Mesh>(null);
  const cordA = useRef<THREE.Mesh>(null);
  const cordB = useRef<THREE.Mesh>(null);
  const loop = useRef<THREE.Mesh>(null);
  // Angles currently drawn. While building they glide toward their target (the ready pose,
  // or the release moment when you're adjusting the hook) instead of jumping.
  const shown = useRef<{ theta: number; phi: number; psi: number } | null>(null);
  const lastMode = useRef(mode);
  const [settled, setSettled] = useState(false); // reached the release-moment pose
  const focus = useStore((s) => s.focus);
  const preview = useMemo(() => (building && focus === 'hook' ? releasePreview(design) : null), [building, focus, design]);

  const t = dims.t;
  const hookLen = t * 3.2;
  const alpha = (design.releaseAngle * Math.PI) / 180;
  const loopAt = 0.55;

  useFrame((_, delta) => {
    const s = useStore.getState();
    let theta: number, phi: number, psi: number, bx: number, by: number, released: boolean;
    if (s.mode === 'throw' && s.sim && s.sim.frames.length) {
      const f = frameAt(s.sim, s.playTime);
      ({ theta, phi, psi, bx, by, released } = f);
      shown.current = { theta, phi, psi };
    } else {
      const pv = s.focus === 'hook' ? releasePreview(design) : null;
      const target = pv?.ok ? pv : startAngles(g);
      if (!shown.current || lastMode.current !== s.mode) shown.current = { theta: target.theta, phi: target.phi, psi: target.psi };
      const k = 1 - Math.exp(-Math.min(delta, 0.1) * 4);
      const cur = shown.current;
      cur.theta += (target.theta - cur.theta) * k;
      cur.phi += (target.phi - cur.phi) * k;
      cur.psi += (target.psi - cur.psi) * k;
      const near = Math.abs(target.theta - cur.theta) + Math.abs(target.psi - cur.psi) < 0.01;
      if (near) Object.assign(cur, { theta: target.theta, phi: target.phi, psi: target.psi });
      const isSettled = !!pv?.ok && near;
      if (isSettled !== settled) setSettled(isSettled);
      ({ theta, phi, psi } = cur);
      const bp = pose(g, theta, phi, psi).ball;
      bx = bp[0];
      by = Math.max(bp[1], g.r);
      released = false;
    }
    lastMode.current = s.mode;

    if (arm.current) arm.current.rotation.z = theta;
    const p = pose(g, theta, phi, psi);
    if (hanger.current) {
      hanger.current.position.set(p.shortEnd[0], p.shortEnd[1], 0);
      hanger.current.rotation.z = phi + Math.PI / 2;
    }
    if (ball.current) ball.current.position.set(bx, by, 0);
    const end: [number, number] = released ? p.ball : [bx, by];
    if (pouch.current) {
      pouch.current.position.set(end[0], end[1], 0);
      pouch.current.rotation.z = Math.atan2(end[1] - p.tip[1], end[0] - p.tip[0]);
    }
    const half = Math.max(g.r * 0.9, t * 0.3);
    // One cord is tied to the arm tip; the other ends in a loop on the release hook until it slides off.
    const d = hookLen * loopAt;
    tmpA.set(p.tip[0] + d * Math.cos(theta + alpha), p.tip[1] + d * Math.sin(theta + alpha), 0);
    if (cordA.current) {
      cordA.current.visible = !released;
      setRod(cordA.current, tmpA, tmpB.set(end[0], end[1], half));
    }
    if (loop.current) loop.current.visible = !released;
    tmpA.set(p.tip[0], p.tip[1], 0);
    if (cordB.current) setRod(cordB.current, tmpA, tmpB.set(end[0], end[1], -half));
  });

  const loopQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(Z, new THREE.Vector3(Math.cos(alpha), Math.sin(alpha), 0)), [alpha]);

  const { post, w, footX, baseHalf, box } = dims;
  const H = g.H;
  const ropeR = Math.max(t * 0.06, g.r * 0.08, 0.0008);

  // Static frame pieces (two A-frames, base, axle)
  const framePieces = useMemo(() => {
    const pieces: { a: THREE.Vector3; b: THREE.Vector3; r: number }[] = [];
    for (const z of [-(w + post / 2), w + post / 2]) {
      pieces.push({ a: new THREE.Vector3(-footX, post, z), b: new THREE.Vector3(-post * 0.4, H - t * 0.4, z), r: post / 2 });
      pieces.push({ a: new THREE.Vector3(footX, post, z), b: new THREE.Vector3(post * 0.4, H - t * 0.4, z), r: post / 2 });
      pieces.push({ a: new THREE.Vector3(-footX * 0.55, H * 0.45, z), b: new THREE.Vector3(footX * 0.55, H * 0.45, z), r: post * 0.4 });
    }
    return pieces;
  }, [w, post, footX, H, t]);

  const start = useMemo(() => {
    const a = startAngles(g);
    return pose(g, a.theta, a.phi, a.psi);
  }, [g]);
  const troughStart = Math.min(start.tip[0], start.ball[0]) - g.r * 2;
  const troughEnd = Math.max(start.ball[0], post) + g.r * 3;

  return (
    <group>
      {/* Base */}
      <group onClick={pick('tower')}>
        {[-(w + post / 2), w + post / 2].map((z) => (
          <mesh key={z} position={[0, post / 2, z]} material={frameWood} castShadow receiveShadow>
            <boxGeometry args={[baseHalf * 2, post, post]} />
          </mesh>
        ))}
        {[-baseHalf + post / 2, baseHalf - post / 2].map((x) => (
          <mesh key={x} position={[x, post / 2, 0]} material={frameWood} castShadow receiveShadow>
            <boxGeometry args={[post, post * 0.9, (w + post) * 2]} />
          </mesh>
        ))}
        {framePieces.map((p, i) => (
          <mesh key={i} ref={(m) => m && setRod(m, p.a, p.b)} material={frameWood} castShadow receiveShadow>
            <boxGeometry args={[p.r * 2, 1, p.r * 2]} />
          </mesh>
        ))}
        {[-(w + post / 2), w + post / 2].map((z) => (
          <mesh key={`blk${z}`} position={[0, H, z]} material={frameWood} castShadow>
            <boxGeometry args={[t * 1.8, t * 1.4, post * 1.1]} />
          </mesh>
        ))}
        {/* Axle */}
        <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]} material={metal} castShadow>
          <cylinderGeometry args={[t * 0.22, t * 0.22, (w + post * 1.3) * 2, 16]} />
        </mesh>
      </group>

      {/* Trough the ball slides along */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(troughStart + troughEnd) / 2, g.r * 0.25, s * g.r * 1.2]} material={darkWood} receiveShadow>
          <boxGeometry args={[troughEnd - troughStart, g.r * 0.5, Math.max(g.r * 0.3, 0.002)]} />
        </mesh>
      ))}

      {/* Arm (rotates around the axle) */}
      <group ref={arm} position={[0, H, 0]}>
        <mesh position={[(g.La - g.Lb) / 2, 0, 0]} material={wood} castShadow onClick={pick('arm')}>
          <boxGeometry args={[g.La + g.Lb, t, t * 0.8]} />
        </mesh>
        {/* Release hook at the tip */}
        <mesh
          position={[g.La + (Math.cos(alpha) * hookLen) / 2, (Math.sin(alpha) * hookLen) / 2, 0]}
          rotation={[0, 0, alpha - Math.PI / 2]}
          material={hookMat}
          onClick={pick('sling')}
        >
          <cylinderGeometry args={[t * 0.13, t * 0.13, hookLen, 10]} />
        </mesh>
        {/* The sling's loop, hooked over the release hook */}
        <mesh ref={loop} position={[g.La + Math.cos(alpha) * hookLen * loopAt, Math.sin(alpha) * hookLen * loopAt, 0]} quaternion={loopQuat} material={rope}>
          <torusGeometry args={[t * 0.26, t * 0.06, 8, 20]} />
        </mesh>
        {preview && <HookAngle La={g.La} alpha={alpha} hookLen={hookLen} t={t} />}
        {!g.hinged && (
          <mesh position={[-g.Lb, 0, 0]} material={darkWood} castShadow onClick={pick('weight')}>
            <boxGeometry args={box} />
          </mesh>
        )}
      </group>

      {/* Hinged counterweight */}
      {g.hinged && (
        <group ref={hanger} onClick={pick('weight')}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, -(g.Lh - box[1] / 2) / 2, s * t * 0.6]} material={metal} castShadow>
              <cylinderGeometry args={[t * 0.08, t * 0.08, Math.max(g.Lh - box[1] / 2, 1e-4), 6]} />
            </mesh>
          ))}
          <mesh position={[0, -g.Lh, 0]} material={darkWood} castShadow>
            <boxGeometry args={box} />
          </mesh>
          {building && step === 'weight' && (
            <Label position={[0, -g.Lh, box[2] / 2]} className="part-label" text={fmtMass(design.cwMass)} z={10} />
          )}
        </group>
      )}

      {/* Where the weight would hit the ground */}
      {building && issueGhost && (
        <group position={[0, g.H - g.Lb - (g.hinged ? g.Lh : 0), 0]}>
          <mesh>
            <boxGeometry args={box} />
            <meshBasicMaterial color="#ff2d2d" transparent opacity={0.35} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -(g.H - g.Lb - (g.hinged ? g.Lh : 0)) + 0.002 * dims.L, 0]}>
            <ringGeometry args={[box[0] * 0.6, box[0] * 0.8, 32]} />
            <meshBasicMaterial color="#ff2d2d" transparent opacity={0.8} />
          </mesh>
          <Label position={[0, box[1] / 2 + dims.t, box[2] / 2]} className="crash-label" text="💥 Hits the ground here" z={12} />
        </group>
      )}

      {/* Sling */}
      <mesh ref={cordA} material={rope}>
        <cylinderGeometry args={[ropeR, ropeR, 1, 5]} />
      </mesh>
      <mesh ref={cordB} material={rope}>
        <cylinderGeometry args={[ropeR, ropeR, 1, 5]} />
      </mesh>
      <mesh ref={pouch} material={leather} scale={[0.6, 1, 1.25]} onClick={pick('sling')}>
        <sphereGeometry args={[g.r * 1.08, 12, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55]} />
      </mesh>

      {/* While adjusting the hook: the launch direction at the moment the ball lets go */}
      {preview?.ok && settled && <LaunchArrow preview={preview} L={dims.L} r={g.r} />}
      {preview && !preview.ok && (
        <Label position={[startTip(g)[0], startTip(g)[1] + dims.L * 0.15, 0]} className="crash-label" text={PREVIEW_FAIL[preview.failure ?? 'neverReleased'] ?? 'With this bend the ball never lets go!'} z={12} />
      )}

      {/* Ball */}
      <mesh ref={ball} material={ballMat} castShadow onClick={pick('ball')}>
        <sphereGeometry args={[g.r, 24, 16]} />
      </mesh>
    </group>
  );
}

/** A 1.2 m kid, so you can see how big the machine really is. */
export function KidForScale({ design }: { design: Design }) {
  const g = useMemo(() => geometry(design), [design]);
  const dims = machineDims(g);
  const x = -dims.baseHalf - 0.4 - 0.3 * dims.L;
  const z = -(dims.w + 0.5 + 0.2 * dims.L);
  const shirt = useMat('#3d7be0');
  const pants = useMat('#2b2f45');
  const skin = useMat('#f1c6a0');
  const hair = useMat('#3b2a1e');
  const zoomed = useStore((s) => s.mode === 'build' && s.focus === 'hook');
  if (dims.L < 0.6 || zoomed) return null; // tiny builds, or zoomed on the hook: the kid would just be in the way
  return (
    <group position={[x, 0, z]}>
      {[-0.07, 0.07].map((dz) => (
        <mesh key={dz} position={[0, 0.27, dz]} material={pants} castShadow>
          <capsuleGeometry args={[0.055, 0.42, 4, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 0.72, 0]} material={shirt} castShadow>
        <capsuleGeometry args={[0.13, 0.28, 4, 12]} />
      </mesh>
      {[-0.17, 0.17].map((dz) => (
        <mesh key={dz} position={[0, 0.72, dz]} rotation={[dz > 0 ? -0.25 : 0.25, 0, 0]} material={shirt} castShadow>
          <capsuleGeometry args={[0.04, 0.3, 4, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 1.04, 0]} material={skin} castShadow>
        <sphereGeometry args={[0.11, 20, 16]} />
      </mesh>
      <mesh position={[0.0, 1.08, 0]} material={hair} castShadow>
        <sphereGeometry args={[0.112, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
      </mesh>
      <Label position={[0, 1.3, 0]} className="scale-label" text="Kid · 1.2 m" z={5} />
    </group>
  );
}

const PREVIEW_FAIL: Partial<Record<string, string>> = {
  neverReleased: 'With this bend the ball never lets go! Bend it more.',
  groundRelease: 'With this bend it lets go before the ball leaves the ground! Bend it less.',
  weightCrash: 'The weight crashes first. Fix the warning to see the release.',
  tooWeak: "The weight can't lift the arm yet. Fix that first.",
  ballTooBig: 'The ball is too big for this machine.',
};

function startTip(g: Geometry): [number, number] {
  const a = startAngles(g);
  return pose(g, a.theta, a.phi, a.psi).tip;
}

/** The hook's bend drawn as an angle: a dashed line straight out from the arm, an arc, and the degrees. */
function HookAngle({ La, alpha, hookLen, t }: { La: number; alpha: number; hookLen: number; t: number }) {
  const R = hookLen * 1.9;
  const arc = useMemo(() => {
    const pts: [number, number, number][] = [];
    const n = Math.max(2, Math.ceil(Math.abs(alpha) / 0.05));
    for (let i = 0; i <= n; i++) {
      const a = (alpha * i) / n;
      pts.push([La + Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75, t * 0.6]);
    }
    return pts;
  }, [La, alpha, R, t]);
  const deg = Math.round((alpha * 180) / Math.PI);
  return (
    <group>
      <Line points={[[La, 0, t * 0.6], [La + R, 0, t * 0.6]]} color="#ffffff" lineWidth={2} dashed dashSize={R * 0.08} gapSize={R * 0.06} />
      <Line points={[[La, 0, t * 0.6], [La + Math.cos(alpha) * R, Math.sin(alpha) * R, t * 0.6]]} color="#ffd23f" lineWidth={2.5} />
      {arc.length > 1 && <Line points={arc} color="#ffd23f" lineWidth={3} />}
      <Label position={[La + Math.cos(alpha / 2) * R * 1.05, Math.sin(alpha / 2) * R * 1.05, t * 0.6]} className="angle-label" text={`${deg}°`} z={13} />
    </group>
  );
}

/** Arrow from the ball showing which way it flies off when it lets go. */
function LaunchArrow({ preview, L, r }: { preview: { bx: number; by: number; vx: number; vy: number; angle: number }; L: number; r: number }) {
  const len = L * 0.35;
  const sp = Math.hypot(preview.vx, preview.vy) || 1;
  const ux = preview.vx / sp;
  const uy = preview.vy / sp;
  const start = new THREE.Vector3(preview.bx + ux * r * 1.3, preview.by + uy * r * 1.3, 0);
  const tipPt = new THREE.Vector3(preview.bx + ux * len, preview.by + uy * len, 0);
  const shaftEnd = new THREE.Vector3(preview.bx + ux * len * 0.82, preview.by + uy * len * 0.82, 0);
  const w = Math.max(L * 0.012, r * 0.35);
  const back = preview.vx < 0;
  const ang = Math.round(preview.angle);
  const text = back ? 'Flies off backward!' : ang >= 0 ? `Flies off at ${ang}° up` : `Flies off ${-ang}° downward!`;
  return (
    <group>
      <mesh ref={(m) => m && setRod(m, start, shaftEnd)}>
        <cylinderGeometry args={[w, w, 1, 10]} />
        <meshBasicMaterial color="#ff7a1a" />
      </mesh>
      <mesh ref={(m) => m && setRod(m, shaftEnd, tipPt)}>
        <cylinderGeometry args={[0, w * 2.6, 1, 14]} />
        <meshBasicMaterial color="#ff7a1a" />
      </mesh>
      <Label position={[tipPt.x + ux * L * 0.06, tipPt.y + uy * L * 0.06 + L * 0.03, 0]} className="launch-label" text={text} z={13} />
      <Label position={[preview.bx, preview.by - r - L * 0.05, 0]} className="handle-hint" text="Lets go here!" z={13} />
    </group>
  );
}
